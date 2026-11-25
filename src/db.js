'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');
const seed = require('./seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'building',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  year INTEGER,
  size TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','in-progress')),
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_type TEXT NOT NULL,
  budget TEXT,
  timeline TEXT,
  address TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','won','lost')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT 'Admin',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
`;

function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function openDb({ file, adminEmail, adminPassword, log = console.log, seedContent = true }) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);

  if (seedContent && db.prepare('SELECT COUNT(*) AS n FROM services').get().n === 0) {
    tx(db, () => {
      const s = db.prepare(
        'INSERT INTO services (slug, title, summary, description, icon, sort_order) VALUES (?,?,?,?,?,?)'
      );
      seed.services.forEach((x, i) => s.run(x.slug, x.title, x.summary, x.description, x.icon, i));
      const p = db.prepare(
        `INSERT INTO projects (slug, title, category, location, year, size, duration, summary, description, status, featured)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      );
      for (const x of seed.projects) {
        p.run(x.slug, x.title, x.category, x.location, x.year, x.size, x.duration, x.summary, x.description, x.status, x.featured ? 1 : 0);
      }
    });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const password = adminPassword || crypto.randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?,?,?)').run(
      adminEmail,
      'Admin',
      hashPassword(password)
    );
    if (!adminPassword) {
      log(`\n  Admin account created → email: ${adminEmail}  password: ${password}`);
      log('  Save this password now (or set ADMIN_PASSWORD before first run). Change it in the admin panel.\n');
    }
  }

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  return db;
}

module.exports = { openDb, tx };
