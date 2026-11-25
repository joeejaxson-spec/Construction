(function () {
  'use strict';
  const { api, esc, site } = window.App;

  // ----- Tabs (keyboard accessible) -----
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next);
      next.focus();
    });
  });
  if (location.hash === '#message') select(tabs[1]);

  // ----- Select options from the server -----
  site().then((s) => {
    document.querySelectorAll('select[data-options]').forEach((sel) => {
      const opts = s.options[sel.dataset.options] || [];
      sel.insertAdjacentHTML('beforeend', opts.map((o) => `<option>${esc(o)}</option>`).join(''));
    });
  });

  // ----- Form submission -----
  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach((e) => e.remove());
    form.querySelectorAll('.has-error').forEach((e) => e.classList.remove('has-error'));
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  }
  function showErrors(form, fields) {
    let first;
    for (const [name, msg] of Object.entries(fields || {})) {
      const input = form.elements[name];
      if (!input) continue;
      const label = input.closest('.field');
      label.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      const err = document.createElement('span');
      err.className = 'field-error';
      err.textContent = msg;
      label.appendChild(err);
      first ||= input;
    }
    first?.focus();
  }
  function clientCheck(form) {
    const errors = {};
    for (const el of form.elements) {
      if (!el.name || el.name === 'website') continue;
      const v = el.value.trim();
      if (el.required && !v) errors[el.name] = 'This field is required';
      else if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[el.name] = 'Enter a valid email address';
      else if (v && el.minLength > 0 && v.length < el.minLength) errors[el.name] = `Please write at least ${el.minLength} characters`;
    }
    return errors;
  }

  document.querySelectorAll('form[data-form]').forEach((form) => {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('[type="submit"]');
    const endpoint = form.dataset.form === 'quote' ? '/api/quotes' : '/api/contact';
    const label = button.textContent;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      status.className = 'form-status';
      status.textContent = '';

      const errors = clientCheck(form);
      if (Object.keys(errors).length) {
        status.classList.add('is-error');
        status.textContent = 'Please fix the highlighted fields.';
        return showErrors(form, errors);
      }

      const body = Object.fromEntries(new FormData(form));
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        await api(endpoint, { method: 'POST', body });
        form.reset();
        status.classList.add('is-success');
        status.textContent =
          form.dataset.form === 'quote'
            ? 'Thanks! Your estimate request is in. We’ll be in touch within one business day.'
            : 'Thanks! Your message has been sent. We’ll reply soon.';
      } catch (err) {
        status.classList.add('is-error');
        status.textContent = err.message;
        showErrors(form, err.fields);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
})();
