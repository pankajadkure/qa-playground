# Known Bugs (Answer Key)

This is the authoritative list of intentional defects seeded into QA Playground. Each entry has an id, where it lives in the code, how to reproduce it, and what the correct behavior would be. Use these as targets for automated tests.

---

## UI Bugs

### UI-1 — Broken "Pricing" nav link
- **Where:** `views/partials/header.ejs`, `data-testid="nav-pricing"`
- **Repro:** Click "Pricing" in the top nav from any page.
- **Actual:** 404 page — the route doesn't exist.
- **Expected:** Should either link to a real pricing page or be removed from the nav.

### UI-2 — Misaligned "Add to Cart" button on Electronics products
- **Where:** `public/css/style.css`, `.product-card--elec .add-to-cart-btn`
- **Repro:** Go to `/products`, look at any product card in the Electronics category.
- **Actual:** The button is shifted up and to the right, overflowing the card boundary.
- **Expected:** Button should be aligned like every other category's card.

### UI-3 — Confirm Password field doesn't validate
- **Where:** `public/js/validation.js` (client), register form never checks password equality
- **Repro:** Go to `/register`, enter a password and a *different* value in Confirm Password, submit.
- **Actual:** Form submits successfully; the account is created with the original password. No error is shown.
- **Expected:** Submission should be blocked with a "Passwords do not match" error.

### UI-4 — Email validation rejects plus-addressed emails
- **Where:** `public/js/validation.js` (`EMAIL_REGEX`) and `routes/pages.js` `/contact` handler (same broken pattern)
- **Repro:** Enter `user+test@example.com` in the login, register, or contact form.
- **Actual:** Rejected as "invalid email".
- **Expected:** Should be accepted — `+` is valid in the local part of an email address.

### UI-5 — Product quick-filter search is case-sensitive
- **Where:** `public/js/catalog.js`
- **Repro:** On `/products`, type `mouse` (lowercase) into "Quick filter by name...".
- **Actual:** "Wireless Mouse" is hidden because the match is case-sensitive.
- **Expected:** Should match regardless of case.

### UI-6 — "Price: Low to High" sort is reversed
- **Where:** `routes/pages.js`, `getProducts()` sortMap
- **Repro:** On `/products`, choose "Price: Low to High" from the sort dropdown.
- **Actual:** Products are sorted high to low. "Price: High to Low" sorts low to high.
- **Expected:** Sort direction should match the selected label. (Note: `GET /api/products?sort=price_asc` via the JSON API is *not* affected — only the UI page.)

### UI-7 — Delete-product modal doesn't close on outside click
- **Where:** `public/js/admin-products.js`
- **Repro:** As an admin, go to `/admin/products`, click "Delete" on any product, then click the dark overlay outside the modal (not Cancel).
- **Actual:** Nothing happens; the modal stays open.
- **Expected:** Should close, consistent with the Add/Edit product modal, which does close on outside click.

### UI-8 — Cart "Total" excludes shipping
- **Where:** `public/js/cart.js`
- **Repro:** Add an item to your cart, view `/cart`. Note the "Total" value, then proceed to `/checkout`.
- **Actual:** The cart page's live "Total" only sums line items. The checkout page's "Total" (and the final `orders.total` in the database) is `subtotal + 5.99` shipping — a different number.
- **Expected:** Cart page total should match the final order total, or be clearly labeled "Subtotal".

---

## API Bugs

### API-1 — Login returns 200 on invalid credentials
- **Where:** `routes/api.js`, `POST /api/auth/login`
- **Repro:** `POST /api/auth/login` with a wrong password.
- **Actual:** HTTP 200 with body `{ "success": false, "error": "..." }`.
- **Expected:** HTTP 401.

### API-2 — Order creation returns 200 instead of 201
- **Where:** `routes/api.js`, `POST /api/orders`
- **Repro:** `POST /api/orders` with a valid bearer token and items.
- **Actual:** HTTP 200.
- **Expected:** HTTP 201 (resource created).

