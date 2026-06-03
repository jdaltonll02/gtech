# Deployment Guide — GCP VM

Full instructions for deploying the Dalton Portfolio platform on a Google Cloud Platform VM using Docker Compose, with HTTPS via Let's Encrypt.

---

## Stack recap

| Service | Container | Exposed |
|---------|-----------|---------|
| PostgreSQL 16 | `db` | internal only |
| Redis 7 | `redis` | internal only |
| FastAPI (4 workers) | `api` | → nginx on host |
| Celery worker | `worker` | internal only |
| Celery beat | `beat` | internal only |
| Flower dashboard | `flower` | `5555` (restrict in firewall) |
| React / Nginx SPA | `frontend` | → nginx on host (port 80/443) |

---

## 1. GCP VM requirements

### Recommended machine type
- **e2-standard-2** (2 vCPU, 8 GB RAM) or larger
- **OS**: Ubuntu 22.04 LTS (recommended)
- **Boot disk**: 30 GB SSD minimum (50 GB+ if you expect media uploads)
- **Static external IP**: Reserve a static IP in GCP → VPC Network → IP Addresses

### Firewall rules (VPC Network → Firewall)

Create or verify the following ingress rules:

| Name | Protocol | Port | Source |
|------|----------|------|--------|
| `allow-http` | TCP | 80 | 0.0.0.0/0 |
| `allow-https` | TCP | 443 | 0.0.0.0/0 |
| `allow-ssh` | TCP | 22 | your IP or 0.0.0.0/0 |
| `allow-flower` | TCP | 5555 | your IP only |

> **Do NOT expose port 5432 (Postgres) or 6379 (Redis) to the internet.**

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
git clone https://github.com/YOUR_GITHUB_USERNAME/daltonportfolio.git
cd daltonportfolio
```

> Replace the URL with your actual repository URL.

---

## 5. Create environment files

### 5a. Root `.env` (used by docker-compose for `${POSTGRES_PASSWORD}`)

```bash
cat > /home/$USER/daltonportfolio/.env <<'EOF'
POSTGRES_PASSWORD=CHANGE_ME_strong_db_password
EOF
```

> This value is referenced by docker-compose.yml as `${POSTGRES_PASSWORD}`.

### 5b. Backend `.env`

```bash
nano /home/$USER/daltonportfolio/backend/.env
```

Paste the following and **replace every `CHANGE_ME` / `replace_me` value**:

```dotenv
# ── Security ──────────────────────────────────────────────────────────────────
# Generate: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=CHANGE_ME_64_hex_chars

# ── Database ──────────────────────────────────────────────────────────────────
# Password must match POSTGRES_PASSWORD in the root .env above
POSTGRES_PASSWORD=CHANGE_ME_strong_db_password
DATABASE_URL=postgresql+asyncpg://portfolio:CHANGE_ME_strong_db_password@db:5432/portfolio_db
DATABASE_URL_SYNC=postgresql://portfolio:CHANGE_ME_strong_db_password@db:5432/portfolio_db

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
# Change this password immediately after first login
FIRST_SUPERADMIN_EMAIL=admin@yourdomain.com
FIRST_SUPERADMIN_PASSWORD=CHANGE_ME_strong_admin_password

# ── Email / SMTP ──────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://yourdomain.com

# ── Tax Rate ──────────────────────────────────────────────────────────────────
TAX_RATE=0.08

ENVIRONMENT=production
```

> The three `CHANGE_ME_strong_db_password` values must be **identical** across the root `.env` and `backend/.env`.

---

## 6. Update docker-compose for production

The frontend container currently binds to host port 80. In production Nginx on the host handles 80/443, so change the frontend's port binding to localhost only:

```bash
# Edit docker-compose.yml
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

This keeps the container accessible only from the host itself, not directly from the internet.

---

## 7. Build and start containers

```bash
cd /home/$USER/daltonportfolio

# Build all images (pass the Stripe publishable key for the frontend build)
docker compose build \
  --build-arg VITE_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME

# Start everything in the background
docker compose up -d

# Watch logs during first startup (migrations run automatically)
docker compose logs -f api
```

Wait until you see:
```
api-1  | INFO:     Application startup complete.
```

Verify all containers are healthy:
```bash
docker compose ps
```

All services should show `healthy` or `running`.

---

## 8. Set up HTTPS with Let's Encrypt

### 8a. Obtain the certificate

Point your domain's **A record** to the VM's static IP before running this.

```bash
sudo certbot certonly --nginx \
  --non-interactive \
  --agree-tos \
  --email admin@yourdomain.com \
  -d yourdomain.com \
  -d www.yourdomain.com
```

Certificates are saved to `/etc/letsencrypt/live/yourdomain.com/`.

### 8b. Configure host Nginx

```bash
sudo nano /etc/nginx/sites-available/portfolio
```

Paste:

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

    # Forward everything to the Dockerised frontend
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8c. Auto-renew certificates

Certbot installs a systemd timer automatically. Verify it:

