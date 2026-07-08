# Deployment Guide — GCP VM + Neon + Docker

Full instructions for deploying the Gibson Technologies platform on a Linux VM (GCP, DigitalOcean, AWS, etc.) using Docker Compose with PostgreSQL hosted on **Neon** (serverless managed Postgres) and HTTPS via Let's Encrypt.

---

## Stack recap

| Service | Container | Exposed |
|---------|-----------|---------|
| PostgreSQL 16 | **Neon** (external, managed) | Neon cloud only |
| Redis 7 | `redis` | internal only |
| FastAPI (4 workers) | `api` | internal (`api:8000`) |
| Celery worker | `worker` | internal only |
| Celery beat | `beat` | internal only |
| Flower dashboard | `flower` | `127.0.0.1:5555` (monitoring) |
| React / Nginx SPA | `frontend` | **0.0.0.0:80, 0.0.0.0:443** (public) |

> There is **no `db` container**. The database is fully managed by Neon. You never run `pg_dump` against a local container — see [Database backups](#15-database-backups) for the Neon approach.

---

## 1. VM Requirements

### Recommended specifications
- **CPU**: 2 vCPU or higher (e2-standard-2 on GCP)
- **RAM**: 4–8 GB minimum
- **Disk**: 30–50 GB SSD
- **OS**: Ubuntu 22.04 LTS, Debian 12+, or similar Linux distribution
- **Static external IP**: Reserved for your domain

### Firewall/Security group rules

| Protocol | Port | Source | Purpose |
|----------|------|--------|---------|
| TCP | 22 | your IP | SSH access |
| TCP | 80 | 0.0.0.0/0 | HTTP (auto-redirect to HTTPS) |
| TCP | 443 | 0.0.0.0/0 | HTTPS (public traffic) |
| TCP | 5555 | your IP only | Flower dashboard (Celery monitoring) |

> **Do NOT expose port 6379 (Redis) to the internet.** PostgreSQL is on Neon — no port to open.

---

## 2. Connect to the VM

### GCP
```bash
gcloud compute ssh YOUR_INSTANCE_NAME --zone YOUR_ZONE
```

### AWS / DigitalOcean / Generic SSH
```bash
ssh -i ~/.ssh/your_key user@YOUR_SERVER_IP
```

---

## 3. Install Docker and Docker Compose

### For Ubuntu 22.04 / Debian 12+

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Allow your user to run Docker without `sudo`
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### For other Linux distributions

Follow the [official Docker installation guide](https://docs.docker.com/engine/install/) for your OS.

---

## 4. Install dependencies

```bash
# Git (for cloning the repository)
sudo apt-get install -y git

# Certbot (for SSL certificates)
sudo apt-get install -y certbot

# (Optional) Other utilities
sudo apt-get install -y curl wget
```

---

## 5. Clone the repository

```bash
# Choose your deployment directory
cd /opt
# or: cd /home/$USER

# Clone the repository
sudo git clone https://github.com/jdaltonll02/gtech.git
# If you cloned to /opt, adjust permissions:
sudo chown -R $USER:$USER gtech

cd gtech
```

---

## 6. Set up Neon database

1. Go to [console.neon.tech](https://console.neon.tech) and create a project (e.g., `gtech-production`).
2. Navigate to **Dashboard → Connection Details**.
3. Select **Pooled connection** and copy **both** connection strings:
   - **Async (asyncpg)** — starts with `postgresql+asyncpg://`
   - **Sync** — starts with `postgresql://`

Example Neon connection strings:
```
postgresql+asyncpg://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb
postgresql://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

> **Neon Free tier:** 0.5 GB storage, auto-suspend after 5 min of inactivity. First request after suspend takes ~1–2 sec. Upgrade to Launch plan ($19/mo) for always-on connections in production.

---

## 7. Configure environment variables

### 7a. Backend `.env`

```bash
nano backend/.env
```

Paste and **replace all `CHANGE_ME` / `REPLACE_ME` values**:

```dotenv
# ── Security ──────────────────────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=13b918bd37c57cd63f04da42d34f3715dd336c49683d0ec6a0001fa34ae0c315

# ── Database (Neon) ───────────────────────────────────────────────────────────
# Paste your Neon connection strings from Step 6
DATABASE_URL=postgresql+asyncpg://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb
DATABASE_URL_SYNC=postgresql://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
REDIS_URL=redis://redis:6379/0

# ── Payments: Stripe ──────────────────────────────────────────────────────────
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME

# ── Payments: PayPal ──────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=REPLACE_ME
PAYPAL_CLIENT_SECRET=REPLACE_ME
PAYPAL_MODE=live

# ── Payments: MTN MoMo ────────────────────────────────────────────────────────
MOMO_SUBSCRIPTION_KEY=REPLACE_ME
MOMO_API_USER=REPLACE_ME
MOMO_API_KEY=REPLACE_ME
MOMO_BASE_URL=https://proxy.momoapi.mtn.com
MOMO_ENVIRONMENT=production
MOMO_CALLBACK_URL=https://gibtechs.com/api/v1/payments/momo/callback

# ── Admin seed (CHANGE IMMEDIATELY AFTER FIRST LOGIN) ─────────────────────────
FIRST_SUPERADMIN_EMAIL=dalton.edu02@gmail.com
FIRST_SUPERADMIN_PASSWORD=DJ@gtech02

# ── Google OAuth (optional) ───────────────────────────────────────────────────
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=1034772606793-0a603vc32qgt49j5c3v1ptmshkfsg87a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://gibtechs.com/api/v1/auth/google/callback

# ── Email / SMTP ──────────────────────────────────────────────────────────────
# Gmail: use app-specific password, not your account password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rabiakalimat02@gmail.com
SMTP_PASSWORD=cvgjbxrwqnsaqqgh
SMTP_FROM=rabiakalimat02@gmail.com
FRONTEND_URL=https://gibtechs.com

# ── CORS (comma-separated list of allowed origins) ───────────────────────────
ALLOWED_ORIGINS=https://gibtechs.com,http://gibtechs.com,http://localhost,https://localhost,http://localhost:5173

# ── Flower (Celery monitoring) ────────────────────────────────────────────────
FLOWER_USER=admin
FLOWER_PASSWORD=CHANGE_ME_strong_flower_password

# ── Environment ──────────────────────────────────────────────────────────────
ENVIRONMENT=production
```

### 7b. Frontend `.env` (optional)

```bash
nano frontend/.env
```

```dotenv
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME
```

---

## 8. Point your domain to the server

Before obtaining SSL certificates, configure your domain's DNS:

1. Go to your domain registrar (e.g., GoDaddy, Namecheap, Route 53)
2. Update the **A record** to point to your server's static IP:
   - `gibtechs.com` → `YOUR_SERVER_IP`
   - `*.gibtechs.com` → `YOUR_SERVER_IP` (optional, for subdomains)
3. Wait 5–15 minutes for DNS propagation to complete

Verify propagation:
```bash
nslookup gibtechs.com
# Should show your server IP
```

---

## 9. Obtain SSL certificate

```bash
# Stop any process using port 80 (e.g., if nginx is running)
sudo systemctl stop nginx

# Request certificate from Let's Encrypt
sudo certbot certonly --standalone \
  -d gibtechs.com \
  -d www.gibtechs.com \
  --agree-tos \
  --no-eff-email \
  --register-unsafely-without-email \
  --non-interactive

# Expected output:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/gibtechs.com/fullchain.pem
# Key is saved at:         /etc/letsencrypt/live/gibtechs.com/privkey.pem
# This certificate expires on YYYY-MM-DD.
```

> **Auto-renewal:** Certbot automatically sets up a systemd timer. Verify it's running:
> ```bash
> sudo systemctl status certbot.timer
> sudo certbot renew --dry-run
> ```

---

## 10. Build and start Docker containers

```bash
cd /opt/gtech  # or wherever you cloned

# Build all Docker images
docker compose build

# Start all services in the background
docker compose up -d

# Watch logs during first startup (Alembic migrations auto-run)
docker compose logs -f api
```

Wait until you see:
```
api-1  | INFO:     Application startup complete
api-1  | INFO:     Uvicorn running on http://0.0.0.0:8000
```

Press `Ctrl+C` to exit logs.

Verify all services are running:
```bash
docker compose ps
```

Expected output:
```
NAME               IMAGE            COMMAND                  SERVICE    STATUS                 PORTS
gtech-api-1        gtech-api        "sh -c 'alembic upgr…"   api        Up (healthy)           0.0.0.0:8000->8000/tcp
gtech-frontend-1   gtech-frontend   "/docker-entrypoint.…"   frontend   Up                     0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
gtech-worker-1     gtech-worker     "celery -A app.celer…"   worker     Up                     
gtech-beat-1       gtech-beat       "celery -A app.celer…"   beat       Up                     
gtech-flower-1     gtech-flower     "sh -c 'celery -A ap…"   flower     Up                     127.0.0.1:5555->5555/tcp
gtech-redis-1      redis:7-alpine   "redis-cli ping"         redis      Up (healthy)           
```

> **Note:** All services should show `Up`. If a container restarted, check logs: `docker compose logs <service_name>`

---

## 11. Verify the deployment

### Check HTTPS redirect
```bash
curl -I http://gibtechs.com
# Expected: 301 redirect to https://
```

### Check API health
```bash
curl https://gibtechs.com/api/v1/health
# Expected: {"status":"ok"} or similar
```

### Check frontend loads
```bash
curl -I https://gibtechs.com
# Expected: 200 OK
```

### Access the site
Open your browser and navigate to:
- **Frontend:** https://gibtechs.com
- **API Docs:** https://gibtechs.com/api/docs
- **Flower (Celery monitoring):** http://localhost:5555 (from SSH tunnel or your IP: http://YOUR_IP:5555)

### Admin dashboard
- URL: https://gibtechs.com/admin
- Email: `FIRST_SUPERADMIN_EMAIL` from `.env`
- Password: `FIRST_SUPERADMIN_PASSWORD` from `.env`

> ⚠️ **IMPORTANT:** Change the admin password immediately after first login via Profile → Change Password.

---

## 12. Register Stripe webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks → Add endpoint
2. **Endpoint URL:** `https://gibtechs.com/api/v1/payments/stripe/webhook`
3. **Events to listen for:**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy the **Signing secret** → paste into `STRIPE_WEBHOOK_SECRET` in `backend/.env`
5. Restart the API container:
   ```bash
   docker compose restart api
   ```

---

## 13. Configure Google OAuth (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Application type: Web application)
3. **Authorized redirect URIs:**
   - `https://gibtechs.com/api/v1/auth/google/callback`
   - `https://gibtechs.com/api/v1/auth/google/login`
4. Copy **Client ID** and **Client Secret** → update `backend/.env`
5. Restart the API:
   ```bash
   docker compose restart api
   ```

---

## 14. Common Docker operations

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f worker

# Last 50 lines
docker compose logs --tail=50 api
```

### Restart a service
```bash
docker compose restart api
docker compose restart worker
# or restart all:
docker compose restart
```

### Rebuild and restart after code changes
```bash
docker compose up -d --build
# or specific service:
docker compose up -d --build api
```

### Stop all services
```bash
docker compose down
```

### Execute a command in a container
```bash
# Bash shell in API container
docker compose exec api bash

# Python REPL
docker compose exec api python

# Run migrations manually
docker compose exec api alembic upgrade head
```

### View container resource usage
```bash
docker stats
```

---

## 15. Database backups

Since PostgreSQL is hosted on **Neon**, backups are managed differently from self-hosted PostgreSQL.

### Neon automatic backups
- Free tier: **7 days** of point-in-time restore
- Launch+: **30 days** of point-in-time restore
- Restore via [console.neon.tech](https://console.neon.tech) → Branches → Restore

### Manual backup via `pg_dump`

```bash
# Install PostgreSQL client tools (one-time)
sudo apt-get install -y postgresql-client

# Dump the database to a local file
# Use your DATABASE_URL_SYNC from backend/.env
pg_dump "postgresql://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# View the backup
ls -lh backup_*.sql
```

### Automated daily backups to cloud storage (optional)

Create a script `/opt/gtech/backup.sh`:

```bash
#!/bin/bash

DB_URL="postgresql://neondb_owner:npg_XXXXXXXX@ep-long-leaf-xxxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
BACKUP_DIR="/opt/gtech/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump "$DB_URL" > "$BACKUP_DIR/backup_$DATE.sql"

# Upload to GCS (if using Google Cloud Storage)
# gsutil cp "$BACKUP_DIR/backup_$DATE.sql" gs://your-bucket/

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
# Add line:
# 0 2 * * * /opt/gtech/backup.sh
```

---

## 16. Monitoring and troubleshooting

### Container won't start?
```bash
docker compose logs <service_name>
# Look for errors in the output
```

### Port already in use?
```bash
# Find process using port 80/443
sudo ss -tlnp | grep ':80\|:443'

# Stop conflicting process
sudo systemctl stop nginx  # if nginx is running
sudo kill -9 <PID>
```

### SSL certificate renewal failed?
```bash
sudo certbot renew -v
# Or manually:
sudo certbot certonly --standalone -d gibtechs.com -d www.gibtechs.com
```

### Database connection issues?
```bash
# Test database connection
docker compose exec api python -c \
  "from sqlalchemy import create_engine; \
   create_engine('$DATABASE_URL').execute('SELECT 1')"
```

### Celery tasks not running?
```bash
# Check worker logs
docker compose logs -f worker

# Check Flower dashboard
# Access http://localhost:5555 (via SSH tunnel)
```

---

## 17. Security checklist

- [ ] Changed `FIRST_SUPERADMIN_PASSWORD` after first login
- [ ] Updated `SECRET_KEY` (generate new one if needed)
- [ ] Updated `SMTP_PASSWORD` (use app-specific password for Gmail)
- [ ] Configured `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (live keys)
- [ ] Updated `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` if using OAuth
- [ ] Restricted SSH access to your IP only (firewall rule)
- [ ] Restricted Flower access (port 5555) to your IP only
- [ ] Enabled SSL certificate auto-renewal (check `sudo systemctl status certbot.timer`)
- [ ] Disabled unnecessary SSH features in `/etc/ssh/sshd_config` (optional but recommended)
- [ ] Set up database backups (see section 15)

---

## 18. Production tips

### Always use HTTPS
All API calls and cookies must be over HTTPS in production. HTTP is only for redirects.

### Monitor SSL certificate expiry
```bash
# Check when certificate expires
sudo certbot certificates

# Auto-renewal should handle this, but verify timer:
sudo systemctl status certbot.timer
```

### Rate limiting
The API is configured with **60 requests/min per IP** (see `backend/app/middleware/rate_limit.py`). Adjust `RATE_LIMIT_PER_MINUTE` in `.env` if needed.

### CORS configuration
Update `ALLOWED_ORIGINS` in `backend/.env` to allow requests only from your domain:
```dotenv
ALLOWED_ORIGINS=https://gibtechs.com
```

### Media storage
By default, media is stored in a Docker volume (`media_data`). For large deployments, consider:
- S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces)
- Update `S3_*` environment variables in `backend/.env`

---

## 19. Updating the application

To deploy new code changes:

```bash
# Pull latest changes
cd /opt/gtech
git pull origin main

# Rebuild affected images
docker compose up -d --build

# Check logs
docker compose logs -f api

# Run migrations (if any)
docker compose exec api alembic upgrade head
```

---

## Troubleshooting & Support

For issues, check logs first:
```bash
docker compose logs -f <service_name>
```

Common issues:
- **Port already in use:** Stop conflicting services (Nginx, other Docker instances)
- **Certificate renewal failed:** Run `sudo certbot renew -v`
- **Out of storage:** Check disk usage with `df -h` and clean up old backups
- **High CPU/memory:** Check `docker stats` and optimize container limits

For more help, refer to:
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Neon documentation](https://neon.tech/docs/)
- [Let's Encrypt documentation](https://letsencrypt.org/docs/)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
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
