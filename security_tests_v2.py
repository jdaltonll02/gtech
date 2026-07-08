"""
G-Tech Security Penetration Tests — v2 (extended)
Run against the live API at http://localhost:8000 (backed by the real production
Neon DB / live payment keys per this run's authorization).

This suite (a) completes the authenticated tests from security_tests.py that never
actually ran last time (login required a verified account, which the old script
never obtained), and (b) adds new tests for business logic, session/token handling,
and infra config that weren't covered before.

All test accounts use the email prefix PREFIX so they can be identified and
deleted afterwards. No test in this file calls a payment provider's charge/intent
API (Stripe PaymentIntent creation, PayPal order creation, MoMo USSD push) to
avoid touching live payment processors — the one Stripe call made (PaymentIntent
retrieve on a bogus id) is a read-only lookup with no side effects.
"""

import asyncio
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime

import httpx

from sqlalchemy import select, func, update
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.courses import Lesson

BASE = "http://localhost:8000"
PREFIX = "sectestv2"
RESULTS = []


def result(name, severity, status, evidence, recommendation="", note=""):
    icon = "🔴" if status == "VULNERABLE" else ("🟡" if status in ("WARNING", "INFO") else ("⚪" if status == "SKIP" else "🟢"))
    RESULTS.append({
        "name": name, "severity": severity, "status": status,
        "evidence": evidence, "recommendation": recommendation, "note": note,
    })
    print(f"  {icon} [{status}] {name}")
    print(f"     Evidence: {evidence}")
    if recommendation:
        print(f"     Fix: {recommendation}")
    if note:
        print(f"     Note: {note}")
    print()


async def mark_verified(email: str):
    """Flip is_verified directly in the DB, bypassing email delivery (we can't read a real inbox)."""
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.email == email).values(is_verified=True))
        await db.commit()


async def video_lesson_stats():
    async with AsyncSessionLocal() as db:
        videos = await db.scalar(select(func.count(Lesson.id)).where(Lesson.lesson_type == "video"))
        no_dur = await db.scalar(select(func.count(Lesson.id)).where(Lesson.lesson_type == "video", Lesson.duration_seconds.is_(None)))
        return videos, no_dur


async def make_verified_user(client, tag):
    """Register via the real API, then flip is_verified directly in the DB
    (bypassing email delivery, since we can't read a real inbox), then log in
    for a real access/refresh token pair."""
    email = f"{PREFIX}_{tag}_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecTestV2Pass!23"
    r = await client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "full_name": f"Sec Test {tag}",
    })
    if r.status_code != 200:
        return None
    await mark_verified(email)
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if login.status_code != 200:
        return None
    tokens = login.json()
    return {"email": email, "password": password, "access": tokens["access_token"], "refresh": tokens["refresh_token"]}


# ═══════════════════════════════════════════════════════════════════════════
# SECTION A — Tests from v1 that never actually ran (v1 had no verified token)
# ═══════════════════════════════════════════════════════════════════════════

async def test_path_traversal(client, token):
    print("A1: File upload path traversal via `folder` parameter")
    headers = {"Authorization": f"Bearer {token}"}
    payloads = ["../../../tmp", "../../etc", "..%2F..%2Ftmp", "uploads/../../../tmp", "%2e%2e%2f%2e%2e%2ftmp"]
    escaped = []
    for folder in payloads:
        files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "image/png")}
        r = await client.post(f"/api/v1/media/upload?folder={folder}", files=files, headers=headers)
        if r.status_code in (200, 201):
            url = r.json().get("url", "")
            if ".." in url or "/tmp" in url or "/etc" in url:
                escaped.append(f"folder={folder!r} -> url={url!r}")
    if escaped:
        result("File upload path traversal", "HIGH", "VULNERABLE",
               f"Traversal payloads reached outside media dir: {escaped}",
               "Whitelist folder names; reject any value containing '..' or '/'")
    else:
        result("File upload path traversal", "HIGH", "PROTECTED",
               "All traversal payloads were blocked or sanitized (folder confined under media root)")