```bash
sudo systemctl status certbot.timer
# Should show "active (waiting)"

# Dry-run to confirm renewal works
sudo certbot renew --dry-run
```

---

## 9. Register the Stripe webhook

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. URL: `https://yourdomain.com/api/v1/payments/stripe/webhook`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) and paste it into `STRIPE_WEBHOOK_SECRET` in `backend/.env`
5. Restart the api container:
   ```bash
   docker compose restart api
   ```

---

## 10. Verify the deployment

```bash
# Site loads over HTTPS
curl -I https://yourdomain.com

# API health check
curl https://yourdomain.com/api/v1/health

# API docs
# Open in browser: https://yourdomain.com/api/v1/docs
```

Expected API health response:
```json
{"status": "ok", "version": "1.0.0"}
```

Log in to the admin panel at `https://yourdomain.com/admin` with the credentials you set in `FIRST_SUPERADMIN_EMAIL` / `FIRST_SUPERADMIN_PASSWORD`.

> **Change the admin password immediately** after first login via Profile → Change Password.

---

## 11. Monitoring & logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker

# Celery Flower dashboard (task monitoring)
# Open: http://YOUR_VM_IP:5555  (only if your firewall allows your IP)

# Container resource usage
docker stats
```

---

## 12. Updating the application

```bash
cd /home/$USER/daltonportfolio

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime via Docker's rolling restart)
docker compose build \
  --build-arg VITE_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME

docker compose up -d --no-deps --build api worker beat frontend

# Check migration ran
docker compose logs api | grep "alembic"
```

---

## 13. Database backups

### Manual backup

```bash
# Dump the database to a local file
docker compose exec db pg_dump -U portfolio portfolio_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from backup

```bash
docker compose exec -T db psql -U portfolio portfolio_db < backup_20260101_120000.sql
```

### Automated daily backups (cron)

```bash
crontab -e
```

Add:
```cron
0 3 * * * cd /home/ubuntu/daltonportfolio && docker compose exec -T db pg_dump -U portfolio portfolio_db > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql 2>/dev/null
```

Create the backup directory:
```bash
mkdir -p /home/$USER/backups
```

---

## 14. Media file backups

Media uploads live in the Docker volume `media_data`. Copy them to GCP Cloud Storage:

```bash
# Install gcloud SDK (if not present)
# https://cloud.google.com/sdk/docs/install

# Create a GCS bucket (one-time)
gsutil mb gs://your-bucket-name-media

# Sync media volume to GCS (run this periodically)
docker run --rm \
  -v daltonportfolio_media_data:/media \
  google/cloud-sdk:alpine \
  gsutil -m rsync -r /media gs://your-bucket-name-media
```

---

## 15. Troubleshooting

### Containers not starting

```bash
docker compose ps            # check status
docker compose logs db       # often the culprit is the DB health check
docker compose logs api      # check for migration errors
```

### API returns 502 Bad Gateway

The `api` container may still be starting. Watch its logs:
```bash
docker compose logs -f api
```

### Database "already exists" error on migration

```bash
docker compose exec api alembic current    # shows current revision
docker compose exec api alembic upgrade head  # re-run migrations
```

### Out of disk space

```bash
df -h                              # check disk usage
docker system prune -f             # remove stopped containers & dangling images
docker volume ls                   # list volumes (don't prune data volumes)
```

### SSL certificate not renewing

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Reset everything (⚠️ destroys all data)

```bash
docker compose down -v   # removes containers AND volumes (irreversible)
docker compose up -d
```

---

## 16. Security checklist before going live

- [ ] `SECRET_KEY` is a random 64-character hex string
- [ ] `POSTGRES_PASSWORD` is a strong, unique password
- [ ] `FIRST_SUPERADMIN_PASSWORD` changed after first login
- [ ] `STRIPE_WEBHOOK_SECRET` is the real Stripe signing secret
- [ ] `MOMO_CALLBACK_SECRET` is a random secret string
- [ ] Flower dashboard (`port 5555`) is **not** open to `0.0.0.0` in GCP firewall
- [ ] PostgreSQL and Redis ports (`5432`, `6379`) are **not** exposed in GCP firewall
- [ ] `ALLOWED_ORIGINS` contains only `https://yourdomain.com`
- [ ] SMTP credentials are app-specific passwords (not account password)
- [ ] HTTPS redirect is working (`curl -I http://yourdomain.com` shows `301`)

---

## Quick-reference commands

| Task | Command |
|------|---------|
| Start all | `docker compose up -d` |
| Stop all | `docker compose down` |
| Restart API | `docker compose restart api` |
| View all logs | `docker compose logs -f` |
| Run migrations | `docker compose exec api alembic upgrade head` |
| Open DB shell | `docker compose exec db psql -U portfolio portfolio_db` |
| Open API shell | `docker compose exec api python` |
| Backup DB | `docker compose exec -T db pg_dump -U portfolio portfolio_db > backup.sql` |
| Check health | `curl https://yourdomain.com/api/v1/health` |
