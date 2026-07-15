# QA Playground

A full-featured demo storefront built specifically for practicing **UI automation**, **API automation**, and **SQL data validation** testing. It simulates a realistic small e-commerce app (browse products, cart, checkout, order history, admin panel) and **intentionally contains bugs** across the UI, API, and database layers so you have real things to catch.

## 🌐 Live Demo

**[https://qa-playground-automation-testing.onrender.com/](https://qa-playground-automation-testing.onrender.com/)**

Hosted free on [Render](https://render.com). Two things to know about this instance:
- **Cold starts:** the free tier sleeps after ~15 minutes of inactivity. The first request after a period of no traffic can take 30-50 seconds to wake back up — that's expected, not a bug.
- **Data resets on redeploy/restart:** the database reseeds to its original sample state (see [Sample Accounts](#sample-accounts) below) every time the instance restarts, since the free tier's disk isn't persistent. Don't rely on data (like a cancelled order, or a newly registered account) surviving long-term on this instance.

## Stack

- Node.js + Express
- SQLite via the built-in `node:sqlite` module (no native build step required)
- Server-rendered views with EJS
- Session-based auth for the web UI, bearer-token auth for the REST API

## Getting Started

```bash
npm install
npm run seed     # creates db/qa_playground.sqlite and sample data
npm start         # http://localhost:3000
```

Re-run `npm run seed` any time to reset the database back to its original sample state (this drops and recreates all tables).

### Environment variables

- `PORT` - port to listen on (default `3000`)
- `QA_DB_PATH` - path to the SQLite file to use (default `db/qa_playground.sqlite`)

Both are used by the [qa-playground-e2e](../qa-playground-e2e) test suite to run multiple isolated instances of this app in parallel during `pytest -n` runs (one server + one database file per worker), without needing any other app changes.

## Sample Accounts

| Email | Password | Role |
|---|---|---|
| admin@qaplayground.test | Admin123! | admin |
| charlie@qaplayground.test | Customer123! | customer |
| priya@qaplayground.test | Priya123! | customer |
| sam@qaplayground.test | Sam123! | customer |

## Features

### UI (server-rendered pages)
- Registration and login with client + server-side validation
- Product catalog with search, category filter, and sort (dynamic dropdowns)
- Product detail pages, cart, and a checkout flow that creates a real order
- Order history and order detail pages, with order cancellation (confirmation modal) for orders still in "placed" status
- Profile page
- Admin panel: dashboard stats, product CRUD via add/edit/delete modals, user role management
- Contact form with validation
- Toast notifications for cart actions
- A `/docs` page with the same feature/bug summary as this file

### REST API (`/api`)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Full CRUD on `/api/products`
- `/api/users` (list/get/update/delete)
- `/api/orders` (list/get/create)

Full endpoint reference: [API.md](API.md).

### Database
- SQLite file at `db/qa_playground.sqlite`
- Tables: `users`, `products`, `orders`, `order_items`
- Inspect it directly with any SQLite client, e.g.:
  ```bash
  sqlite3 db/qa_playground.sqlite "SELECT id, name, price FROM products;"
  ```

## Known Bugs

This app ships with intentional defects for you to find via automated tests. The full annotated list — including exactly which file/line each bug lives in — is in [BUGS.md](BUGS.md). Each bug is also tagged inline in the source with a comment referencing its ID (e.g. `BUG API-4`).

Summary:

- **8 UI bugs** (broken link, misaligned CSS, broken client-side validation, a reversed sort, an inconsistent modal, a stale total, a case-sensitive search)
- **7 API bugs** (wrong status codes, a silently-dropped field, a type inconsistency, missing input validation, sensitive-field exposure)
- **4 database-validation bugs** (values the UI/API report that don't match what's actually stored)

## Project Structure

```
server.js            entry point
db/                   database connection, schema + seed script
lib/auth.js           password hashing, session + bearer-token middleware
routes/pages.js        UI routes (EJS views)
routes/auth.js         UI login/register/logout
routes/api.js           JSON REST API
views/                  EJS templates
public/                 static CSS/JS
```
