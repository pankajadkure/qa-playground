const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Overridable so parallel test runs can point each worker at its own
// isolated SQLite file instead of sharing the default one.
const DB_PATH = process.env.QA_DB_PATH || path.join(__dirname, 'qa_playground.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

module.exports = db;
