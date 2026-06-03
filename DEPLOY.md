# Deployment Guide — GCP VM + Neon

Full instructions for deploying the Dalton Portfolio platform on a Google Cloud Platform VM using Docker Compose, with PostgreSQL hosted on **Neon** (serverless managed Postgres) and HTTPS via Let's Encrypt.

---

## Stack recap

| Service | Container | Exposed |
|---------|-----------|---------|
| PostgreSQL 16 | **Neon** (external, managed) | Neon cloud only |
| Redis 7 | `redis` | internal only |
| FastAPI (4 workers) | `api` | → nginx on host |
| Celery worker | `worker` | internal only |
| Celery beat | `beat` | internal only |
| Flower dashboard | `flower` | `127.0.0.1:5555` only |
| React / Nginx SPA | `frontend` | → nginx on host (port 80/443) |

> There is **no `db` container**. The database is fully managed by Neon. You never run `pg_dump` against a local container — see [Database backups](#13-database-backups) for the Neon approach.

---

## 1. GCP VM requirements

### Recommended machine type
- **e2-standard-2** (2 vCPU, 8 GB RAM) or larger
- **OS**: Ubuntu 22.04 LTS (recommended)
- **Boot disk**: 30 GB SSD minimum (50 GB+ if you expect heavy media uploads)
- **Static external IP**: Reserve a static IP in GCP → VPC Network → IP Addresses

### Firewall rules (VPC Network → Firewall)

| Name | Protocol | Port | Source |
|------|----------|------|--------|
| `allow-http` | TCP | 80 | 0.0.0.0/0 |
| `allow-https` | TCP | 443 | 0.0.0.0/0 |
| `allow-ssh` | TCP | 22 | your IP only |
| `allow-flower` | TCP | 5555 | your IP only |

> **Do NOT expose port 6379 (Redis) to the internet.** PostgreSQL is on Neon — no port to open.

---

## 2. Connect to the VM

```bash
gcloud compute ssh YOUR_INSTANCE_NAME --zone YOUR_ZONE
# or plain SSH:
ssh -i ~/.ssh/your_key ubuntu@YOUR_STATIC_IP
```

---

## 3. Install dependencies on the VM

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Let your user run docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version

# Install Git, Nginx, Certbot
sudo apt-get install -y git nginx certbot python3-certbot-nginx
```

---

## 4. Clone the repository

```bash
cd /home/$USER
git clone https://github.com/jdaltonll02/gtech.git daltonportfolio
cd daltonportfolio
```

---

## 5. Set up Neon database

1. Go to [console.neon.tech](https://console.neon.tech) and create a project (e.g. `dalton-portfolio`).
2. From the **Dashboard → Connection Details**, select **Pooled connection** and copy both connection strings:
   - **Async (asyncpg)** — starts with `postgresql+asyncpg://`
   - **Sync** — starts with `postgresql://`
3. Neon connection strings look like:
   ```
   postgresql+asyncpg://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep these strings — you will paste them into `backend/.env` in the next step.

> Neon's free tier includes 0.5 GB storage and auto-suspend after 5 minutes of inactivity (the first request after suspend takes ~1–2 s). Upgrade to the Launch plan ($19/mo) for always-on connections in production.

---

## 6. Create environment files

### 6a. Backend `.env`

```bash
nano /home/$USER/daltonportfolio/backend/.env
```

Paste the following and **replace every `CHANGE_ME` / `REPLACE_ME` value**:

```dotenv
# ── Security ──────────────────────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=CHANGE_ME_64_hex_chars

# ── Database (Neon) ───────────────────────────────────────────────────────────
# Paste your Neon connection strings here (from Neon Dashboard → Connection Details)
DATABASE_URL=postgresql+asyncpg://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_SYNC=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME

# ── PayPal ────────────────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=REPLACE_ME
PAYPAL_CLIENT_SECRET=REPLACE_ME
PAYPAL_MODE=live

# ── MTN MoMo ──────────────────────────────────────────────────────────────────
MOMO_SUBSCRIPTION_KEY=REPLACE_ME
MOMO_API_USER=REPLACE_ME
MOMO_API_KEY=REPLACE_ME
MOMO_BASE_URL=https://proxy.momoapi.mtn.com
MOMO_ENVIRONMENT=production
MOMO_CALLBACK_URL=https://yourdomain.com/api/v1/payments/momo/callback
MOMO_CALLBACK_SECRET=CHANGE_ME_random_secret

# ── Admin seed ────────────────────────────────────────────────────────────────
FIRST_SUPERADMIN_EMAIL=admin@yourdomain.com
FIRST_SUPERADMIN_PASSWORD=CHANGE_ME_strong_admin_password

# ── Google OAuth (optional) ───────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/v1/auth/google/callback

# ── Email / SMTP ──────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://yourdomain.com

# ── Tax & rate limiting ───────────────────────────────────────────────────────
TAX_RATE=0.08
RATE_LIMIT_PER_MINUTE=60

# ── Flower auth ───────────────────────────────────────────────────────────────
FLOWER_USER=admin
FLOWER_PASSWORD=CHANGE_ME_strong_flower_password

ENVIRONMENT=production
```

### 6b. Frontend `.env`

```bash
nano /home/$USER/daltonportfolio/frontend/.env
```

```dotenv
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME
```

---

## 7. Build and start containers

```bash
cd /home/$USER/daltonportfolio

# Build all images
docker compose build

# Start everything in the background
docker compose up -d

# Watch logs during first startup (Alembic migrations run automatically against Neon)
docker compose logs -f api
```

Wait until you see:
```
api-1  | INFO:     Application startup complete.
```

Verify all containers are running:
```bash
docker compose ps
```

> **Note:** There is no `db` service. If you see a reference to a `db` container in logs, it means a stale `docker-compose.yml` is in use — pull the latest code.

---

## 8. Configure host Nginx

The frontend container binds to `127.0.0.1:3000`. Host Nginx handles all public traffic on 80/443 and proxies to it.

```bash
sudo nano /etc/nginx/sites-available/portfolio
```

Paste (replace `yourdomain.com`):

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 25M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Set up HTTPS with Let's Encrypt

Point your domain's **A record** to the VM's static IP **before** running this.

```bash
sudo certbot certonly --nginx \
  --non-interactive \
  --agree-tos \
  --email admin@yourdomain.com \
  -d yourdomain.com \
  -d www.yourdomain.com
```

Certificates are saved to `/etc/letsencrypt/live/yourdomain.com/`.

Reload Nginx to pick up the new certificates:
```bash
sudo systemctl reload nginx
```

### Auto-renew

Certbot installs a systemd timer automatically. Verify it:

```bash
sudo systemctl status certbot.timer
# Should show "active (waiting)"

sudo certbot renew --dry-run
```

---

## 10. Update docker-compose for production

The frontend container must bind to `127.0.0.1` only (not `0.0.0.0`) so host Nginx is the only entry point:

```bash
nano /home/$USER/daltonportfolio/docker-compose.yml
```

Change the `frontend` service ports from:
```yaml
    ports:
      - "80:80"
```
to:
```yaml
    ports:
      - "127.0.0.1:3000:80"
```

Restart the frontend container to apply:
```bash
docker compose up -d --no-deps frontend
```

---

## 11. Register the Stripe webhook

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. URL: `https://yourdomain.com/api/v1/payments/stripe/webhook`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) → paste it into `STRIPE_WEBHOOK_SECRET` in `backend/.env`
5. Restart the api container:
   ```bash
   docker compose restart api
   ```

---

## 12. Verify the deployment

```bash
# HTTPS redirect works
curl -I http://yourdomain.com
# Expected: 301 → https://yourdomain.com

# API health check
curl https://yourdomain.com/api/v1/health
# Expected: {"status":"ok","version":"1.0.0"}

# Frontend loads
curl -I https://yourdomain.com
# Expected: 200
```

Log in to the admin panel at `https://yourdomain.com/admin` with the credentials set in `FIRST_SUPERADMIN_EMAIL` / `FIRST_SUPERADMIN_PASSWORD`.

> **Change the admin password immediately** after first login via Profile → Change Password.

---

## 13. Database backups

Since PostgreSQL is hosted on **Neon**, backups are managed differently from a self-hosted instance.

### Neon built-in backups (automatic)
- Neon retains **7 days of point-in-time restore** on the Free tier, **30 days** on Launch+.
- Restore a branch to any point via [console.neon.tech](https://console.neon.tech) → Branches → Restore.

### Manual snapshot via `pg_dump` from the VM

```bash
# Install postgres client tools (one-time)
sudo apt-get install -y postgresql-client

# Dump to a local file (use your Neon DATABASE_URL_SYNC value)
pg_dump "postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Automated daily backup to GCS

```bash
# Create backup directory
mkdir -p /home/$USER/backups

# Add to crontab
crontab -e
```

Add:
```cron
0 3 * * * pg_dump "postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql 2>/dev/null
```

Optionally sync to GCS:
```bash
gsutil mb gs://your-bucket-name-backups
# Add after the pg_dump line in cron:
# gsutil cp /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql gs://your-bucket-name-backups/
```

### Restore from a manual dump

```bash
psql "postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" \
  < backup_20260101_120000.sql
```

---

## 14. Media file backups

Media uploads live in the Docker volume `media_data`. Sync them to GCP Cloud Storage:

```bash
# Create a GCS bucket (one-time)
gsutil mb gs://your-bucket-name-media

# Sync media volume to GCS
docker run --rm \
  -v daltonportfolio_media_data:/media \
  google/cloud-sdk:alpine \
  gsutil -m rsync -r /media gs://your-bucket-name-media
```

Add this to cron for daily syncs:
```cron
30 3 * * * docker run --rm -v daltonportfolio_media_data:/media google/cloud-sdk:alpine gsutil -m rsync -r /media gs://your-bucket-name-media
```

---

## 15. Monitoring & logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker

# Celery Flower dashboard — accessible only from your IP via SSH tunnel
ssh -L 5555:127.0.0.1:5555 ubuntu@YOUR_STATIC_IP
# Then open http://localhost:5555 in your browser
# Login with FLOWER_USER / FLOWER_PASSWORD from backend/.env

# Container resource usage
docker stats
```

---

## 16. Updating the application

```bash
cd /home/$USER/daltonportfolio

# Pull latest code
git pull origin main

# Rebuild changed images and restart
docker compose build
docker compose up -d --no-deps --build api worker beat frontend

# Verify migrations ran
docker compose logs api | grep -i alembic
```

Alembic migrations run automatically on `api` container start — no manual step needed.

---

## 17. Troubleshooting

### Containers not starting

```bash
docker compose ps
docker compose logs api
docker compose logs worker
```

### API returns 502 Bad Gateway

The `api` container may still be starting (health check takes up to 40 s). Watch its logs:
```bash
docker compose logs -f api
```

### Neon connection errors (`connection refused` / SSL errors)

- Confirm `DATABASE_URL` uses `?sslmode=require` at the end.
- Confirm you are using the **pooled** connection string from Neon (not the direct one) for better reliability.
- Check Neon project is not suspended: log in to [console.neon.tech](https://console.neon.tech) and wake the branch.

### Alembic migration errors on first boot

```bash
docker compose exec api alembic current     # shows current revision
docker compose exec api alembic upgrade head  # re-run if needed
```

### Out of disk space

```bash
df -h
docker system prune -f       # remove stopped containers & dangling images
docker volume ls             # never prune media_data or redis volumes
```

### SSL certificate not renewing

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 18. Security checklist before going live

- [ ] `SECRET_KEY` is a random 64-character hex string
- [ ] `FIRST_SUPERADMIN_PASSWORD` changed after first login
- [ ] `STRIPE_WEBHOOK_SECRET` is the real Stripe signing secret
- [ ] `MOMO_CALLBACK_SECRET` is a random secret string
- [ ] `FLOWER_USER` and `FLOWER_PASSWORD` are set to non-default values
- [ ] Flower is accessed via SSH tunnel only — **not** open to `0.0.0.0` in GCP firewall
- [ ] Redis port (`6379`) is **not** exposed in GCP firewall
- [ ] `ALLOWED_ORIGINS` contains only `https://yourdomain.com`
- [ ] SMTP credentials are app-specific passwords (not your account password)
- [ ] HTTPS redirect is working (`curl -I http://yourdomain.com` shows `301`)
- [ ] Neon project is on a paid plan for always-on connections (no cold-start in prod)

---

## Quick-reference commands

| Task | Command |
|------|---------|
| Start all | `docker compose up -d` |
| Stop all | `docker compose down` |
| Restart API | `docker compose restart api` |
| View all logs | `docker compose logs -f` |
| Run migrations | `docker compose exec api alembic upgrade head` |
| Open API Python shell | `docker compose exec api python` |
| Backup DB (Neon) | `pg_dump "postgresql://..." > backup.sql` |
| Restore DB (Neon) | `psql "postgresql://..." < backup.sql` |
| Sync media to GCS | `docker run --rm -v daltonportfolio_media_data:/media google/cloud-sdk:alpine gsutil -m rsync -r /media gs://your-bucket` |
| Check health | `curl https://yourdomain.com/api/v1/health` |
| Flower (SSH tunnel) | `ssh -L 5555:127.0.0.1:5555 ubuntu@YOUR_IP` |