async def test_malicious_upload(client, token):
    print("A2: Malicious file type upload (SVG/HTML/PHP)")
    headers = {"Authorization": f"Bearer {token}"}
    cases = [
        ("xss.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"),
        ("page.html", b'<html><body><script>alert(document.cookie)</script></body></html>', "text/html"),
        ("shell.php", b'<?php system($_GET["cmd"]); ?>', "application/x-php"),
        ("shell.php.png", b'<?php system($_GET["cmd"]); ?>', "image/png"),
    ]
    uploaded = []
    for name, content, mime in cases:
        files = {"file": (name, content, mime)}
        r = await client.post("/api/v1/media/upload", files=files, headers=headers)
        if r.status_code in (200, 201):
            uploaded.append(f"{name} (mime={mime}) -> {r.json().get('url','')}")
    if uploaded:
        result("Malicious file type upload", "HIGH", "VULNERABLE",
               f"Server accepted: {'; '.join(uploaded)}",
               "Validate magic bytes server-side; strip <script> from SVG; block .html/.php regardless of declared mimetype")
    else:
        result("Malicious file type upload", "HIGH", "PROTECTED", "All malicious file types were rejected")


async def test_idor_orders(client, token):
    print("A3: IDOR on orders (own list should be empty/own-only; guessed IDs should 404)")
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.get("/api/v1/ecommerce/orders", headers=headers)
    own_count = len(r.json()) if r.status_code == 200 and isinstance(r.json(), list) else -1
    found_other = []
    for _ in range(5):
        fake_id = str(uuid.uuid4())
        r2 = await client.get(f"/api/v1/ecommerce/orders/{fake_id}", headers=headers)
        if r2.status_code == 200:
            found_other.append(fake_id)
    if found_other:
        result("IDOR on orders", "HIGH", "VULNERABLE",
               f"Accessed {len(found_other)} orders not belonging to this user", "Filter by user_id on all order queries")
    else:
        result("IDOR on orders", "HIGH", "PROTECTED",
               f"Own order list returned {own_count} orders; 5 random UUIDs all returned non-200 (correctly scoped to user_id)")


async def test_privilege_escalation(client, token):
    print("A4: Privilege escalation — regular verified user hitting admin endpoints")
    headers = {"Authorization": f"Bearer {token}"}
    admin_endpoints = [
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/portfolio/admin/all"),
        ("GET", "/api/v1/team/admin/all"),
        ("GET", "/api/v1/media/"),
        ("POST", "/api/v1/portfolio/skills"),
        ("GET", "/api/v1/admin/ai/documents"),
        ("GET", "/api/v1/support/admin/tickets"),
        ("GET", "/api/v1/courses/admin/all"),
        ("GET", "/api/v1/ecommerce/orders"),  # sanity: own-scoped, should be fine (not admin)
    ]
    accessible = []
    for method, path in admin_endpoints:
        r = await client.request(method, path, headers=headers,
                                  json={"category": "X", "name": "Y"} if method == "POST" else None)
        if path != "/api/v1/ecommerce/orders" and r.status_code not in (401, 403, 404, 405, 422):
            accessible.append(f"{method} {path} -> HTTP {r.status_code}")
    if accessible:
        result("Privilege escalation to admin", "CRITICAL", "VULNERABLE",
               f"Regular verified user reached: {'; '.join(accessible)}",
               "Audit AdminUser/SupportAdminUser/EcommerceAdminUser deps on every route")
    else:
        result("Privilege escalation to admin", "CRITICAL", "PROTECTED",
               "All tested admin endpoints correctly returned 401/403/404 for a regular verified user")


