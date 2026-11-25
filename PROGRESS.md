# G-Tech platform implementation progress

Last verified: 2026-11-25

## Phase 1 — API contract and access security

- [x] Align React ecommerce requests with the Express `/api/v1/ecommerce` routes.
- [x] Require authentication and active enrollment for course AI and private course documents.
- [x] Remove quiz answers and explanations from learner lesson payloads.
- [x] Scope course-management endpoints to administrators or assigned instructors.
- [x] Sanitize rich HTML before rendering it and disallow inline scripts through CSP.

Acceptance: server contract/security tests pass; React production build passes.

## Phase 2 — Ecommerce transaction integrity

- [x] Reserve stock atomically at checkout with row locking.
- [x] Reject inactive, unavailable, or insufficient-stock products.
- [x] Restore reserved inventory when orders fail or expire.
- [x] Make Stripe, PayPal, and Mobile Money payment completion idempotent.
- [x] Persist immutable shipping details on the order.
- [x] Add guarded fulfillment transitions, tracking, shipment, and delivery timestamps.
- [x] Add an admin orders and fulfillment workspace.

Acceptance: domain tests, React tests, and production startup test pass.

## Phase 3 — Course assessment integrity

- [x] Support single-answer and multi-select quizzes consistently.
- [x] Persist assignment/project submissions and instructor grading.
- [x] Gate lesson completion on mandatory quiz and assignment results.
- [x] Keep video watch progress monotonic and require a completion threshold.
- [x] Issue verifiable certificates and completion badges idempotently.
- [ ] Enforce quiz attempt limits and assessment timers on the server.
- [ ] Add rubrics, file submissions, and a consolidated instructor gradebook.

## Phase 4 — Course access and merchandising

- [x] Enforce private course access grants and prerequisites.
- [x] Enforce enrollment-relative lesson drip schedules.
- [x] Add course discussions with instructor indicators and moderation.
- [x] Add instructor assignment management.
- [x] Add course coupon CRUD, validation, concurrent usage limits, and redemption claims.
- [x] Support zero-cost coupon checkout without creating an external payment intent.
- [ ] Add bundles, subscriptions, cohort scheduling, and waitlists.

## Phase 5 — Operational reliability

- [x] Add ordered SQL migrations with an advisory lock and migration history.
- [x] Add database readiness checks that verify the current migration level.
- [x] Add a durable PostgreSQL job queue with retries and stale-job recovery.
- [x] Move paid-order processing, order email, and course-completion email to durable jobs.
- [ ] Consolidate the legacy base schema into a reproducible fresh-database SQL bootstrap.
- [ ] Move all remaining fire-and-forget notifications to durable jobs.
- [ ] Add provider refund operations, returns/RMA, and inventory reconciliation.

## Phase 6 — Security, performance, and production confidence

- [x] Remove inline script permission from Content Security Policy.
- [x] Sanitize blog, course, and mathematical rich content.
- [ ] Move refresh credentials from local storage to rotated HttpOnly secure cookies.
- [ ] Replace process-local rate limiting with a shared atomic store.
- [x] Route-split the React application and reduce the initial bundle below 500 kB gzip (238 kB verified).
- [ ] Add PostgreSQL-backed integration tests for migrations, checkout, coupons, and grading.
- [ ] Add browser end-to-end tests for purchase, course completion, and fulfillment.
- [ ] Add structured logs, error tracking, metrics, and alerting.

## Current verification

- Server: 9 test files, 34 tests passing.
- React: 5 test files, 38 tests passing.
- React production build: passing; initial JavaScript bundle is 238 kB gzip.
- Deployment: not performed from this implementation batch.
