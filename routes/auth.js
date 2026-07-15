const express = require('express');
const router = express.Router();
const db = require('../db/database');
const {
  hashPassword,
  checkPassword,
  generateToken,
  findUserByEmail,
  toPublicUser,
} = require('../lib/auth');

router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null, next: req.query.next || '/' });
});

router.post('/login', (req, res) => {
  const { email, password, next: nextUrl } = req.body;
  const user = findUserByEmail((email || '').trim().toLowerCase());

  if (!user || !checkPassword(password || '', user.password_hash)) {
    return res.status(401).render('login', {
      title: 'Login',
      error: 'Invalid email or password.',
      next: nextUrl || '/',
    });
  }

  req.session.user = toPublicUser(user);
  res.redirect(nextUrl && nextUrl !== '' ? nextUrl : '/products');
});

router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null, values: {} });
});

router.post('/register', (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!name || !cleanEmail || !password) {
    return res.status(400).render('register', {
      title: 'Register',
      error: 'All fields are required.',
      values: { name, email },
    });
  }

  // NOTE: password/confirmPassword equality is intentionally NOT enforced here.
  // See BUGS.md UI-3 - the confirm-password field is decorative only.

  if (findUserByEmail(cleanEmail)) {
    return res.status(409).render('register', {
      title: 'Register',
      error: 'An account with that email already exists.',
      values: { name, email },
    });
  }

  const hash = hashPassword(password);
  const token = generateToken(cleanEmail);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, api_token) VALUES (?, ?, ?, ?, ?)')
    .run(name, cleanEmail, hash, 'customer', token);

  req.session.user = {
    id: Number(info.lastInsertRowid),
    name,
    email: cleanEmail,
    role: 'customer',
  };
  res.redirect('/products');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