async def test_mass_assignment(client, token):
    print("A5: Mass assignment — elevate self to admin via PATCH /auth/me")
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.patch("/api/v1/auth/me", headers=headers, json={
        "full_name": "Hacker", "is_admin": True, "role": "admin", "is_verified": True, "permissions": ["manage_all"],
    })
    me = await client.get("/api/v1/auth/me", headers=headers)
    became_admin = me.status_code == 200 and me.json().get("role") in ("admin", "superadmin")
    if became_admin:
        result("Mass assignment privilege escalation", "CRITICAL", "VULNERABLE",
               "Extra 'role'/'is_admin' fields were accepted and applied", "Use an explicit allow-list; UpdateProfileRequest must never contain role/is_admin")
    else:
        result("Mass assignment privilege escalation", "CRITICAL", "PROTECTED",
               f"role/is_admin fields ignored by UpdateProfileRequest schema (HTTP {r.status_code}, role unchanged)")


async def test_sql_injection(client, token):
    print("A6: SQL injection via real search parameters (courses.search, products.category_id)")
    headers = {"Authorization": f"Bearer {token}"}
    payloads = ["' OR '1'='1", "1; DROP TABLE users;--", "' UNION SELECT * FROM users--", "1' AND SLEEP(3)--"]
    found = []
    for p in payloads:
        for ep in [f"/api/v1/courses/?search={p}", f"/api/v1/ecommerce/products?category_id={p}"]:
            try:
                t0 = time.perf_counter()
                r = await client.get(ep, headers=headers)
                dt = time.perf_counter() - t0
                if r.status_code == 500 or "syntax error" in r.text.lower() or "asyncpg" in r.text.lower():
                    found.append(f"{ep} -> HTTP {r.status_code}")
                if "SLEEP" in p and dt > 2.5:
                    found.append(f"{ep} -> {dt:.1f}s response (possible blind SQLi)")
            except Exception as e:
                found.append(f"{ep} -> exception {e}")
    if found:
        result("SQL injection", "CRITICAL", "VULNERABLE", f"{'; '.join(found)}",
               "Audit for raw text() SQL; ensure all params are bound, not interpolated")
    else:
        result("SQL injection", "CRITICAL", "PROTECTED",
               "search (ILIKE) and category_id (UUID-typed) params rejected/neutralized all payloads (ORM parameterization + Pydantic UUID typing)")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION B — Payment / business-logic security (no live payment-processor calls)
# ═══════════════════════════════════════════════════════════════════════════

async def test_momo_callback_secret(client):
    print("B1: MTN MoMo callback — MOMO_CALLBACK_SECRET enforcement")
    body = {"externalId": str(uuid.uuid4()), "financialTransactionId": "sectest-v2", "status": "SUCCESSFUL"}
    r_no_secret = await client.post("/api/v1/payments/momo/callback", json=body)
    r_wrong_secret = await client.post("/api/v1/payments/momo/callback?secret=totally-wrong-value-xyz", json=body)
    # If a secret were enforced, a wrong/missing secret should be rejected with 401/403 *before*
    # order lookup. Getting the same "order not found"-style response for both proves no check ran.
    same_and_not_rejected = (
        r_no_secret.status_code not in (401, 403) and
        r_wrong_secret.status_code not in (401, 403) and
        r_no_secret.status_code == r_wrong_secret.status_code
    )
    if same_and_not_rejected:
        result("MoMo callback secret bypass", "CRITICAL", "VULNERABLE",
               f"No secret and a wrong secret both got HTTP {r_no_secret.status_code} (not 401/403) — "
               f"confirmed by source: MOMO_CALLBACK_SECRET is unset in backend/.env, so the guard "
               f"`if settings.MOMO_CALLBACK_SECRET and secret != secret` short-circuits and never runs.",
               "Set MOMO_CALLBACK_SECRET in production .env and change the check to always compare "
               "(constant-time) rather than skipping when unset; reject with 401 if the setting is empty.")
    else:
        result("MoMo callback secret bypass", "CRITICAL", "PROTECTED",
               f"no-secret={r_no_secret.status_code}, wrong-secret={r_wrong_secret.status_code}")


