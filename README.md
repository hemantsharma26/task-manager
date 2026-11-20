# Task Manager

A Kanban-style task manager built with **React, Express, MongoDB and Redis** (TypeScript on both sides). You sign up,
then create, edit, drag, filter, sort and search your own tasks on a board whose columns you can change. Every user
only ever sees their own data.

I kept the feature set small and put the effort where small apps usually fall short: authentication and security,
validation, ownership checks, ordering that survives drag and drop, caching, dates and timezones, and tests.

## Features

**Tasks and board**

- Board with drag and drop (mouse, touch from a grip handle, or keyboard: Space, arrows, Space) and a sortable List view
- **Columns are yours:** add, rename, reorder, mark as "counts as done" and delete (with a choice of where its tasks go). New accounts start with To do, In progress, Issue, Re-work and Done
- Issue keys (`TM-12`), priority icons, status lozenges, due-date badges that turn red when overdue
- Issue dialog with in-place editing; the open issue is in the URL, so it can be linked to
- Search, filters, five sort orders, per-column "Show more", filters kept in the URL
- Optimistic updates with rollback, animated and responsive (columns snap on phones), light theme

**Accounts and security** (details in [Security](#security))

- Register and sign in with a password policy, a live strength checklist and show/hide
- Short-lived access token plus a **rotating refresh token** with theft detection; the browser renews quietly
- Brute-force lockout per account and address, rate limits per IP and per user
- Change password, see where you are signed in, sign out one device or **all devices**

## Quick start

You need **Node 20+**. MongoDB and Redis are optional to install (see below).

```bash
git clone <this repo> && cd task-manager
npm run setup        # installs everything and creates server/.env from server/.env.example
```

Then, in **two terminals**:

```bash
# Terminal 1: a local MongoDB on 127.0.0.1:27017 (no install needed; data kept in server/.mongo-data)
npm run db

# Terminal 2: seeds a demo account, then starts the API (:4100) and the web app (:5173)
npm run seed && npm run dev
```

Open http://localhost:5173 and sign in with the demo account, or register a new one:

| Email                   | Password           |
| ----------------------- | ------------------ |
| `demo@taskmanager.test` | `Demo-Board-2026!` |

**Redis (recommended, not required).** With `REDIS_URL` set in `server/.env` the cache, the sign-out list, the
lockout counters and the rate limits are shared by every instance. Without it the app uses a private in-process cache,
which is fine for one instance. `docker compose up -d` starts MongoDB and Redis if you prefer containers.

### Production build

```bash
npm run build
npm start            # serves the API and the built React app from one origin on $PORT
```

In production the API serves `client/dist` itself, so there is one origin: no CORS and first-party cookies. Put it behind
a reverse proxy that terminates TLS and set `TRUST_PROXY_HOPS`. If you serve it over plain `http` for a quick demo, set
`COOKIE_SECURE=false`, otherwise browsers drop the cookies. The server **refuses to start in production with the
placeholder secrets from `.env.example`**.

## Configuration

All configuration comes from environment variables, and nowhere else. They are read from the real environment first
(Docker, a server, CI), then `server/.env.<NODE_ENV>` (`.env.test` is committed and holds only harmless test values),
then `server/.env` (yours, never committed). The server validates everything at boot and names any bad variable.
**`server/.env.example` lists every setting with its default and a comment.** The ones you will touch:

| Variable                                  | Notes                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `MONGODB_URI`                             | required                                                                     |
| `JWT_SECRET`, `PASSWORD_PEPPER`           | required, 32+ random characters each, and different from each other         |
| `REDIS_URL`                               | optional; shared cache, revocation list, lockouts and rate limits           |
| `ACCESS_TOKEN_MINUTES`                    | default 15                                                                   |
| `REFRESH_TOKEN_DAYS`, `SESSION_MAX_DAYS`  | idle limit (7) and hard limit (30) of a session                              |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` | default: 5 failures lock that account and address for 15 minutes        |
| `CACHE_TTL_*_SECONDS`, `CACHE_ENABLED`    | how long cached reads may be served; writes also invalidate at once         |
| `RATE_LIMIT_*`                            | per-IP API limit, strict sign-in limit, per-user write limit                |
| `ALLOWED_ORIGINS`, `HSTS_ENABLED`, `COOKIE_SECURE`, `TRUST_PROXY_HOPS` | production hardening switches |

## Tests and checks

```bash
npm test             # 169 API tests + 37 UI/unit tests
npm run typecheck
```

The API tests run against a real `mongod` (in memory), and, when `redis-server` is installed, against a real Redis too;
the Redis tests skip themselves otherwise. Tests never touch a Redis you already have running. They cover auth and
session handling, the security middleware (each attack in the table below), the password policy, every sort and
filter, drag-and-drop ordering (including the renumbering edge case), dynamic columns, cache hits, misses and
invalidation, the cache when Redis is down, rate limits shared across two app instances, and that the hot queries
really use their indexes (checked with `explain`). `npm audit` reports 0 known vulnerabilities.

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
| GET    | `/auth/me`                | Current user                                                       |
| POST   | `/auth/password`          | Change password (needs the current one); signs out other devices   |
| GET    | `/auth/sessions`          | Devices this user is signed in on                                  |
| DELETE | `/auth/sessions/:id`      | Sign one device out                                                |
| GET    | `/columns`                | The board's columns, in order                                      |
| POST   | `/columns`                | Add a column `{ name, isDone }`                                    |
| PATCH  | `/columns/:id`            | Rename, or change "counts as done"                                 |
| POST   | `/columns/:id/move`       | Reorder: `{ afterId }` (null = far left)                           |
| DELETE | `/columns/:id?moveTo=key` | Delete; `moveTo` is required if it still holds tasks               |
| GET    | `/tasks`                  | List with filters, sort and pagination                             |
| GET    | `/tasks/stats`            | Counts per column plus the number of overdue tasks                 |
| POST   | `/tasks`                  | Create (next issue number, bottom of its column)                   |
| GET    | `/tasks/:id`              | Read one                                                           |
| PATCH  | `/tasks/:id`              | Update any subset of fields                                        |
| POST   | `/tasks/:id/move`         | Drag and drop: `{ status, afterId }`                               |
| DELETE | `/tasks/:id`              | Delete                                                             |

`GET /tasks` takes `status` (a column key), `priority`, `due` (`overdue|today|week|none`), `q`, `sort`
(`createdAt|dueDate|priority|title|rank`), `order`, `page`, `limit` (max 50) and `today` (the client's local date).
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

"Due 20 Nov" means that day wherever you are. A `Date` would shift by a day for anyone not in UTC, so the due date is a
`YYYY-MM-DD` string (which also sorts correctly as text) and "overdue" is decided against the **client's local date**.
All the date maths lives in one small, tested file.

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
| Clickjacking, MIME sniffing, leakage | `frame-ancestors none` and `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, locked-down `Permissions-Policy`, `Cross-Origin-*` policies |
| Abuse and overload                   | Rate limits per IP, per user for writes, and strict for auth (Redis-backed, so shared by all instances); slow-client timeouts; body size caps |
| Enumeration and data leaks           | Another user's ids always answer 404; errors never include stack traces; auth responses are `no-store`; logs never contain cookies, bodies or full emails |
| Misconfiguration                     | Config validated at boot; production **refuses to start** with a placeholder secret; HSTS belongs to the TLS proxy                    |
| Vulnerable dependencies              | `npm audit`: 0 known vulnerabilities                                                                                                  |

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

### Upgrading an existing database

Issue numbers and ranks were added after the first version. If you already have tasks without them, run
`npm run migrate:numbers --prefix server` once **before** starting the new API. It is idempotent. Columns need no migration: an
account without any gets the five defaults the first time it is used, with the same keys tasks already used.

## Left out on purpose

1. **Sharing and collaboration** (shared boards, assignees, comments). It turns "a task has one owner" into a permissions model, and
   every query, test and screen with it. That is a feature of its own.
2. **Reminders and notifications** (email or push when something is due). It needs a mail provider, a background job runner and
   delivery tracking: a lot of moving parts for something that does not show in a short review of the core flow.
3. **Email verification and password reset.** Both need transactional email and single-use expiring tokens, and I did not want to ship a
   half-working version. It also means sign-up still says "this email is taken", which reveals that an address is registered; the
   per-IP caps limit how fast that can be used, but only verification by email would really close it.

## Known limitation

**Cache invalidation is coarse, and there is no stampede protection.** Any write by a user drops everything cached for that user
(task pages, stats and columns), because it is one version number per user. That is simple and always correct, but for a user who edits
constantly the cache rarely gets to help, and when a popular entry expires, many requests at once can all miss and all hit MongoDB. With one
more day I would version per column (so moving a card only invalidates the two columns involved and the counts), and add single-flight
loading so concurrent misses share one database query.

Smaller trade-offs I am aware of: the sign-out deny-list and lockout counters fail **open** if Redis is unreachable (an access token then
lives out its 15 minutes, and the per-IP limiter still applies), because failing closed would lock every user out during a cache outage; without
Redis those counters are per-process; there is no real-time sync (a second device sees changes on its next refetch); and search is a
case-insensitive, escaped regex scoped to one user's tasks (a text index or Atlas Search would be the next step).
