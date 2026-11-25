/* Shared helpers for every public page. Exposes window.App. */
(function () {
  'use strict';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, init);
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.fields = data && data.fields;
      throw err;
    }
    return data;
  }

  let sitePromise;
  const site = () => (sitePromise ||= api('/api/site'));

  const ICONS = {
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    building: '<rect x="4" y="3" width="16" height="18"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/><path d="M10 21v-3h4v3"/>',
    hammer: '<path d="M14 6l4 4"/><path d="M11.5 3.5 17 9l3-3-5.5-5.5z" transform="translate(-1 1)"/><path d="M13 9 3.5 18.5a1.4 1.4 0 0 0 2 2L15 11"/>',
    ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V3h6v1"/><path d="M8.5 12l2 2 4-4.5"/><path d="M9 17h6"/>',
    layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/><path d="M2 17.5l10 5 10-5" opacity=".6"/>',
    hardhat: '<path d="M3 18h18"/><path d="M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/>',
    truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.building}</svg>`;

  // Blueprint-style line drawings used when a project has no photo yet.
  const ART = {
    residential:
      '<path d="M60 250V150l110-80 110 80v100"/><path d="M40 165 170 70l130 95"/><rect x="95" y="175" width="45" height="40"/><rect x="200" y="175" width="45" height="40"/><path d="M150 250v-55h40v55"/><path d="M235 110V80h22v46"/><path d="M290 250V190h70v60"/><path d="M285 195l40-30 40 30"/>',
    commercial:
      '<rect x="70" y="60" width="150" height="190"/><rect x="230" y="120" width="100" height="130"/><path d="M90 85h110M90 115h110M90 145h110M90 175h110M90 205h110"/><path d="M120 60v160M170 60v160"/><path d="M250 145h60M250 175h60M250 205h60"/><path d="M125 250v-30h40v30"/>',
    renovation:
      '<path d="M50 250V120h220v130"/><path d="M40 125 160 60l120 65"/><rect x="80" y="150" width="60" height="50"/><path d="M110 150v50M80 175h60"/><path d="M290 250 330 90M320 250 360 90"/><path d="M297 222h30M304 194h30M311 166h30M318 138h30M325 110h30"/><path d="M190 250v-70h50v70"/>',
    industrial:
      '<path d="M40 250V150l50-30v30l50-30v30l50-30v30l50-30v110"/><path d="M40 150h200"/><rect x="70" y="200" width="40" height="50"/><rect x="130" y="200" width="40" height="50"/><path d="M300 250V50M290 250h20"/><path d="M300 60h80M300 60l-30 20h30"/><path d="M370 60v60"/><rect x="360" y="120" width="20" height="16"/><path d="M300 90l20-30M320 90l20-30M340 90l20-30" opacity=".6"/><path d="M300 90h70"/>',
  };
  function placeholder(category) {
    const key = String(category || '').toLowerCase();
    const art = ART[key] || ART.commercial;
    return `<div class="ph" data-cat="${esc(key)}"><div class="ph__art"><svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="rgba(245,179,1,.8)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M0 250h400" stroke="rgba(255,255,255,.35)"/>${art}</svg></div></div>`;
  }

  function media(p) {
    return p.image_url
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy">`
      : placeholder(p.category);
  }

  function projectCard(p) {
    const meta = [p.category, p.location, p.year].filter(Boolean).map(esc).join(' · ');
    return `<a class="project-card reveal" href="/projects/${encodeURIComponent(p.slug)}">
      <div class="project-card__media">
        <span class="badge">${esc(p.category)}</span>
        ${p.status === 'in-progress' ? '<span class="badge badge--progress">In progress</span>' : ''}
        ${media(p)}
      </div>
      <div class="project-card__body">
        <span class="project-card__meta">${meta}</span>
        <h3>${esc(p.title)}</h3>
        ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
      </div>
    </a>`;
  }

  const paragraphs = (text) =>
    String(text || '')
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`)
      .join('');

  // Fade-in elements as they scroll into view.
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -40px' })
    : null;
  function reveal(root = document) {
    root.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => (io ? io.observe(el) : el.classList.add('is-visible')));
  }

  async function fillStats() {
    const els = document.querySelectorAll('[data-stat]');
    if (!els.length) return;
    try {
      const s = await api('/api/stats');
      els.forEach((el) => {
        const target = Number(s[el.dataset.stat]) || 0;
        countUp(el, target);
      });
    } catch { /* leave placeholders */ }
  }
  function countUp(el, target) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return (el.textContent = target);
    const start = performance.now();
    const dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Navigation: highlight the current page and handle the mobile menu.
  function initNav() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.site-nav a:not(.btn)').forEach((a) => {
      const href = a.getAttribute('href');
      if (href === path || (href !== '/' && path.startsWith(href + '/'))) a.setAttribute('aria-current', 'page');
    });
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        toggle.focus();
      }
    });
  }

  async function fillFooterServices() {
    const ul = document.querySelector('[data-footer-services]');
    if (!ul) return;
    try {
      const services = await api('/api/services');
      ul.innerHTML = services
        .slice(0, 5)
        .map((s) => `<li><a href="/services#${esc(s.slug)}">${esc(s.title)}</a></li>`)
        .join('');
    } catch { /* keep fallback link */ }
  }

  window.App = { esc, api, site, icon, placeholder, media, projectCard, paragraphs, reveal };

  initNav();
  fillStats();
  fillFooterServices();
  reveal();
})();