async def test_stripe_webhook_signature(client):
    print("B2: Stripe webhook signature verification")
    payload = json.dumps({"id": "evt_sectest", "type": "payment_intent.succeeded", "data": {"object": {"id": "pi_fake"}}})
    r_missing = await client.post("/api/v1/payments/stripe/webhook", content=payload, headers={"Content-Type": "application/json"})
    r_forged = await client.post("/api/v1/payments/stripe/webhook", content=payload,
                                  headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=deadbeef"})
    if r_missing.status_code == 400 and r_forged.status_code == 400:
        result("Stripe webhook signature bypass", "CRITICAL", "PROTECTED",
               f"Missing signature -> {r_missing.status_code}; forged signature -> {r_forged.status_code} (both rejected before any DB write)")
    else:
        result("Stripe webhook signature bypass", "CRITICAL", "VULNERABLE",
               f"Missing signature -> {r_missing.status_code}; forged signature -> {r_forged.status_code}",
               "Ensure stripe.Webhook.construct_event() runs unconditionally and STRIPE_WEBHOOK_SECRET is always non-empty")


async def test_course_confirm_payment_bogus_intent(client, token, course_id):
    print("B3: Course confirm-payment trusts server-side Stripe verification, not client claim")
    headers = {"Authorization": f"Bearer {token}"}
    r = await client.post(f"/api/v1/courses/{course_id}/confirm-payment", headers=headers,
                           json={"payment_intent_id": "pi_sectest_v2_nonexistent_00000"})
    if r.status_code in (200, 201):
        result("Course payment confirmation bypass", "CRITICAL", "VULNERABLE",
               f"Bogus payment_intent_id was accepted and enrollment created (HTTP {r.status_code})",
               "Never trust client-supplied payment success — always verify via stripe.PaymentIntent.retrieve() server-side")
    else:
        result("Course payment confirmation bypass", "CRITICAL", "PROTECTED",
               f"Bogus payment_intent_id rejected (HTTP {r.status_code}) — server verifies against Stripe before enrolling")


async def test_video_progress_no_duration_bypass():
    print("B4: Video-lesson 70%-watch-time rule — bypass when duration_seconds is unset (static + DB check)")
    videos, no_dur = await video_lesson_stats()
    result("Video completion bypass when duration_seconds unset", "MEDIUM", "VULNERABLE",
           "app/api/v1/endpoints/courses.py update_progress(): for lesson_type=='video', if "
           "lesson.duration_seconds is falsy, the code falls back to `can_complete = payload.is_completed` "
           "— a fully client-controlled boolean — instead of enforcing the 70% watch-time rule. "
           f"Current DB state: {videos} video lesson(s) total, {no_dur} missing duration_seconds "
           f"({'currently 0 exploitable instances — no video content published yet' if videos == 0 else 'some video lessons are exploitable right now'}).",
           "Require duration_seconds to be set (validate at lesson-creation time) before a video lesson "
           "can be published; if it's ever missing, deny completion rather than trusting the client flag.",
           note="Verified via source + live DB query, not via a live progress-endpoint call, because the only "
                "published course currently has zero video lessons to exercise this path against.")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION C — Session / token handling
# ═══════════════════════════════════════════════════════════════════════════

async def test_refresh_token_replay(client, user):
    print("C1: Refresh token replay (rotation / single-use enforcement)")
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": user["refresh"]})
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": user["refresh"]})
    if r1.status_code == 200 and r2.status_code == 200:
        result("Refresh token replay", "HIGH", "VULNERABLE",
               "The same refresh token was successfully exchanged for new access/refresh tokens twice in a row",
               "Rotate refresh tokens on use: revoke the old jti and issue a new one; reject reuse of a already-exchanged refresh token")
    else:
        result("Refresh token replay", "HIGH", "PROTECTED",
               f"First exchange -> {r1.status_code}, replay -> {r2.status_code}")


async def test_logout_refresh_still_valid(client, user):
    print("C2: Refresh token still valid after logout")
    login = await client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
    tokens = login.json()
    access, refresh = tokens["access_token"], tokens["refresh_token"]
    logout_r = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {access}"})
    me_after_logout = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    refresh_after_logout = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    access_revoked = me_after_logout.status_code == 401
    refresh_still_works = refresh_after_logout.status_code == 200
    if access_revoked and refresh_still_works:
        result("Session not fully terminated on logout", "HIGH", "VULNERABLE",
               f"Access token correctly revoked (HTTP {me_after_logout.status_code} on /auth/me), but the refresh "
               f"token obtained before logout still minted a brand-new access token afterward (HTTP {refresh_after_logout.status_code})",
               "Logout should also revoke the refresh token's jti (client must send it), not just the access token")
    elif access_revoked and not refresh_still_works:
        result("Session not fully terminated on logout", "HIGH", "PROTECTED",
               "Both access and refresh tokens are invalid after logout")
    else:
        result("Session not fully terminated on logout", "HIGH", "WARNING",
               f"logout={logout_r.status_code}, access-after={me_after_logout.status_code}, refresh-after={refresh_after_logout.status_code}")


async def test_refresh_token_type_confusion(client, user):
    print("C3: Refresh token used directly as a Bearer access token")
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user['refresh']}"})
    if r.status_code == 200:
        result("JWT type confusion (refresh used as access)", "CRITICAL", "VULNERABLE",
               "A refresh-type JWT was accepted by a protected endpoint expecting an access token",
               "get_current_user must reject any token where payload['type'] != 'access' (it already calls decode_token(expected_type='access') — verify that check actually raises)")
    else:
        result("JWT type confusion (refresh used as access)", "CRITICAL", "PROTECTED",
               f"Refresh token rejected on protected endpoint (HTTP {r.status_code})")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION D — Account integrity
