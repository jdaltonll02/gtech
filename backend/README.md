# Portfolio CMS Backend API

FastAPI + PostgreSQL + Redis backend for the portfolio, CMS, and e-commerce platform.

---

## Quick Start

### 1. Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run with Docker (recommended)
```bash
# From project root
docker-compose up --build
```
This starts PostgreSQL, Redis, runs Alembic migrations, seeds the superadmin, and starts the API on port 8000.

### 3. Run locally
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed superadmin
python -m app.db.init_db

# Start server
uvicorn app.main:app --reload --port 8000
```

---

## API Documentation

Interactive docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Endpoints Reference

### Auth — `/api/v1/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login, returns JWT tokens |
| POST | `/refresh` | Public | Refresh access token |
| GET | `/me` | User | Get current user profile |

### Portfolio CMS — `/api/v1/portfolio`
All list/get endpoints are public. Create/update/delete require Admin or SuperAdmin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects (cached) |
| POST | `/projects` | Create project |
| GET | `/projects/{id}` | Get project |
| PATCH | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Delete project |
| GET/POST/PATCH/DELETE | `/experience/{id}` | Experience CRUD |
| GET/POST/PATCH/DELETE | `/education/{id}` | Education CRUD |
| GET/POST/PATCH/DELETE | `/certifications/{id}` | Certification CRUD |
| GET/POST/PATCH/DELETE | `/publications/{id}` | Publication CRUD |

### Media — `/api/v1/media`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload` | User | Upload file to S3 |
| GET | `/` | Admin | List all media |
| DELETE | `/{id}` | Admin | Delete media + S3 object |

### E-commerce — `/api/v1`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | Public | List categories |
| POST | `/categories` | Admin | Create category |
| PATCH/DELETE | `/categories/{id}` | Admin | Update/delete category |
| GET | `/products` | Public | List products (filter by category) |
| POST | `/products` | Admin | Create product |
| GET/PATCH/DELETE | `/products/{id}` | Public/Admin | Get/update/delete product |
| GET | `/cart` | User | Get cart with totals |
| POST | `/cart` | User | Add item to cart |
| PATCH | `/cart/{id}` | User | Update cart item quantity |
| DELETE | `/cart/{id}` | User | Remove cart item |
| DELETE | `/cart` | User | Clear cart |
| GET | `/orders` | User | List user's orders |
| GET | `/orders/{id}` | User | Get order detail |
| POST | `/orders/checkout` | User | Create order from cart |

### Payments — `/api/v1/payments`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe/intent/{order_id}` | User | Create Stripe PaymentIntent |
| POST | `/stripe/webhook` | Public | Stripe webhook handler |
| POST | `/paypal/intent/{order_id}` | User | Create PayPal order |
| POST | `/paypal/capture/{paypal_order_id}` | User | Capture PayPal payment |
| POST | `/momo/intent/{order_id}?phone_number=` | User | Initiate MTN MOMO payment |
| POST | `/momo/callback` | Public | MOMO async callback |
| GET | `/momo/status/{reference}` | User | Check MOMO transaction status |

### Admin — `/api/v1/admin`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics` | Admin | Full analytics dashboard data |
| GET | `/orders` | Admin | List all orders (paginated) |
| PATCH | `/orders/{id}/status` | Admin | Update order status |

---

## Database Schema

```
users
  id UUID PK | email | full_name | hashed_password | role | is_active | is_verified | created_at | updated_at

projects
  id UUID PK | title | description | category | tags[] | github_url | live_url | image_url | featured | order_index | created_at | updated_at

experiences
  id UUID PK | company | position | duration | location | description | achievements[] | order_index | created_at | updated_at

education
  id UUID PK | institution | degree | field_of_study | start_year | end_year | gpa | description | order_index | created_at | updated_at

certifications
  id UUID PK | title | issuer | date | credential_url | image_url | order_index | created_at | updated_at

publications
  id UUID PK | title | authors | venue | year | abstract | link | doi | order_index | created_at | updated_at

media
  id UUID PK | filename | original_filename | content_type | size_bytes | s3_key | s3_bucket | cdn_url | folder | uploaded_by | created_at

categories
  id UUID PK | name | slug | description | created_at

products
  id UUID PK | name | description | price | category_id FK | image_url | in_stock | stock_quantity | is_active | created_at | updated_at

cart_items
  id UUID PK | user_id FK | product_id FK | quantity | created_at | updated_at

orders
  id UUID PK | user_id FK | status | subtotal | tax | total | payment_provider | payment_status | payment_intent_id | payment_reference | billing_email | billing_name | notes | created_at | updated_at

order_items
  id UUID PK | order_id FK | product_id FK | quantity | unit_price | total_price | product_name
```

---

## Payment Flow

### Stripe
1. `POST /orders/checkout` → creates order with status `payment_pending`
2. `POST /payments/stripe/intent/{order_id}` → returns `client_secret`
3. Frontend confirms payment with Stripe.js using `client_secret`
4. Stripe sends webhook to `/payments/stripe/webhook` → order marked `paid`

### PayPal
1. `POST /orders/checkout` → creates order
2. `POST /payments/paypal/intent/{order_id}` → returns `approval_url`
3. User redirected to PayPal approval URL
4. On return, `POST /payments/paypal/capture/{paypal_order_id}` → order marked `paid`

### MTN MOMO
1. `POST /orders/checkout` → creates order
2. `POST /payments/momo/intent/{order_id}?phone_number=256XXXXXXXXX` → sends push to phone
3. User approves on phone
4. MOMO calls `/payments/momo/callback` → order marked `paid`
5. Poll `/payments/momo/status/{reference}` to check status

---

## Security
- JWT Bearer tokens (access: 30min, refresh: 7 days)
- bcrypt password hashing
- Role-based access: `user` < `admin` < `superadmin`
- Rate limiting: 60 req/min per IP (configurable)
- Stripe webhook signature verification
- Input validation via Pydantic v2

## Caching
- Redis caches portfolio list endpoints for 300s
- Cache invalidated on any write to that resource
