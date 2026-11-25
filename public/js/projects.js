(function () {
  'use strict';
  const { api, esc, projectCard, reveal } = window.App;
  const grid = document.querySelector('[data-projects]');
  const filters = document.querySelector('[data-filters]');
  const statusSel = document.querySelector('[data-status-filter]');
  const countEl = document.querySelector('[data-count]');

  const params = new URLSearchParams(location.search);
  let category = params.get('category') || '';
  statusSel.value = params.get('status') || '';
  let categories = [];

  function renderFilters(total) {
    const chips = [{ category: '', count: total, label: 'All' }, ...categories.map((c) => ({ ...c, label: c.category }))];
    filters.innerHTML = chips
      .map(
        (c) =>
          `<button type="button" class="chip" data-cat="${esc(c.category)}" aria-pressed="${c.category === category}">${esc(c.label)}<span class="count">${c.count}</span></button>`
      )
      .join('');
  }

  async function load() {
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (statusSel.value) q.set('status', statusSel.value);
    history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
    try {
      const { projects, categories: cats } = await api(`/api/projects?${q}`);
      categories = cats;
      renderFilters(cats.reduce((a, c) => a + c.count, 0));
      countEl.textContent = `${projects.length} project${projects.length === 1 ? '' : 's'}`;
      grid.innerHTML = projects.length
        ? projects.map(projectCard).join('')
        : '<p class="empty">No projects match these filters yet.</p>';
      reveal(grid);
    } catch {
      grid.innerHTML = '<p class="empty">Could not load projects right now.</p>';
    }
  }

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    category = btn.dataset.cat;
    load();
  });
  statusSel.addEventListener('change', load);
  load();
})();
