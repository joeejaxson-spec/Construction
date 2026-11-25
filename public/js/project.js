(function () {
  'use strict';
  const { api, esc, media, paragraphs, projectCard, reveal } = window.App;
  const slug = location.pathname.split('/').filter(Boolean).pop();
  const $ = (k) => document.querySelector(`[data-p="${k}"]`);

  api(`/api/projects/${encodeURIComponent(slug)}`)
    .then((p) => {
      $('category').textContent = p.category;
      $('title').textContent = p.title;
      $('summary').textContent = p.summary;
      $('media').innerHTML = media(p);
      $('description').innerHTML = paragraphs(p.description);
      const specs = [
        ['Category', p.category],
        ['Location', p.location],
        ['Year', p.year],
        ['Size', p.size],
        ['Duration', p.duration],
        ['Status', p.status === 'in-progress' ? 'In progress' : 'Completed'],
      ].filter(([, v]) => v !== null && v !== undefined && v !== '');
      $('specs').innerHTML = specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

      if (p.related && p.related.length) {
        document.querySelector('[data-related]').innerHTML = p.related.map(projectCard).join('');
        document.querySelector('[data-related-wrap]').hidden = false;
        reveal();
      }
    })
    .catch(() => {
      $('description').innerHTML = '<p class="empty">This project could not be loaded.</p>';
    });
})();
