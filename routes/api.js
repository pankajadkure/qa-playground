/**
 * REST API for QA Playground.
 *
 * Auth: Bearer token in the `Authorization` header. Obtain a token via
 * POST /api/auth/login. See /api-docs for full documentation.
 *
 * Several endpoints in this file contain INTENTIONAL bugs for automation
 * practice. Each is tagged with a BUGS.md id (e.g. "BUG API-3") so they are
 * easy to find and cross-reference. Do not "fix" them without checking
 * BUGS.md first - they are part of the exercise.
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const {
  hashPassword,
  checkPassword,
  generateToken,
  findUserByEmail,
  findUserById,
  toPublicUser,
  apiAuth,
  apiRequireAdmin,
} = require('../lib/auth');

/* ------------------------------- AUTH -------------------------------- */

router.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!name || !cleanEmail || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (findUserByEmail(cleanEmail)) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const hash = hashPassword(password);
  const token = generateToken(cleanEmail);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, api_token) VALUES (?, ?, ?, ?, ?)')
    .run(name, cleanEmail, hash, 'customer', token);

  const user = findUserById(Number(info.lastInsertRowid));
  res.status(201).json({ user: toPublicUser(user), token });
});

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail((email || '').trim().toLowerCase());
  const valid = user && checkPassword(password || '', user.password_hash);

  if (!valid) {
    // BUG API-1: invalid credentials should return HTTP 401, but this
    // endpoint returns 200 with a `success: false` body instead. A client
    // that only checks the status code will think the login succeeded.
    return res.status(200).json({ success: false, error: 'Invalid email or password' });
  }

  res.status(200).json({ success: true, user: toPublicUser(user), token: user.api_token });
});

router.post('/auth/logout', apiAuth, (req, res) => {
  // Token is not actually invalidated server-side in this demo; the
  // endpoint just acknowledges the request.
  res.status(200).json({ success: true });
});

router.get('/auth/me', apiAuth, (req, res) => {
  res.json({ user: toPublicUser(req.apiUser) });
});

/* ----------------------------- PRODUCTS ------------------------------- */

router.get('/products', (req, res) => {
  const { category, search, sort } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  const sortMap = {
    price_asc: 'price ASC',
    price_desc: 'price DESC',
    name_asc: 'name ASC',
    name_desc: 'name DESC',
  };
  sql += ' ORDER BY ' + (sortMap[sort] || 'id ASC');

  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows, count: rows.length });
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // BUG API-5: product id 2 (Mechanical Keyboard) returns `price` as a
  // string instead of a number, an inconsistent type compared to every
  // other product. Good target for API schema/contract validation.
  if (Number(product.id) === 2) {
    product.price = String(product.price);
  }

  res.json({ product });
});

router.post('/products', apiAuth, apiRequireAdmin, (req, res) => {
  const { sku, name, category, price, stock, description, image_emoji } = req.body;
  if (!sku || !name || !category || price === undefined) {
    return res.status(400).json({ error: 'sku, name, category and price are required' });
  }

  // BUG API-6: negative price/stock values are not rejected. A product can
  // be created with price: -10 or stock: -5.
  const info = db
    .prepare(
      'INSERT INTO products (sku, name, category, price, stock, description, image_emoji) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(sku, name, category, price, stock ?? 0, description || '', image_emoji || '📦');

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ product });
});

router.put('/products/:id', apiAuth, apiRequireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { name, category, price, stock, description, image_emoji } = req.body;

  // BUG API-4 / DB-1: the UPDATE statement below does not include `price`
  // in its SET clause, so price changes sent by the client are silently
  // dropped and the database keeps the old value - yet the JSON response
  // below echoes back whatever price the client sent, making the API look
  // like the update succeeded. Compare the API response against a direct
  // SQL SELECT to catch this.
  db.prepare(
    `UPDATE products SET name = ?, category = ?, stock = ?, description = ?, image_emoji = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    stock ?? existing.stock,
    description ?? existing.description,
    image_emoji ?? existing.image_emoji,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  const responseProduct = { ...updated, price: price !== undefined ? price : updated.price };
  res.json({ product: responseProduct });
});

router.delete('/products/:id', apiAuth, apiRequireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(409).json({ error: 'Product appears in an existing order and cannot be deleted' });
    }
    throw err;
  }
  // BUG API-3: this endpoint returns 200 even when no row matched (i.e. the
  // product id did not exist). It should return 404 in that case.
  res.status(200).json({ success: true });
});

/* ------------------------------- USERS -------------------------------- */

router.get('/users', apiAuth, apiRequireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM users').all();
  res.json({ users: rows.map(toPublicUser) });
});

router.get('/users/:id', apiAuth, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  // BUG API-7: this endpoint returns the raw user row, including
  // `password_hash`, instead of the sanitized version returned everywhere
  // else via toPublicUser(). Sensitive field exposure bug.
  res.json({ user });
});

router.put('/users/:id', apiAuth, (req, res) => {
  const isSelf = String(req.apiUser.id) === String(req.params.id);
  if (!isSelf && req.apiUser.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to edit this user' });
  }
  const existing = findUserById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, role } = req.body;
  const nextRole = req.apiUser.role === 'admin' && role ? role : existing.role;

  db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(
    name ?? existing.name,
    nextRole,
    req.params.id
  );

  res.json({ user: toPublicUser(findUserById(req.params.id)) });
});

router.delete('/users/:id', apiAuth, apiRequireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.status(200).json({ success: true });
});

/* ------------------------------- ORDERS -------------------------------- */

router.get('/orders', apiAuth, (req, res) => {
  const isAdmin = req.apiUser.role === 'admin';
  const rows = isAdmin
    ? db.prepare('SELECT * FROM orders ORDER BY id DESC').all()
    : db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.apiUser.id);
  res.json({ orders: rows });
});

router.get('/orders/:id', apiAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.user_id !== req.apiUser.id && req.apiUser.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to view this order' });
  }
  const items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name FROM order_items oi
       JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(order.id);
  res.json({ order, items });
});

router.post('/orders', apiAuth, (req, res) => {
  const { items } = req.body; // [{ product_id, quantity }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  let subtotal = 0;
  const resolvedItems = [];
  for (const it of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
    if (!product) {
      return res.status(400).json({ error: `Unknown product_id ${it.product_id}` });
    }
    const qty = Math.max(1, Number(it.quantity) || 1);
    subtotal += product.price * qty;
    resolvedItems.push({ product_id: product.id, quantity: qty, unit_price: product.price });
  }

  const shipping = 5.99;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  const info = db
    .prepare('INSERT INTO orders (user_id, subtotal, shipping_fee, total, status) VALUES (?, ?, ?, ?, ?)')
    .run(req.apiUser.id, subtotal, shipping, total, 'placed');
  const orderId = Number(info.lastInsertRowid);

  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
  );
  for (const it of resolvedItems) {
    insertItem.run(orderId, it.product_id, it.quantity, it.unit_price);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  // BUG API-2: a newly created resource should return HTTP 201, but this
  // endpoint returns 200 instead.
  res.status(200).json({ order });
});

router.post('/orders/:id/cancel', apiAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.user_id !== req.apiUser.id && req.apiUser.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to cancel this order' });
  }
  if (order.status !== 'placed') {
    return res.status(409).json({ error: `Order cannot be cancelled from status "${order.status}"` });
  }

  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);

  // BUG DB-4: same as the UI cancel route - product stock is never
  // restored for the cancelled items. See BUGS.md DB-4.

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ order: updated });
});

module.exports = router;
