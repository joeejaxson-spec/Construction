'use strict';
const { HttpError, rateLimiter } = require('./http');
const { validate, slugify } = require('./validate');
const auth = require('./auth');

const PROJECT_TYPES = [
  'New home',
  'Addition',
  'Renovation / remodel',
  'Commercial build',
  'Tenant fit-out',
  'Concrete / foundation',
  'Other',
];
const BUDGETS = ['Under $50k', '$50k – $150k', '$150k – $500k', '$500k – $1M', 'Over $1M', 'Not sure yet'];
const TIMELINES = ['As soon as possible', 'Within 3 months', '3 – 6 months', '6 – 12 months', 'Just planning'];
const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const PROJECT_STATUSES = ['completed', 'in-progress'];
const ICONS = ['home', 'building', 'hammer', 'ruler', 'clipboard', 'layers', 'hardhat', 'truck'];

const quoteSchema = {
  name: { type: 'string', required: true, max: 120 },
  email: { type: 'email', required: true, max: 200 },
  phone: { type: 'string', max: 40 },
  project_type: { type: 'string', required: true, enum: PROJECT_TYPES },
  budget: { type: 'string', enum: BUDGETS },
  timeline: { type: 'string', enum: TIMELINES },
  address: { type: 'string', max: 200 },
  message: { type: 'string', required: true, min: 10, max: 4000 },
};

const contactSchema = {
  name: { type: 'string', required: true, max: 120 },
  email: { type: 'email', required: true, max: 200 },
  subject: { type: 'string', max: 200 },
  message: { type: 'string', required: true, min: 5, max: 4000 },
};

const projectSchema = {
  title: { type: 'string', required: true, max: 160 },
  slug: { type: 'slug', max: 80 },
  category: { type: 'string', required: true, max: 60 },
  location: { type: 'string', max: 120, default: '' },
  year: { type: 'int', min: 1900, max: 2100 },
  size: { type: 'string', max: 60, default: '' },
  duration: { type: 'string', max: 60, default: '' },
  summary: { type: 'string', max: 400, default: '' },
  description: { type: 'string', max: 10000, default: '' },
  image_url: { type: 'url', max: 1000 },
  status: { type: 'string', enum: PROJECT_STATUSES, default: 'completed' },
  featured: { type: 'bool' },
  published: { type: 'bool', default: true },
};

const serviceSchema = {
  title: { type: 'string', required: true, max: 120 },
  slug: { type: 'slug', max: 80 },
  summary: { type: 'string', required: true, max: 300 },
  description: { type: 'string', max: 10000, default: '' },
  icon: { type: 'string', enum: ICONS, default: 'building' },
  sort_order: { type: 'int', min: 0, max: 9999, default: 0 },
};

const toProject = (r) => r && { ...r, featured: !!r.featured, published: !!r.published };

function idParam(ctx) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found');
  return id;
}

