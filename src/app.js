'use strict';
const fs = require('node:fs');
const path = require('node:path');
const baseConfig = require('./config');
const { openDb } = require('./db');
const { HttpError, sendJson, readBody, setSecurityHeaders, Router } = require('./http');
const routes = require('./routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VIEWS_DIR = path.join(__dirname, 'views');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// Clean URLs → page files
const PAGES = {
  '/': 'index.html',
  '/services': 'services.html',
  '/projects': 'projects.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/quote': 'contact.html',
  '/admin': 'admin/index.html',
};

const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function createApp(options = {}) {
  const config = { ...baseConfig, ...options.config, site: { ...baseConfig.site, ...(options.config?.site || {}) } };
  const log = options.log || console.log;
  const db =
    options.db ||
    openDb({
      file: options.dbPath || config.dbPath,
      adminEmail: config.adminEmail,
      adminPassword: config.adminPassword,
      log,
    });

  const router = new Router();
  routes.register(router, { config, limits: options.limits });

  const cache = new Map();
  function readCached(file) {
    if (config.production && cache.has(file)) return cache.get(file);
    const buf = fs.readFileSync(file);
    if (config.production) cache.set(file, buf);
    return buf;
  }

  function renderHtml(file, vars = {}) {
    let html = readCached(file).toString('utf8');
    html = html.replace(/<!--\s*@(header|footer)\s*-->/g, (_, name) =>
      readCached(path.join(VIEWS_DIR, `${name}.html`)).toString('utf8')
    );
    const values = {
      ...Object.fromEntries(Object.entries(config.site).map(([k, v]) => [`site.${k}`, v])),
      'site.phoneHref': config.site.phone.replace(/[^\d+]/g, ''),
      year: new Date().getFullYear(),
      ...vars,
    };
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => (key in values ? escHtml(values[key]) : m));
  }

  function sendHtml(res, status, html) {
    res.writeHead(status, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    res.end(html);
  }

  function notFound(res) {
    sendHtml(res, 404, renderHtml(path.join(PUBLIC_DIR, '404.html')));
  }

  function serveSitemap(req, res) {
    const origin = `${config.production ? 'https' : 'http'}://${req.headers.host || 'localhost'}`;
    const urls = ['/', '/services', '/projects', '/about', '/contact'];
    for (const p of db.prepare('SELECT slug FROM projects WHERE published = 1').all()) urls.push(`/projects/${p.slug}`);
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => `  <url><loc>${escHtml(origin + u)}</loc></url>`).join('\n') +
      '\n</urlset>\n';
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(xml);
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    if (pathname === '/sitemap.xml') return serveSitemap(req, res);

    const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    if (PAGES[clean]) return sendHtml(res, 200, renderHtml(path.join(PUBLIC_DIR, PAGES[clean])));

    const projectMatch = /^\/projects\/([a-z0-9-]+)$/.exec(clean);
    if (projectMatch) {
      const p = db.prepare('SELECT title, summary FROM projects WHERE slug = ? AND published = 1').get(projectMatch[1]);
      if (!p) return notFound(res);
      return sendHtml(res, 200, renderHtml(path.join(PUBLIC_DIR, 'project.html'), { 'page.title': p.title, 'page.summary': p.summary }));
    }

    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return notFound(res);
    }
    const file = path.normalize(path.join(PUBLIC_DIR, decoded));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return notFound(res);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      return notFound(res);
    }
    if (!stat.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') return sendHtml(res, 200, renderHtml(file));
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': config.production ? 'public, max-age=3600' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  async function handler(req, res) {
    setSecurityHeaders(res);
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendJson(res, 400, { error: 'Bad request' });
    }
    const isApi = url.pathname.startsWith('/api/');
    try {
      if (!isApi) return serveStatic(req, res, url.pathname);

      const match = router.match(req.method, url.pathname);
      if (!match) throw new HttpError(404, 'Not found');
      if (match.notAllowed) throw new HttpError(405, 'Method not allowed');

      const fwd = config.trustProxy && req.headers['x-forwarded-for'];
      const ctx = {
        req,
        res,
        db,
        log,
        url,
        params: match.params,
        query: Object.fromEntries(url.searchParams),
        ip: fwd ? String(fwd).split(',')[0].trim() : req.socket.remoteAddress,
        status: 200,
        body: {},
      };
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) ctx.body = await readBody(req);
      const result = await match.handler(ctx);
      if (!res.headersSent) sendJson(res, ctx.status, result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) log(`[error] ${req.method} ${req.url}\n${err.stack || err}`);
      if (res.headersSent) return res.end();
      if (isApi || status !== 404) {
        sendJson(res, status, {
          error: status === 500 ? 'Something went wrong on our end' : err.message,
          ...(err.details ? { fields: err.details } : {}),
        });
      } else notFound(res);
    }
  }

  return { handler, db, config };
}

module.exports = { createApp };
