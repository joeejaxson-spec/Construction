# Construction Company Website

A full-stack website for a construction company. It has a public marketing site, a quote-request system and an admin panel for managing leads, messages, the project portfolio and services.

**It has no dependencies.** It runs on Node.js 22's built-in HTTP server and built-in SQLite, so there is no `npm install` step and nothing to keep patched.

## Features

**Public website**
- Home page with a hero section, live stats, services, featured projects, the process and a call to action
- Services page built from the database, with jump links
- Project portfolio with category and status filters, plus a page for each project with specs and related projects
- About page
- Contact page with two forms: **Request an estimate** (project type, budget, timeline, address) and **General message**
- Mobile-responsive layout, accessible navigation, a generated `sitemap.xml` and `robots.txt`
- Drawn placeholder artwork for any project without a photo yet

**Admin panel** (`/admin`)
- Dashboard with new leads, a sales pipeline (new → contacted → quoted → won/lost) and recent requests
- Quote requests: filter, search, open details, change status, add internal notes, delete
- Messages: read/unread, reply by email, delete
- Projects: create, edit, publish/unpublish, feature on the home page, delete
- Services: create, edit, reorder, delete
- Account: change password

**Security**
- Passwords hashed with scrypt. Sessions use HttpOnly, SameSite=Strict cookies, and only hashed tokens are stored.
- The API accepts JSON only, which blocks cross-site form posts (CSRF)
- Rate limits on login and on public forms, plus a hidden honeypot field to catch spam bots
- Strict Content-Security-Policy and other security headers
- Every input is validated on the server, and all output is escaped

## Quick start

Requires **Node.js 22.13 or newer**.

```bash
cp .env.example .env        # then edit company details and the admin password
npm start                   # http://localhost:3000
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`)

If `ADMIN_PASSWORD` isn't set on the first run, a random password is generated and printed once to the console.

Other commands:

```bash
npm run dev    # restart automatically when files change
npm test       # run the API test suite
```

## Environment variables

All settings live in a `.env` file in the project root. The server loads it automatically on start, so you don't need dotenv. Copy the example to begin:

```bash
cp .env.example .env
```

### Full `.env` example

```env
PORT=3000
NODE_ENV=development
# Set to 1 when running behind a reverse proxy / load balancer
TRUST_PROXY=0
# DB_PATH=./data/construction.db

# Admin login (used to create the first admin account on first run)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-to-something-long

# Company details shown on the website
SITE_NAME=Jaxson Construction
SITE_TAGLINE=Built right. Built to last.
SITE_PHONE=(555) 010-2048
SITE_EMAIL=info@example.com
SITE_ADDRESS=1200 Foundry Road, Suite 4, Springfield
SITE_HOURS=Mon–Fri 7:00–17:00 · Sat 8:00–12:00
SITE_LICENSE=Licensed & insured · Lic. #000000
SITE_FOUNDED=2008
```

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `HOST` | `0.0.0.0` | Network interface to bind to |
| `NODE_ENV` | `development` | Set to `production` to mark cookies Secure (needs HTTPS) and cache static files |
| `TRUST_PROXY` | `0` | Set to `1` behind a reverse proxy so rate limits use the real client IP from `X-Forwarded-For` |
| `DB_PATH` | `./data/construction.db` | Location of the SQLite database file |
| `SESSION_DAYS` | `7` | How long an admin stays signed in |

### Admin account

| Variable | Default | Description |
|---|---|---|
| `ADMIN_EMAIL` | `admin@example.com` | Email for the first admin account |
| `ADMIN_PASSWORD` | *(random)* | Password for the first admin account. If you leave it unset, a random password is printed to the console once. |

These two are read **only when the database has no admin user yet**, which is normally the first run. Changing them later has no effect. Change the password in the admin panel under **Account** instead, or delete `data/construction.db` to start fresh. Deleting it also removes all leads and content.

### Company details

These values appear in the header, footer, contact page and page titles. Changes take effect after a restart.

