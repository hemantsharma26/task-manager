# Task Manager

[![CI](https://github.com/hemantsharma26/task-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/hemantsharma26/task-manager/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

A Kanban-style task manager built with **React, Express, MongoDB and Redis** (TypeScript on both sides). You sign up,
then create, edit, drag, filter, sort and search your own tasks on a board whose columns you can change. Every user
only ever sees their own data.

I kept the feature set small and put the effort where small apps usually fall short: authentication and security,
validation, ownership checks, ordering that survives drag and drop, caching, dates and timezones, and tests.

> **Status:** `v1.1.0` is the current release (branch `main`). It adds teams (invitations by email, roles, assigning tasks to several
> people), your own columns and priorities, time windows, rich-text notes, file attachments, and forgot/reset password. Live comments
> are the one big item still open; see the [Roadmap](#roadmap).

## Contents

1. [What you get](#what-you-get) · 2. [Tech stack](#tech-stack) · 3. [Getting started](#getting-started) ·
4. [Using the app](#using-the-app) · 5. [Commands](#commands) · 6. [Configuration](#configuration) ·
7. [Troubleshooting](#troubleshooting) · 8. [Tests and CI](#tests-and-ci) · 9. [Deploying to a server](#deploying-to-a-server) ·
10. [Git workflow](#git-workflow-and-releases) · 11. [API](#api) · 12. [Project layout](#project-layout) ·
13. [Decisions](#decisions) · 14. [Security](#security) · 15. [Caching, performance and scale](#caching-performance-and-scale) ·
16. [Left out and limitations](#left-out-on-purpose) · 17. [Roadmap](#roadmap)

## What you get

**Tasks and board**

- Board with drag and drop (mouse, touch from a grip handle, or keyboard: Space, arrows, Space) and a sortable List view
- **Columns are yours:** add, rename, reorder, mark as "counts as done" and delete (with a choice of where its tasks go). New accounts start with To do, In progress, Issue, Re-work and Done
- **Priorities are yours too:** make as many as you like, with your own names, colours and order (the order is what "sort by priority" follows). New accounts start with Low, Medium and High
- **Colours:** give any column (status) its own colour; it tints its cards, header and lozenges
- **Time windows:** pick a date, then a deadline time or a start and end ("9:00 – 11:30 AM", with 30 min / 1 / 2 / 4 hour shortcuts and the length shown). The task turns red once the END of its window has passed, and the tasks of one day are listed in time order
- **Due date and time** from a designed calendar: quick picks (Today, Tomorrow, Next Monday, In a week), month navigation, a time row with presets, and full keyboard control. A task due today at 9:00 turns overdue once 9:00 has passed
- Issue keys (`TM-12`), coloured priority flags, status lozenges, due badges that turn red when overdue
- **A notepad on every task:** a small word processor (headings, bold, italic, underline, strike, lists, quotes, code, links, text and highlight colours, fonts, sizes, alignment) on a ruled yellow pad. It saves by itself while you type
- **Attach images, videos and PDFs** when you create a task or later: drag and drop, thumbnails, upload progress, images open large, videos play in place, PDFs open in a tab
- **A colour for each task** (it tints the whole card), as well as for each column and each priority
- Issue dialog with in-place editing; the open issue is in the URL, so it can be linked to
- Search, filters, five sort orders, per-column "Show more", filters kept in the URL
- Optimistic updates with rollback, animated and responsive (columns snap on phones), light theme

**Accounts and security** (details in [Security](#security))

- Register and sign in with a password policy, a live strength checklist and show/hide
- Short-lived access token plus a **rotating refresh token** with theft detection; the browser renews quietly
- Brute-force lockout per account and address, rate limits per IP and per user
- **Change password** with current, new and confirm fields (the button stays off until all three are valid), and **Forgot password** on the sign-in page: a one-time link by email (30 minutes, newest link only), the same answer whether or not the address has an account
- **Sign out** of this device, of one other device, of all other devices, or of every device

**Teams and assignment**

- **Invite people by email:** a private link (7 days, single use, only works for the invited address). Anyone who accepts joins your board as Admin, Editor or Viewer
- **Assign a task to several people at once** from a searchable picker; only people who accepted an invitation appear in it. They get an email, never the person who assigned and never twice
- **Roles are enforced on the server** for tasks, columns, priorities and files; the UI hides what a role cannot do. A board switcher moves between your own board and boards you were invited to
- Filters for "assigned to me", "unassigned" and one person; removing a member takes them off every task

## Tech stack

| Layer      | Technology                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ |
| Frontend   | React 19, TypeScript, Vite, React Router, TanStack Query, dnd-kit, hand-written CSS        |
| Backend    | Node.js, Express 5, TypeScript, zod (validation), Mongoose, pino (logging)                |
| Database   | MongoDB                                                                                    |
| Cache      | Redis (optional: falls back to an in-process cache)                                        |
| Tests      | Vitest, supertest, Testing Library, a throwaway MongoDB and Redis                          |
| Tooling    | GitHub Actions CI, Dependabot                                                              |

## Getting started

### 1. What you need

| Requirement  | Version     | Check it with           | Notes                                                                    |
| ------------ | ----------- | ----------------------- | ------------------------------------------------------------------------ |
| Node.js      | 20 or newer | `node -v`               | npm comes with it                                                        |
| Git          | any         | `git --version`         |                                                                          |
| MongoDB      | 6 or newer  | _optional_              | You do **not** need to install it: step 4 starts one for you             |
| Redis        | 6 or newer  | _optional_              | The app works without it; with it, caching and limits are shared         |

Works on macOS and Linux. On Windows use WSL, because the setup script uses `cp`.

### 2. Get the code and install

```bash
git clone https://github.com/hemantsharma26/task-manager.git
cd task-manager
npm run setup
```

`npm run setup` installs the dependencies of the root, `server/` and `client/`, and creates `server/.env` from
`server/.env.example` (it never overwrites an existing one). It takes a minute or two the first time.

### 3. Configure `server/.env`

The defaults work for local development, so you can skip straight to step 4. To set it up properly, open
`server/.env` and replace the two secrets with random values (generate each with this command, run it twice):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Setting           | What it is                                                              | Change it?                              |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `MONGODB_URI`     | Where MongoDB listens                                                   | Only if yours is elsewhere              |
| `JWT_SECRET`      | Signs the login tokens                                                  | Yes, before sharing the app with anyone |
| `PASSWORD_PEPPER` | A second secret mixed into every password before it is hashed           | Yes, and keep it different from the one above. Changing it later makes existing passwords stop working |
| `REDIS_URL`       | Cache and shared limits. Remove or comment the line to run without Redis | Set it only if Redis is running         |

Every setting, with its default and a comment, is listed in `server/.env.example`.

### 4. Start MongoDB

Pick **one**:

- **Nothing installed (easiest).** In a terminal that you leave open:
  ```bash
  npm run db
  ```
  The first run downloads a MongoDB build (about 100 MB, once). You should see `MongoDB ready at mongodb://127.0.0.1:27017/`.
  Data is kept in `server/.mongo-data`, so it survives restarts. Stop it with `Ctrl+C`.
- **Docker.** `docker compose up -d` starts MongoDB and Redis.
- **MongoDB Atlas / your own server.** Put its connection string in `MONGODB_URI`.

### 5. (Optional) Redis

If Redis is already running on `localhost:6379`, keep `REDIS_URL=redis://127.0.0.1:6379`. If you do not want Redis,
delete that line; the app then uses a small in-process cache. When the server starts it logs `Cache store: redis` or
`Cache store: memory` so you can see which one is in use.

### 6. Create the demo data

In a **second terminal**, from the project folder:

```bash
npm run seed
```

You should see `Seeded 15 tasks for demo@taskmanager.test`. This is safe to repeat: it resets the demo account.

### 7. Start the app

```bash
npm run dev
```

This starts the API on **http://localhost:4100** and the web app on **http://localhost:5173**; both reload when you
edit code. Wait for the line `API listening on http://localhost:4100`.

### 8. Open it

Go to **http://localhost:5173**, then either register a new account or sign in with the demo one:

| Email                   | Password           |
| ----------------------- | ------------------ |
| `demo@taskmanager.test` | `Demo-Board-2026!` |

You should land on a board with five columns and fifteen tasks. If something does not work, see
[Troubleshooting](#troubleshooting).

## Using the app

1. **Create an account** (or use the demo one). The password box shows what is still missing as you type.
2. **Add a task.** Click **Create** at the top, or **+ Create** at the bottom of any column and press Enter. The quick
   box stays open so you can add several in a row.
3. **Move it.** Drag a card to another column or to another position. On a phone, press the grip handle (the dots) on the
   card. With a keyboard: focus a card, press Space, use the arrow keys, then Space again; Escape cancels.
4. **Open it.** Click a card to edit the title, description, status, priority and due date in place. Each change saves by
   itself. The address bar now contains the issue, so you can send the link.
5. **Shape the board.** Open the `...` menu on a column header to rename it, move it left or right, mark it as
   **Counts as done** (tasks in it are finished and never overdue), or delete it. If it still holds tasks you choose which
   column they move to. **+ Add column** at the right end adds a new one.
6. **Find things.** Use the search box, the priority and due-date filters, and the quick filters in the sidebar. The
   **List** tab shows the same tasks as a table you can sort by clicking a heading.
7. **Look after your account.** Click your avatar, then **Account security** to change your password, see the devices you
   are signed in on, sign one out, or **sign out of all devices**.

## Commands

Run these from the project folder.

| Command                                | What it does                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run setup`                        | Installs everything and creates `server/.env`                                          |
| `npm run db`                           | Starts a local MongoDB (no install needed), data in `server/.mongo-data`               |
| `npm run seed`                         | Creates or resets the demo account and its tasks                                       |
| `npm run dev`                          | API and web app together, with live reload                                             |
| `npm test`                             | Server tests, then client tests                                                        |
| `npm run typecheck`                    | TypeScript check of server and client                                                  |
| `npm run build`                        | Builds the client and compiles the server                                              |
| `npm start`                            | Runs the built app in production mode (one port, serves the web app too)               |
| `npm run migrate:numbers --prefix server` | One-off upgrade for data created before issue keys existed (see below)             |
| `npm run test:watch --prefix server`   | Server tests, re-run on every change                                                   |

**Upgrading an old database.** Issue numbers and ranks were added after the first version. If you already have tasks
without them, run `npm run migrate:numbers --prefix server` once **before** starting the new API. It is safe to repeat.
Columns need no migration: an account without any gets the five defaults the first time it is used.

## Configuration

All configuration comes from environment variables, and nowhere else. They are read from the real environment first
(Docker, a server, CI), then `server/.env.<NODE_ENV>` (`.env.test` is committed and holds only harmless test values),
then `server/.env` (yours, never committed). The server validates everything at start-up and names any bad variable.

| Variable                          | Default                  | Meaning                                                                      |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `NODE_ENV`                        | `development`            | `development`, `test` or `production`                                        |
| `PORT`                            | `4100`                   | API port                                                                     |
| `LOG_LEVEL`                       | by environment           | `debug`, `info`, `warn`, `error`, `silent`                                   |
| `TRUST_PROXY_HOPS`                | `1`                      | Reverse proxies in front of the app (needed for the real client IP)          |
| `MONGODB_URI`                     | _required_               | MongoDB connection string                                                    |
| `JWT_SECRET`                      | _required_               | 32+ random characters                                                        |
| `PASSWORD_PEPPER`                 | _required_               | 32+ random characters, different from `JWT_SECRET`                           |
| `ACCESS_TOKEN_MINUTES`            | `15`                     | Lifetime of the access token                                                 |
| `REFRESH_TOKEN_DAYS`              | `7`                      | A session ends after this many days without use                              |
| `SESSION_MAX_DAYS`                | `30`                     | ...or this long after sign-in, whichever comes first                         |
| `LOGIN_MAX_ATTEMPTS`              | `5`                      | Failed sign-ins before that account and address is locked                    |
| `LOGIN_LOCKOUT_MINUTES`           | `15`                     | How long the lock lasts                                                      |
| `LOGIN_EMAIL_MAX_ATTEMPTS`        | `25`                     | Soft cap on failures for one email from any address                          |
| `LOGIN_EMAIL_WINDOW_MINUTES`      | `60`                     | Window for the cap above                                                     |
| `REGISTER_MAX_PER_IP`             | `10`                     | New accounts allowed per address per window                                  |
| `REGISTER_WINDOW_MINUTES`         | `60`                     | Window for the cap above                                                     |
| `REDIS_URL`                       | _none_                   | Shared cache, sign-out list, lockouts and rate limits                        |
| `CACHE_ENABLED`                   | `true`                   | `false` skips caching entirely                                               |
| `CACHE_TTL_TASK_LIST_SECONDS`     | `60`                     | How long a cached task page may be served (writes also invalidate at once)  |
| `CACHE_TTL_TASK_STATS_SECONDS`    | `60`                     | Same, for the counts                                                         |
| `CACHE_TTL_COLUMNS_SECONDS`       | `300`                    | Same, for the column list                                                    |
| `CACHE_TTL_PRIORITIES_SECONDS`    | `300`                    | Same, for the priority list                                                  |
| `UPLOAD_DIR`                      | `uploads`                | Where attached files are stored (relative to `server/`). Back it up          |
| `SMTP_URL`                        | _none_                   | Real email delivery (invitations, assignments, password reset). Without it, emails are only printed in the server log |
| `MAIL_FROM`                       | `Task Manager <no-reply@localhost>` | The From address of those emails                                  |
| `APP_URL`                         | `http://localhost:5173`  | Public address of the web app, used for the links inside emails              |
| `RATE_LIMIT_API_MAX` / `_WINDOW_SECONDS`   | `600` / `60`    | Requests per IP for the whole API                                            |
| `RATE_LIMIT_AUTH_MAX` / `_WINDOW_SECONDS`  | `20` / `900`    | Sign-in, register and refresh attempts per IP                                |
| `RATE_LIMIT_WRITE_MAX` / `_WINDOW_SECONDS` | `240` / `60`    | Writes per signed-in user                                                    |
| `CLIENT_ORIGIN`                   | `http://localhost:5173`  | Dev-server origin allowed by CORS (development only)                         |
| `ALLOWED_ORIGINS`                 | _none_                   | Extra origins allowed to send writes in production (comma separated)         |
| `COOKIE_SECURE`                   | on in production         | Set `false` only when serving over plain `http`                              |
| `HSTS_ENABLED`                    | `false`                  | Send HSTS from the app (normally the TLS proxy does)                         |

The web app has one optional setting, in `client/.env` (copy `client/.env.example`): `VITE_API_URL`, the address the
dev server forwards `/api` to (default `http://localhost:4100`).

## Troubleshooting

| Symptom                                                              | Cause and fix                                                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration` and the app exits                | A variable in `server/.env` is missing or too short. The message names it. Compare with `.env.example` |
| `PASSWORD_PEPPER ... must be at least 32 characters`                 | You have an older `.env`. Add a `PASSWORD_PEPPER=` line (see step 3)                                  |
| `MongoServerSelectionError` / the API cannot connect                 | MongoDB is not running. Start it (`npm run db`, step 4) and restart the API                           |
| `EADDRINUSE: address already in use :::4100`                         | Another program uses the port. Set `PORT=4101` in `server/.env`, and `VITE_API_URL=http://localhost:4101` in `client/.env` |
| The page loads but sign-in does nothing, or you are sent back to login | Cookies are being dropped. In production over plain `http`, set `COOKIE_SECURE=false`; otherwise check you open the app on the address it is served from |
| `Cache store: memory` but you wanted Redis                           | `REDIS_URL` is missing or commented out. If it is set and Redis is down, the app logs a warning and keeps working without the cache |
| "Too many failed sign-in attempts" (HTTP 429)                        | The lockout worked. Wait for the time shown, or restart the API when running without Redis             |
| Demo login says invalid                                              | Run `npm run seed` again; the demo password changed in v1.0.0 to `Demo-Board-2026!`                    |
| `npm test` is slow the first time                                    | It downloads a MongoDB build once (about 100 MB) and caches it                                         |
| Redis tests are skipped                                              | Normal when `redis-server` is not installed. Everything else still runs                                |

## Tests and CI

```bash
npm test             # 270 API tests + 93 UI/unit tests
npm run typecheck
```

The API tests run against a real `mongod` (in memory) and, when `redis-server` is installed, against a real Redis too; the
Redis tests skip themselves otherwise. Tests never touch a Redis you already have running. They cover auth and session
handling, the security middleware (each attack in the [Security](#security) table), the password policy, every sort and
filter, drag-and-drop ordering (including the renumbering edge case), dynamic columns, cache hits, misses and
invalidation, the cache when Redis is down, rate limits shared across two app instances, and that the hot queries
really use their indexes (checked with `explain`). `npm audit` reports 0 known vulnerabilities.

**GitHub Actions** runs on every push and pull request to `main` and `develop`: typecheck, tests and build for the server
and the client, plus a dependency audit. Dependabot proposes dependency updates weekly.

## Deploying to a server

This is the path I use for a single Linux server (for example an EC2 instance). It runs one Node process that serves the API
**and** the web app, behind nginx for HTTPS.

1. **Install** Node 20+, MongoDB (or use Atlas), optionally Redis, nginx and certbot.
2. **Get the code:** `git clone https://github.com/hemantsharma26/task-manager.git && cd task-manager && git checkout v1.0.0`
3. **Install and build:** `npm run setup && npm run build`
4. **Configure** `server/.env` for production:
   ```ini
   NODE_ENV=production
   PORT=4100
   MONGODB_URI=mongodb://127.0.0.1:27017/task-manager
   JWT_SECRET=<48 random bytes, hex>
   PASSWORD_PEPPER=<a different 48 random bytes, hex>
   REDIS_URL=redis://127.0.0.1:6379
   TRUST_PROXY_HOPS=1
   ```
   The server **refuses to start** if a secret still starts with `change-me`.
5. **Run it under a process manager:**
   ```bash
   npm i -g pm2
   pm2 start "npm start" --name task-manager
   pm2 save && pm2 startup
   ```
6. **nginx** in front (replace the domain):
   ```nginx
   server {
     server_name tasks.example.com;
     location / {
       proxy_pass http://127.0.0.1:4100;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
7. **HTTPS:** `sudo certbot --nginx -d tasks.example.com`. HTTPS is required: in production the cookies are `Secure` and use the
   `__Host-` prefix, so browsers will not keep them over plain `http`.
8. **Check it:** `curl https://tasks.example.com/api/health` returns `{"status":"ok"}`.

Production checklist: real random secrets, MongoDB and Redis not exposed to the internet, regular MongoDB backups,
`TRUST_PROXY_HOPS` matching your proxy chain, and `pm2 logs task-manager` watched for `auth.` and `security.` events.

## Git workflow and releases

| Branch      | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `main`      | Always releasable; every release is tagged (`v1.0.0`, ...)               |
| `develop`   | Integration branch; features are merged here first                       |
| `feature/*` | One feature each, branched from `develop`, merged back by pull request   |
| `fix/*`, `chore/*`, `docs/*` | Smaller changes, same flow                                |

Releases: open a pull request `develop` to `main`, let CI pass, merge, then tag `vMAJOR.MINOR.PATCH`. The full rules are in
[CONTRIBUTING.md](CONTRIBUTING.md), and security reports go through [SECURITY.md](SECURITY.md).

## API

All routes are under `/api`. Errors always have one shape:
`{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "title", "message": "…" }] } }`.

| Method | Path                      | Description                                                        |
| ------ | ------------------------- | ------------------------------------------------------------------ |
| POST   | `/auth/register`          | Create an account and sign in                                      |
| POST   | `/auth/login`             | Sign in                                                            |
| POST   | `/auth/refresh`           | Swap the refresh cookie for a new token pair                       |
| POST   | `/auth/logout`            | End this session                                                   |
| POST   | `/auth/logout-all`        | End every session of this user                                     |
| POST   | `/auth/logout-others`     | End every session except this one                                  |
| POST   | `/auth/forgot-password`   | Email a reset link (always answers 202, whatever the address)      |
| POST   | `/auth/reset-password`    | `{ token, newPassword }`: set a new password from the link, sign out everywhere |
| GET    | `/auth/me`                | Current user                                                       |
| POST   | `/auth/password`          | Change password (needs the current one); signs out other devices   |
| GET    | `/auth/sessions`          | Devices this user is signed in on                                  |
| DELETE | `/auth/sessions/:id`      | Sign one device out                                                |
| GET    | `/workspaces`             | The boards you can open (yours, and ones you were invited to)      |
| GET    | `/team/members`           | People on the board (send `X-Workspace-Id` for a shared board)     |
| POST   | `/team/invitations`       | Invite `{ email, role }` (owner / admin)                           |
| GET    | `/invitations/:token`     | What an invitation link is for (no sign-in needed)                 |
| POST   | `/invitations/:token/accept` | Join, if signed in as the invited address                       |
| GET    | `/columns`                | The board's columns, in order                                      |
| POST   | `/columns`                | Add a column `{ name, isDone, color }`                             |
| PATCH  | `/columns/:id`            | Rename, recolour, or change "counts as done"                       |
| POST   | `/columns/:id/move`       | Reorder: `{ afterId }` (null = far left)                           |
| DELETE | `/columns/:id?moveTo=key` | Delete; `moveTo` is required if it still holds tasks               |
| GET    | `/priorities`             | Your priorities, least important first                             |
| POST   | `/priorities`             | Add one `{ name, color }`                                          |
| PATCH  | `/priorities/:id`         | Rename or recolour                                                 |
| POST   | `/priorities/:id/move`    | Reorder: `{ afterId }` (null = least important)                    |
| DELETE | `/priorities/:id?moveTo=key` | Delete; `moveTo` is required if tasks still use it              |
| GET    | `/tasks`                  | List with filters, sort and pagination                             |
| GET    | `/tasks/stats`            | Counts per column plus the number of overdue tasks                 |
| POST   | `/tasks`                  | Create (next issue number, bottom of its column)                   |
| GET    | `/tasks/:id`              | Read one                                                           |
| POST   | `/tasks/:id/attachments`  | Upload up to 5 files (multipart field `files`)                     |
| GET    | `/tasks/:id/attachments/:attId` | The file itself (Range requests work, so video can be scrubbed) |
| DELETE | `/tasks/:id/attachments/:attId` | Remove a file                                                |
| PATCH  | `/tasks/:id`              | Update any subset of fields                                        |
| POST   | `/tasks/:id/move`         | Drag and drop: `{ status, afterId }`                               |
| DELETE | `/tasks/:id`              | Delete                                                             |

`GET /tasks` takes `status` (a column key), `priority` (a priority key), `due` (`overdue|today|week|none`), `q`, `sort`
(`createdAt|dueDate|priority|title|rank`), `order`, `page`, `limit` (max 50), `today` (the client's local date) and `nowTime`
(its local time, HH:MM, so "overdue" can include tasks whose time today has passed). A task has `dueDate` (YYYY-MM-DD) and an optional `dueTime` (HH:MM, 24 hour; only with a date).
Unknown values are rejected with a 400 rather than ignored. Cached reads carry an `X-Cache: HIT|MISS` header.

## Project layout

The backend is split by feature, and each feature by responsibility, so a change has one obvious place to go:

```
server/src/
  config/env.ts            every setting, validated at boot; the only place that reads process.env
  constants/               every string literal and magic number: routes, headers, errors, messages, limits, cache keys
  infra/                   things that talk to the outside world
    database/              MongoDB connection
    cache/                 Redis and in-memory stores, key builders, read-through cache service
    logger.ts, security-log.ts
  shared/                  used by every module
    middleware/            security headers, JSON-only, operator-key filter, CSRF origin guard, rate limits, auth guard, errors
    errors/, utils/        HttpError, ranking, dates, text helpers
  modules/
    auth/                  routes → controller → service → repository, plus tokens, sessions, passwords, lockouts
    tasks/                 routes → controller → service → repository, plus filters, mapper, schemas, models
    columns/               routes → controller → service → repository, plus mapper, schemas, model
  app.ts                   the middleware pipeline, in a deliberate order
  server.ts                start-up, timeouts, graceful shutdown
server/tests/              supertest + in-memory MongoDB (+ a real Redis when available)
server/scripts/            local MongoDB, seed data, one-off migration
client/src/                api/ (fetch wrapper, React Query hooks), components/, pages/, hooks/, lib/
```

A **route** only maps a path to a handler. A **controller** parses input with zod and shapes the response. A
**service** holds the rules (and decides what to cache and what a write invalidates). A **repository** is the only code
that talks to MongoDB. Constants live in `constants/`, so no message, header name or path is written twice.

## Decisions

These are the choices I would defend first.

### 1. Sessions: a short-lived access token and a rotating refresh token

A single long-lived JWT cannot be revoked, so I split it. The **access token** lives 15 minutes and is checked without a
database call. The **refresh token** is 256 random bits whose SHA-256 is all the database stores, is sent only to
`/api/auth`, and is swapped for a new one every time it is used. If an old refresh token ever shows up again, somebody
kept a copy, so that session is revoked. Two tabs refreshing at the same instant are recognised (a 10 second grace
window plus an atomic compare-and-swap) and not mistaken for theft. Both tokens are `httpOnly` cookies, so an XSS bug
cannot read them. Signing out puts the session on a short deny-list, so its access token stops working **immediately**,
not 15 minutes later. Password change and "sign out everywhere" use a "nothing issued before now is valid" marker.

In production the cookie names get the browser-enforced `__Host-` / `__Secure-` prefixes. The client renews the access
token quietly when it expires (one shared refresh, with a lock across tabs), so users only ever see the sign-in page when
the session is truly over.

### 2. Query on the server, and keep the state of the view in the URL

Filtering, sorting and paging happen in MongoDB so the list stays fast whatever the number of tasks. Every query is
scoped by `owner` first and the indexes start with it. Only the sorts that need a computed key (priority order, "no due
date last", case-insensitive title) use an aggregation; the rest go straight through an index. On the client the filters
live in the URL, which gives bookmarkable views and a working back button, and unrecognised values fall back to defaults.

### 3. Due dates are calendar dates, not timestamps

"Due 20 Nov, 5:30 PM" means that day and that wall-clock time wherever you are. A `Date` would shift for anyone not in UTC, so the
due date is a `YYYY-MM-DD` string (which also sorts correctly as text) and the time is a separate `HH:MM` string. "Overdue" is decided
against the **client's own local date and time**, which it sends with the request. All the date maths lives in two small, tested files.

### 4. Ordering by drag and drop: sparse ranks, decided on the server

Each task has a numeric `rank` inside its column (1000, 2000, …). Dropping a card between two others gives it the
midpoint, so a drag is **one write**. The client only says "into this column, below that card"; the server looks up the
real neighbours, so the result is right even when only the first 20 cards are loaded. If two ranks get too close to split,
that one column is renumbered and the drop retried (there is a test that forces it). Columns are ordered the same way.

### 5. A Redis cache that can only make things faster

Reads (task pages, stats, the column list) are cached per user. Each user has a **version number**, and it is part of
every one of their cache keys; any write bumps it, which makes all their old entries unreachable in one `INCR`, with no
scanning or deleting. Keys are built in one file, entries expire on their own, and a user's writes never flush anyone
else's cache. Every cache failure (Redis down, a slow command, a corrupt entry) is logged and treated as a miss, so a
Redis outage costs speed and never availability (there is a test that runs the whole API with Redis unreachable).

## Security

| Threat                               | Defence                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Stolen database                      | Passwords: HMAC-SHA256 with a secret **pepper** (kept outside the database), then bcrypt (cost 12). Refresh tokens are stored as hashes only |
| Weak or reused passwords             | Min 10 characters, a mix of 3 character classes (or a 16+ character passphrase), a deny-list of common passwords that also sees through `P@ssw0rd2026!`, no name or email inside it |
| Password guessing                    | Lockout per **account + address** after 5 failures (15 min, with `Retry-After`), a softer cap per account from anywhere, a strict per-IP limit, identical errors and timing whether or not the email exists |
| Fake accounts                        | Per-IP registration cap, a 4 kB body limit on the auth routes, email and name normalised (Unicode look-alikes fold together)          |
| Stolen session cookie                | 15 minute access tokens, `httpOnly` cookies, refresh-token rotation with reuse detection, instant revocation on sign-out, sign out one or all devices |
| Token forgery                        | HS256 pinned (no `alg: none`, no algorithm swapping), issuer and audience checked, a separate pepper secret                          |
| XSS                                  | Strict Content-Security-Policy (no inline or eval script, same-origin only), tokens unreadable from JavaScript, React escapes output |
| CSRF                                 | `SameSite` cookies (the refresh cookie is `Strict` and path-limited), JSON-only bodies (a plain HTML form cannot send them), and an Origin / `Sec-Fetch-Site` check that refuses cross-site writes |
| NoSQL injection, prototype pollution | zod accepts only plain typed values, **and** a filter refuses any `$operator`, dotted, bracketed or `__proto__` key before it reaches code |
| Malicious notes and uploads          | Notes are cleaned on the server against an allow-list (tags, attributes, style values, fonts, link schemes) and again in the browser. Files are identified by their **first bytes**, never by name or browser type; only images, video and PDF are accepted (SVG is not); per-type size limits; random on-disk names inside the owner's folder; served with `nosniff` and a sandbox CSP; removed with their task |
| Clickjacking, MIME sniffing, leakage | `frame-ancestors none` and `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, locked-down `Permissions-Policy`, `Cross-Origin-*` policies |
| Abuse and overload                   | Rate limits per IP, per user for writes, and strict for auth (Redis-backed, so shared by all instances); slow-client timeouts; body size caps |
| Enumeration and data leaks           | Another user's ids always answer 404; errors never include stack traces; auth responses are `no-store`; logs never contain cookies, bodies or full emails |
| Misconfiguration                     | Config validated at boot; production **refuses to start** with a placeholder secret; HSTS belongs to the TLS proxy                    |
| Vulnerable dependencies              | `npm audit`: 0 known vulnerabilities, and CI fails on a high-severity one                                                              |

Each row is exercised by a test. Security events (failed sign-in, lockout, token reuse, blocked cross-site write, blocked
injection attempt) are logged with stable names such as `auth.refresh_token_reuse_detected`.

## Caching, performance and scale

- **Redis read-through cache** (decision 5), plus **HTTP caching**: API reads are `private, no-cache` with an ETag, so an unchanged
  list is an empty `304`; in production the hashed build files are `immutable` for a year.
- **Client cache (React Query):** data is fresh for 30 s; after a change only the affected queries refetch; a title edit refetches nothing.
- **Indexes match the queries.** Sorts end in `_id` (a stable tiebreaker), so the indexes do too. A test runs `explain` and fails if a board
  column or the default list needs an in-memory sort. That test caught a real mistake of mine.
- **Less work per request:** gzip, index-friendly sorts through plain `find`, a code-split list view, 20 cards per column at a time.
- **Stateless API, shared state in Redis:** sessions, lockouts, rate limits and the cache do not live in process memory, so more
  instances can run behind a load balancer.

What I have **not** done, so nothing here is overstated: no load test, no Redis cluster (a single instance, with a graceful
fallback), and pages use offsets, which is fine for per-user sizes but would become a cursor for much larger lists.

## Left out on purpose

1. **Comments and live updates** (Socket.IO). Sharing and assignment are built, but real-time collaboration needs a socket layer with
   its own authentication, per-board rooms and a story for reconnects, which is a feature of its own.
2. **Reminders and notifications** (email or push when something is due). It needs a mail provider, a background job runner and
   delivery tracking: a lot of moving parts for something that does not show in a short review of the core flow.
3. **Email verification at sign-up.** Password reset already sends one-time links, but verifying an address before the account works also needs a
   "not verified yet" state in every screen. It also means sign-up still says "this email is taken", which reveals that an address is registered; the
   per-IP caps limit how fast that can be used, but only verification by email would really close it.

### Known limitation

**Cache invalidation is coarse, and there is no stampede protection.** Any write by a user drops everything cached for that user
(task pages, stats and columns), because it is one version number per user. That is simple and always correct, but for a user who edits
constantly the cache rarely gets to help, and when a popular entry expires, many requests at once can all miss and all hit MongoDB. With one
more day I would version per column (so moving a card only invalidates the two columns involved and the counts), and add single-flight
loading so concurrent misses share one database query.

Smaller trade-offs I am aware of: the sign-out deny-list and lockout counters fail **open** if Redis is unreachable (an access token then
lives out its 15 minutes, and the per-IP limiter still applies), because failing closed would lock every user out during a cache outage; without
Redis those counters are per-process; there is no real-time sync (a second device sees changes on its next refetch); and search is a
case-insensitive, escaped regex scoped to one user's tasks (a text index or Atlas Search would be the next step).

## Roadmap

Done in `v1.1.0`:

- [x] **Invitations by email:** a secure link, expiring, single use, tied to the invited address
- [x] **Roles and permissions** (owner, admin, editor, viewer), enforced on the server for every route
- [x] **Assigning tasks** to several people, with an email when you are assigned
- [x] **File uploads** on tasks: images, PDFs and video, validated by content and served only to people on the board
- [x] **Rich-text notes** on tasks (fonts, colours, lists) with server-side sanitising
- [x] **Your own priorities** (as many as you like, with colours), **colours for tasks and statuses**
- [x] **Due date and time** with a designed calendar picker, and time windows
- [x] **Forgot / reset password** and every sign-out option

Still open:

- [ ] **Live comments** over WebSockets (Socket.IO), with typing indicators, history and attachments
- [ ] **Several projects per team** (today a person has one board, plus the boards they were invited to)
- [ ] **Custom roles** with finer permissions
- [ ] **Email verification** at sign-up
