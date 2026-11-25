'use strict';
const { HttpError } = require('./http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate a request body against a schema.
 * Field rules: { type: 'string'|'email'|'int'|'bool'|'url'|'slug', required, max, min, enum, default }
 * With `partial: true`, missing fields are skipped (for PATCH-style updates).
 */
function validate(body, schema, { partial = false } = {}) {
  const data = {};
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = body[key];
    const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    if (missing) {
      if (partial && v === undefined) continue;
      if (rule.required) {
        errors[key] = 'This field is required';
        continue;
      }
      if (rule.default !== undefined) data[key] = rule.default;
      else if (!partial || v !== undefined) data[key] = rule.type === 'bool' ? false : null;
      continue;
    }
    switch (rule.type) {
      case 'int': {
        const n = Number(v);
        if (!Number.isInteger(n)) errors[key] = 'Must be a whole number';
        else if (rule.min !== undefined && n < rule.min) errors[key] = `Must be at least ${rule.min}`;
        else if (rule.max !== undefined && n > rule.max) errors[key] = `Must be at most ${rule.max}`;
        else data[key] = n;
        break;
      }
      case 'bool':
        data[key] = v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
        break;
      default: {
        if (typeof v !== 'string' && typeof v !== 'number') {
          errors[key] = 'Invalid value';
          break;
        }
        v = String(v).trim();
        const max = rule.max ?? 500;
        if (v.length > max) errors[key] = `Must be ${max} characters or fewer`;
        else if (rule.min && v.length < rule.min) errors[key] = `Must be at least ${rule.min} characters`;
        else if (rule.type === 'email' && !EMAIL_RE.test(v)) errors[key] = 'Enter a valid email address';
        else if (rule.type === 'slug' && !SLUG_RE.test(v))
          errors[key] = 'Use lowercase letters, numbers and dashes only';
        else if (rule.type === 'url' && !/^(https?:\/\/|\/)[^\s]*$/i.test(v))
          errors[key] = 'Must be an http(s) URL or a path starting with /';
        else if (rule.enum && !rule.enum.includes(v)) errors[key] = `Must be one of: ${rule.enum.join(', ')}`;
        else data[key] = v;
      }
    }
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields', errors);
  return data;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = { validate, slugify };
