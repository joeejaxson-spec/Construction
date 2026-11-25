/* Admin dashboard: single-page app with hash routing. No dependencies. */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function api(path, { method = 'GET', body } = {}) {
    const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401 && !path.endsWith('/login')) {
      showLogin();
      throw Object.assign(new Error('Your session has ended. Please sign in again.'), { status: 401 });
    }
    if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, fields: data?.fields });
    return data;
  }

  // ---------- UI helpers ----------
  let toastTimer;
  function toast(msg, isError = false) {
    const t = $('[data-toast]');
    t.textContent = msg;
    t.classList.toggle('is-error', isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }

  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return isNaN(d) ? s : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const statusPill = (s) => `<span class="status status--${esc(s)}">${esc(String(s).replace('-', ' '))}</span>`;

  function fieldErrors(form, fields) {
    form.querySelectorAll('.field-error').forEach((e) => e.remove());
    form.querySelectorAll('.has-error').forEach((e) => e.classList.remove('has-error'));
    for (const [name, msg] of Object.entries(fields || {})) {
      const input = form.elements[name];
      const wrap = input?.closest('.field');
      if (!wrap) continue;
      wrap.classList.add('has-error');
      wrap.insertAdjacentHTML('beforeend', `<span class="field-error">${esc(msg)}</span>`);
    }
  }

  // Modal (one at a time) + a separate lightweight confirm dialog
  const modal = $('[data-modal]');
  const modalForm = $('[data-modal-form]');
  let modalSubmit = null;
  function openModal({ title, body, foot, onSubmit, onOpen }) {
    $('[data-modal-title]').textContent = title;
    $('[data-modal-body]').innerHTML = body;
    $('[data-modal-foot]').innerHTML = foot;
    modalSubmit = onSubmit;
    if (!modal.open) modal.showModal();
    onOpen?.(modalForm);
    modalForm.querySelector('input, select, textarea')?.focus();
  }
  const closeModal = () => modal.open && modal.close();
  $('[data-modal-close]').addEventListener('click', closeModal);
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!modalSubmit) return closeModal();
    const btn = modalForm.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await modalSubmit(modalForm);
    } catch (err) {
      fieldErrors(modalForm, err.fields);
      toast(err.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  modalForm.addEventListener('click', (e) => {
    if (e.target.closest('[data-cancel]')) closeModal();
  });

  function confirmDialog(message, okLabel = 'Delete') {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'modal';
      d.classList.add('modal--sm');
      d.innerHTML = `<div class="modal__inner"><div class="modal__body"><p class="m0">${esc(message)}</p></div>
        <div class="modal__foot"><button class="btn btn--ghost" data-no type="button">Cancel</button>
        <button class="btn btn--danger" data-yes type="button">${esc(okLabel)}</button></div></div>`;
      document.body.appendChild(d);
      const done = (v) => { d.close(); d.remove(); resolve(v); };
      d.querySelector('[data-no]').onclick = () => done(false);
      d.querySelector('[data-yes]').onclick = () => done(true);
      d.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
      d.showModal();
      d.querySelector('[data-no]').focus();
    });
  }

  // ---------- Auth ----------
  let meta = null;
  function showLogin() {
    closeModal();
    $('[data-app]').hidden = true;
    $('[data-login]').hidden = false;
    $('[data-login-form] input[name="email"]').focus();
  }
  async function showApp(user) {
    $('[data-login]').hidden = true;
    $('[data-app]').hidden = false;
    $('[data-user]').textContent = user.email;
    meta ||= await api('/api/admin/meta');
    route();
  }

  $('[data-login-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $('[data-login-error]');
    err.hidden = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const user = await api('/api/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      showApp(user);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // ---------- Router ----------
  const views = { dashboard, quotes, messages, projects, services, account };
  const view = () => $('[data-view]');
  async function route() {
    if ($('[data-app]').hidden) return;
    const name = (location.hash.slice(1).split('?')[0] || 'dashboard');
    const fn = views[name] || dashboard;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === (views[name] ? name : 'dashboard')));
    view().innerHTML = '<div class="loading">Loading…</div>';
    try {
      await fn();
    } catch (err) {
      if (err.status !== 401) view().innerHTML = `<div class="panel"><p class="alert alert--error">${esc(err.message)}</p></div>`;
    }
    refreshBadges();
  }
  window.addEventListener('hashchange', route);

  async function refreshBadges() {
    try {
      const s = await api('/api/admin/stats');
      const set = (k, n) => {
        const b = $(`[data-badge="${k}"]`);
        b.textContent = n;
        b.hidden = !n;
      };
      set('quotes', s.quotes.new);
      set('messages', s.unreadMessages);
    } catch { /* ignore */ }
  }

  // ---------- Dashboard ----------
  async function dashboard() {
    const s = await api('/api/admin/stats');
    view().innerHTML = `
      <div class="page-head"><h1>Dashboard</h1></div>
      <div class="stats">
        <a class="stat" href="#quotes"><strong>${s.quotes.new}</strong><span>New quote requests</span></a>
        <a class="stat" href="#quotes"><strong>${s.quotesLast30}</strong><span>Requests, last 30 days</span></a>
        <a class="stat" href="#messages"><strong>${s.unreadMessages}</strong><span>Unread messages</span></a>
        <a class="stat" href="#projects"><strong>${s.projects}</strong><span>Portfolio projects</span></a>
      </div>
      <section class="panel">
        <h2>Sales pipeline</h2>
        <div class="pipeline">
          ${meta.quoteStatuses.map((k) => `<a href="#quotes?status=${k}"><strong>${s.quotes[k]}</strong><span>${k}</span></a>`).join('')}
        </div>
      </section>
      <section class="panel">
        <h2>Latest quote requests</h2>
        ${
          s.recentQuotes.length
            ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Project</th><th>Status</th><th>Received</th></tr></thead><tbody>
              ${s.recentQuotes.map((q) => `<tr class="clickable" data-open-quote="${q.id}"><td>${esc(q.name)}</td><td>${esc(q.project_type)}</td><td>${statusPill(q.status)}</td><td>${fmtDate(q.created_at)}</td></tr>`).join('')}
              </tbody></table></div>`
            : '<p class="hint">No quote requests yet. They will appear here when someone fills in the estimate form.</p>'
        }
      </section>`;
    view().querySelectorAll('[data-open-quote]').forEach((tr) =>
      tr.addEventListener('click', () => (location.hash = `quotes?open=${tr.dataset.openQuote}`))
    );
  }

  // ---------- Quotes ----------
  async function quotes() {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    let status = params.get('status') || '';
    let q = '';
    const openId = Number(params.get('open')) || null;

    view().innerHTML = `
      <div class="page-head"><h1>Quote requests</h1></div>
      <div class="toolbar">
        <div class="seg" data-seg>
          ${['', ...meta.quoteStatuses].map((s) => `<button type="button" data-s="${s}" aria-pressed="${s === status}">${s || 'All'}</button>`).join('')}
        </div>
        <input type="search" placeholder="Search name, email, message…" data-search aria-label="Search quotes">
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Client</th><th>Project</th><th>Budget / timeline</th><th>Status</th><th>Received</th></tr></thead>
        <tbody data-rows><tr><td colspan="5" class="loading">Loading…</td></tr></tbody>
      </table></div>`;

    let rows = [];
    async function load() {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (q) qs.set('q', q);
      rows = await api(`/api/admin/quotes?${qs}`);
      $('[data-rows]').innerHTML = rows.length
        ? rows
            .map(
              (r) => `<tr class="clickable" data-id="${r.id}">
                <td>${esc(r.name)}<span class="cell-sub">${esc(r.email)}</span></td>
                <td>${esc(r.project_type)}<span class="cell-sub truncate">${esc(r.message)}</span></td>
                <td>${esc(r.budget || '—')}<span class="cell-sub">${esc(r.timeline || '')}</span></td>
                <td>${statusPill(r.status)}</td>
                <td>${fmtDate(r.created_at)}</td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="5" class="empty-row">No quote requests match.</td></tr>';
    }

    $('[data-seg]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      status = b.dataset.s;
      document.querySelectorAll('[data-seg] button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      load();
    });
    let t;
    $('[data-search]').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { q = e.target.value.trim(); load(); }, 250);
    });
    $('[data-rows]').addEventListener('click', (e) => {
      const tr = e.target.closest('[data-id]');
      if (tr) openQuote(rows.find((r) => r.id === Number(tr.dataset.id)), load);
    });

    await load();
    if (openId) {
      const r = rows.find((x) => x.id === openId) || (await api('/api/admin/quotes')).find((x) => x.id === openId);
      if (r) openQuote(r, load);
    }
  }

  function openQuote(r, reload) {
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
    openModal({
      title: `Quote #${r.id}`,
      body: `
        <dl class="detail-list">
          ${row('Name', esc(r.name))}
          ${row('Email', `<a href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Your estimate request')}">${esc(r.email)}</a>`)}
          ${row('Phone', r.phone ? `<a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a>` : '')}
          ${row('Project type', esc(r.project_type))}
          ${row('Budget', esc(r.budget))}
          ${row('Timeline', esc(r.timeline))}
          ${row('Address', esc(r.address))}
          ${row('Received', fmtDate(r.created_at))}
        </dl>
        <div class="message-box">${esc(r.message)}</div>
        <label class="field"><span>Status</span>
          <select name="status">${meta.quoteStatuses.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Internal notes</span><textarea name="notes" rows="4" maxlength="5000" placeholder="Call notes, site visit date, estimate amount…">${esc(r.notes)}</textarea></label>`,
      foot: `<button type="button" class="btn btn--danger spacer" data-del>Delete</button>
             <button type="button" class="btn btn--ghost" data-cancel>Close</button>
             <button type="submit" class="btn btn--accent">Save changes</button>`,
      onSubmit: async (form) => {
        await api(`/api/admin/quotes/${r.id}`, { method: 'PATCH', body: { status: form.elements.status.value, notes: form.elements.notes.value } });
        closeModal();
        toast('Quote updated');
        await reload();
        refreshBadges();
      },
      onOpen: (form) => {
        form.querySelector('[data-del]').onclick = async () => {
          if (!(await confirmDialog(`Delete quote request from ${r.name}? This can’t be undone.`))) return;
          await api(`/api/admin/quotes/${r.id}`, { method: 'DELETE' }).catch((e) => toast(e.message, true));
          closeModal();
          toast('Quote deleted');
          await reload();
          refreshBadges();
        };
      },
    });
  }

  // ---------- Messages ----------
  async function messages() {
    view().innerHTML = `
      <div class="page-head"><h1>Messages</h1></div>
      <div class="table-wrap"><table>
        <thead><tr><th>From</th><th>Message</th><th>Received</th><th></th></tr></thead>
        <tbody data-rows></tbody>
      </table></div>`;
    let rows = [];
    async function load() {
      rows = await api('/api/admin/messages');
      $('[data-rows]').innerHTML = rows.length
        ? rows
            .map(
              (m) => `<tr class="clickable ${m.is_read ? '' : 'unread'}" data-id="${m.id}">
                <td>${esc(m.name)}<span class="cell-sub">${esc(m.email)}</span></td>
                <td>${esc(m.subject || '(no subject)')}<span class="cell-sub truncate">${esc(m.message)}</span></td>
                <td>${fmtDate(m.created_at)}</td>
                <td class="actions"><button type="button" class="btn btn--ghost btn--sm" data-toggle>${m.is_read ? 'Mark unread' : 'Mark read'}</button></td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="4" class="empty-row">No messages yet.</td></tr>';
    }
    $('[data-rows]').addEventListener('click', async (e) => {
      const tr = e.target.closest('[data-id]');
      if (!tr) return;
      const m = rows.find((x) => x.id === Number(tr.dataset.id));
      if (e.target.closest('[data-toggle]')) {
        await api(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { is_read: !m.is_read } });
        await load();
        return refreshBadges();
      }
      if (!m.is_read) {
        api(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { is_read: true } }).then(() => { load(); refreshBadges(); });
      }
      openModal({
        title: m.subject || 'Message',
        body: `<dl class="detail-list"><dt>From</dt><dd>${esc(m.name)} &lt;<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>&gt;</dd><dt>Received</dt><dd>${fmtDate(m.created_at)}</dd></dl>
               <div class="message-box">${esc(m.message)}</div>`,
        foot: `<button type="button" class="btn btn--danger spacer" data-del>Delete</button>
               <a class="btn btn--ghost" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message'))}">Reply by email</a>
               <button type="button" class="btn" data-cancel>Close</button>`,
        onSubmit: null,
        onOpen: (form) => {
          form.querySelector('[data-del]').onclick = async () => {
            if (!(await confirmDialog('Delete this message?'))) return;
            await api(`/api/admin/messages/${m.id}`, { method: 'DELETE' });
            closeModal();
            toast('Message deleted');
            await load();
            refreshBadges();
          };
        },
      });
    });
    await load();
  }

  // ---------- Projects ----------
  async function projects() {
    view().innerHTML = `
      <div class="page-head"><h1>Projects</h1><button class="btn btn--accent" type="button" data-new>+ New project</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Project</th><th>Category</th><th>Year</th><th>Status</th><th>Visibility</th><th></th></tr></thead>
        <tbody data-rows></tbody>
      </table></div>`;
    let rows = [];
    async function load() {
      rows = await api('/api/admin/projects');
      $('[data-rows]').innerHTML = rows.length
        ? rows
            .map(
              (p) => `<tr data-id="${p.id}">
                <td>${p.featured ? '<span class="star" title="Featured on home page">★</span> ' : ''}<strong>${esc(p.title)}</strong><span class="cell-sub">/projects/${esc(p.slug)}</span></td>
                <td>${esc(p.category)}</td>
                <td>${esc(p.year ?? '')}</td>
                <td>${statusPill(p.status)}</td>
                <td>${p.published ? 'Published' : statusPill('draft')}</td>
                <td class="actions">
                  ${p.published ? `<a class="btn btn--ghost btn--sm" href="/projects/${esc(p.slug)}" target="_blank" rel="noopener">View</a>` : ''}
                  <button class="btn btn--ghost btn--sm" type="button" data-edit>Edit</button>
                  <button class="btn btn--danger btn--sm" type="button" data-del>Delete</button>
                </td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="6" class="empty-row">No projects yet. Add your first one.</td></tr>';
    }
    $('[data-new]').onclick = () => editProject(null, load);
    $('[data-rows]').addEventListener('click', async (e) => {
      const tr = e.target.closest('[data-id]');
      if (!tr) return;
      const p = rows.find((x) => x.id === Number(tr.dataset.id));
      if (e.target.closest('[data-edit]')) editProject(p, load);
      if (e.target.closest('[data-del]')) {
        if (!(await confirmDialog(`Delete “${p.title}”? It will be removed from the website.`))) return;
        await api(`/api/admin/projects/${p.id}`, { method: 'DELETE' });
        toast('Project deleted');
        load();
      }
    });
    await load();
  }

  function editProject(p, reload) {
    const v = p || { status: 'completed', published: true, featured: false, year: new Date().getFullYear() };
    const cats = ['Residential', 'Commercial', 'Renovation', 'Industrial'];
    openModal({
      title: p ? 'Edit project' : 'New project',
      body: `
        <div class="grid-2">
          <label class="field"><span>Title *</span><input name="title" required maxlength="160" value="${esc(v.title)}"></label>
          <label class="field"><span>URL slug</span><input name="slug" maxlength="80" value="${esc(v.slug)}" placeholder="auto-generated from title"></label>
        </div>
        <div class="grid-3">
          <label class="field"><span>Category *</span><input name="category" required maxlength="60" list="cat-list" value="${esc(v.category)}"></label>
          <label class="field"><span>Location</span><input name="location" maxlength="120" value="${esc(v.location)}"></label>
          <label class="field"><span>Year</span><input name="year" type="number" min="1900" max="2100" value="${esc(v.year ?? '')}"></label>
        </div>
        <datalist id="cat-list">${cats.map((c) => `<option value="${c}">`).join('')}</datalist>
        <div class="grid-3">
          <label class="field"><span>Size</span><input name="size" maxlength="60" value="${esc(v.size)}" placeholder="e.g. 3,200 sq ft"></label>
          <label class="field"><span>Duration</span><input name="duration" maxlength="60" value="${esc(v.duration)}" placeholder="e.g. 9 months"></label>
          <label class="field"><span>Status</span><select name="status">${meta.projectStatuses.map((s) => `<option value="${s}" ${s === v.status ? 'selected' : ''}>${s.replace('-', ' ')}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Summary (shown on cards)</span><input name="summary" maxlength="400" value="${esc(v.summary)}"></label>
        <label class="field"><span>Full description</span><textarea name="description" rows="7" maxlength="10000">${esc(v.description)}</textarea><span class="hint">Leave a blank line between paragraphs.</span></label>
        <label class="field"><span>Photo URL</span><input name="image_url" maxlength="1000" value="${esc(v.image_url)}" placeholder="https://… or /img/your-photo.jpg"><span class="hint">Put photos in public/img/ and enter /img/filename.jpg, or paste an https link. Leave blank for a drawn placeholder.</span></label>
        <div class="check-row">
          <label class="check"><input type="checkbox" name="published" ${v.published ? 'checked' : ''}> Published on website</label>
          <label class="check"><input type="checkbox" name="featured" ${v.featured ? 'checked' : ''}> Featured on home page</label>
        </div>`,
      foot: `<button type="button" class="btn btn--ghost" data-cancel>Cancel</button><button type="submit" class="btn btn--accent">${p ? 'Save project' : 'Create project'}</button>`,
      onSubmit: async (form) => {
        const f = form.elements;
        const body = {
          title: f.title.value, slug: f.slug.value, category: f.category.value, location: f.location.value,
          year: f.year.value, size: f.size.value, duration: f.duration.value, status: f.status.value,
          summary: f.summary.value, description: f.description.value, image_url: f.image_url.value,
          published: f.published.checked, featured: f.featured.checked,
        };
        await api(p ? `/api/admin/projects/${p.id}` : '/api/admin/projects', { method: p ? 'PUT' : 'POST', body });
        closeModal();
        toast(p ? 'Project saved' : 'Project created');
        reload();
      },
    });
  }

  // ---------- Services ----------
  async function services() {
    view().innerHTML = `
      <div class="page-head"><h1>Services</h1><button class="btn btn--accent" type="button" data-new>+ New service</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Service</th><th>Summary</th><th></th></tr></thead>
        <tbody data-rows></tbody>
      </table></div>`;
    let rows = [];
    async function load() {
      rows = await api('/api/services');
      $('[data-rows]').innerHTML = rows.length
        ? rows
            .map(
              (s) => `<tr data-id="${s.id}">
                <td>${s.sort_order}</td>
                <td><strong>${esc(s.title)}</strong><span class="cell-sub">icon: ${esc(s.icon)}</span></td>
                <td class="truncate">${esc(s.summary)}</td>
                <td class="actions"><button class="btn btn--ghost btn--sm" type="button" data-edit>Edit</button><button class="btn btn--danger btn--sm" type="button" data-del>Delete</button></td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="4" class="empty-row">No services yet.</td></tr>';
    }
    $('[data-new]').onclick = () => editService(null, load, rows.length);
    $('[data-rows]').addEventListener('click', async (e) => {
      const tr = e.target.closest('[data-id]');
      if (!tr) return;
      const s = rows.find((x) => x.id === Number(tr.dataset.id));
      if (e.target.closest('[data-edit]')) editService(s, load);
      if (e.target.closest('[data-del]')) {
        if (!(await confirmDialog(`Delete the “${s.title}” service?`))) return;
        await api(`/api/admin/services/${s.id}`, { method: 'DELETE' });
        toast('Service deleted');
        load();
      }
    });
    await load();
  }

  function editService(s, reload, nextOrder = 0) {
    const v = s || { icon: 'building', sort_order: nextOrder };
    openModal({
      title: s ? 'Edit service' : 'New service',
      body: `
        <div class="grid-2">
          <label class="field"><span>Title *</span><input name="title" required maxlength="120" value="${esc(v.title)}"></label>
          <label class="field"><span>URL anchor</span><input name="slug" maxlength="80" value="${esc(v.slug)}" placeholder="auto-generated"></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Icon</span><select name="icon">${meta.icons.map((i) => `<option ${i === v.icon ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
          <label class="field"><span>Display order</span><input name="sort_order" type="number" min="0" max="9999" value="${esc(v.sort_order)}"></label>
        </div>
        <label class="field"><span>Summary *</span><input name="summary" required maxlength="300" value="${esc(v.summary)}"></label>
        <label class="field"><span>Full description</span><textarea name="description" rows="7" maxlength="10000">${esc(v.description)}</textarea><span class="hint">Leave a blank line between paragraphs.</span></label>`,
      foot: `<button type="button" class="btn btn--ghost" data-cancel>Cancel</button><button type="submit" class="btn btn--accent">${s ? 'Save service' : 'Create service'}</button>`,
      onSubmit: async (form) => {
        const f = form.elements;
        const body = { title: f.title.value, slug: f.slug.value, icon: f.icon.value, sort_order: f.sort_order.value, summary: f.summary.value, description: f.description.value };
        await api(s ? `/api/admin/services/${s.id}` : '/api/admin/services', { method: s ? 'PUT' : 'POST', body });
        closeModal();
        toast(s ? 'Service saved' : 'Service created');
        reload();
      },
    });
  }

  // ---------- Account ----------
  async function account() {
    const me = await api('/api/admin/me');
    view().innerHTML = `
      <div class="page-head"><h1>Account</h1></div>
      <section class="panel panel--narrow">
        <h2>Change password</h2>
        <p class="hint">Signed in as ${esc(me.email)}. Changing your password signs out every other device.</p>
        <form data-pw novalidate class="stack">
          <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
          <label class="field"><span>New password (10+ characters)</span><input name="next" type="password" autocomplete="new-password" minlength="10" required></label>
          <label class="field"><span>Confirm new password</span><input name="confirm" type="password" autocomplete="new-password" required></label>
          <div><button class="btn btn--accent" type="submit">Update password</button></div>
        </form>
      </section>`;
    $('[data-pw]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = form.elements;
      if (f.next.value !== f.confirm.value) return fieldErrors(form, { confirm: 'Passwords don’t match' });
      try {
        await api('/api/admin/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
        form.reset();
        fieldErrors(form, {});
        toast('Password updated');
      } catch (err) {
        fieldErrors(form, err.fields);
        toast(err.message, true);
      }
    });
  }

  // ---------- Boot ----------
  api('/api/admin/me').then(showApp).catch(() => showLogin());
})();
