'use strict';
const path = require('node:path');

const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  host: env.HOST || '0.0.0.0',
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'construction.db'),
  production: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY === '1',
  adminEmail: env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: env.ADMIN_PASSWORD || null,
  sessionDays: Number(env.SESSION_DAYS) || 7,

  // Company details shown across the site. Override any of them in .env.
  site: {
    name: env.SITE_NAME || 'Jaxson Construction',
    tagline: env.SITE_TAGLINE || 'Built right. Built to last.',
    phone: env.SITE_PHONE || '(555) 010-2048',
    email: env.SITE_EMAIL || 'info@example.com',
    address: env.SITE_ADDRESS || '1200 Foundry Road, Suite 4, Springfield',
    hours: env.SITE_HOURS || 'Mon–Fri 7:00–17:00 · Sat 8:00–12:00',
    license: env.SITE_LICENSE || 'Licensed & insured · Lic. #000000',
    founded: Number(env.SITE_FOUNDED) || 2008,
  },
};
