# API Reference

Base URL: `http://localhost:3000/api`

Authenticate via `POST /api/auth/login` or `/api/auth/register` to get a bearer token, then send it as:

```
Authorization: Bearer <token>
```

> Several endpoints below intentionally return incorrect status codes or data. Where relevant, each section notes the intentional bug and links to its id in [BUGS.md](BUGS.md). Documented "expected" behavior in this file describes what the endpoint *should* do; the "actual" behavior is what it currently does.

## Auth

### `POST /api/auth/register`
Create an account.

Request body:
```json
{ "name": "Jamie Doe", "email": "jamie@example.com", "password": "Secret123!" }
```
Response `201`:
```json
{ "user": { "id": 5, "name": "Jamie Doe", "email": "jamie@example.com", "role": "customer", ... }, "token": "tok_..." }
```
`409` if the email is already registered.

### `POST /api/auth/login`
Request body:
```json
{ "email": "charlie@qaplayground.test", "password": "Customer123!" }
```
Response `200` on success:
```json
{ "success": true, "user": { ... }, "token": "tok_..." }
```
**Bug (API-1):** on invalid credentials this returns `200` with `{ "success": false, "error": "..." }` instead of `401`.

### `POST /api/auth/logout`
Requires bearer token. Returns `200 { "success": true }`. (Token is not actually invalidated server-side in this demo app.)

### `GET /api/auth/me`
Requires bearer token. Returns the current user.

---

## Products

### `GET /api/products`
Query params: `category`, `search` (substring match on name), `sort` (`price_asc` | `price_desc` | `name_asc` | `name_desc`).
```
GET /api/products?category=Electronics&sort=price_asc
```
Response `200`:
```json
{ "products": [ { "id": 1, "sku": "ELEC-001", "name": "Wireless Mouse", "category": "Electronics", "price": 19.99, "stock": 120, ... } ], "count": 1 }
```

### `GET /api/products/:id`
Response `200`: `{ "product": { ... } }`. `404` if not found.
**Bug (API-5):** product id `2` returns `price` as a string instead of a number.

### `POST /api/products` (admin token required)
```json
{ "sku": "NEW-001", "name": "Test Widget", "category": "Home", "price": 12.5, "stock": 10 }
```
Response `201 { "product": { ... } }`.
**Bug (API-6):** negative `price`/`stock` are accepted without validation.

### `PUT /api/products/:id` (admin token required)
```json
{ "name": "Updated Name", "price": 29.99, "stock": 50 }
```
Response `200 { "product": { ... } }`.
**Bug (API-4 / DB-1):** the `price` field in the response does not reflect what was actually written to the database — the update silently fails to persist price changes. Verify via direct SQL query.

### `DELETE /api/products/:id` (admin token required)
Response `200 { "success": true }`.
**Bug (API-3):** returns `200` even when `:id` does not exist. Expected: `404`.

---

## Users

### `GET /api/users` (admin token required)
Response `200 { "users": [ ... ] }` — password hashes are correctly omitted.

### `GET /api/users/:id` (any valid token)
Response `200 { "user": { ... } }`.
**Bug (API-7):** unlike the list endpoint, this returns the raw `password_hash` field.

### `PUT /api/users/:id` (own account, or admin token for any user)
```json
{ "name": "New Name", "role": "admin" }
```
`role` changes are only applied when the caller is an admin. Response `200 { "user": { ... } }`.

### `DELETE /api/users/:id` (admin token required)
Response `200 { "success": true }`, or `404` if the id doesn't exist (this one correctly returns 404).

---

## Orders

### `GET /api/orders` (bearer token required)
Returns the caller's own orders, or all orders if the caller is an admin.

### `GET /api/orders/:id` (bearer token required)
Response `200 { "order": { ... }, "items": [ ... ] }`. `403` if the order belongs to another (non-admin) user. `404` if not found.

### `POST /api/orders` (bearer token required)
```json
{ "items": [ { "product_id": 1, "quantity": 2 }, { "product_id": 6, "quantity": 1 } ] }
```
Response body: `{ "order": { "id": 12, "subtotal": 74.97, "shipping_fee": 5.99, "total": 80.96, "status": "placed", ... } }`.
**Bug (API-2):** returns HTTP `200` instead of `201` on successful creation.

### `POST /api/orders/:id/cancel` (bearer token required)
Cancels an order still in `placed` status. Response `200 { "order": { ..., "status": "cancelled" } }`.
`403` if the order belongs to another (non-admin) user. `404` if not found. `409` if the order is not in `placed` status (already cancelled, or already shipped).
**Bug (DB-4):** the cancelled items' quantities are never added back to `products.stock` - see `BUGS.md`.

---

## Example curl session

```bash
# Log in
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie@qaplayground.test","password":"Customer123!"}'

# Use the returned token
TOKEN="tok_..."

curl -s http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":1,"quantity":2}]}'
```
