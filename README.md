# Task Manager

A small task manager built with **React, Express and MongoDB** (TypeScript on both sides). You sign up, and
then create, edit, complete, filter, sort and search your own tasks. Each user only ever sees their own data.

I kept the scope deliberately tight and spent the effort on the parts that usually go wrong in small apps:
validation, ownership checks, sensible error handling, dates and timezones, and tests.

## Features

- Register, sign in and sign out (JWT in an `httpOnly` cookie)
- Create, edit, delete (with an inline confirmation) and complete tasks
- Title, description, priority (low / medium / high), status (to do / in progress / done) and due date
- Summary cards (all, to do, in progress, done, overdue) that double as quick filters
- Search, filter by priority and due date (overdue, today, next 7 days, none), and five sort orders
- Server-side pagination
- Filters are kept in the URL, so a filtered view can be bookmarked and the back button works
- Optimistic updates for ticking a task off or deleting it, with rollback if the request fails
- Responsive layout, keyboard friendly, follows the system light / dark theme

## Quick start

You need **Node 20+**. You do not need to install MongoDB or Docker (see option A).

```bash
git clone <this repo> && cd task-manager
npm run setup        # installs server + client + root dependencies and creates server/.env
```

Then, in **two terminals**:

```bash
# Terminal 1: a local MongoDB on 127.0.0.1:27017 (downloads a mongod binary on first run, data kept in server/.mongo-data)
npm run db

# Terminal 2: seeds a demo account, then starts the API (http://localhost:4100) and the web app (http://localhost:5173)
npm run seed && npm run dev
```

Open http://localhost:5173 and sign in with the demo account:

| Email                   | Password     |
| ----------------------- | ------------ |
| `demo@taskmanager.test` | `Demo@12345` |

…or just register a new account.

**Option B, your own MongoDB.** Skip `npm run db`, run `docker compose up -d` (a plain `mongo:7`) or point
`MONGODB_URI` in `server/.env` at MongoDB Atlas.

### Production build

```bash
npm run build
npm start            # serves the API and the built React app from one origin on $PORT
```

In production the API serves `client/dist` itself, so there is a single origin: no CORS and a first-party cookie.
Put it behind a reverse proxy that terminates TLS. If you serve it over plain `http` (for example for a quick demo
on a server IP), set `COOKIE_SECURE=false` in `server/.env`, otherwise browsers drop the session cookie.

### Configuration (`server/.env`)

| Variable         | Default / example                      | Notes                                         |
| ---------------- | -------------------------------------- | --------------------------------------------- |
| `MONGODB_URI`    | `mongodb://127.0.0.1:27017/task-manager` | required                                      |
| `JWT_SECRET`     | 32+ random characters                  | required; the server refuses to start without |
| `PORT`           | `4100`                                 |                                               |
| `JWT_EXPIRES_IN` | `7d`                                   |                                               |
| `CLIENT_ORIGIN`  | `http://localhost:5173`                | only used for CORS in development             |
| `COOKIE_SECURE`  | on in production                       | see above                                     |

## Tests and checks

```bash
npm test             # 24 API tests (real MongoDB in memory) + 13 UI/unit tests
npm run typecheck
```

The API tests run against a real `mongod` (started in memory), not mocks, because most of the interesting logic
(sorting, filters, unique indexes) lives in the queries. They cover auth, validation, ownership, filters,
all sort orders, pagination, the date logic and the error shapes.

## API

All routes are under `/api`. Errors always have the same shape:
`{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "title", "message": "…" }] } }`.

| Method | Path                | Description                                         |
| ------ | ------------------- | --------------------------------------------------- |
| POST   | `/auth/register`    | Create an account and start a session               |
| POST   | `/auth/login`       | Sign in                                             |
| POST   | `/auth/logout`      | Clear the session cookie                            |
| GET    | `/auth/me`          | Current user                                        |
| GET    | `/tasks`            | List with filters, sort and pagination (see below)  |
| GET    | `/tasks/stats`      | Counts per status plus the number of overdue tasks  |
| POST   | `/tasks`            | Create                                              |
| GET    | `/tasks/:id`        | Read one                                            |
| PATCH  | `/tasks/:id`        | Update any subset of fields                         |
| DELETE | `/tasks/:id`        | Delete                                              |

