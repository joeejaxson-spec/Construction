(function () {
  'use strict';
  const { api, esc, icon, paragraphs, reveal } = window.App;
  const list = document.querySelector('[data-service-list]');
  const index = document.querySelector('[data-service-index]');

  api('/api/services')
    .then((services) => {
      index.innerHTML = services.map((s) => `<a class="chip" href="#${esc(s.slug)}">${esc(s.title)}</a>`).join('');
      list.innerHTML =
        services
          .map(
            (s) => `<article class="service-row reveal" id="${esc(s.slug)}">
              <span class="icon-box">${icon(s.icon)}</span>
              <div>
                <h2>${esc(s.title)}</h2>
                <p class="summary">${esc(s.summary)}</p>
                <div class="desc">${paragraphs(s.description)}</div>
              </div>
              <a class="btn btn--accent btn--sm" href="/quote#quote">Get a quote</a>
            </article>`
          )
          .join('') || '<p class="empty">Services coming soon.</p>';
      reveal(list);
      // Re-apply hash scroll once content exists.
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    })
    .catch(() => (list.innerHTML = '<p class="empty">Could not load services right now.</p>'));
})();