### API-3 — Deleting a non-existent product returns 200
- **Where:** `routes/api.js`, `DELETE /api/products/:id`
- **Repro:** `DELETE /api/products/999999` (an id that doesn't exist) with an admin token.
- **Actual:** HTTP 200, `{ "success": true }`.
- **Expected:** HTTP 404.

### API-4 — Product price updates are silently dropped
- **Where:** `routes/api.js`, `PUT /api/products/:id` (also reachable via the admin UI form at `POST /admin/products/:id`, `routes/pages.js`)
- **Repro:** `PUT /api/products/1` with `{ "price": 999.99 }`, then `GET /api/products/1`, or query the database directly.
- **Actual:** The response to the PUT echoes back `price: 999.99`, but the database row's `price` column is unchanged.
- **Expected:** The database should reflect the updated price.
- **Cross-reference:** DB-1 below is the same underlying bug, viewed from the database side.

### API-5 — Inconsistent price type for one product
- **Where:** `routes/api.js`, `GET /api/products/:id`
- **Repro:** `GET /api/products/2` (Mechanical Keyboard).
- **Actual:** `price` is returned as a string (`"59.99"`) instead of a number, unlike every other product.
- **Expected:** `price` should always be a number.

### API-6 — No validation on negative price/stock
- **Where:** `routes/api.js`, `POST /api/products`
- **Repro:** `POST /api/products` (admin token) with `{ "price": -10, "stock": -5, ... }`.
- **Actual:** HTTP 201 — the product is created with negative values.
- **Expected:** HTTP 400 rejecting invalid values.

### API-7 — `password_hash` exposed in user detail response
- **Where:** `routes/api.js`, `GET /api/users/:id`
- **Repro:** `GET /api/users/1` with any valid bearer token.
- **Actual:** Response includes the raw `password_hash` field.
- **Expected:** Sensitive fields should never be serialized to the client (compare with `GET /api/users`, which correctly omits it).

---

## Database / Data-Validation Bugs

These are best caught by comparing what the UI or API *report* against what is actually stored in `db/qa_playground.sqlite`.

### DB-1 — Product price edits never persist
Same defect as API-4. The `UPDATE products SET ...` statement in both `routes/api.js` (`PUT /api/products/:id`) and `routes/pages.js` (`POST /admin/products/:id`) omits `price` from its `SET` clause. Verify with:
```sql
SELECT id, name, price FROM products WHERE id = 1;
```
compared against whatever price was last submitted through the UI/API.

### DB-2 — Cart total vs. stored order total
See UI-8. The `orders.total` column (and everything after checkout) correctly includes the `shipping_fee`, but the cart page's live JS total does not. Verify with:
```sql
SELECT id, subtotal, shipping_fee, total FROM orders ORDER BY id DESC LIMIT 1;
```

### DB-3 — Profile page shows wrong role for a seeded user
- **Where:** `views/profile.ejs`
- **Repro:** Log in as `priya@qaplayground.test` / `Priya123!`, visit `/profile`.
- **Actual:** Role badge shows "admin".
- **Expected:** Should show "customer" — verify with:
  ```sql
  SELECT email, role FROM users WHERE email = 'priya@qaplayground.test';
  ```
  which returns `customer`. The template hardcodes the badge for this one email address regardless of the database value.

### DB-4 — Cancelling an order doesn't restore product stock
- **Where:** `routes/pages.js` (`POST /orders/:id/cancel`) and `routes/api.js` (`POST /api/orders/:id/cancel`)
- **Repro:** Note a product's `stock` value, place an order containing it, then cancel that order (via the "Cancel Order" button on the order detail page, or the API endpoint).
- **Actual:** The order's `status` correctly changes to `cancelled`, but the product's `stock` column is never incremented back — verify with:
  ```sql
  SELECT id, name, stock FROM products WHERE id = <product_id>;
  ```
  the value is unchanged from before cancellation.
- **Expected:** Cancelling an order should return its items' quantities to inventory.
