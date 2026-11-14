# Express Porting Inventory

Generated from the canonical Python files on 2026-11-10.

> The repository contains untracked duplicate files ending in ` (1)`. They are not imported by the application, are excluded from this inventory, and must remain untouched.

## Summary

- HTTP routes: **215**
- Existing database: Neon PostgreSQL (preserve all table/column names and pgvector)
- Only allowed additive schema change: `kv_store`
- Node process: API under `/api/v1`, `/health`, `/media`, then React SPA fallback
- Status vocabulary: `todo`, `done`, `blocked`

## Authorization semantics

`CurrentUser` requires a valid HS256 access token, a non-revoked JTI, an issue time after the latest password change, and an active database user. `OptionalUser` resolves invalid/missing credentials to anonymous. Admin means `admin` or `superadmin`; superadmin is exact. Permission guards allow admins automatically and otherwise require any named permission from an active staff-role assignment. Course scoping must preserve `manage_courses` versus `manage_own_courses` plus role metadata `course_ids`.

## Routes

| Method | Path | Authentication / role | Success | Python source | Status |
|---|---|---|---:|---|---|
| GET | `/api/v1/admin/analytics` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:15` | done |
| GET | `/api/v1/admin/orders` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:63` | done |
| PATCH | `/api/v1/admin/orders/{order_id}/status` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:75` | done |
| GET | `/api/v1/admin/users` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:86` | done |
| PATCH | `/api/v1/admin/users/{user_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:92` | done |
| DELETE | `/api/v1/admin/users/{user_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/admin.py:104` | done |
| GET | `/api/v1/admin/system-status` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/admin.py:113` | done |
| POST | `/api/v1/ai/chat` | Optional bearer | 200 | `backend/app/api/v1/endpoints/ai.py:60` | done |
| POST | `/api/v1/ai/classroom/{course_id}` | Optional bearer | 200 | `backend/app/api/v1/endpoints/ai.py:85` | done |
| GET | `/api/v1/ai/sessions/{session_key}/history` | Public | 200 | `backend/app/api/v1/endpoints/ai.py:118` | done |
| GET | `/api/v1/admin/ai/documents` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/ai.py:135` | done |
| POST | `/api/v1/admin/ai/documents` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/ai.py:146` | done |
| DELETE | `/api/v1/admin/ai/documents/{doc_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/ai.py:204` | done |
| GET | `/api/v1/courses/{course_id}/ai/documents` | Public | 200 | `backend/app/api/v1/endpoints/ai.py:216` | done |
| POST | `/api/v1/courses/{course_id}/ai/documents` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/ai.py:226` | done |
| DELETE | `/api/v1/courses/{course_id}/ai/documents/{doc_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/ai.py:280` | done |
| POST | `/api/v1/auth/forgot-password` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:57` | done |
| POST | `/api/v1/auth/reset-password` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:84` | done |
| POST | `/api/v1/auth/2fa/send-code` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:118` | done |
| POST | `/api/v1/auth/2fa/verify` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:130` | done |
| POST | `/api/v1/auth/2fa/enable` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:145` | done |
| POST | `/api/v1/auth/2fa/disable` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:152` | done |
| POST | `/api/v1/auth/register` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:160` | done |
| POST | `/api/v1/auth/login` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:180` | done |
| POST | `/api/v1/auth/logout` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:227` | done |
| POST | `/api/v1/auth/refresh` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:241` | done |
| GET | `/api/v1/auth/me` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:254` | done |
| PATCH | `/api/v1/auth/me` | Authenticated | 200 | `backend/app/api/v1/endpoints/auth.py:261` | done |
| POST | `/api/v1/auth/verify-email` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:297` | done |
| POST | `/api/v1/auth/resend-verification` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:317` | done |
| GET | `/api/v1/auth/oauth-token` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:331` | done |
| GET | `/api/v1/auth/google` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:345` | done |
| GET | `/api/v1/auth/google/callback` | Public | 200 | `backend/app/api/v1/endpoints/auth.py:358` | done |
| GET | `/api/v1/blog` | Public | 200 | `backend/app/api/v1/endpoints/blog.py:24` | done |
| GET | `/api/v1/blog/categories` | Public | 200 | `backend/app/api/v1/endpoints/blog.py:51` | done |
| GET | `/api/v1/blog/{slug}` | Public | 200 | `backend/app/api/v1/endpoints/blog.py:59` | done |
| GET | `/api/v1/blog/admin/all` | Permission: manage_blog | 200 | `backend/app/api/v1/endpoints/blog.py:76` | done |
| POST | `/api/v1/blog/admin/posts` | Permission: manage_blog | 201 | `backend/app/api/v1/endpoints/blog.py:84` | done |
| PATCH | `/api/v1/blog/admin/posts/{post_id}` | Permission: manage_blog | 200 | `backend/app/api/v1/endpoints/blog.py:108` | done |
| DELETE | `/api/v1/blog/admin/posts/{post_id}` | Permission: manage_blog | 204 | `backend/app/api/v1/endpoints/blog.py:130` | done |
| GET | `/api/v1/courses/` | Public | 200 | `backend/app/api/v1/endpoints/courses.py:80` | done |
| POST | `/api/v1/courses/` | Permission: manage_courses/manage_own_courses | 201 | `backend/app/api/v1/endpoints/courses.py:123` | done |
| GET | `/api/v1/courses/admin/all` | Permission: manage_courses/manage_own_courses | 200 | `backend/app/api/v1/endpoints/courses.py:134` | done |
| GET | `/api/v1/courses/admin/{course_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:149` | done |
| GET | `/api/v1/courses/admin/{course_id}/enrollments` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:254` | done |
| DELETE | `/api/v1/courses/admin/enrollments/{enrollment_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:281` | done |
| GET | `/api/v1/courses/my/enrollments` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:293` | done |
| GET | `/api/v1/courses/my/certificates` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:319` | done |
| GET | `/api/v1/courses/certificates/{cert_number}` | Public | 200 | `backend/app/api/v1/endpoints/courses.py:343` | done |
| GET | `/api/v1/courses/lessons/{lesson_id}/blocks` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:368` | done |
| POST | `/api/v1/courses/lessons/{lesson_id}/blocks` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/courses.py:376` | done |
| PATCH | `/api/v1/courses/blocks/{block_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:387` | done |
| DELETE | `/api/v1/courses/blocks/{block_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:399` | done |
| GET | `/api/v1/courses/lessons/{lesson_id}/assessments` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:410` | done |
| POST | `/api/v1/courses/lessons/{lesson_id}/assessments` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/courses.py:421` | done |
| PATCH | `/api/v1/courses/assessments/{assessment_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:433` | done |
| DELETE | `/api/v1/courses/assessments/{assessment_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:447` | done |
| POST | `/api/v1/courses/assessments/{assessment_id}/submit` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:456` | done |
| POST | `/api/v1/courses/assessments/{assessment_id}/questions` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/courses.py:541` | done |
| PATCH | `/api/v1/courses/questions/{question_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:552` | done |
| DELETE | `/api/v1/courses/questions/{question_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:564` | done |
| POST | `/api/v1/courses/sections/{section_id}/lessons` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/courses.py:575` | done |
| PATCH | `/api/v1/courses/sections/{section_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:592` | done |
| DELETE | `/api/v1/courses/sections/{section_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:614` | done |
| PATCH | `/api/v1/courses/sections/{section_id}/lessons/reorder` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:623` | done |
| PATCH | `/api/v1/courses/lessons/{lesson_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:638` | done |
| DELETE | `/api/v1/courses/lessons/{lesson_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:667` | done |
| POST | `/api/v1/courses/{course_id}/sections` | Admin/superadmin | 201 | `backend/app/api/v1/endpoints/courses.py:680` | done |
| PATCH | `/api/v1/courses/{course_id}/sections/reorder` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:696` | done |
| POST | `/api/v1/courses/{course_id}/enroll` | Authenticated | 201 | `backend/app/api/v1/endpoints/courses.py:717` | done |
| POST | `/api/v1/courses/{course_id}/payment-intent` | Authenticated | 201 | `backend/app/api/v1/endpoints/courses.py:765` | done |
| POST | `/api/v1/courses/{course_id}/confirm-payment` | Authenticated | 201 | `backend/app/api/v1/endpoints/courses.py:815` | done |
| GET | `/api/v1/courses/{course_id}/lessons/{lesson_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:881` | done |
| POST | `/api/v1/courses/{course_id}/lessons/{lesson_id}/progress` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:939` | done |
| GET | `/api/v1/courses/{course_id}/progress` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:1063` | done |
| PATCH | `/api/v1/courses/{course_id}` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/courses.py:1078` | done |
| DELETE | `/api/v1/courses/{course_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/courses.py:1092` | done |
| GET | `/api/v1/courses/{course_id}` | Public | 200 | `backend/app/api/v1/endpoints/courses.py:1105` | done |
| GET | `/api/v1/courses/{course_id}/ratings/summary` | Public | 200 | `backend/app/api/v1/endpoints/courses.py:1162` | done |
| GET | `/api/v1/courses/{course_id}/ratings` | Public | 200 | `backend/app/api/v1/endpoints/courses.py:1177` | done |
| GET | `/api/v1/courses/{course_id}/ratings/me` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:1200` | done |
| POST | `/api/v1/courses/{course_id}/rate` | Authenticated | 200 | `backend/app/api/v1/endpoints/courses.py:1219` | done |
| DELETE | `/api/v1/courses/{course_id}/rate` | Authenticated | 204 | `backend/app/api/v1/endpoints/courses.py:1259` | done |
| GET | `/api/v1/ecommerce/categories` | Public | 200 | `backend/app/api/v1/endpoints/ecommerce.py:45` | done |
| POST | `/api/v1/ecommerce/categories` | Permission: manage_ecommerce | 201 | `backend/app/api/v1/endpoints/ecommerce.py:51` | done |
| PATCH | `/api/v1/ecommerce/categories/{cat_id}` | Permission: manage_ecommerce | 200 | `backend/app/api/v1/endpoints/ecommerce.py:59` | done |
| DELETE | `/api/v1/ecommerce/categories/{cat_id}` | Permission: manage_ecommerce | 204 | `backend/app/api/v1/endpoints/ecommerce.py:71` | done |
| GET | `/api/v1/ecommerce/products` | Public | 200 | `backend/app/api/v1/endpoints/ecommerce.py:82` | done |
| POST | `/api/v1/ecommerce/products` | Permission: manage_ecommerce | 201 | `backend/app/api/v1/endpoints/ecommerce.py:92` | done |
| GET | `/api/v1/ecommerce/products/{product_id}` | Public | 200 | `backend/app/api/v1/endpoints/ecommerce.py:108` | done |
| PATCH | `/api/v1/ecommerce/products/{product_id}` | Permission: manage_ecommerce | 200 | `backend/app/api/v1/endpoints/ecommerce.py:119` | done |
| DELETE | `/api/v1/ecommerce/products/{product_id}` | Permission: manage_ecommerce | 204 | `backend/app/api/v1/endpoints/ecommerce.py:155` | done |
| GET | `/api/v1/ecommerce/cart` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:186` | done |
| POST | `/api/v1/ecommerce/cart` | Authenticated | 201 | `backend/app/api/v1/endpoints/ecommerce.py:192` | done |
| PATCH | `/api/v1/ecommerce/cart/{item_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:213` | done |
| DELETE | `/api/v1/ecommerce/cart/{item_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:227` | done |
| DELETE | `/api/v1/ecommerce/cart` | Authenticated | 204 | `backend/app/api/v1/endpoints/ecommerce.py:241` | done |
| GET | `/api/v1/ecommerce/orders` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:250` | done |
| GET | `/api/v1/ecommerce/orders/{order_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:261` | done |
| POST | `/api/v1/ecommerce/orders/checkout` | Authenticated | 201 | `backend/app/api/v1/endpoints/ecommerce.py:274` | done |
| GET | `/api/v1/ecommerce/products/{product_id}/ratings/summary` | Public | 200 | `backend/app/api/v1/endpoints/ecommerce.py:320` | done |
| GET | `/api/v1/ecommerce/products/{product_id}/ratings` | Public | 200 | `backend/app/api/v1/endpoints/ecommerce.py:335` | done |
| GET | `/api/v1/ecommerce/products/{product_id}/ratings/me` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:358` | done |
| POST | `/api/v1/ecommerce/products/{product_id}/rate` | Authenticated | 200 | `backend/app/api/v1/endpoints/ecommerce.py:377` | done |
| DELETE | `/api/v1/ecommerce/products/{product_id}/rate` | Authenticated | 204 | `backend/app/api/v1/endpoints/ecommerce.py:412` | done |
| GET | `/api/v1/forms` | Public | 200 | `backend/app/api/v1/endpoints/forms.py:30` | done |
| GET | `/api/v1/forms/{slug}` | Optional bearer | 200 | `backend/app/api/v1/endpoints/forms.py:41` | done |
| POST | `/api/v1/forms/{slug}/submit` | Optional bearer | 201 | `backend/app/api/v1/endpoints/forms.py:56` | done |
| GET | `/api/v1/forms/admin/all` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:90` | done |
| GET | `/api/v1/forms/admin/{form_id}` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:96` | done |
| POST | `/api/v1/forms/admin/create` | Permission: manage_forms | 201 | `backend/app/api/v1/endpoints/forms.py:101` | done |
| PATCH | `/api/v1/forms/admin/{form_id}` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:113` | done |
| DELETE | `/api/v1/forms/admin/{form_id}` | Permission: manage_forms | 204 | `backend/app/api/v1/endpoints/forms.py:123` | done |
| POST | `/api/v1/forms/admin/{form_id}/fields` | Permission: manage_forms | 201 | `backend/app/api/v1/endpoints/forms.py:135` | done |
| PATCH | `/api/v1/forms/admin/fields/{field_id}` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:144` | done |
| DELETE | `/api/v1/forms/admin/fields/{field_id}` | Permission: manage_forms | 204 | `backend/app/api/v1/endpoints/forms.py:156` | done |
| POST | `/api/v1/forms/admin/{form_id}/fields/reorder` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:166` | done |
| GET | `/api/v1/forms/admin/{form_id}/submissions` | Permission: manage_forms | 200 | `backend/app/api/v1/endpoints/forms.py:179` | done |
| DELETE | `/api/v1/forms/admin/submissions/{submission_id}` | Permission: manage_forms | 204 | `backend/app/api/v1/endpoints/forms.py:191` | done |
| POST | `/api/v1/media/upload` | Authenticated | 201 | `backend/app/api/v1/endpoints/media.py:67` | done |
| GET | `/api/v1/media/` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/media.py:123` | done |
| GET | `/api/v1/media/{media_id}` | Public | 200 | `backend/app/api/v1/endpoints/media.py:131` | done |
| DELETE | `/api/v1/media/{media_id}` | Admin/superadmin | 204 | `backend/app/api/v1/endpoints/media.py:140` | done |
| POST | `/api/v1/media/migrate-legacy` | Admin/superadmin | 200 | `backend/app/api/v1/endpoints/media.py:153` | done |
| GET | `/api/v1/partners` | Public | 200 | `backend/app/api/v1/endpoints/partners.py:30` | done |
| POST | `/api/v1/partners/admin` | Permission: manage_partners | 201 | `backend/app/api/v1/endpoints/partners.py:41` | done |
| GET | `/api/v1/partners/businesses` | Public | 200 | `backend/app/api/v1/endpoints/partners.py:52` | done |
| POST | `/api/v1/partners/admin/businesses` | Permission: manage_partners | 201 | `backend/app/api/v1/endpoints/partners.py:63` | done |
| GET | `/api/v1/partners/businesses/{business_id}` | Public | 200 | `backend/app/api/v1/endpoints/partners.py:72` | done |
| PATCH | `/api/v1/partners/admin/businesses/{business_id}` | Permission: manage_partners | 200 | `backend/app/api/v1/endpoints/partners.py:81` | done |
| DELETE | `/api/v1/partners/admin/businesses/{business_id}` | Permission: manage_partners | 204 | `backend/app/api/v1/endpoints/partners.py:93` | done |
| GET | `/api/v1/partners/{partner_id}` | Public | 200 | `backend/app/api/v1/endpoints/partners.py:106` | done |
| PATCH | `/api/v1/partners/admin/{partner_id}` | Permission: manage_partners | 200 | `backend/app/api/v1/endpoints/partners.py:115` | done |
| DELETE | `/api/v1/partners/admin/{partner_id}` | Permission: manage_partners | 204 | `backend/app/api/v1/endpoints/partners.py:127` | done |
| POST | `/api/v1/payments/stripe/intent/{order_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/payments.py:29` | done |
| POST | `/api/v1/payments/stripe/webhook` | Public | 200 | `backend/app/api/v1/endpoints/payments.py:47` | done |
| POST | `/api/v1/payments/paypal/intent/{order_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/payments.py:110` | done |
| POST | `/api/v1/payments/paypal/capture/{paypal_order_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/payments.py:125` | done |
| POST | `/api/v1/payments/momo/intent/{order_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/payments.py:143` | done |
| POST | `/api/v1/payments/momo/callback` | Public | 200 | `backend/app/api/v1/endpoints/payments.py:162` | done |
| GET | `/api/v1/payments/momo/status/{reference}` | Authenticated | 200 | `backend/app/api/v1/endpoints/payments.py:187` | done |
| GET | `/api/v1/portfolio/projects` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:36` | done |
| POST | `/api/v1/portfolio/projects` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:47` | done |
| GET | `/api/v1/portfolio/projects/{project_id}` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:56` | done |
| PATCH | `/api/v1/portfolio/projects/{project_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:65` | done |
| DELETE | `/api/v1/portfolio/projects/{project_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:77` | done |
| GET | `/api/v1/portfolio/experience` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:89` | done |
| POST | `/api/v1/portfolio/experience` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:100` | done |
| GET | `/api/v1/portfolio/experience/{exp_id}` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:109` | done |
| PATCH | `/api/v1/portfolio/experience/{exp_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:118` | done |
| DELETE | `/api/v1/portfolio/experience/{exp_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:130` | done |
| GET | `/api/v1/portfolio/education` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:142` | done |
| POST | `/api/v1/portfolio/education` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:153` | done |
| GET | `/api/v1/portfolio/education/{edu_id}` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:162` | done |
| PATCH | `/api/v1/portfolio/education/{edu_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:171` | done |
| DELETE | `/api/v1/portfolio/education/{edu_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:183` | done |
| GET | `/api/v1/portfolio/certifications` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:195` | done |
| POST | `/api/v1/portfolio/certifications` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:206` | done |
| GET | `/api/v1/portfolio/certifications/{cert_id}` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:215` | done |
| PATCH | `/api/v1/portfolio/certifications/{cert_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:224` | done |
| DELETE | `/api/v1/portfolio/certifications/{cert_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:236` | done |
| GET | `/api/v1/portfolio/publications` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:248` | done |
| POST | `/api/v1/portfolio/publications` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:259` | done |
| GET | `/api/v1/portfolio/publications/{pub_id}` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:268` | done |
| PATCH | `/api/v1/portfolio/publications/{pub_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:277` | done |
| DELETE | `/api/v1/portfolio/publications/{pub_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:289` | done |
| GET | `/api/v1/portfolio/skills` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:301` | done |
| POST | `/api/v1/portfolio/skills` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/portfolio.py:312` | done |
| PATCH | `/api/v1/portfolio/skills/{skill_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:321` | done |
| DELETE | `/api/v1/portfolio/skills/{skill_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:333` | done |
| GET | `/api/v1/portfolio/profile` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:348` | done |
| PATCH | `/api/v1/portfolio/profile` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:357` | done |
| GET | `/api/v1/portfolio/testimonials` | Public | 200 | `backend/app/api/v1/endpoints/portfolio.py:373` | done |
| POST | `/api/v1/portfolio/testimonials` | Authenticated | 201 | `backend/app/api/v1/endpoints/portfolio.py:387` | done |
| GET | `/api/v1/portfolio/admin/testimonials` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:403` | done |
| PATCH | `/api/v1/portfolio/admin/testimonials/{testimonial_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/portfolio.py:410` | done |
| DELETE | `/api/v1/portfolio/admin/testimonials/{testimonial_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/portfolio.py:422` | done |
| GET | `/api/v1/rbac/permissions` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:19` | done |
| GET | `/api/v1/rbac/roles` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:26` | done |
| POST | `/api/v1/rbac/roles` | Superadmin | 201 | `backend/app/api/v1/endpoints/rbac.py:32` | done |
| PATCH | `/api/v1/rbac/roles/{role_id}` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:52` | done |
| DELETE | `/api/v1/rbac/roles/{role_id}` | Superadmin | 204 | `backend/app/api/v1/endpoints/rbac.py:73` | done |
| GET | `/api/v1/rbac/assignments` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:87` | done |
| POST | `/api/v1/rbac/assignments` | Superadmin | 201 | `backend/app/api/v1/endpoints/rbac.py:105` | done |
| PATCH | `/api/v1/rbac/assignments/{assignment_id}` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:136` | done |
| DELETE | `/api/v1/rbac/assignments/{assignment_id}` | Superadmin | 204 | `backend/app/api/v1/endpoints/rbac.py:162` | done |
| GET | `/api/v1/rbac/users` | Superadmin | 200 | `backend/app/api/v1/endpoints/rbac.py:174` | done |
| POST | `/api/v1/support/tickets` | Public | 201 | `backend/app/api/v1/endpoints/support.py:109` | done |
| GET | `/api/v1/support/tickets/my` | Authenticated | 200 | `backend/app/api/v1/endpoints/support.py:140` | done |
| GET | `/api/v1/support/tickets/my/{ticket_id}` | Authenticated | 200 | `backend/app/api/v1/endpoints/support.py:157` | done |
| POST | `/api/v1/support/tickets/my/{ticket_id}/reply` | Authenticated | 200 | `backend/app/api/v1/endpoints/support.py:170` | done |
| GET | `/api/v1/support/admin/tickets` | Permission: manage_tickets | 200 | `backend/app/api/v1/endpoints/support.py:203` | done |
| GET | `/api/v1/support/admin/tickets/{ticket_id}` | Permission: manage_tickets | 200 | `backend/app/api/v1/endpoints/support.py:239` | done |
| PATCH | `/api/v1/support/admin/tickets/{ticket_id}` | Permission: manage_tickets | 200 | `backend/app/api/v1/endpoints/support.py:252` | done |
| POST | `/api/v1/support/admin/tickets/{ticket_id}/reply` | Permission: manage_tickets | 200 | `backend/app/api/v1/endpoints/support.py:270` | done |
| GET | `/api/v1/support/admin/stats` | Permission: manage_tickets | 200 | `backend/app/api/v1/endpoints/support.py:298` | done |
| GET | `/api/v1/team` | Public | 200 | `backend/app/api/v1/endpoints/team.py:53` | done |
| GET | `/api/v1/team/{slug}` | Public | 200 | `backend/app/api/v1/endpoints/team.py:63` | done |
| GET | `/api/v1/team/admin/all` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:74` | done |
| POST | `/api/v1/team/admin` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/team.py:82` | done |
| PATCH | `/api/v1/team/admin/{member_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:93` | done |
| DELETE | `/api/v1/team/admin/{member_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/team.py:105` | done |
| POST | `/api/v1/team/admin/{member_id}/experiences` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/team.py:116` | done |
| PATCH | `/api/v1/team/admin/{member_id}/experiences/{exp_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:127` | done |
| DELETE | `/api/v1/team/admin/{member_id}/experiences/{exp_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/team.py:141` | done |
| POST | `/api/v1/team/admin/{member_id}/educations` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/team.py:154` | done |
| PATCH | `/api/v1/team/admin/{member_id}/educations/{edu_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:165` | done |
| DELETE | `/api/v1/team/admin/{member_id}/educations/{edu_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/team.py:179` | done |
| POST | `/api/v1/team/admin/{member_id}/projects` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/team.py:192` | done |
| PATCH | `/api/v1/team/admin/{member_id}/projects/{proj_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:203` | done |
| DELETE | `/api/v1/team/admin/{member_id}/projects/{proj_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/team.py:217` | done |
| POST | `/api/v1/team/admin/{member_id}/certifications` | Permission: manage_portfolio | 201 | `backend/app/api/v1/endpoints/team.py:230` | done |
| PATCH | `/api/v1/team/admin/{member_id}/certifications/{cert_id}` | Permission: manage_portfolio | 200 | `backend/app/api/v1/endpoints/team.py:241` | done |
| DELETE | `/api/v1/team/admin/{member_id}/certifications/{cert_id}` | Permission: manage_portfolio | 204 | `backend/app/api/v1/endpoints/team.py:255` | done |
| GET | `/health` | Public | 200 | `backend/app/main.py:94` | done |

## Tasks

| Task | Trigger / schedule | Retry | Source | Status |
|---|---|---|---|---|
| send_verification_email | Registration/resend | 3 × 60s | `tasks/email_tasks.py:9` | done |
| send_welcome_email | Verification | 3 × 60s | `tasks/email_tasks.py:23` | done |
| send_order_confirmation | Paid order | 3 × 60s | `tasks/email_tasks.py:37` | done |
| send_password_reset | Forgot password | 3 × 60s | `tasks/email_tasks.py:82` | done |
| send_2fa_code | Login/resend | 3 × 60s | `tasks/email_tasks.py:107` | done |
| send_ticket_notification | Ticket creation | 3 × 60s | `tasks/email_tasks.py:132` | done |
| send_course_completion | Course completion | 3 × 60s | `tasks/email_tasks.py:184` | done |
| send_ticket_reply | Ticket reply | 3 × 60s | `tasks/email_tasks.py:216` | done |
| process_uploaded_image | Upload | none declared | `tasks/media_tasks.py:8` | done |
| cleanup_orphaned_media | Every 24h | scheduled | `tasks/media_tasks.py:31` | done |
| process_paid_order | Payment success | 3 × 30s; idempotent | `tasks/order_tasks.py:7` | done |
| cancel_stale_orders | Every hour | scheduled | `tasks/order_tasks.py:68` | done |

## Services

| Service | Python source | Node implementation | Status |
|---|---|---|---|
| SMTP email | `services/email_service.py` | Nodemailer + Hostinger SMTP | done |
| Stripe | `services/stripe_service.py` | `stripe` | done |
| PayPal | `services/paypal_service.py` | REST via fetch | done |
| MTN MoMo | `services/momo_service.py` | fetch | done |
| LLM/embeddings | `services/llm.py` | `openai` compatible client | done |
| RAG | `services/rag.py` | JSON embeddings with in-process cosine similarity (matching current Python model) | done |
| PDF ingestion | `services/ingestion.py` | `pdf-parse` | done |
| Web search | `services/web_search.py` | isolated DuckDuckGo HTML adapter | done |
| S3 dead stub | `services/s3.py` | intentionally omitted | n/a |

## Environment variables

| Group | Variables |
|---|---|
| App | `APP_NAME`, `APP_VERSION`, `DEBUG`, `ENVIRONMENT`, `PORT` (Node/Hostinger addition) |
| Security | `SECRET_KEY` (required), `ALGORITHM` (HS256), `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` |
| Database/KV | `DATABASE_URL` (required Neon runtime URL), `DATABASE_URL_SYNC` (Python/Alembic compatibility), optional `REDIS_URL` |
| Media | `LOCAL_MEDIA_ROOT` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` |
| MoMo | `MOMO_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY`, `MOMO_BASE_URL`, `MOMO_ENVIRONMENT`, `MOMO_CALLBACK_URL`, `MOMO_CALLBACK_SECRET` |
| Commerce | `TAX_RATE` |
| HTTP | `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MINUTE`, `FRONTEND_URL`, `SITE_URL` |
| Seed | `FIRST_SUPERADMIN_EMAIL`, `FIRST_SUPERADMIN_PASSWORD` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Hostinger SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| AI | `HF_TOKEN`, `HF_BASE_URL`, `HF_CHAT_MODEL`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_PROVIDER` (replaced the CMU gateway) |

Defaults must match `backend/app/core/config.py`. Optional integrations warn and degrade gracefully. Hostinger SMTP is considered configured only when host, user, and password are all present.

## Middleware and cross-cutting behavior

| Concern | Required parity | Status |
|---|---|---|
| Security headers | Exact CSP, nosniff, DENY framing, referrer policy, permissions policy, production HSTS | done |
| CORS | Exact allow-list, credentials, methods, and headers | done |
| Rate limiting | Global IP limit plus auth limits (3/5/10 per minute); persistent store preferred | done |
| Proxy | Hostinger-safe `trust proxy` | done |
| Error handling | `{"detail": ...}`; FastAPI-like Zod validation errors with status 422 | done |
| Serialization | UUID strings, ISO datetimes, Decimal strings, enum values, snake_case | done |
| Uploads/images | Multer + Sharp | done |
| Stripe webhook | Raw body middleware before JSON | done |
| Media | Isolated storage module; same `/media` URL shape | done |
| Static app | Serve `frontend/dist` with non-API SPA fallback | done |

## KV parity

The driver interface must support JSON-aware get/set with TTL, delete, delete-by-pattern, token revocation, password-change markers, 2FA hashes, OAuth state, login lockout increment/expiry, and expired-row cleanup. Use ioredis only when `REDIS_URL` is explicitly set; otherwise use the additive PostgreSQL `kv_store` table so security state survives restarts.