| Variable | Default | Where it shows |
|---|---|---|
| `SITE_NAME` | `Jaxson Construction` | Logo, page titles, footer |
| `SITE_TAGLINE` | `Built right. Built to last.` | Footer |
| `SITE_PHONE` | `(555) 010-2048` | Top bar, call buttons, contact page |
| `SITE_EMAIL` | `info@example.com` | Top bar, footer, contact page |
| `SITE_ADDRESS` | `1200 Foundry Road, Suite 4, Springfield` | Footer, contact page |
| `SITE_HOURS` | `Mon–Fri 7:00–17:00 · Sat 8:00–12:00` | Top bar, footer, contact page |
| `SITE_LICENSE` | `Licensed & insured · Lic. #000000` | Hero card, footer, about page |
| `SITE_FOUNDED` | `2008` | "Since …" text and the years-in-business counter |

> `.env` is git-ignored. Never commit it, because it holds your admin password. On hosts like Render or Railway, enter these values in the dashboard's environment settings instead of uploading a `.env` file.

## Customizing

| What | Where |
|---|---|
| Company name, phone, email, address, hours, licence, year founded | `.env` (see [Environment variables](#environment-variables)) |
| Services and projects | Admin panel, under **Services** and **Projects** |
| Project photos | Put images in `public/img/` and set the project's photo to `/img/your-photo.jpg`, or paste an `https://` URL |
| Colours and fonts | CSS variables at the top of `public/css/styles.css` |
| Page text (hero, about story, values) | `public/*.html` |
| Header and footer | `src/views/header.html`, `src/views/footer.html` |

> The first run loads **sample** services and projects so the site doesn't start empty. Replace them with your real work in the admin panel before going live.

## Project structure

```
server.js              Entry point
src/
  app.js               Request handling, static pages, templating
  routes.js            All API endpoints (public + admin)
  db.js                SQLite schema and first-run setup
  seed.js              Sample services and projects
  auth.js              Password hashing and sessions
  http.js              Router, body parsing, security headers, rate limiting
  validate.js          Input validation
  views/               Shared header and footer
public/                Pages, CSS, browser JS, admin panel
test/                  API tests (node:test)
data/                  SQLite database (created at runtime, git-ignored)
```

## API overview

| Method | Path | Notes |
|---|---|---|
| GET | `/api/site` | Company details and form options |
| GET | `/api/stats` | Public counters |
| GET | `/api/services` | All services |
| GET | `/api/projects?category=&status=&featured=1` | Published projects and category counts |
| GET | `/api/projects/:slug` | One project and related projects |
| POST | `/api/quotes` | Submit an estimate request |
| POST | `/api/contact` | Submit a general message |
| POST | `/api/admin/login` / `logout` | Sign in or out |
| GET | `/api/admin/stats` | Dashboard numbers |
| GET/PATCH/DELETE | `/api/admin/quotes[/:id]` | Manage leads |
| GET/PATCH/DELETE | `/api/admin/messages[/:id]` | Manage messages |
| GET/POST/PUT/DELETE | `/api/admin/projects[/:id]` | Manage the portfolio |
| POST/PUT/DELETE | `/api/admin/services[/:id]` | Manage services |
| POST | `/api/admin/password` | Change password |

## Deploying

The site works on any host that runs Node 22, such as Render, Railway, Fly.io or a VPS. You can also use Docker:

```bash
docker build -t construction-site .
docker run -p 3000:3000 -v construction-data:/app/data \
  -e ADMIN_PASSWORD='choose-a-strong-one' -e SITE_NAME='Your Company' construction-site
```

In production, set `NODE_ENV=production` so cookies are marked Secure (this requires HTTPS). If you run behind a reverse proxy, also set `TRUST_PROXY=1`. Keep the `data/` directory on persistent storage, and back up `data/construction.db`.

New leads are logged to the console. To get email alerts, add an email call where `New quote request` is logged in `src/routes.js`.
