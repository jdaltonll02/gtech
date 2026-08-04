# Migration Guide — Moving to a New Linux VM

This guide covers moving the entire Gibson Technologies platform — database, application, uploaded media, and configuration — from one Linux VM to another (e.g. resizing, changing cloud providers, or replacing a compromised host).

For a **fresh install** (no existing data to carry over), use [DEPLOY.md](DEPLOY.md) instead. This guide assumes you already have a running instance with real data and are moving it somewhere else.

---

## What "migration" covers

| Component | Where it lives today | Portable by default? |
|---|---|---|
| Database | Neon (managed Postgres, external to the VM) | **Yes** — see Scenario A below |
| Application code | This git repository | Yes — `git clone` |
| Uploaded media (photos, resumes, etc.) | Docker volume `media_data` on the VM's local disk | **No** — must be exported/imported (`scripts/backup.sh` / `scripts/restore.sh`) |
| Redis | In-container only, no volume | N/A — nothing to migrate (cache + Celery broker only, safe to lose) |
| Secrets (`backend/.env`, `frontend/.env`) | VM's local disk only, gitignored | **No** — must be copied securely, never via git |
| SSL certificates | `/etc/letsencrypt` on the VM's host filesystem | **No** — reissue on the new VM, or copy the directory |
| Domain (`gibtechs.com`) | DNS, external to both VMs | Update the A/AAAA record to the new VM's IP once verified |

Two migration scenarios are supported. **Scenario A is strongly recommended** — it's faster, safer, and has near-zero data-transfer risk.

- **Scenario A — keep the same Neon database.** The new VM's `backend/.env` points at the exact same Neon connection strings as the old VM. There is nothing to migrate for the database — both VMs would simply be talking to the same external database. Only media, secrets, and certs move.
- **Scenario B — also move the database** (e.g. leaving Neon entirely, or moving to a different Neon project). Requires a full `pg_dump`/`pg_restore` cycle via `scripts/backup.sh` / `scripts/restore.sh`.

---

## Tooling

Two scripts automate the parts that aren't just `git clone`:

- **`scripts/backup.sh`** — run on the **source** VM. Produces one archive (`backups/gtech-backup-<timestamp>.tar.gz`) containing a `pg_dump` of the database, a tar of the `media_data` volume, `backend/.env` / `frontend/.env`, and a manifest.
- **`scripts/restore.sh`** — run on the **destination** VM. Given that archive, places the env files, (optionally) restores the database, (optionally) restores the media volume, then brings the stack up and waits for it to report healthy.

Both were tested against this deployment's real database and media volume as part of writing this guide (dump/restore round-tripped correctly into a throwaway scratch Postgres container and a throwaway Docker volume — the process is sound; treat a rehearsal against a real second VM as good practice before a production cutover, since that end-to-end path hasn't been exercised against a live second host).

```bash
scripts/backup.sh                              # writes to ./backups/
scripts/restore.sh <archive> --skip-db          # Scenario A: env + media only
scripts/restore.sh <archive>                    # Scenario B: env + media + database
```

Run `scripts/restore.sh` with no arguments to see all flags.

> Both scripts require Docker but no PostgreSQL client tools on the host — `pg_dump`/`pg_restore` run inside a throwaway `postgres:18-alpine` container, matched to Neon's current server version (18.x at the time of writing — if Neon has since upgraded further, update the image tag in both scripts to match, or `pg_dump`/`pg_restore` will refuse to run with a "server version mismatch" error).

---

## Pre-migration checklist

- [ ] Note the current site is live with real users, orders, and enrollments — plan for a maintenance window if choosing Scenario B (the database restore step is a hard cutover, not a rolling one).
- [ ] Confirm you have SSH access to both the old and new VM.
- [ ] Confirm the new VM meets the same requirements as a fresh install (see DEPLOY.md § 1: 2+ vCPU, 4–8GB RAM, 30–50GB disk, Ubuntu 22.04/Debian 12+).
- [ ] Lower your DNS record's TTL (e.g. to 300s) at least a few hours ahead of the cutover, so the eventual DNS change propagates quickly.
- [ ] Decide Scenario A vs. B (A unless you have a specific reason to move off Neon).

---

## Step-by-step

### 1. Prepare the new VM

Follow **DEPLOY.md sections 1–5**: provision the VM, open firewall ports, install Docker + Docker Compose, install git/certbot, and `git clone` this repository. Stop before DEPLOY.md's "Configure environment variables" step — the migration scripts handle that part.

