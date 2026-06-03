# Gibson Technologies — Full-Stack Portfolio Platform

A production-ready, full-stack platform combining a personal portfolio, e-commerce store, learning management system (LMS), and support ticketing system. Built with FastAPI, React 18, PostgreSQL, and Docker.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [Project Structure](#project-structure)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Available Routes](#available-routes)
8. [Architecture](#architecture)
9. [Database Migrations](#database-migrations)
10. [Payment Integrations](#payment-integrations)
11. [Running Tests](#running-tests)
12. [Deployment](#deployment)
13. [Security Notes](#security-notes)

---

## Overview

Gibson Technologies is a multi-feature platform that serves as a professional portfolio, digital storefront, learning platform, and support desk — all in one system. The backend exposes a versioned REST API consumed by a React single-page application served through Nginx.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 + Uvicorn (4 workers) |
| Database | PostgreSQL 16 via Neon (managed) |
| ORM | SQLAlchemy 2.0 (async) + Alembic migrations |
| Cache | Redis 7 |
| Task queue | Celery 5 + Flower monitoring |
| Auth | JWT (PyJWT) + bcrypt + Google OAuth |
| Payments | Stripe, PayPal, MTN MoMo |
| Email | SMTP via Celery async tasks |
| Storage | Local disk (Docker volume) + S3-compatible |
| Validation | Pydantic v2 |
| Rate limiting | SlowAPI (60 req/min per IP) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| UI components | Radix UI + shadcn/ui primitives |
| State | Zustand |
| Animations | Motion (Framer Motion) |
| Payments | @stripe/react-stripe-js |
| Rich text | TipTap |
| Charts | Recharts |
| Server | Nginx 1.27 (production) |

### Infrastructure
| Service | Technology |
|---|---|
| Containerisation | Docker + Docker Compose |
| Database | Neon (serverless PostgreSQL) |
| Reverse proxy | Nginx |
| CI-readiness | pytest + Vitest test suites |

---

## Features

### Portfolio & CMS
- Projects, experience, education, certifications, publications
- Fully editable hero section (name, title, photo, resume, GitHub link) via admin
- Skills taxonomy with category grouping
- Redis-cached public endpoints (300 s TTL)

### E-commerce Store
- Product catalogue with categories, tags, brand, SKU, and technical specifications
- Multi-image support with drag-to-reorder
- Discounted pricing with automatic discount-% display
- Shopping cart with tax calculation
- Order management with status tracking
- Admin analytics dashboard (revenue, orders, users)

### Payment Processing
- **Stripe** — card payments via Stripe Elements + real-time webhook verification
- **PayPal** — OAuth redirect approval flow
- **MTN MoMo** — USSD push-to-phone with HMAC-signed callback security

### Learning Management System (LMS)
- Hierarchical course structure (sections → lessons → content blocks)
- Lesson types: video, text, code, document, mixed
- Progress tracking with server-enforced completion rules:
  - Video: 70% watch-time required
  - Text/code/document: auto-complete on visit
  - Quiz/assignment: passing attempt required
- Automatic certificate generation on 100% completion
- Course payment gate (Stripe) — paid courses require confirmed payment before enrollment
- Free preview lessons for unenrolled visitors

### Authentication & Security
- JWT access (30 min) + refresh (7 days) tokens
- Google OAuth (sign-in with Google)
- Email-based Two-Factor Authentication (6-digit OTP, 10-min TTL, stored hashed in Redis)
- Password reset via secure token (SHA-256 hashed, 1-hour expiry, stored in DB)
- Role-based access control: `user` < `admin` < `superadmin`
- Admin routes protected on both frontend and backend

### Support Ticketing
- Public contact form — creates a tracked support ticket
- Thread-based conversation between user and support team
- Status workflow: Open → In Progress → Waiting for User → Resolved → Closed
- Priority levels: Low / Medium / High / Urgent
- Email notifications: ticket confirmation to user, new-ticket alert to admin, reply notifications
- Admin portal: ticket list with filters, stats dashboard, inline reply, status update

### Media Management
- File upload endpoint (local storage → Docker volume → S3-ready)
- Gallery page with folder-based filtering and masonry layout
- Per-folder organisation (products, courses, profile, resumes, gallery)

### Notifications (Email)
All emails sent asynchronously via Celery:
- Email address verification
- Welcome email after verification
- Password reset link
- 2FA one-time code
- Order confirmation
- Support ticket confirmation + admin alert
- Ticket reply notification

---

## Project Structure

```
daltonportfolio/
├── backend/                    # FastAPI application
│   ├── alembic/                # Database migrations
│   │   └── versions/           # 13 migration files (0001 → 0013)
│   ├── app/
│   │   ├── api/v1/endpoints/   # Route handlers (auth, courses, ecommerce, support, …)
│   │   ├── core/               # Settings (Pydantic), security utilities
│   │   ├── db/                 # SQLAlchemy engine, session, Redis client
│   │   ├── models/             # ORM models (user, courses, ecommerce, support, …)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Stripe, PayPal, MoMo, email service
│   │   └── tasks/              # Celery tasks (email, media, order processing)
│   ├── tests/                  # pytest test suite
│   ├── .env.example            # Environment variable template
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pytest.ini
│
├── frontend/                   # React + TypeScript SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # Reusable UI components + course components
│   │   │   ├── pages/          # Page components (admin, courses, store, auth, …)
│   │   │   ├── store/          # Zustand stores (auth, cart, course)
│   │   │   └── utils/          # API client, helpers
│   │   ├── styles/             # Tailwind + global CSS
│   │   └── test/               # Vitest test suite
│   ├── nginx.conf              # Production Nginx configuration
│   ├── Dockerfile
│   └── package.json
│
├── .gitignore
├── docker-compose.yml
├── DEPLOY.md                   # Full GCP deployment guide
└── README.md                   # This file
```

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/jdaltonll02/gtech.git
cd gtech
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Open backend/.env and fill in all required values
```

See [Environment Variables](#environment-variables) for a full reference.

### 3. Build and start

```bash
# Pass your Stripe publishable key for the frontend build
docker compose build \
  --build-arg VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY

docker compose up -d
```

Services start in dependency order (Redis and DB health-checks must pass before the API starts). Alembic migrations and the superadmin seed run automatically on first boot.

### 4. Verify

| Service | URL |
|---|---|
| Frontend | http://localhost |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (ReDoc) | http://localhost:8000/redoc |
| Celery Flower | http://localhost:5555 |

### 5. Local development (without Docker)

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.db.init_db        # seeds superadmin
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                     # starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api` and `/media` to `http://localhost:8000`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in every value.

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | ✅ | 64-char hex secret — generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | ✅ | Async PostgreSQL URL (`postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC` | ✅ | Sync PostgreSQL URL (`postgresql://...`) — used by Celery tasks |
| `REDIS_URL` | ✅ | Redis connection URL |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key — also passed as Docker build arg |
| `PAYPAL_CLIENT_ID` | ✅ | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | ✅ | PayPal app client secret |
| `PAYPAL_MODE` | | `sandbox` or `live` (default: `sandbox`) |
| `MOMO_SUBSCRIPTION_KEY` | ✅ | MTN MoMo subscription key |
| `MOMO_API_USER` | ✅ | MTN MoMo API user UUID |
| `MOMO_API_KEY` | ✅ | MTN MoMo API key |
| `MOMO_CALLBACK_URL` | ✅ | Public URL for MoMo payment callbacks |
| `MOMO_CALLBACK_SECRET` | | Random secret appended to callback URL for webhook security |
| `FIRST_SUPERADMIN_EMAIL` | ✅ | Seeded superadmin email |
| `FIRST_SUPERADMIN_PASSWORD` | ✅ | Seeded superadmin password — **change after first login** |
| `GOOGLE_CLIENT_ID` | | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | | OAuth callback URL |
| `SMTP_HOST` | | SMTP server (leave blank to disable email) |
| `SMTP_PORT` | | SMTP port (default: `587`) |
| `SMTP_USER` | | SMTP username |
| `SMTP_PASSWORD` | | SMTP app password |
| `SMTP_FROM` | | From address for outgoing emails |
| `FRONTEND_URL` | | Full frontend URL — used in email links |
| `ALLOWED_ORIGINS` | | Comma-separated CORS origins |
| `TAX_RATE` | | Decimal tax rate (default: `0.08` = 8%) |
| `RATE_LIMIT_PER_MINUTE` | | API rate limit per IP (default: `60`) |

---

## Available Routes

### Frontend pages

| Path | Auth | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/portfolio` | Public | Portfolio showcase |
| `/gallery` | Public | Media gallery |
| `/store` | Public | Product catalogue |
| `/store/product/:id` | Public | Product detail |
| `/store/cart` | Public | Shopping cart |
| `/store/checkout` | User | Checkout with Stripe / PayPal / MoMo |
| `/store/orders` | User | Order history |
| `/courses` | Public | Course catalogue |
| `/courses/:id` | Public | Course detail & enrollment |
| `/courses/:id/learn` | Enrolled | Course player |
| `/courses/my-learning` | User | Enrolled courses |
| `/contact` | Public | Support ticket form |
| `/tickets` | User | My support tickets |
| `/tickets/:id` | User | Ticket thread |
| `/login` | Public | Sign in (supports 2FA step) |
| `/register` | Public | Sign up |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Set new password (from email link) |
| `/profile` | User | Profile, security, 2FA, courses |
| `/admin` | Admin | Admin dashboard |
| `/admin/courses/:id/builder` | Admin | Full-screen course builder |

### Backend API

Base path: `/api/v1`

| Module | Prefix | Docs |
|---|---|---|
| Authentication | `/auth` | `/docs#/auth` |
| Portfolio CMS | `/portfolio` | `/docs#/portfolio` |
| Media | `/media` | `/docs#/media` |
| E-commerce | `/categories`, `/products`, `/cart`, `/orders` | `/docs#/ecommerce` |
| Payments | `/payments` | `/docs#/payments` |
| Courses / LMS | `/courses` | `/docs#/courses` |
| Support tickets | `/support` | `/docs#/support` |
| Admin | `/admin` | `/docs#/admin` |
| Partners | `/partners` | `/docs#/partners` |

Full interactive documentation: **http://localhost:8000/docs**

---

## Architecture

```
Browser
  │
  ▼
Nginx (port 80 / 443)
  ├── /api/*  → FastAPI (port 8000, 4 workers)
  │              ├── PostgreSQL (Neon) via asyncpg
  │              ├── Redis (cache + Celery broker)
  │              └── Celery Worker
  │                    └── Email (SMTP) / media processing
  └── /*      → React SPA (static files)
```

**Request lifecycle:**
1. Browser → Nginx
2. Nginx proxies `/api/` to Uvicorn/FastAPI
3. FastAPI validates JWT, applies rate limiting, runs RBAC
4. Async SQLAlchemy queries PostgreSQL on Neon
5. Write-through cache invalidation via Redis
6. Long-running tasks (emails, order processing) dispatched to Celery
7. Celery worker processes tasks and sends emails via SMTP

---

## Database Migrations

Migrations are managed with Alembic and run automatically on container start.

```bash
# Check current revision
docker compose exec api alembic current

# Apply all pending migrations
docker compose exec api alembic upgrade head

# Create a new migration
docker compose exec api alembic revision --autogenerate -m "description"

# Roll back one step
docker compose exec api alembic downgrade -1
```

### Migration history

| Revision | Description |
|---|---|
| 0001 | Initial schema (users, portfolio, e-commerce, courses) |
| 0002 | Product pricing fields |
| 0003 | Product image URLs array |
| 0004 | Email verification + skills |
| 0005 | Course builder (sections, lessons, content blocks, assessments) |
| 0006 | Quiz attempts |
| 0007 | Profile settings (singleton) |
| 0008 | Course payments |
| 0009 | Partners & businesses |
| 0010 | Google OAuth (`google_id` on users) |
| 0011a | Fix enum types (`native_enum=False`) |
| 0011b | Product extended fields (SKU, brand, tags, specs, weight) |
| 0012 | Merge heads |
| 0013 | Support tickets, password reset tokens, 2FA field |

---

## Payment Integrations

### Stripe (card payments)
1. Frontend calls `POST /orders/checkout` → order created
2. Frontend calls `POST /payments/stripe/intent/{order_id}` → receives `client_secret`
3. Stripe.js `confirmCardPayment(client_secret, { card })` — card never touches the server
4. Stripe webhook `payment_intent.succeeded` → order status → `paid` → Celery fulfillment task

**For courses:** `POST /courses/{id}/payment-intent` → confirm with Stripe.js → `POST /courses/{id}/confirm-payment` → enrollment created.

### PayPal
1. `POST /payments/paypal/intent/{order_id}` → `approval_url`
2. User redirected to PayPal
3. On return: `POST /payments/paypal/capture/{paypal_order_id}` → order marked paid

### MTN MoMo
1. `POST /payments/momo/intent/{order_id}?phone_number=256XXXXXXXXX` → USSD push sent
2. User approves on phone
3. MoMo POSTs to `/payments/momo/callback?secret=XXXX` → verified → order paid

---

## Running Tests

### Backend (pytest)
```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

Test coverage includes: auth endpoints (register, login, refresh), payment security (MOMO secret verification, Stripe webhook signature, PayPal task dispatch), health check.

### Frontend (Vitest)
```bash
cd frontend
npm test
```

Test coverage includes: API client (auth headers, token refresh, 401 handling), auth store, cart store, course store, payment flow helpers.

---

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for the complete GCP VM deployment guide covering:

- VM sizing and firewall rules
- Docker installation
- Environment configuration
- HTTPS setup with Let's Encrypt
- Stripe webhook registration
- Database backup strategy
- Zero-downtime update procedure
- Troubleshooting

---

## Security Notes

- **Never commit `backend/.env`** — it contains real credentials. The `.gitignore` blocks it.
- **Rotate credentials** if `.env` is accidentally pushed to a public repository.
- The **admin route** (`/admin`) is protected on both the frontend (`RequireAdmin` component) and every backend endpoint (`AdminUser` dependency).
- **Stripe webhooks** are verified with HMAC signature before processing.
- **MoMo callbacks** require a shared secret in the query string.
- **2FA codes** are stored as SHA-256 hashes in Redis with 10-minute TTL.
- **Password reset tokens** are stored as SHA-256 hashes in the database with 1-hour expiry.
- Flower (Celery monitoring) runs on port 5555 — restrict this to your IP in firewall rules.

---

## License

Private repository — all rights reserved. © 2026 John Dalton Gibson / Gibson Technologies.