`GET /tasks` query parameters: `status`, `priority`, `due` (`overdue|today|week|none`), `q` (search),
`sort` (`createdAt|dueDate|priority|title`), `order` (`asc|desc`), `page`, `limit` (max 50) and `today`
(`YYYY-MM-DD`, the client's local date; see decision 3). Unknown values are rejected with a 400 rather than ignored.

## Project layout

```
server/
  src/
    config/env.ts          validated environment, fails fast on boot
    models/                Mongoose schemas (User, Task)
    schemas/               zod schemas: the single definition of valid input
    services/              business logic (auth, tasks), no Express in here
    routes/                thin HTTP layer: parse, call a service, respond
    middleware/            auth guard, central error handler
  tests/                   supertest + in-memory MongoDB
  scripts/                 local MongoDB and seed data
client/
  src/
    api/                   fetch wrapper, React Query hooks, types
    components/            small presentational pieces
    pages/                 sign in / register, tasks
    hooks/                 URL-backed filter state, debounce
    lib/dates.ts           all calendar-date logic in one tested place
```

## Decisions

These are the three choices I would defend first.

### 1. Session handling: JWT in an `httpOnly` cookie, one origin in production

The token is never exposed to JavaScript, so an XSS bug cannot lift it out of `localStorage`. The cookie is
`SameSite=Lax` and the API only accepts JSON, which together close off the usual CSRF routes without a token
dance. In production the API serves the built client, so everything is same-origin and no CORS is needed; in
development Vite proxies `/api`, so the cookie is first-party there too. The trade-off is that I need a server
for the cookie (fine here) and that revoking a stolen token is hard (see the limitation below).

Smaller things in the same area: passwords are hashed with bcrypt (12 rounds), a failed login costs the same
time and returns the same message whether the email exists or not, auth routes are rate limited, and a task
that belongs to someone else returns **404, not 403**, so ids cannot be probed.

### 2. Query on the server, and keep the state of the view in the URL

Filtering, sorting and paging happen in MongoDB, not in the browser, so the list stays fast whatever the number of
tasks. Every query is scoped by `owner` first and the indexes start with it. A single aggregation pipeline serves the
list because two of the sort orders need computed keys: priority must order low < medium < high (it is a string
in the database), and due-date sorting must put tasks with no date **last** in both directions. `_id` is the final
sort key so pages stay stable when other keys tie. On the client the filters live in the URL query string, which
gives bookmarkable views and a working back button for free, and unrecognised values fall back to defaults instead
of reaching the API.

### 3. Due dates are calendar dates, not timestamps

"Due 20 Nov" means that day wherever you are. Storing it as a `Date` makes it shift by a day for anyone not in
UTC. So the due date is a `YYYY-MM-DD` string (which also sorts and compares correctly as plain text), and
"overdue" is decided against the **client's local date**, which it sends as `today`. The server defaults to the
UTC date if it is missing. All the date maths lives in one small, tested file (`client/src/lib/dates.ts`).

Also worth a mention: input is validated with zod at the edge (and the same rules are checked in the form for
fast feedback), `completedAt` is kept in sync with `status` in a model hook rather than trusting the client, and
the React Query layer does optimistic updates but always refetches afterwards so the server stays the source of truth.

## Left out on purpose

1. **Sharing and collaboration** (shared lists, assignees, comments). It changes the data model from "a task has one
   owner" to a permissions model, and every query, test and UI state with it. That is a feature of its own, not
   something to bolt on to a single-user app.
2. **Reminders and notifications** (email or push when something is due). It needs a mail provider, a background
   job runner and delivery tracking, which is a lot of moving parts for something that does not show up in
   a short review of the core flow.
3. **Password reset and email verification.** Both need transactional email and single-use expiring tokens, and I
   did not want to ship a half-working version. Without them an account with a forgotten password is lost.

## Known limitation

**Sessions cannot be revoked.** The JWT is stateless and lasts 7 days, so "sign out" only clears the cookie in that
browser. If a token were stolen, it would stay valid until it expires, and changing a password would not log out other
devices. With one more day I would switch to a short-lived access token (about 15 minutes) plus a rotating refresh
token stored hashed in MongoDB, so logout, password change and "sign out everywhere" can invalidate sessions for real.

Smaller trade-offs I am aware of: search is a case-insensitive, escaped regex scoped to one user's tasks (fine at
this size, but a text index or Atlas Search would be the next step), and rate limiting is in memory, so it is
per-instance rather than shared.
