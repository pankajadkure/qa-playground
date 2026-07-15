/**
 * Creates schema (drop + recreate) and inserts sample data.
 * Run with: npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./database');

function reset() {
  db.exec(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      api_token TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      image_emoji TEXT DEFAULT '📦',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subtotal REAL NOT NULL,
      shipping_fee REAL NOT NULL DEFAULT 5.99,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'placed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );
  `);
}

function seed() {
  reset();

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, api_token) VALUES (?, ?, ?, ?, ?)`
  );

  const users = [
    { name: 'Ada Admin', email: 'admin@qaplayground.test', password: 'Admin123!', role: 'admin' },
    { name: 'Charlie Customer', email: 'charlie@qaplayground.test', password: 'Customer123!', role: 'customer' },
    // Intentional data bug: this user's role is 'customer' in the DB, but the
    // profile page template hardcodes an "Admin" badge for this specific
    // email address. UI shows Admin, DB says customer. See BUGS.md #DB-3.
    { name: 'Priya Sharma', email: 'priya@qaplayground.test', password: 'Priya123!', role: 'customer' },
    { name: 'Sam Tester', email: 'sam@qaplayground.test', password: 'Sam123!', role: 'customer' },
  ];

  const userIds = {};
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 8);
    const token = 'tok_' + Buffer.from(u.email).toString('hex');
    const info = insertUser.run(u.name, u.email, hash, u.role, token);
    userIds[u.email] = Number(info.lastInsertRowid);
  }

  const insertProduct = db.prepare(
    `INSERT INTO products (sku, name, category, price, stock, description, image_emoji) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const products = [
    ['ELEC-001', 'Wireless Mouse', 'Electronics', 19.99, 120, 'Ergonomic 2.4GHz wireless mouse.', '🖱️'],
    ['ELEC-002', 'Mechanical Keyboard', 'Electronics', 59.99, 45, 'Tactile brown-switch mechanical keyboard.', '⌨️'],
    ['ELEC-003', 'USB-C Hub', 'Electronics', 24.5, 80, '7-in-1 USB-C hub with HDMI.', '🔌'],
    ['ELEC-004', 'Noise Cancelling Headphones', 'Electronics', 129.99, 30, 'Over-ear ANC headphones, 30h battery.', '🎧'],
    ['ELEC-005', 'Portable SSD 1TB', 'Electronics', 89.0, 60, 'USB 3.2 external SSD.', '💾'],
    ['BOOK-001', 'Clean Code', 'Books', 34.99, 50, 'A handbook of agile software craftsmanship.', '📘'],
    ['BOOK-002', 'The Pragmatic Programmer', 'Books', 39.99, 40, 'Your journey to mastery.', '📗'],
    ['BOOK-003', 'Automate the Boring Stuff', 'Books', 29.5, 70, 'Practical programming for beginners.', '📙'],
    ['CLTH-001', 'QA Playground T-Shirt', 'Clothing', 14.99, 200, '100% cotton test-automation-themed tee.', '👕'],
    ['CLTH-002', 'Hoodie - Debug Mode', 'Clothing', 34.0, 90, 'Comfy fleece hoodie.', '🧥'],
    ['CLTH-003', 'Baseball Cap', 'Clothing', 12.0, 150, 'Adjustable cap with embroidered logo.', '🧢'],
    ['HOME-001', 'Standing Desk Mat', 'Home', 27.75, 55, 'Anti-fatigue mat for standing desks.', '🟫'],
    ['HOME-002', 'Desk Lamp LED', 'Home', 21.99, 65, 'Adjustable brightness LED desk lamp.', '💡'],
    ['HOME-003', 'Ceramic Mug - 99 Bugs', 'Home', 9.99, 300, '"99 little bugs in the code" mug.', '☕'],
    ['HOME-004', 'Plant - Office Succulent', 'Home', 8.5, 110, 'Low-maintenance desk succulent.', '🌵'],
    ['ELEC-006', 'Webcam 1080p', 'Electronics', 44.99, 0, 'Full HD webcam with autofocus. Currently out of stock.', '📷'],
  ];

  const productIds = {};
  for (const p of products) {
    const info = insertProduct.run(...p);
    productIds[p[0]] = Number(info.lastInsertRowid);
  }

  const insertOrder = db.prepare(
    `INSERT INTO orders (user_id, subtotal, shipping_fee, total, status) VALUES (?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`
  );

  // Sample order 1 for Charlie: 2x Wireless Mouse + 1x Clean Code
  {
    const items = [
      { sku: 'ELEC-001', qty: 2, price: 19.99 },
      { sku: 'BOOK-001', qty: 1, price: 34.99 },
    ];
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const shipping = 5.99;
    const total = Math.round((subtotal + shipping) * 100) / 100;
    const info = insertOrder.run(userIds['charlie@qaplayground.test'], subtotal, shipping, total, 'placed');
    const orderId = Number(info.lastInsertRowid);
    for (const it of items) {
      insertItem.run(orderId, productIds[it.sku], it.qty, it.price);
    }
  }

  // Sample order 2 for Priya: 1x Mechanical Keyboard
  {
    const items = [{ sku: 'ELEC-002', qty: 1, price: 59.99 }];
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const shipping = 5.99;
    const total = Math.round((subtotal + shipping) * 100) / 100;
    const info = insertOrder.run(userIds['priya@qaplayground.test'], subtotal, shipping, total, 'shipped');
    const orderId = Number(info.lastInsertRowid);
    for (const it of items) {
      insertItem.run(orderId, productIds[it.sku], it.qty, it.price);
    }
  }

  console.log('Database seeded successfully.');
  console.log('Sample accounts:');
  for (const u of users) {
    console.log(`  ${u.email} / ${u.password} (${u.role})`);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, reset };