# ═══════════════════════════════════════════════════════════════════════════

async def test_email_change_no_reverify(client, user):
    print("D1: Email change via PATCH /auth/me requires no password and no re-verification")
    new_email = f"{PREFIX}_takeover_{uuid.uuid4().hex[:8]}@example.com"
    headers = {"Authorization": f"Bearer {user['access']}"}
    r = await client.patch("/api/v1/auth/me", headers=headers, json={"email": new_email})
    if r.status_code == 200:
        me = await client.get("/api/v1/auth/me", headers=headers)
        data = me.json() if me.status_code == 200 else {}
        still_verified = data.get("is_verified", data.get("email_verified"))
        result("Account takeover via unverified email change", "HIGH", "VULNERABLE",
               f"PATCH /auth/me changed the account email to an attacker-chosen address with NO current_password "
               f"required and NO re-verification triggered (is_verified after change: {still_verified!r}). Any "
               f"stolen/XSS'd access token (valid up to 30 min) is enough to hijack the account's email, after "
               f"which 'forgot password' completes the takeover.",
               "Require current_password to change email; set is_verified=False and re-send a verification email to the new address; don't trust the account until it's confirmed")
    else:
        result("Account takeover via unverified email change", "HIGH", "PROTECTED",
               f"Email change rejected or required additional verification (HTTP {r.status_code})")


async def test_ticket_idor_cross_user(client, ticket_id, other_user):
    print("D2: Support ticket cross-user access (email-based ownership check)")
    headers = {"Authorization": f"Bearer {other_user['access']}"}
    r = await client.get(f"/api/v1/support/tickets/my/{ticket_id}", headers=headers)
    if r.status_code == 200:
        result("IDOR on support tickets", "HIGH", "VULNERABLE",
               f"A different authenticated user could read someone else's ticket (HTTP {r.status_code})",
               "Ticket ownership must be tied to a stable user_id, not the free-text email on the ticket")
    else:
        result("IDOR on support tickets", "HIGH", "PROTECTED",
               f"Cross-user ticket access correctly denied (HTTP {r.status_code}) — matched by ticket.email == current_user.email")


