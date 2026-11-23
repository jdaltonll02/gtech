"""
G-Tech Security Penetration Tests
Run against the live API at http://localhost:8000
Tests each vulnerability category and records PASS/FAIL with evidence.
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from datetime import datetime

import httpx

BASE = "http://localhost:8000"
RESULTS = []

# ── helpers ───────────────────────────────────────────────────────────────────

def result(name, severity, status, evidence, recommendation=""):
    icon = "🔴" if status == "VULNERABLE" else ("🟡" if status == "WARNING" else "🟢")
    RESULTS.append({
        "name": name,
        "severity": severity,
        "status": status,
        "evidence": evidence,
        "recommendation": recommendation,
    })
    print(f"  {icon} [{status}] {name}")
    print(f"     Evidence: {evidence}")
    if recommendation:
        print(f"     Fix: {recommendation}")
    print()

async def register_test_user(client, email=None, password="Test1234!"):
    email = email or f"sectest_{uuid.uuid4().hex[:8]}@example.com"
    r = await client.post("/api/v1/auth/register", json={
        "email": email, "password": password,
        "full_name": "Security Test",
    })
    return email, password, r

async def get_token(client, email, password):
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None

# ── TEST 1: Brute-force login — no rate limiting ───────────────────────────────

async def test_brute_force_login(client):
    print("TEST 1: Brute-force / Rate Limiting on Login")
    email = f"brutetest_{uuid.uuid4().hex[:6]}@example.com"
    await client.post("/api/v1/auth/register", json={
        "email": email, "password": "RealPass123!", "full_name": "Brute Test"
    })

    blocked = False
    attempts = 0
    for i in range(20):
        r = await client.post("/api/v1/auth/login", json={
            "email": email, "password": f"WrongPass{i}!"
        })
        attempts += 1
        if r.status_code == 429:
            blocked = True
            break

    if blocked:
        result("Brute-force login protection", "HIGH",
               "PROTECTED", f"Blocked after {attempts} attempts (HTTP 429)")
    else:
        result("Brute-force login protection", "HIGH",
               "VULNERABLE", f"Sent {attempts} wrong password attempts — never blocked, never throttled",
               "Add rate limiting: 5 failed attempts per email per 15 min → lock")

# ── TEST 2: Brute-force 2FA OTP ───────────────────────────────────────────────

async def test_2fa_bruteforce(client):
    print("TEST 2: Brute-force 2FA OTP")
    # Get a known user_id by registering
    email = f"twofa_{uuid.uuid4().hex[:6]}@example.com"
    r = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "TwoFA123!", "full_name": "2FA Test"
    })
    if r.status_code not in (200, 201):
        result("2FA brute-force protection", "HIGH", "SKIP", "Could not register test user")
        return

    # Attempt many guesses against a realistic user_id (any uuid)
    test_user_id = str(uuid.uuid4())
    blocked = False
    attempts = 0
    for code in ["000000", "111111", "123456", "999999", "000001", "000002",
                 "000003", "000004", "000005", "000006", "000007", "000008"]:
        r = await client.post("/api/v1/auth/2fa/verify", json={
            "user_id": test_user_id, "code": code
        })
        attempts += 1
        if r.status_code == 429:
            blocked = True
            break

    if blocked:
        result("2FA brute-force protection", "HIGH",
               "PROTECTED", f"Blocked after {attempts} attempts (HTTP 429)")
    else:
        result("2FA brute-force protection", "HIGH",
               "VULNERABLE", f"{attempts} OTP guesses accepted without throttle (all returned non-429)",
               "Rate-limit /2fa/verify to 5 attempts per user_id per 15 min, then invalidate the code")

# ── TEST 3: Forgot-password rate limiting / user enumeration ──────────────────

async def test_forgot_password_enum(client):
    print("TEST 3: Forgot-password rate limiting & user enumeration")
    # Timing attack: does the endpoint respond faster for non-existent vs. existing email?
    email_exists = f"timing_{uuid.uuid4().hex[:6]}@example.com"
    await client.post("/api/v1/auth/register", json={
        "email": email_exists, "password": "Timing123!", "full_name": "Timing Test"
    })

    times_exist, times_ghost = [], []
    for _ in range(5):
        t0 = time.perf_counter()
        await client.post("/api/v1/auth/forgot-password", json={"email": email_exists})
        times_exist.append(time.perf_counter() - t0)

        t0 = time.perf_counter()
        await client.post("/api/v1/auth/forgot-password", json={"email": f"ghost_{uuid.uuid4().hex[:6]}@nowhere.com"})
        times_ghost.append(time.perf_counter() - t0)

    avg_exist = sum(times_exist) / len(times_exist)
    avg_ghost = sum(times_ghost) / len(times_ghost)
    diff_ms = abs(avg_exist - avg_ghost) * 1000

    # Also test rate limiting
    blocked = False
    for i in range(12):
        r = await client.post("/api/v1/auth/forgot-password", json={"email": email_exists})
        if r.status_code == 429:
            blocked = True
            break

    if diff_ms > 150:
        result("User enumeration via forgot-password timing", "MEDIUM",
               "VULNERABLE",
               f"Existing email avg {avg_exist*1000:.1f}ms vs ghost avg {avg_ghost*1000:.1f}ms — {diff_ms:.1f}ms gap leaks existence",
               "Add constant-time response delay regardless of email existence")
    else:
        result("User enumeration via forgot-password timing", "MEDIUM",
               "PROTECTED", f"Timing gap only {diff_ms:.1f}ms — not exploitable")

    if not blocked:
        result("Forgot-password rate limiting", "HIGH",
               "VULNERABLE", "12 requests sent without 429 — no rate limiting on password reset",
               "Limit to 3/hour per email address")
    else:
        result("Forgot-password rate limiting", "HIGH",
               "PROTECTED", "Rate limit enforced on /forgot-password")

# ── TEST 4: File upload path traversal ───────────────────────────────────────

async def test_path_traversal(client, token):
    print("TEST 4: File upload path traversal via `folder` parameter")
    headers = {"Authorization": f"Bearer {token}"}

    traversal_payloads = [
        "../../../tmp",
        "../../etc",
        "..%2F..%2Ftmp",
        "uploads/../../../tmp",
        "%2e%2e%2f%2e%2e%2ftmp",
    ]

    escaped = []
    for folder in traversal_payloads:
        files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "image/png")}
        r = await client.post(f"/api/v1/media/upload?folder={folder}", files=files, headers=headers)
        if r.status_code in (200, 201):
            url = r.json().get("url", "")
            if ".." in url or "tmp" in url or "etc" in url:
                escaped.append(f"folder={folder!r} → url={url!r}")

    # Check if file was written outside media dir
    import subprocess
    outside = subprocess.run(
        ["docker", "compose", "exec", "-T", "api", "find", "/tmp", "-newer", "/app/media", "-name", "*.png"],
        capture_output=True, text=True, cwd="/home/Jdalton/gtechwebsite"
    )

    if escaped or outside.stdout.strip():
        result("File upload path traversal", "HIGH",
               "VULNERABLE", f"Traversal payloads reached outside media dir: {escaped or outside.stdout.strip()}",
               "Whitelist folder names; reject any value containing '..' or '/'")
    else:
        result("File upload path traversal", "HIGH",
               "PROTECTED", "All traversal payloads were blocked or sanitized by Path resolution")

# ── TEST 5: Unauthenticated file upload ───────────────────────────────────────

async def test_unauth_upload(client):
    print("TEST 5: Unauthenticated file upload")
    files = {"file": ("evil.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 50, "image/png")}
    r = await client.post("/api/v1/media/upload", files=files)
    if r.status_code in (200, 201):
        url = r.json().get("url", "?")
        result("Unauthenticated file upload", "HIGH",
               "VULNERABLE", f"File accepted without auth token → {url}",
               "Require Bearer token for all uploads; remove the optional-auth fallback")
    else:
        result("Unauthenticated file upload", "HIGH",
               "PROTECTED", f"Upload rejected without auth (HTTP {r.status_code})")

# ── TEST 6: Malicious file type upload (SVG XSS, HTML, PHP) ───────────────────

async def test_malicious_upload(client, token):
    print("TEST 6: Malicious file type upload")
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
            uploaded.append(f"{name} (mime={mime}) → {r.json().get('url','')}")

    if uploaded:
        result("Malicious file upload", "HIGH",
               "VULNERABLE", f"Server accepted: {'; '.join(uploaded)}",
               "Validate magic bytes; strip scripts from SVG; block HTML/PHP extensions")
    else:
        result("Malicious file upload", "HIGH",
               "PROTECTED", "All malicious file types were rejected")

# ── TEST 7: Insecure Direct Object Reference on orders/tickets ────────────────

async def test_idor(client, token):
    print("TEST 7: IDOR — access other users' data")
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to list all orders (should only see own)
    r = await client.get("/api/v1/orders/", headers=headers)
    order_count = len(r.json()) if r.status_code == 200 and isinstance(r.json(), list) else 0

    # Attempt to access UUID-guessed orders
    found_other = []
    for _ in range(5):
        fake_id = str(uuid.uuid4())
        r = await client.get(f"/api/v1/orders/{fake_id}", headers=headers)
        if r.status_code == 200:
            found_other.append(fake_id)

    if found_other:
        result("IDOR on orders", "HIGH", "VULNERABLE",
               f"Accessed {len(found_other)} orders belonging to other users",
               "Filter by user_id on all order queries")
    else:
        result("IDOR on orders", "HIGH", "PROTECTED",
               f"UUID-guessed order IDs all returned 404/403")

# ── TEST 8: Admin endpoints accessible by regular users ───────────────────────

async def test_privilege_escalation(client, user_token):
    print("TEST 8: Privilege escalation — regular user accessing admin endpoints")
    headers = {"Authorization": f"Bearer {user_token}"}

    admin_endpoints = [
        ("GET",  "/api/v1/admin/users"),
        ("GET",  "/api/v1/portfolio/admin/all"),
        ("GET",  "/api/v1/team/admin/all"),
        ("GET",  "/api/v1/media/"),
        ("POST", "/api/v1/portfolio/skills"),
        ("GET",  "/api/v1/admin/ai/documents"),
    ]

    accessible = []
    for method, path in admin_endpoints:
        r = await client.request(method, path, headers=headers,
                                  json={"category": "X", "name": "Y"} if method == "POST" else None)
        if r.status_code not in (401, 403, 404, 405, 422):
            accessible.append(f"{method} {path} → HTTP {r.status_code}")

    if accessible:
        result("Privilege escalation to admin", "CRITICAL",
               "VULNERABLE", f"Regular user reached: {'; '.join(accessible)}",
               "Audit all admin deps — ensure AdminUser/PortfolioAdminUser are enforced on every route")
    else:
        result("Privilege escalation to admin", "CRITICAL",
               "PROTECTED", "All tested admin endpoints correctly returned 401/403 for regular user")

# ── TEST 9: JWT algorithm confusion / none attack ─────────────────────────────

async def test_jwt_attacks(client):
    print("TEST 9: JWT algorithm confusion & 'none' attack")
    import base64

    def b64url(data):
        if isinstance(data, str):
            data = data.encode()
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    # Build a forged token with alg=none
    header = b64url(json.dumps({"alg": "none", "typ": "JWT"}))
    payload_data = b64url(json.dumps({
        "sub": str(uuid.uuid4()), "type": "access",
        "exp": int(time.time()) + 9999999, "iat": int(time.time())
    }))
    forged_token = f"{header}.{payload_data}."

    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged_token}"})
    if r.status_code == 200:
        result("JWT algorithm=none attack", "CRITICAL",
               "VULNERABLE", "Forged JWT with alg=none was accepted — attacker can impersonate any user",
               "Explicitly specify allowed algorithms in jose.decode(): algorithms=['HS256']")
    else:
        result("JWT algorithm=none attack", "CRITICAL",
               "PROTECTED", f"Forged alg=none token rejected (HTTP {r.status_code})")

    # HS256 with empty secret
    try:
        import hmac
        msg = f"{header}.{payload_data}".encode()
        sig = b64url(hmac.new(b"", msg, hashlib.sha256).digest())
        empty_secret_token = f"{header}.{payload_data}.{sig}"
        r2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {empty_secret_token}"})
        if r2.status_code == 200:
            result("JWT empty secret", "CRITICAL", "VULNERABLE",
                   "JWT signed with empty string secret was accepted",
                   "Ensure SECRET_KEY is long (>=32 bytes) and never empty")
        else:
            result("JWT empty secret", "CRITICAL", "PROTECTED",
                   f"Empty-secret JWT rejected (HTTP {r2.status_code})")
    except Exception as e:
        result("JWT empty secret", "CRITICAL", "SKIP", str(e))

# ── TEST 10: Mass assignment on user update ───────────────────────────────────

async def test_mass_assignment(client, token):
    print("TEST 10: Mass assignment — elevate self to admin via /auth/update-me")
    headers = {"Authorization": f"Bearer {token}"}

    # Try to inject admin fields
    r = await client.patch("/api/v1/auth/update-me", headers=headers, json={
        "full_name": "Hacker",
        "is_admin": True,
        "is_active": True,
        "email_verified": True,
        "permissions": ["manage_all"],
        "role": "admin",
    })

    if r.status_code == 200:
        me = await client.get("/api/v1/auth/me", headers=headers)
        if me.status_code == 200 and me.json().get("is_admin"):
            result("Mass assignment privilege escalation", "CRITICAL",
                   "VULNERABLE", "Set is_admin=True via /auth/update-me and it was accepted",
                   "Use explicit allow-list of updatable fields; never accept is_admin from user input")
        else:
            result("Mass assignment privilege escalation", "CRITICAL",
                   "PROTECTED", "Request accepted but is_admin was not changed (fields ignored)")
    else:
        result("Mass assignment privilege escalation", "CRITICAL",
               "PROTECTED", f"Server rejected extra fields (HTTP {r.status_code})")

# ── TEST 11: Security headers ─────────────────────────────────────────────────

async def test_security_headers(client):
    print("TEST 11: HTTP security headers")
    r = await client.get("/")
    headers = {k.lower(): v for k, v in r.headers.items()}

    required = {
        "x-content-type-options": "nosniff",
        "x-frame-options": None,
        "strict-transport-security": None,
        "content-security-policy": None,
        "x-xss-protection": None,
        "referrer-policy": None,
    }

    missing = [h for h in required if h not in headers]
    present = [h for h in required if h in headers]

    if missing:
        result("Missing HTTP security headers", "MEDIUM",
               "VULNERABLE", f"Missing: {', '.join(missing)}",
               "Add SecurityHeadersMiddleware returning X-Frame-Options, HSTS, CSP, etc.")
    else:
        result("Missing HTTP security headers", "MEDIUM",
               "PROTECTED", f"All security headers present: {', '.join(present)}")

# ── TEST 12: CORS misconfiguration ────────────────────────────────────────────

async def test_cors(client):
    print("TEST 12: CORS misconfiguration")

    origins = [
        "https://evil.com",
        "null",
        "https://gtechwebsite.evil.com",
        "http://localhost.evil.com",
    ]

    bad_origins = []
    for origin in origins:
        r = await client.options("/api/v1/auth/login",
                                  headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
        acao = r.headers.get("access-control-allow-origin", "")
        if acao == origin or acao == "*":
            bad_origins.append(f"{origin} → ACAO: {acao}")

    if bad_origins:
        result("CORS misconfiguration", "HIGH",
               "VULNERABLE", f"Reflected/wildcard CORS for untrusted origins: {'; '.join(bad_origins)}",
               "Whitelist only production domains in ALLOWED_ORIGINS; never reflect arbitrary Origin headers")
    else:
        result("CORS misconfiguration", "HIGH",
               "PROTECTED", "CORS only allows whitelisted origins")

# ── TEST 13: SQL injection via search/filter params ───────────────────────────

async def test_sql_injection(client, token):
    print("TEST 13: SQL injection via search parameters")
    headers = {"Authorization": f"Bearer {token}"}

    payloads = [
        "' OR '1'='1",
        "1; DROP TABLE users;--",
        "' UNION SELECT * FROM users--",
        "1' AND SLEEP(3)--",
        "%27 OR %271%27=%271",
    ]

    found = []
    for p in payloads:
        # Try search params on various endpoints
        endpoints = [
            f"/api/v1/store/products?search={p}",
            f"/api/v1/courses/?search={p}",
            f"/api/v1/blog/?search={p}",
        ]
        for ep in endpoints:
            try:
                r = await client.get(ep, headers=headers)
                if r.status_code == 500:
                    found.append(f"500 on {ep} with {p!r}")
                elif "syntax error" in r.text.lower() or "pg::" in r.text.lower():
                    found.append(f"DB error on {ep} with {p!r}")
            except Exception:
                pass

    if found:
        result("SQL injection", "CRITICAL",
               "VULNERABLE", f"Database errors exposed: {'; '.join(found)}",
               "Use parameterized queries only (SQLAlchemy ORM already does this — check raw text() calls)")
    else:
        result("SQL injection", "CRITICAL",
               "PROTECTED", "All SQL injection payloads returned safe responses (ORM parameterization working)")

# ── TEST 14: Open redirect ────────────────────────────────────────────────────

async def test_open_redirect(client):
    print("TEST 14: Open redirect")
    payloads = [
        "https://evil.com",
        "//evil.com",
        "/\\evil.com",
        "https:///evil.com",
    ]
    found = []
    for p in payloads:
        for endpoint in [
            f"/api/v1/auth/google/callback?next={p}",
            f"/api/v1/auth/login?redirect={p}",
        ]:
            r = await client.get(endpoint, follow_redirects=False)
            loc = r.headers.get("location", "")
            if r.status_code in (301, 302, 307, 308) and any(evil in loc for evil in ["evil.com"]):
                found.append(f"{endpoint} → Location: {loc}")

    if found:
        result("Open redirect", "MEDIUM", "VULNERABLE",
               f"Redirects to external domain: {'; '.join(found)}",
               "Validate redirect URLs are relative paths or match allowed domain list")
    else:
        result("Open redirect", "MEDIUM", "PROTECTED",
               "No unvalidated redirect to external domains detected")

# ── TEST 15: Sensitive data in error responses ────────────────────────────────

async def test_error_disclosure(client):
    print("TEST 15: Sensitive data in error responses")
    # Trigger various errors
    probes = [
        "/api/v1/auth/me",                  # no token
        "/api/v1/orders/not-a-uuid",        # invalid UUID
        "/api/v1/portfolio/skills/00000000-0000-0000-0000-000000000000",
        "/api/v1/auth/login",               # missing body
    ]

    leaks = []
    for path in probes:
        r = await client.get(path) if "login" not in path else await client.post(path, json={})
        text = r.text
        for keyword in ["traceback", "sqlalchemy", "asyncpg", "file \"", "line ", "stack", "/app/", "secret"]:
            if keyword.lower() in text.lower():
                leaks.append(f"{path}: contains '{keyword}'")
                break

    if leaks:
        result("Sensitive data in error responses", "MEDIUM",
               "VULNERABLE", f"Stack/path info leaked: {'; '.join(leaks)}",
               "Set DEBUG=False; use generic error handler; never forward exception details to client")
    else:
        result("Sensitive data in error responses", "MEDIUM",
               "PROTECTED", "Error responses contain no stack traces or internal paths")

# ── TEST 16: Password strength on reset ───────────────────────────────────────

async def test_weak_reset_password(client):
    print("TEST 16: Weak password accepted on /reset-password")
    # We can't get a real reset token easily, so we test the validation logic
    # by calling with obviously invalid token + weak password and checking the error path
    r = await client.post("/api/v1/auth/reset-password", json={
        "token": "fakefakefake",
        "new_password": "aaa",         # extremely weak
    })
    # If error is "password too short" rather than "invalid token", it validated password first
    # which is fine. If it says "invalid token" with weak password, password was never validated.
    text = r.text.lower()
    if "invalid" in text or "expired" in text:
        # Server rejected the token before password validation — can't test without real token
        result("Password strength on reset", "MEDIUM",
               "WARNING", "Cannot verify without valid reset token — static analysis shows only min-length (8) is checked, not complexity",
               "Apply same password_strength validator from RegisterRequest to ResetPasswordRequest")
    elif "password" in text and ("8 char" in text or "length" in text or "weak" in text):
        result("Password strength on reset", "MEDIUM",
               "VULNERABLE", "Server validates password length only, not complexity",
               "Require uppercase + digit in reset password same as registration")

# ── TEST 17: Verify email token never expires ─────────────────────────────────

async def test_email_token_no_expiry(client):
    print("TEST 17: Email verification token — no expiry")
    # Register a user but don't verify
    email = f"noverify_{uuid.uuid4().hex[:6]}@example.com"
    r = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "NoVerify123!", "full_name": "No Verify"
    })
    if r.status_code not in (200, 201):
        result("Email token expiry", "MEDIUM", "SKIP", "Could not register")
        return

    # Try brute-force with short tokens (test throttling)
    blocked = False
    for _ in range(15):
        r = await client.post("/api/v1/auth/verify-email", json={"token": uuid.uuid4().hex})
        if r.status_code == 429:
            blocked = True
            break

    if not blocked:
        result("Email verification brute-force", "MEDIUM",
               "VULNERABLE", "15 random token guesses on /verify-email — never throttled (no 429)",
               "Rate-limit /verify-email to 5 attempts per IP per hour")
    else:
        result("Email verification brute-force", "MEDIUM",
               "PROTECTED", "Throttled verification endpoint")

# ── TEST 18: Media directory listing ─────────────────────────────────────────

async def test_directory_listing(client):
    print("TEST 18: Media directory listing / traversal")
    r = await client.get("/media/")
    if r.status_code == 200 and ("<html" in r.text.lower() or "index of" in r.text.lower() or "<a href" in r.text.lower()):
        result("Media directory listing", "MEDIUM",
               "VULNERABLE", "GET /media/ returns HTML directory listing — exposes all uploaded filenames",
               "Mount StaticFiles with html=False or add nginx deny for directory listing")
    else:
        result("Media directory listing", "MEDIUM",
               "PROTECTED", f"GET /media/ returned HTTP {r.status_code} — no directory listing")

# ── MAIN ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 70)
    print("  G-TECH SECURITY PENETRATION TESTS")
    print(f"  Target: {BASE}")
    print(f"  Time:   {datetime.now().isoformat()}")
    print("=" * 70)
    print()

    async with httpx.AsyncClient(base_url=BASE, timeout=30, follow_redirects=False) as client:

        # Register a regular test user for authenticated tests
        email = f"pentest_{uuid.uuid4().hex[:8]}@example.com"
        reg = await client.post("/api/v1/auth/register", json={
            "email": email, "password": "PenTest123!", "full_name": "Pen Tester"
        })
        token = None
        if reg.status_code in (200, 201):
            # Try to login (may fail if email verification required)
            login_r = await client.post("/api/v1/auth/login", json={
                "email": email, "password": "PenTest123!"
            })
            if login_r.status_code == 200:
                token = login_r.json().get("access_token")

        print(f"Test user: {email}  |  Token obtained: {'YES' if token else 'NO (email verify required?)'}\n")

        await test_brute_force_login(client)
        await test_2fa_bruteforce(client)
        await test_forgot_password_enum(client)
        await test_unauth_upload(client)
        if token:
            await test_path_traversal(client, token)
            await test_malicious_upload(client, token)
            await test_idor(client, token)
            await test_privilege_escalation(client, token)
            await test_mass_assignment(client, token)
            await test_sql_injection(client, token)
        await test_jwt_attacks(client)
        await test_security_headers(client)
        await test_cors(client)
        await test_open_redirect(client)
        await test_error_disclosure(client)
        await test_weak_reset_password(client)
        await test_email_token_no_expiry(client)
        await test_directory_listing(client)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    by_status = {}
    for r in RESULTS:
        by_status.setdefault(r["status"], []).append(r)

    vuln    = by_status.get("VULNERABLE", [])
    warn    = by_status.get("WARNING", [])
    protect = by_status.get("PROTECTED", [])
    skipped = by_status.get("SKIP", [])

    print(f"\n  🔴 VULNERABLE : {len(vuln)}")
    for r in vuln:
        print(f"     • [{r['severity']}] {r['name']}")

    print(f"\n  🟡 WARNING    : {len(warn)}")
    for r in warn:
        print(f"     • [{r['severity']}] {r['name']}")

    print(f"\n  🟢 PROTECTED  : {len(protect)}")
    for r in protect:
        print(f"     • [{r['severity']}] {r['name']}")

    if skipped:
        print(f"\n  ⚪ SKIPPED    : {len(skipped)}")
        for r in skipped:
            print(f"     • {r['name']}")

    print(f"\n  Total tests: {len(RESULTS)}")
    print()

    # Write JSON report
    with open("/home/Jdalton/gtechwebsite/security_report.json", "w") as f:
        json.dump(RESULTS, f, indent=2)
    print("  Full report saved to: security_report.json")
    print()

if __name__ == "__main__":
    asyncio.run(main())