function uniqueSlug(db, table, base, excludeId = 0) {
  let slug = base || 'item';
  let n = 2;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`).get(slug, excludeId)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function buildUpdate(table, data, id) {
  const keys = Object.keys(data);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const hasUpdated = ['projects', 'quotes'].includes(table);
  return {
    sql: `UPDATE ${table} SET ${sets}${hasUpdated ? ", updated_at = datetime('now')" : ''} WHERE id = ?`,
    values: [...keys.map((k) => (typeof data[k] === 'boolean' ? Number(data[k]) : data[k])), id],
  };
}

function register(router, { config, limits = {} }) {
  const formLimit = rateLimiter({ windowMs: 10 * 60e3, max: limits.forms ?? 5 });
  const loginLimit = rateLimiter({ windowMs: 15 * 60e3, max: limits.login ?? 10 });

  // ---------- Public ----------
  router.on('GET', '/api/health', () => ({ ok: true }));

  router.on('GET', '/api/site', () => ({
    ...config.site,
    yearsInBusiness: new Date().getFullYear() - config.site.founded,
    options: { projectTypes: PROJECT_TYPES, budgets: BUDGETS, timelines: TIMELINES },
  }));

  router.on('GET', '/api/stats', ({ db }) => {
    const completed = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE published = 1 AND status = 'completed'").get().n;
    const active = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE published = 1 AND status = 'in-progress'").get().n;
    return { completed, active, years: new Date().getFullYear() - config.site.founded };
  });

  router.on('GET', '/api/services', ({ db }) =>
    db.prepare('SELECT * FROM services ORDER BY sort_order, id').all()
  );

  router.on('GET', '/api/services/:slug', ({ db, params }) => {
    const s = db.prepare('SELECT * FROM services WHERE slug = ?').get(params.slug);
    if (!s) throw new HttpError(404, 'Service not found');
    return s;
  });

  router.on('GET', '/api/projects', ({ db, query }) => {
    const where = ['published = 1'];
    const args = [];
    if (query.category) {
      where.push('category = ?');
      args.push(query.category);
    }
    if (query.featured === '1') where.push('featured = 1');
    if (query.status && PROJECT_STATUSES.includes(query.status)) {
      where.push('status = ?');
      args.push(query.status);
    }
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 100);
    const rows = db
      .prepare(
        `SELECT id, slug, title, category, location, year, size, duration, summary, image_url, status, featured
         FROM projects WHERE ${where.join(' AND ')} ORDER BY featured DESC, year DESC, id DESC LIMIT ${limit}`
      )
      .all(...args);
    const categories = db
      .prepare('SELECT category, COUNT(*) AS count FROM projects WHERE published = 1 GROUP BY category ORDER BY category')
      .all();
    return { projects: rows.map(toProject), categories };
  });

  router.on('GET', '/api/projects/:slug', ({ db, params }) => {
    const p = db.prepare('SELECT * FROM projects WHERE slug = ? AND published = 1').get(params.slug);
    if (!p) throw new HttpError(404, 'Project not found');
    const related = db
      .prepare(
        `SELECT slug, title, category, location, year, image_url, status FROM projects
         WHERE published = 1 AND category = ? AND id != ? ORDER BY year DESC LIMIT 3`
      )
      .all(p.category, p.id);
    return { ...toProject(p), related };
  });

  router.on('POST', '/api/quotes', (ctx) => {
    if (ctx.body.website) return (ctx.status = 201), { ok: true }; // honeypot: silently drop bots
    if (!formLimit(`q:${ctx.ip}`)) throw new HttpError(429, 'Too many requests. Please try again in a few minutes.');
    const d = validate(ctx.body, quoteSchema);
    const r = ctx.db
      .prepare(
        'INSERT INTO quotes (name, email, phone, project_type, budget, timeline, address, message) VALUES (?,?,?,?,?,?,?,?)'
      )
      .run(d.name, d.email, d.phone, d.project_type, d.budget, d.timeline, d.address, d.message);
    ctx.log(`New quote request #${r.lastInsertRowid} from ${d.name} <${d.email}>`);
    ctx.status = 201;
    return { ok: true, id: Number(r.lastInsertRowid) };
  });

  router.on('POST', '/api/contact', (ctx) => {
    if (ctx.body.website) return (ctx.status = 201), { ok: true };
    if (!formLimit(`c:${ctx.ip}`)) throw new HttpError(429, 'Too many requests. Please try again in a few minutes.');
    const d = validate(ctx.body, contactSchema);
    const r = ctx.db
      .prepare('INSERT INTO messages (name, email, subject, message) VALUES (?,?,?,?)')
      .run(d.name, d.email, d.subject, d.message);
    ctx.log(`New contact message #${r.lastInsertRowid} from ${d.name} <${d.email}>`);
    ctx.status = 201;
    return { ok: true, id: Number(r.lastInsertRowid) };
  });

  // ---------- Auth ----------
  router.on('POST', '/api/admin/login', (ctx) => {
    if (!loginLimit(`l:${ctx.ip}`)) throw new HttpError(429, 'Too many sign-in attempts. Try again later.');
    const { email, password } = validate(ctx.body, {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, max: 200 },
    });
    const user = ctx.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !auth.verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    const { token } = auth.createSession(ctx.db, user.id, config.sessionDays);
    ctx.res.setHeader(
      'Set-Cookie',
      auth.sessionCookie(token, { maxAgeSec: config.sessionDays * 86400, secure: config.production })
    );
    return { id: user.id, email: user.email, name: user.name };
  });

  router.on('POST', '/api/admin/logout', (ctx) => {
    const u = auth.currentUser(ctx.db, ctx.req);
    if (u) ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(u.tokenHash);
    ctx.res.setHeader('Set-Cookie', auth.sessionCookie('', { maxAgeSec: 0, secure: config.production }));
    return { ok: true };
  });

  router.on('GET', '/api/admin/me', (ctx) => {
    const { id, email, name } = auth.requireUser(ctx);
    return { id, email, name };
  });

  router.on('POST', '/api/admin/password', (ctx) => {
    const u = auth.requireUser(ctx);
    const d = validate(ctx.body, {
      current: { type: 'string', required: true, max: 200 },
      next: { type: 'string', required: true, min: 10, max: 200 },
    });
    const row = ctx.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(u.id);
    if (!auth.verifyPassword(d.current, row.password_hash)) {
      throw new HttpError(422, 'Please fix the highlighted fields', { current: 'Current password is incorrect' });
    }
    ctx.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(d.next), u.id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(u.id, u.tokenHash);
    return { ok: true };
  });

  // ---------- Admin: dashboard ----------
  router.on('GET', '/api/admin/stats', (ctx) => {
    auth.requireUser(ctx);
    const db = ctx.db;
    const byStatus = Object.fromEntries(QUOTE_STATUSES.map((s) => [s, 0]));
    for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM quotes GROUP BY status').all()) byStatus[r.status] = r.n;
    return {
      quotes: byStatus,
      quotesTotal: Object.values(byStatus).reduce((a, b) => a + b, 0),
      quotesLast30: db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE created_at >= datetime('now','-30 days')").get().n,
      unreadMessages: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').get().n,
      projects: db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,
      services: db.prepare('SELECT COUNT(*) AS n FROM services').get().n,
      recentQuotes: db
        .prepare('SELECT id, name, project_type, status, created_at FROM quotes ORDER BY id DESC LIMIT 5')
        .all(),
    };
  });

  // ---------- Admin: quotes ----------
  router.on('GET', '/api/admin/quotes', (ctx) => {
    auth.requireUser(ctx);
    const { status, q } = ctx.query;
    const where = [];
    const args = [];
    if (status && QUOTE_STATUSES.includes(status)) {
      where.push('status = ?');
      args.push(status);
    }
    if (q) {
      where.push('(name LIKE ? OR email LIKE ? OR message LIKE ? OR address LIKE ?)');
      const like = `%${String(q).slice(0, 100)}%`;
      args.push(like, like, like, like);
    }
    return ctx.db
      .prepare(`SELECT * FROM quotes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`)
      .all(...args);
  });

  router.on('PATCH', '/api/admin/quotes/:id', (ctx) => {
    auth.requireUser(ctx);
    const id = idParam(ctx);
    const d = validate(
      ctx.body,
      { status: { type: 'string', enum: QUOTE_STATUSES }, notes: { type: 'string', max: 5000 } },
      { partial: true }
    );
    if (d.notes === null) d.notes = '';
    const { sql, values } = buildUpdate('quotes', d, id);
    if (!ctx.db.prepare(sql).run(...values).changes) throw new HttpError(404, 'Quote not found');
    return ctx.db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
  });

  router.on('DELETE', '/api/admin/quotes/:id', (ctx) => {
    auth.requireUser(ctx);
    if (!ctx.db.prepare('DELETE FROM quotes WHERE id = ?').run(idParam(ctx)).changes) throw new HttpError(404, 'Quote not found');
    return { ok: true };
  });

  // ---------- Admin: messages ----------
  router.on('GET', '/api/admin/messages', (ctx) => {
    auth.requireUser(ctx);
    return ctx.db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all().map((m) => ({ ...m, is_read: !!m.is_read }));
  });

  router.on('PATCH', '/api/admin/messages/:id', (ctx) => {
    auth.requireUser(ctx);
    const d = validate(ctx.body, { is_read: { type: 'bool', required: true } });
    const r = ctx.db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(d.is_read ? 1 : 0, idParam(ctx));
    if (!r.changes) throw new HttpError(404, 'Message not found');
    return { ok: true };
  });

  router.on('DELETE', '/api/admin/messages/:id', (ctx) => {
    auth.requireUser(ctx);
    if (!ctx.db.prepare('DELETE FROM messages WHERE id = ?').run(idParam(ctx)).changes) throw new HttpError(404, 'Message not found');
    return { ok: true };
  });

  // ---------- Admin: projects ----------
  router.on('GET', '/api/admin/projects', (ctx) => {
    auth.requireUser(ctx);
    return ctx.db.prepare('SELECT * FROM projects ORDER BY year DESC, id DESC').all().map(toProject);
  });

  router.on('POST', '/api/admin/projects', (ctx) => {
    auth.requireUser(ctx);
    const d = validate(ctx.body, projectSchema);
    d.slug = uniqueSlug(ctx.db, 'projects', d.slug || slugify(d.title));
    const cols = Object.keys(d);
    const r = ctx.db
      .prepare(`INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((k) => (typeof d[k] === 'boolean' ? Number(d[k]) : d[k])));
    ctx.status = 201;
    return toProject(ctx.db.prepare('SELECT * FROM projects WHERE id = ?').get(r.lastInsertRowid));
  });

  router.on('PUT', '/api/admin/projects/:id', (ctx) => {
    auth.requireUser(ctx);
    const id = idParam(ctx);
    if (!ctx.db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) throw new HttpError(404, 'Project not found');
    const d = validate(ctx.body, projectSchema);
    d.slug = uniqueSlug(ctx.db, 'projects', d.slug || slugify(d.title), id);
    const { sql, values } = buildUpdate('projects', d, id);
    ctx.db.prepare(sql).run(...values);
    return toProject(ctx.db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  });

  router.on('DELETE', '/api/admin/projects/:id', (ctx) => {
    auth.requireUser(ctx);
    if (!ctx.db.prepare('DELETE FROM projects WHERE id = ?').run(idParam(ctx)).changes) throw new HttpError(404, 'Project not found');
    return { ok: true };
  });

  // ---------- Admin: services ----------
  router.on('POST', '/api/admin/services', (ctx) => {
    auth.requireUser(ctx);
    const d = validate(ctx.body, serviceSchema);
    d.slug = uniqueSlug(ctx.db, 'services', d.slug || slugify(d.title));
    const cols = Object.keys(d);
    const r = ctx.db
      .prepare(`INSERT INTO services (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((k) => d[k]));
    ctx.status = 201;
    return ctx.db.prepare('SELECT * FROM services WHERE id = ?').get(r.lastInsertRowid);
  });

  router.on('PUT', '/api/admin/services/:id', (ctx) => {
    auth.requireUser(ctx);
    const id = idParam(ctx);
    if (!ctx.db.prepare('SELECT 1 FROM services WHERE id = ?').get(id)) throw new HttpError(404, 'Service not found');
    const d = validate(ctx.body, serviceSchema);
    d.slug = uniqueSlug(ctx.db, 'services', d.slug || slugify(d.title), id);
    const { sql, values } = buildUpdate('services', d, id);
    ctx.db.prepare(sql).run(...values);
    return ctx.db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  });

  router.on('DELETE', '/api/admin/services/:id', (ctx) => {
    auth.requireUser(ctx);
    if (!ctx.db.prepare('DELETE FROM services WHERE id = ?').run(idParam(ctx)).changes) throw new HttpError(404, 'Service not found');
    return { ok: true };
  });

  router.on('GET', '/api/admin/meta', (ctx) => {
    auth.requireUser(ctx);
    return { quoteStatuses: QUOTE_STATUSES, projectStatuses: PROJECT_STATUSES, icons: ICONS };
  });
}

module.exports = { register, PROJECT_TYPES };
