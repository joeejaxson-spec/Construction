(function () {
  'use strict';
  const { api, esc, icon, projectCard, reveal } = window.App;

  const servicesEl = document.querySelector('[data-services]');
  const featuredEl = document.querySelector('[data-featured]');

  if (servicesEl) {
    api('/api/services')
      .then((services) => {
        servicesEl.innerHTML = services
          .slice(0, 6)
          .map(
            (s) => `<a class="service-card reveal" href="/services#${esc(s.slug)}">
              <span class="icon-box">${icon(s.icon)}</span>
              <h3>${esc(s.title)}</h3>
              <p>${esc(s.summary)}</p>
              <span class="more">Learn more →</span>
            </a>`
          )
          .join('') || '<p class="empty">Services coming soon.</p>';
        reveal(servicesEl);
      })
      .catch(() => (servicesEl.innerHTML = '<p class="empty">Could not load services right now.</p>'));
  }

  if (featuredEl) {
    api('/api/projects?featured=1&limit=3')
      .then(({ projects }) => {
        featuredEl.innerHTML = projects.length
          ? projects.slice(0, 3).map(projectCard).join('')
          : '<p class="empty">Featured projects will appear here.</p>';
        reveal(featuredEl);
      })
      .catch(() => (featuredEl.innerHTML = '<p class="empty">Could not load projects right now.</p>'));
  }
})();
