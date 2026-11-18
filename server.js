const path = require('path');
const express = require('express');
const session = require('express-session');

const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(
  session({
    secret: 'qa-playground-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Make the logged-in user available to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.cartCount = (req.session.cart || []).reduce((sum, i) => sum + i.quantity, 0);
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