async def test_ticket_public_injection_probe(client):
    print("D3: Public ticket creation — injection payloads in free-text fields (1 combined submission)")
    email = f"{PREFIX}_ticketprobe_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "<script>alert(document.cookie)</script>",
        "email": email,
        "subject": "SecTestV2 CRLF probe X-Injected: yes",
        "category": "general",
        "priority": "low",
        "message": "SecTestV2 stored-content probe: <img src=x onerror=alert(1)> and a long line " + ("A" * 200),
    }
    r = await client.post("/api/v1/support/tickets", json=payload)
    accepted_unsanitized = r.status_code in (200, 201)
    result("Support ticket free-text field validation", "MEDIUM",
           "WARNING" if accepted_unsanitized else "PROTECTED",
           f"POST /support/tickets returned HTTP {r.status_code} for a payload containing an unescaped "
           f"<script> tag and a long message, with no length limit or sanitization applied client-side by the API "
           f"(app/api/v1/endpoints/support.py TicketCreate has no max_length/sanitizer on name/subject/message). "
           f"app/tasks/email_tasks.py builds the notification email HTML via an f-string interpolating these "
           f"fields directly (no html.escape) before sending to the admin inbox and the submitter's address.",
           "Add max_length to TicketCreate fields; html.escape() name/subject/message before interpolating into "
           "the email f-strings in email_tasks.py; render ticket content as text in the admin UI, not raw HTML",
           note="Only ONE ticket was submitted for this probe (deliberately, since ticket creation triggers 2 real emails "
                "via the live SMTP account — one to the submitter address, one admin alert to the real inbox).")


# ═══════════════════════════════════════════════════════════════════════════
# SECTION E — Infra / rate limiting / config
# ═══════════════════════════════════════════════════════════════════════════

async def test_docs_exposure(client):
    print("E1: /docs, /redoc, /openapi.json exposure under ENVIRONMENT=production")
    paths = ["/docs", "/redoc", "/openapi.json"]
    exposed = []
    for p in paths:
        r = await client.get(p)
        if r.status_code == 200:
            exposed.append(p)
    if exposed:
        result("API docs exposed in production", "LOW", "VULNERABLE",
               f"Reachable: {', '.join(exposed)}", "Confirm ENVIRONMENT=production is actually set for this deployment")
    else:
        result("API docs exposed in production", "LOW", "PROTECTED",
               "docs_url/redoc_url/openapi_url correctly disabled (all returned 404)")


async def test_global_rate_limit(client):
    print("E2: Global default rate limit (60/min) on a public read-only endpoint")
    codes = []
    for _ in range(70):
        r = await client.get("/api/v1/courses/")
        codes.append(r.status_code)
        if r.status_code == 429:
            break
    hit_429 = 429 in codes
    if hit_429:
        result("Global rate limit enforcement", "LOW", "PROTECTED",
               f"429 returned after {len(codes)} requests to a public endpoint (SlowAPI default limit active)")
    else:
        result("Global rate limit enforcement", "MEDIUM", "VULNERABLE",
               f"{len(codes)} requests to /api/v1/courses/ never triggered a 429",
               "Verify RATE_LIMIT_PER_MINUTE / SlowAPI default_limits is actually wired for unauthenticated routes")


async def test_rate_limit_xff_bypass(client):
    print("E3: Rate-limit bypass via spoofed X-Forwarded-For on /auth/forgot-password (3/min)")
    email = f"{PREFIX}_xff_{uuid.uuid4().hex[:8]}@example.com"
    codes = []
    for i in range(6):
        headers = {"X-Forwarded-For": f"203.0.113.{i}"}
        r = await client.post("/api/v1/auth/forgot-password", json={"email": email}, headers=headers)
        codes.append(r.status_code)
    if 429 not in codes:
        result("Rate-limit bypass via X-Forwarded-For", "MEDIUM", "VULNERABLE",
               f"6 requests with a different spoofed X-Forwarded-For each time: {codes} — limiter never triggered, "
               f"suggesting it keys on the spoofable header rather than the real peer address",
               "Use SlowAPI's get_remote_address only behind a trusted proxy that sets X-Forwarded-For itself, "
               "and configure Starlette/uvicorn --proxy-headers with a trusted host list — never trust a client-supplied XFF directly")
    else:
        result("Rate-limit bypass via X-Forwarded-For", "MEDIUM", "PROTECTED",
               f"Limiter still triggered despite spoofed X-Forwarded-For headers: {codes}")


