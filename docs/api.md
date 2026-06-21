# API Reference — Nouf-ex

All endpoints are served by [`app/server/index.ts`](../app/server/index.ts) on
the same origin as the SPA (default `http://localhost:3000`). The frontend
talks to relative paths (`/api/...`).

| Verb     | Path                                | Auth   | Purpose                                    |
| -------- | ----------------------------------- | ------ | ------------------------------------------ |
| `GET`    | `/api/stats/home`                   | —      | Homepage counters (used by healthcheck).   |
| `GET`    | `/api/products`                     | —      | List / search products.                   |
| `GET`    | `/api/products/featured`            | —      | Curated featured products.                 |
| `GET`    | `/api/products/deals`               | —      | Products with an active deal.              |
| `GET`    | `/api/products/:id`                 | —      | Product detail + store + reviews + images. |
| `GET`    | `/api/stores`                       | —      | List of stores.                            |
| `GET`    | `/api/stores/:id`                   | —      | Store detail + its products.               |
| `GET`    | `/api/stores/:id/reviews`           | —      | Reviews for a specific store.              |
| `GET`    | `/api/categories`                   | —      | Full category tree.                        |
| `GET`    | `/api/categories/:slug`             | —      | One category + its products.               |
| `GET`    | `/api/reviews`                      | —      | Reviews with optional filters.             |
| `POST`   | `/api/reviews`                      | —      | Submit a new review.                       |
| `GET`    | `/api/orders`                       | —      | List orders (filterable by query).         |
| `GET`    | `/api/orders/:id`                   | —      | One order with its items.                  |
| `POST`   | `/api/orders`                       | —      | Create an order from a cart snapshot.      |
| `GET`    | `/api/cart/:userId`                 | —      | Cart contents for a user.                  |
| `POST`   | `/api/cart`                         | —      | Add an item to a user's cart.              |
| `DELETE` | `/api/cart/:id`                     | —      | Remove one cart item.                      |
| `DELETE` | `/api/cart/clear/:userId`           | —      | Clear an entire cart.                      |
| `GET`    | `/api/wishlist/:userId`             | —      | Wishlist contents.                         |
| `POST`   | `/api/wishlist`                     | —      | Add an item to the wishlist.               |
| `DELETE` | `/api/wishlist/:id`                 | —      | Remove one wishlist item.                  |
| `GET`    | `/api/notifications/:userId`        | —      | List notifications for a user.             |
| `PUT`    | `/api/notifications/:id/read`       | —      | Mark one notification as read.             |
| `POST`   | `/api/auth/register`                | rate-limited | Create an account.                   |
| `POST`   | `/api/auth/login`                   | rate-limited | Exchange credentials for a session.  |
| `GET`    | `/api/auth/me`                      | —      | Return the current user (stub).            |
| `POST`   | `/api/payments`                     | rate-limited | Create a payment for an order.         |
| `GET`    | `/api/payments/order/:orderId`      | —      | Payments for one order.                    |
| `POST`   | `/api/payments/:id/confirm`         | —      | Confirm a payment (e.g. on COD receipt).   |
| `GET`    | `/api/addresses`                    | —      | List a user's saved addresses.             |
| `POST`   | `/api/addresses`                    | —      | Create a new address.                      |
| `DELETE` | `/api/addresses/:id`                | —      | Remove a saved address.                    |
| `GET`    | `/api/shipping/methods?weight_kg=N` | —      | Shipping options for a given cart weight.  |
| `POST`   | `/api/coupons/validate`             | —      | Validate a coupon against a cart total.    |
| `POST`   | `/api/coupons/redeem`               | —      | Redeem (persist) a coupon redemption.      |
| `POST`   | `/api/refunds`                      | —      | Open a refund / dispute.                   |
| `POST`   | `/api/refunds/:id/resolve`          | —      | Admin: resolve a refund.                   |

> "Auth" column = current behaviour. The codebase ships with a stub; see
> `docs/roadmap.md` P0-1 for the real session middleware.

---

## Conventions

- **JSON in, JSON out.** Requests send `Content-Type: application/json`.
  Responses are `application/json; charset=utf-8`.
- **IDs are integers.** They match the `SERIAL` columns in the schema.
- **Errors** look like `{ "error": "human readable", "details"?: zodIssues }`
  with the appropriate 4xx/5xx status.
- **Pagination** is currently inline (the SQL fetches a window); the
  frontend handles UI pagination locally.
- **Multilingual fields** (e.g. products) are returned with all three
  locales (`name_ar`, `name_en`, `name_zh`) and the SPA picks the active one.

## Smoke test

```sh
curl http://localhost:3000/api/stats/home
curl http://localhost:3000/api/products?limit=5
curl http://localhost:3000/api/products/1
curl http://localhost:3000/api/categories
```

## Where the contract is defined

- **Server**: route handlers in `app/server/index.ts`.
- **Client**: typed wrappers in `app/src/lib/api.ts` (one exported `async`
  function per endpoint, with a `ts` interface per payload).
- **Tests**: `app/server/tests/api-server.test.ts` covers the high-traffic
  endpoints.
