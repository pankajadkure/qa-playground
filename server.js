const path = require('path');
const express = require('express');
const session = require('express-session');

const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
});

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
  );
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; form-action 'self'; base-uri 'self'"
  );
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { redirect: false }));

app.use(
  session({
    secret: 'qa-playground-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, sameSite: 'lax', httpOnly: true },
  })
);

// CSRF defense: reject state-changing requests whose Origin doesn't match our Host
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin.replace(/^https?:\/\//, '') !== req.get('Host')) {
    return res.status(403).send('Forbidden: cross-origin request blocked');
  }
  next();
});

// Make the logged-in user available to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.cartCount = (req.session.cart || []).reduce((sum, i) => sum + i.quantity, 0);
  next();
});

// Restrict the post-login `next` value to a safe same-site relative path
function safeNext(value) {
  if (typeof value !== 'string') return value;
  return /^\/(?![\/\\])[^\x00-\x1f\x7f"'<>`\\]*$/.test(value) ? value : '/';
}
app.use((req, res, next) => {
  if (req.query && req.query.next !== undefined) req.query.next = safeNext(req.query.next);
  if (req.body && req.body.next !== undefined) req.body.next = safeNext(req.body.next);
  next();
});

app.use('/', authRouter);
app.use('/', pagesRouter);
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`QA Playground running at http://localhost:${PORT}`);
});
