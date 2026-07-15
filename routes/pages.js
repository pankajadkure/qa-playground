const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireLogin, requireAdmin, findUserById } = require('../lib/auth');

function getProducts({ category, search, sort } = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    // BUG UI-5: search is case-sensitive (SQLite LIKE is case-sensitive for
    // non-ASCII / when using this exact form with binary collation on some
    // builds is inconsistent) - and more importantly, the JS-driven client
    // filtering under /products (used for the live-filter input) does a
    // plain case-sensitive substring match. Typing "mouse" will not find
    // "Wireless Mouse" client-side. See BUGS.md UI-5.
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  // BUG UI-6: price_asc/price_desc are swapped here, so the "Price: Low to
  // High" option actually sorts high-to-low and vice versa. Name sorting is
  // unaffected. This bug is UI-only - the JSON API's sort behaves correctly.
  const sortMap = {
    price_asc: 'price DESC',
    price_desc: 'price ASC',
    name_asc: 'name ASC',
    name_desc: 'name DESC',
  };
  sql += ' ORDER BY ' + (sortMap[sort] || 'id ASC');
  return db.prepare(sql).all(...params);
}

router.get('/', (req, res) => {
  const featured = db.prepare('SELECT * FROM products ORDER BY RANDOM() LIMIT 4').all();
  res.render('home', { title: 'QA Playground', featured });
});

/* ----------------------------- PRODUCTS ------------------------------- */

router.get('/products', (req, res) => {
  const { category, search, sort } = req.query;
  const products = getProducts({ category, search, sort });
  const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category);
  res.render('products', {
    title: 'Products',
    products,
    categories,
    filters: { category: category || '', search: search || '', sort: sort || '' },
  });
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).render('404', { title: 'Not Found' });
  res.render('product-detail', { title: product.name, product });
});

/* ------------------------------- CART -------------------------------- */

router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const items = cart.map((c) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(c.product_id);
    return { product, quantity: c.quantity };
  }).filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  res.render('cart', { title: 'Your Cart', items, subtotal });
});

router.post('/cart/add', (req, res) => {
  const productId = Number(req.body.product_id);
  const quantity = Math.max(1, Number(req.body.quantity) || 1);
  const cart = req.session.cart || [];
  const existing = cart.find((c) => c.product_id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ product_id: productId, quantity });
  }
  req.session.cart = cart;
  res.redirect(req.get('Referer') || '/products');
});

router.post('/cart/update', (req, res) => {
  const productId = Number(req.body.product_id);
  const quantity = Math.max(1, Number(req.body.quantity) || 1);
  const cart = req.session.cart || [];
  const item = cart.find((c) => c.product_id === productId);
  if (item) item.quantity = quantity;
  req.session.cart = cart;
  res.redirect('/cart');
});

router.post('/cart/remove', (req, res) => {
  const productId = Number(req.body.product_id);
  req.session.cart = (req.session.cart || []).filter((c) => c.product_id !== productId);
  res.redirect('/cart');
});

router.get('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || [];
  const items = cart.map((c) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(c.product_id);
    return { product, quantity: c.quantity };
  }).filter((i) => i.product);
  if (items.length === 0) return res.redirect('/cart');
  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const shipping = 5.99;
  res.render('checkout', { title: 'Checkout', items, subtotal, shipping, total: subtotal + shipping });
});

router.post('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || [];
  const items = cart.map((c) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(c.product_id);
    return { product, quantity: c.quantity };
  }).filter((i) => i.product);
  if (items.length === 0) return res.redirect('/cart');

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const shipping = 5.99;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  const info = db
    .prepare('INSERT INTO orders (user_id, subtotal, shipping_fee, total, status) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.user.id, subtotal, shipping, total, 'placed');
  const orderId = Number(info.lastInsertRowid);
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
  );
  for (const i of items) {
    insertItem.run(orderId, i.product.id, i.quantity, i.product.price);
  }

  req.session.cart = [];
  res.redirect(`/orders/${orderId}`);
});

/* ------------------------------- ORDERS -------------------------------- */