### 2. Back up the source VM

On the **old** VM, from the repo root:

```bash
cd /opt/gtech   # or wherever this repo lives
scripts/backup.sh
```

This produces `backups/gtech-backup-<timestamp>.tar.gz`. It contains live secrets and (if not skipped) your full database — treat it accordingly.

### 3. Transfer the archive

Copy it to the new VM over SSH — never through git, email, or a third-party file-sharing service:

```bash
scp /opt/gtech/backups/gtech-backup-*.tar.gz you@NEW_VM_IP:/tmp/
```

### 4. Restore on the new VM

```bash
cd /opt/gtech   # the freshly cloned repo on the NEW VM
scripts/restore.sh /tmp/gtech-backup-*.tar.gz --skip-db     # Scenario A (recommended)
# or, to also move the database itself:
scripts/restore.sh /tmp/gtech-backup-*.tar.gz               # Scenario B
```

You'll be shown the backup's manifest (source host, git commit, timestamp) and asked to confirm before anything is overwritten. The script then:
1. Places `backend/.env` / `frontend/.env` (backing up anything already there first).
2. Restores the database, unless `--skip-db` (Scenario A never needs this — the new VM already points at the same Neon instance).
3. Restores the `media_data` volume.
4. Runs `docker compose up -d --build` and waits for the API health check to pass.

### 5. Obtain SSL certificates on the new VM

Certificates don't transfer automatically. Either:
- **Reissue** (simplest): follow DEPLOY.md § 9 (`certbot certonly --standalone -d gibtechs.com`) — requires DNS to already point at the new VM, or a temporary A record swap during issuance.
- **Copy**: `scp -r` the old VM's `/etc/letsencrypt` directory to the same path on the new VM, then set up certbot's renewal timer there (`sudo systemctl enable --now certbot.timer`).

### 6. Verify before cutting over

With the new VM fully up but DNS still pointed at the old one, verify directly against the new VM's IP (bypassing DNS):

```bash
curl -H "Host: gibtechs.com" http://NEW_VM_IP/api/v1/health
```

Then, from a browser or via `/etc/hosts` override, walk through the same checks used throughout this project's development: log in, browse courses, confirm an uploaded image loads, check the admin dashboard renders. Don't skip this — DNS-level verification alone won't catch a misconfigured `.env` or a missing media file.

### 7. Cut over DNS

Update the A/AAAA record for `gibtechs.com` (and `www`) to the new VM's IP. Propagation should be fast given the lowered TTL from the pre-migration checklist.

### 8. Monitor and keep the old VM as a fallback

Watch `docker compose logs -f` on the new VM for the first hour of real traffic. Keep the old VM running (but not receiving traffic) for 24–48 hours in case a rollback is needed — don't decommission it immediately.

### 9. Decommission the old VM

Once confident the new VM is stable:
- Stop the stack: `docker compose down` (no `-v` — see below).
- Securely delete `backend/.env` and any backup archives left on the old VM.
- Terminate/deprovision the old VM per your cloud provider.

---

## Rollback plan

If something goes wrong after cutover, revert DNS back to the old VM's IP — it's still running and untouched. If Scenario B's database restore already happened and you need to roll back data too, restore the same backup archive's `database.dump` back into the original Neon database with the same `pg_restore` command `restore.sh` uses (`docker run --rm -v <dump>:/database.dump:ro postgres:18-alpine pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$OLD_DATABASE_URL_SYNC" /database.dump`), keeping in mind this also reverts any writes that happened between the backup and the rollback.

---

## Never run `-v` on `docker compose down`

`docker compose down -v` deletes the `media_data` Docker volume permanently. This applies on both the old and new VM at every stage of a migration — always use plain `docker compose down` (see `redeploy.sh` for the existing safe-redeploy pattern this repo already follows).

---

## Security notes

- Transfer `backend/.env` and backup archives only over SSH (`scp`/`rsync`), never via git, email, Slack, or a pastebin.
- Keep `SECRET_KEY` identical between old and new VM unless you intend to invalidate every active login session (changing it invalidates all existing JWTs).
- Rotate `FIRST_SUPERADMIN_PASSWORD`, Stripe/PayPal/MoMo keys, and SMTP credentials only if you have reason to believe they were exposed during the move — routine migration doesn't require rotating them, since the same secrets simply move with the `.env` file.
- Delete backup archives from both VMs once the migration is confirmed stable; they contain a full plaintext copy of your secrets and database.
