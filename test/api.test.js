'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');

let server, base, app;
const ADMIN = { email: 'admin@test.local', password: 'correct-horse-battery' };

before(async () => {
  app = createApp({
    dbPath: ':memory:',
    config: { adminEmail: ADMIN.email, adminPassword: ADMIN.password },
    limits: { forms: 100, login: 100 },
    log: () => {},
  });
  server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function req(path, { method = 'GET', body, cookie, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : raw });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function login() {
  const r = await req('/api/admin/login', { method: 'POST', body: ADMIN });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('pages render with header, footer and site details', async () => {
  for (const p of ['/', '/services', '/projects', '/about', '/contact', '/admin']) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
    assert.match(r.text, /Jaxson Construction/, p);
    assert.doesNotMatch(r.text, /\{\{site\./, `unrendered template in ${p}`);
  }
  const home = await req('/');
  assert.match(home.text, /class="site-header"/);
  assert.match(home.text, /class="site-footer"/);
});

test('security headers are set', async () => {
  const r = await req('/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('unknown pages and traversal attempts return 404', async () => {
  assert.equal((await req('/nope')).status, 404);
  assert.equal((await req('/projects/does-not-exist')).status, 404);
  assert.equal((await req('/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await req('/api/nope')).status, 404);
});

test('services and projects are seeded and public', async () => {
  const s = await req('/api/services');
  assert.equal(s.status, 200);
  assert.ok(s.json.length >= 6);

  const p = await req('/api/projects');
  assert.ok(p.json.projects.length >= 8);
  assert.ok(p.json.categories.some((c) => c.category === 'Residential'));

  const f = await req('/api/projects?featured=1');
  assert.ok(f.json.projects.every((x) => x.featured));

  const c = await req('/api/projects?category=Commercial');
  assert.ok(c.json.projects.every((x) => x.category === 'Commercial'));

  const one = await req('/api/projects/maple-ridge-residence');
  assert.equal(one.json.title, 'Maple Ridge Residence');
  assert.ok(Array.isArray(one.json.related));

  const page = await req('/projects/maple-ridge-residence');
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>Maple Ridge Residence/);
});

test('quote request: validation and success', async () => {
  const bad = await req('/api/quotes', { method: 'POST', body: { name: '', email: 'nope', project_type: 'Spaceship', message: 'hi' } });
  assert.equal(bad.status, 422);
  assert.ok(bad.json.fields.name && bad.json.fields.email && bad.json.fields.project_type && bad.json.fields.message);

  const ok = await req('/api/quotes', {
    method: 'POST',
    body: { name: 'Pat Builder', email: 'pat@example.com', project_type: 'New home', budget: 'Not sure yet', message: 'Two-storey home on a corner lot.' },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.json.id > 0);
});

test('non-JSON bodies are rejected (CSRF protection)', async () => {
  const res = await fetch(base + '/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=a&email=a@b.co&message=hello',
  });
  assert.equal(res.status, 415);
});

test('honeypot submissions are silently dropped', async () => {
  const cookie = await login();
  const before = (await req('/api/admin/messages', { cookie })).json.length;
  const r = await req('/api/contact', { method: 'POST', body: { name: 'Bot', email: 'b@b.co', message: 'spam spam', website: 'http://x' } });
  assert.equal(r.status, 201);
  assert.equal((await req('/api/admin/messages', { cookie })).json.length, before);
});

test('admin endpoints require login', async () => {
  for (const p of ['/api/admin/me', '/api/admin/quotes', '/api/admin/projects', '/api/admin/stats']) {
    assert.equal((await req(p)).status, 401, p);
  }
  const wrong = await req('/api/admin/login', { method: 'POST', body: { email: ADMIN.email, password: 'wrong-password' } });
  assert.equal(wrong.status, 401);
});

test('admin can manage quotes and messages', async () => {
  const cookie = await login();
  await req('/api/contact', { method: 'POST', body: { name: 'Sam', email: 'sam@example.com', subject: 'Hi', message: 'Do you build decks?' } });

  const quotes = (await req('/api/admin/quotes', { cookie })).json;
  assert.ok(quotes.length >= 1);
  const q = quotes[0];
  const upd = await req(`/api/admin/quotes/${q.id}`, { method: 'PATCH', cookie, body: { status: 'contacted', notes: 'Site visit Tue' } });
  assert.equal(upd.json.status, 'contacted');
  assert.equal(upd.json.notes, 'Site visit Tue');
  assert.equal((await req(`/api/admin/quotes/${q.id}`, { method: 'PATCH', cookie, body: { status: 'bogus' } })).status, 422);
  assert.equal((await req('/api/admin/quotes?status=contacted', { cookie })).json.length, 1);
  assert.equal((await req('/api/admin/quotes?q=corner', { cookie })).json.length, 1);

  const stats = (await req('/api/admin/stats', { cookie })).json;
  assert.equal(stats.quotes.contacted, 1);
  assert.ok(stats.unreadMessages >= 1);

  const msgs = (await req('/api/admin/messages', { cookie })).json;
  const m = msgs.find((x) => x.email === 'sam@example.com');
  assert.equal((await req(`/api/admin/messages/${m.id}`, { method: 'PATCH', cookie, body: { is_read: true } })).status, 200);
  assert.equal((await req(`/api/admin/messages/${m.id}`, { method: 'DELETE', cookie, body: {} })).status, 200);
  assert.equal((await req(`/api/admin/quotes/${q.id}`, { method: 'DELETE', cookie, body: {} })).status, 200);
  assert.equal((await req(`/api/admin/quotes/${q.id}`, { method: 'DELETE', cookie, body: {} })).status, 404);
});

test('admin can create, update, unpublish and delete projects', async () => {
  const cookie = await login();
  const created = await req('/api/admin/projects', {
    method: 'POST',
    cookie,
    body: { title: 'Test Garage Build', category: 'Residential', year: 2026, summary: 'A garage.', featured: true },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.slug, 'test-garage-build');
  assert.equal(created.json.published, true);

  const dup = await req('/api/admin/projects', { method: 'POST', cookie, body: { title: 'Test Garage Build', category: 'Residential' } });
  assert.equal(dup.json.slug, 'test-garage-build-2');

  const id = created.json.id;
  const upd = await req(`/api/admin/projects/${id}`, {
    method: 'PUT',
    cookie,
    body: { ...created.json, title: 'Test Garage Build', published: false },
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.published, false);
  assert.equal((await req('/api/projects/test-garage-build')).status, 404, 'unpublished is hidden');

  const badUrl = await req(`/api/admin/projects/${id}`, { method: 'PUT', cookie, body: { title: 'x', category: 'y', image_url: 'javascript:alert(1)' } });
  assert.equal(badUrl.status, 422);

  assert.equal((await req(`/api/admin/projects/${id}`, { method: 'DELETE', cookie, body: {} })).status, 200);
  assert.equal((await req(`/api/admin/projects/${dup.json.id}`, { method: 'DELETE', cookie, body: {} })).status, 200);
});

test('admin can manage services', async () => {
  const cookie = await login();
  const c = await req('/api/admin/services', { method: 'POST', cookie, body: { title: 'Roofing', summary: 'Roofs that keep the rain out.', icon: 'home' } });
  assert.equal(c.status, 201);
  assert.equal(c.json.slug, 'roofing');
  const u = await req(`/api/admin/services/${c.json.id}`, { method: 'PUT', cookie, body: { ...c.json, summary: 'Updated.' } });
  assert.equal(u.json.summary, 'Updated.');
  assert.equal((await req(`/api/admin/services/${c.json.id}`, { method: 'DELETE', cookie, body: {} })).status, 200);
});

test('password change and logout', async () => {
  const cookie = await login();
  const bad = await req('/api/admin/password', { method: 'POST', cookie, body: { current: 'nope', next: 'another-long-password' } });
  assert.equal(bad.status, 422);
  const ok = await req('/api/admin/password', { method: 'POST', cookie, body: { current: ADMIN.password, next: 'another-long-password' } });
  assert.equal(ok.status, 200);
  ADMIN.password = 'another-long-password';
  assert.equal((await req('/api/admin/logout', { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal((await req('/api/admin/me', { cookie })).status, 401);
  await login();
});

test('sitemap lists published projects', async () => {
  const r = await req('/sitemap.xml');
  assert.equal(r.status, 200);
  assert.match(r.text, /\/projects\/maple-ridge-residence/);
});

test('login is rate limited', async () => {
  const strict = createApp({ dbPath: ':memory:', limits: { login: 2 }, config: { adminPassword: 'whatever-123' }, log: () => {} });
  const s = http.createServer(strict.handler);
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${s.address().port}/api/admin/login`;
  const hit = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) });
  assert.equal((await hit()).status, 401);
  assert.equal((await hit()).status, 401);
  assert.equal((await hit()).status, 429);
  s.close();
});
