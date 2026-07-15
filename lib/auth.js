const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db/database');

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 8);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function generateToken(email) {
  return 'tok_' + crypto.randomBytes(16).toString('hex') + '_' + Buffer.from(email).toString('hex').slice(0, 8);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findUserByToken(token) {
  return db.prepare('SELECT * FROM users WHERE api_token = ?').get(token);
}

function toPublicUser(user) {
  if (!user) return null;
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

// UI (session-based) middleware
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('403', { title: 'Forbidden' });
  }
  next();
}

// API (bearer token) middleware
function apiAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const user = findUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.apiUser = user;
  next();
}

function apiRequireAdmin(req, res, next) {
  if (!req.apiUser || req.apiUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

module.exports = {
  hashPassword,
  checkPassword,
  generateToken,
  findUserByEmail,
  findUserById,
  findUserByToken,
  toPublicUser,
  requireLogin,
  requireAdmin,
  apiAuth,
  apiRequireAdmin,
};