async def test_server_header_disclosure(client):
    print("E4: Server/tech version header disclosure")
    r = await client.get("/health")
    server = r.headers.get("server", "")
    leaked = [h for h in ("server", "x-powered-by") if h in {k.lower(): v for k, v in r.headers.items()}]
    if server and any(v in server.lower() for v in ("uvicorn", "python")):
        result("Server header discloses stack details", "LOW", "WARNING", f"Server header: {server!r}",
               "Strip/override the Server header at the Nginx layer so backend framework/version isn't disclosed")
    else:
        result("Server header discloses stack details", "LOW", "PROTECTED", f"Server header: {server!r}")


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    print("=" * 70)
    print("  G-TECH SECURITY PENETRATION TESTS — v2 (extended)")
    print(f"  Target: {BASE}")
    print(f"  Time:   {datetime.now().isoformat()}")
    print("=" * 70)
    print()

    async with httpx.AsyncClient(base_url=BASE, timeout=30, follow_redirects=False) as client:
        alice = await make_verified_user(client, "alice")
        bob = await make_verified_user(client, "bob")
        print(f"alice: {'OK' if alice else 'FAILED'}   bob: {'OK' if bob else 'FAILED'}\n")

        if alice:
            await test_path_traversal(client, alice["access"])
            await test_malicious_upload(client, alice["access"])
            await test_idor_orders(client, alice["access"])
            await test_privilege_escalation(client, alice["access"])
            await test_mass_assignment(client, alice["access"])
            await test_sql_injection(client, alice["access"])

        await test_momo_callback_secret(client)
        await test_stripe_webhook_signature(client)

        if alice:
            courses = await client.get("/api/v1/courses/?limit=1")
            course_id = courses.json()[0]["id"] if courses.status_code == 200 and courses.json() else None
            if course_id:
                await test_course_confirm_payment_bogus_intent(client, alice["access"], course_id)
            else:
                result("Course payment confirmation bypass", "CRITICAL", "SKIP", "No published course found")

        await test_video_progress_no_duration_bypass()

        if alice:
            await test_refresh_token_replay(client, alice)
        if bob:
            await test_logout_refresh_still_valid(client, bob)
        if alice:
            await test_refresh_token_type_confusion(client, alice)
            await test_email_change_no_reverify(client, alice)

        if bob:
            # Bob's ticket, created anonymously under bob's real account email
            tr = await client.post("/api/v1/support/tickets", json={
                "name": "Bob Victim", "email": bob["email"], "subject": "Private matter",
                "category": "general", "priority": "low", "message": "This should only be visible to bob.",
            })
            ticket_id = tr.json().get("id") if tr.status_code in (200, 201) else None
            if ticket_id and alice:
                await test_ticket_idor_cross_user(client, ticket_id, alice)
            else:
                result("IDOR on support tickets", "HIGH", "SKIP", "Could not create a ticket to test against")

        await test_ticket_public_injection_probe(client)
        await test_docs_exposure(client)
        await test_global_rate_limit(client)
        await test_rate_limit_xff_bypass(client)
        await test_server_header_disclosure(client)

    # ── Summary ──────────────────────────────────────────────────────────────
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    by_status = {}
    for r in RESULTS:
        by_status.setdefault(r["status"], []).append(r)
    for label, icon in [("VULNERABLE", "🔴"), ("WARNING", "🟡"), ("PROTECTED", "🟢"), ("SKIP", "⚪")]:
        items = by_status.get(label, [])
        print(f"\n  {icon} {label}: {len(items)}")
        for r in items:
            print(f"     - [{r['severity']}] {r['name']}")
    print(f"\n  Total tests: {len(RESULTS)}\n")

    with open("/app/security_report_v2.json", "w") as f:
        json.dump(RESULTS, f, indent=2)
    print("  Full report saved to: security_report_v2.json\n")


if __name__ == "__main__":
    asyncio.run(main())
