# Tutorial — run an order end-to-end

> **Audience:** new contributors who want to exercise the full stack.
> **Time required:** ~30 minutes (incl. setup).
> **Last updated:** 2026-07-02.
> **Standards referenced:** Diátaxis (this is a _tutorial_ — learning
> focused, not reference), IEEE 829-2008 §8 (test script structure),
> Microsoft Docs tutorial format.

This tutorial walks you through the full lifecycle of an order — from
browsing the public catalog, through checkout, payment confirmation,
admin fulfilment, and order history. By the end you'll have:

- [x] Spun up the API + Vite dev server locally.
- [x] Walked the React SPA through every screen the order touches.
- [x] Verified the data made it into PostgreSQL via `psql`.
- [x] Cross-referenced the order with the PHASE 05 design spec.

## Before you start

You should have:

| Prerequisite | Version | Why |
|--------------|---------|-----|
| Node.js      | ≥ 20    | runs the API and Vite |
| npm          | ≥ 10    | bundled with Node 20 |
| PostgreSQL   | ≥ 17    | the API talks to Postgres via `pg` |
| `psql`       | any     | for verifying the data at the end |
| `curl`       | any     | for the small health check |

If you haven't set up the project yet, follow
[`development/getting-started.md`](../development/getting-started.md)
first. This tutorial assumes you can run `npm run api` and see
`{"status":"ok"}` on `http://127.0.0.1:3000/api/health`.

## Step 1 — boot the stack

Open two terminals in `app/`:

```sh

# Terminal A — Express API on :3000

npm run api

# Terminal B — Vite dev server on :5173

npm run dev
```

Open <http://127.0.0.1:5173> in a browser. You should land on the home
page. If you don't, check the two terminals for error messages — most
common cause is a missing `.env` (see the getting-started guide).

## Step 2 — exercise the public catalog

1. From the home page, click any product card.
2. You should see the **product detail page** with name, price, and
   images.
3. Note the product URL — it looks like `/product/<slug>-<id>`.

Behind the scenes this fires `GET /api/products/:id`. Verify with `curl`:

```sh
curl -s http://127.0.0.1:3000/api/products/<id> | head -40
```

The response shape is documented in
[`architecture/api.md`](../architecture/api.md) §"Products".

**Diátaxis check:** you're now in the _explanation_ mindset — "what does
the system look like in motion?" Don't get stuck here. Move on.

## Step 3 — register a customer

1. Click the avatar in the navbar → **Sign in** → **Create account**.
2. Use a unique email (the seed script adds three users — see
   [`database/README.md`](../../database/README.md) §"Seed users").
3. Confirm the redirect lands you on `/customer` (the customer dashboard).

What you should see:

- The navbar shows your display name.
- A greeting with your first name.
- A row of "Recent orders" — empty at this point.

This fires `POST /api/auth/register` + `POST /api/auth/login` and stores
a JWT in `localStorage` under `noufex_token`. See
[`app/src/context/AppContext.tsx`](../../app/src/context/AppContext.tsx)
for the exact storage key.

## Step 4 — place an order

1. Go back to the product detail page from Step 2.
2. Click **Add to cart** — the cart icon in the navbar updates.
3. Click the cart icon → **Checkout**.
4. Pick a saved address (you may need to add one in
   `/customer/addresses` if you don't have one yet).
5. Pick **Cash on Delivery** as the payment method — easiest to verify
   end-to-end without a payment provider.
6. Click **Place order**.

You should land on `/checkout/success?orderId=<uuid>`. Capture the
`orderId` from the URL — you'll need it in Step 5.

**PHASE 05 cross-reference:** the steps above map directly to test
cases in [`docs/testing/phases/PHASE_05_ORDERS_INVENTORY.md`](../testing/phases/PHASE_05_ORDERS_INVENTORY.md).
The place-order endpoint is `POST /api/orders`; the inventory decrement
is verified by an SQL `SELECT` after the response.

## Step 5 — verify in the database

Open a third terminal:

```sh
psql "postgresql://noufex_app:CHANGE_ME_APP@localhost:5432/noufex_db"
```

Then:

```sql
-- 1. Confirm the order exists
SELECT id, status, total_amount, created_at
  FROM orders
 WHERE id = '<orderId from step 4>'
 ORDER BY created_at DESC
 LIMIT 1;

-- 2. Confirm the inventory decrement trigger fired
SELECT product_id, quantity, created_at
  FROM inventory_log
 ORDER BY created_at DESC
 LIMIT 5;

-- 3. Confirm the audit log captured the action
SELECT actor_id, action, target_table, target_id, created_at
  FROM admin_audit_log
 ORDER BY created_at DESC
 LIMIT 5;
```

If any of these return zero rows, you've found a bug — file an issue
using the [bug report template](../../.github/ISSUE_TEMPLATE/bug_report.md)
and include the output.

## Step 6 — view as admin

1. Sign out of the customer account.
2. Sign in as the seed admin: email `admin@noufex.local`, password
   `AdminPass123!` (the seed script documents these — see
   [`database/seed.sql`](../../database/seed.sql) for the exact list).
3. Navigate to `/admin/orders`.
4. The order you placed should appear with status `pending`.
5. Click **Mark as processing** to advance it. This fires
   `PATCH /api/admin/orders/:id/status`.

PHASE 11 ([`docs/testing/phases/PHASE_11_ADMIN_RBAC.md`](../testing/phases/PHASE_11_ADMIN_RBAC.md))
covers the admin happy path in detail.

## Step 7 — run the matching PHASE test

The PHASE scripts under `tests/e2e/` automate what you just did by hand.
Run the order-related ones to see them in action:

```sh

# From the repo root

node tests/e2e/reset-rate-limit.cjs   # clear the per-user bucket
powershell -File tests/e2e/phase05_orders_inventory.ps1
powershell -File tests/e2e/phase11_admin_rbac.ps1
```

If either script reports a FAIL that you can't reproduce by hand, the
test is likely the wrong one — the `rate-limit cascade` failure mode
documented in MASTER_PLAN §11.1 is a test-infra issue, not a code bug.

## Recap

You walked through every layer of the stack:

```text
React SPA (Vite, 5173)
   ↓ fetch /api/* (browser)
Express API (tsx, 3000)
   ↓ pg pool (Node)
PostgreSQL 17 (5432)
   ↓ triggers (PL/pgSQL)
admin_audit_log, inventory_log
```

You also exercised:

- Public catalog (PHASE 02)
- Auth + register + login (PHASE 00)
- Cart + checkout (PHASE 04 + 07)
- Orders + inventory decrement (PHASE 05)
- Admin RBAC (PHASE 11)

That's 6 PHASE specs covered in 30 minutes of hands-on time. Well done.

## Where to go next

| If you want to …                             | Read                                                  |
|----------------------------------------------|-------------------------------------------------------|
| Understand how a single endpoint is wired    | [`architecture/api.md`](../architecture/api.md) §"Endpoint anatomy" |
| See how the DB enforces integrity            | [`architecture/database.md`](../architecture/database.md) §"Triggers" |
| Add a new API endpoint                       | [`../CONTRIBUTING.md`](../../CONTRIBUTING.md) §"Adding an API endpoint" |
| Write your first PHASE test script           | [`testing/conventions.md`](../testing/conventions.md) §"PHASE scripts" |
| Set up the MkDocs site                       | [`../BUILD.md`](../BUILD.md)                          |