router.get('/orders', requireLogin, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.session.user.id);
  res.render('orders', { title: 'Order History', orders });
});

router.get('/orders/:id', requireLogin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).render('404', { title: 'Not Found' });
  if (order.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
    return res.status(403).render('403', { title: 'Forbidden' });
  }
  const items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name, p.image_emoji FROM order_items oi
       JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(order.id);
  res.render('order-detail', { title: `Order #${order.id}`, order, items });
});

router.post('/orders/:id/cancel', requireLogin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).render('404', { title: 'Not Found' });
  if (order.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
    return res.status(403).render('403', { title: 'Forbidden' });
  }
  if (order.status !== 'placed') {
    // Only orders still in "placed" status can be cancelled - once shipped
    // (or already cancelled) there's nothing to do.
    return res.redirect(`/orders/${order.id}`);
  }

  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);

  // BUG DB-4: cancelling an order does NOT restore the cancelled items'
  // quantity back to `products.stock`. The order is correctly marked
  // cancelled, but inventory is never replenished - a product bought out
  // in a since-cancelled order stays understocked. See BUGS.md DB-4.

  res.redirect(`/orders/${order.id}`);
});

/* ------------------------------- PROFILE ------------------------------- */

router.get('/profile', requireLogin, (req, res) => {
  const user = findUserById(req.session.user.id);
  res.render('profile', { title: 'My Profile', user });
});

/* ------------------------------- CONTACT ------------------------------- */

router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us', submitted: false, error: null, values: {} });
});

router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!name || !email || !message) {
    return res.render('contact', { title: 'Contact Us', submitted: false, error: 'All fields are required.', values: req.body });
  }
  if (!emailRegex.test(email)) {
    return res.render('contact', { title: 'Contact Us', submitted: false, error: 'Please enter a valid email address.', values: req.body });
  }
  res.render('contact', { title: 'Contact Us', submitted: true, error: null, values: {} });
});

/* -------------------------------- ADMIN -------------------------------- */

router.get('/admin', requireLogin, requireAdmin, (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  res.render('admin/dashboard', { title: 'Admin Dashboard', productCount, userCount, orderCount });
});

router.get('/admin/products', requireLogin, requireAdmin, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.render('admin/products', {
    title: 'Manage Products',
    products,
    deleteError: req.query.deleteError === '1',
  });
});

router.post('/admin/products', requireLogin, requireAdmin, (req, res) => {
  const { sku, name, category, price, stock, description, image_emoji } = req.body;
  db.prepare(
    'INSERT INTO products (sku, name, category, price, stock, description, image_emoji) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(sku, name, category, Number(price) || 0, Number(stock) || 0, description || '', image_emoji || '📦');
  res.redirect('/admin/products');
});

router.post('/admin/products/:id', requireLogin, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).render('404', { title: 'Not Found' });

  const { name, category, price, stock, description, image_emoji } = req.body;

  // BUG API-4 / DB-1 (shared with the JSON API): price is intentionally
  // left out of this UPDATE statement, so edits made from this admin form
  // do not persist to the database even though the admin panel will
  // re-render the value the admin typed in.
  db.prepare(
    `UPDATE products SET name = ?, category = ?, stock = ?, description = ?, image_emoji = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    Number(stock) ?? existing.stock,
    description ?? existing.description,
    image_emoji ?? existing.image_emoji,
    req.params.id
  );
  res.redirect('/admin/products');
});

router.post('/admin/products/:id/delete', requireLogin, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      return res.redirect('/admin/products?deleteError=1');
    }
    throw err;
  }
  res.redirect('/admin/products');
});

router.get('/admin/users', requireLogin, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.render('admin/users', { title: 'Manage Users', users });
});

router.post('/admin/users/:id/role', requireLogin, requireAdmin, (req, res) => {
  const { role } = req.body;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.redirect('/admin/users');
});

router.post('/admin/users/:id/delete', requireLogin, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.redirect('/admin/users');
});

/* -------------------------------- DOCS ---------------------------------- */

router.get('/docs', (req, res) => {
  res.render('docs', { title: 'Documentation & API Reference' });
});

module.exports = router;
