# BrewSpace

A coffee-shop workspace reservation platform. Customers browse a café, walk the
room in an interactive 3D floor map, hold a seat for five minutes while they
confirm, check in with a code, and then order or call a waiter from the table.
Waiters and admins work a live queue and manage the room.

This is a Bun + TypeScript monorepo: an Elysia API backed by PostgreSQL and
Redis, and a Next.js App Router frontend with a React Three Fiber floor map.

---

## What's here

```
brewspace/
├── apps/
│   ├── api/          Elysia API — auth, reservations, orders, service requests, dashboards
│   └── web/          Next.js 14 app — booking flow, 3D map, staff & admin dashboards
├── packages/
│   ├── contracts/    Shared Zod schemas, DTOs, enums, and state-transition tables
│   └── typescript-config/  Shared strict tsconfig bases
├── docker-compose.yml   Postgres 16 + Redis 7 for local development
└── .env.example
```

The frontend and backend share one source of truth for types and business
rules: `packages/contracts` holds the Zod schemas, the enums, and the
`RESERVATION_TRANSITIONS` / `SERVICE_REQUEST_TRANSITIONS` / `ORDER_TRANSITIONS`
tables that both sides consult so state-machine rules are never duplicated.

---

## Prerequisites

- **Bun** ≥ 1.3 (the monorepo uses Bun workspaces and the `workspace:*` protocol)
- **Docker** (for Postgres and Redis), or your own Postgres 16 and Redis 7

---

## Quick start

```bash
# 1. Install all workspace dependencies
bun install

# 2. Start Postgres and Redis
docker compose up -d

# 3. Configure environment
cp .env.example apps/api/.env
# The defaults in .env.example match docker-compose; edit if you run your own services.

# 4. Create the schema and seed demo data
bun run db:migrate
bun run db:seed

# 5. Run both apps (API on :4000, web on :3000)
bun run dev
```

Then open **http://localhost:3000**.

### Run the apps individually

```bash
bun run dev:api    # API only, http://localhost:4000
bun run dev:web    # Web only, http://localhost:3000
```

---

## Development credentials

The seed creates four accounts. **All share the password
`brewspace-dev-password`.**

| Role     | Email                   | Use it to…                                   |
|----------|-------------------------|----------------------------------------------|
| Admin    | `admin@brewspace.dev`   | View the dashboard, edit the floor map, manage the menu |
| Waiter   | `waiter1@brewspace.dev` | Work the live service/order queue for the main floor & lounge |
| Waiter   | `waiter2@brewspace.dev` | Same, for the workspace & meeting zones      |
| Customer | `customer@brewspace.dev`| Book a seat, check in, order, call a waiter  |

The seed also creates one branch (**BrewSpace Downtown**, open 07:00–22:00 UTC
daily) with 17 seats across four zones, a two-category menu, and one sample
served order so the admin dashboard has data on first load.

---

## Trying the full flow

1. Sign in as the customer, open **Book a spot**, pick BrewSpace Downtown.
2. Choose a date/time and **Check availability** — seats light up green
   (available), amber (held), or clay (reserved) on the 3D map.
3. Click a green seat, **Hold this seat** (a five-minute countdown starts), then
   **Confirm reservation**.
4. On **My reservations**, enter the shown reservation code to **check in**.
5. Once checked in, **Order at the table** or **Call a waiter**.
6. In another browser (or incognito), sign in as `waiter1@brewspace.dev` and open
   **Staff** — new requests and orders stream in live and can be advanced through
   their pipelines.
7. As the admin, **Admin → Edit floor map** lets you drag seats on the plan; the
   3D preview updates live and **Save layout** persists it.

---

## Testing

The backend ships with a full integration suite (59 tests) that runs against a
real Postgres and Redis — no mocks for the pieces that matter (the seat-overlap
guard, Redis holds, the racing double-confirm).

```bash
# One-time: create and migrate the test database
createdb brewspace_test   # or: docker compose exec postgres createdb -U postgres brewspace_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/brewspace_test \
REDIS_URL=redis://localhost:6379/1 \
SESSION_SECRET=test-secret-at-least-32-characters-long \
  bun run --cwd apps/api db:migrate

# Run the suite
bun run test:api
```

The suite is configured to run files serially (`fileParallelism: false`) and
truncates all tables plus flushes the Redis test DB between tests, so runs are
deterministic. Coverage spans authentication and sessions, holds and
reservations (including cancellation/extension/check-in rules and the
concurrent double-booking race), availability computation, the service-request
staff queue and zone authorization, and orders with integer-cents pricing and
the kitchen status pipeline.

### Type checking

```bash
bun run typecheck        # both apps
```

---

## API documentation

With the API running, interactive docs are at **http://localhost:4000/docs**.

The machine-readable OpenAPI 3.0 spec — importable into **APIDog**, Postman, or
Insomnia — is served at **http://localhost:4000/docs/json** (40 documented
paths). Point your tool's "Import from URL" at that endpoint.

Health and readiness probes: `GET /health` and `GET /ready` (the latter checks
Postgres and Redis connectivity).

Real-time staff updates use Server-Sent Events at
`GET /api/v1/events?branchId=…` (waiter/admin only); the frontend uses these as
a refetch signal so the dashboard is always consistent with the database.

---

## Architecture notes

### The ORM decision (please read)

The original specification named a "**Liquid ORM**" for the persistence layer.
No such library exists — it is not on npm and has no published package. Rather
than block, the build follows the specification's own escape hatch: all data
access goes through **narrow repository interfaces** (`ReservationRepository`,
`SeatRepository`, `MenuRepository`, `OrderRepository`, and so on), and the
concrete implementations live behind them.

Those implementations use **Drizzle ORM** over `postgres`. Because every service
depends only on the repository interface — never on Drizzle directly — the ORM
is a swappable detail. If a real "Liquid ORM" (or any other library) later
becomes available, only the `Drizzle*Repository` classes need to change; the
services, business rules, and tests are untouched. This keeps the domain layer
honest about what it actually needs from persistence and keeps the door open.

### Integrity lives in the database, not just the app

Double-booking is prevented by a PostgreSQL **exclusion constraint** (via
`btree_gist`) on `(seat_id, tstzrange(start_at, end_at))` for active
reservation statuses. Even if two requests race past the application checks, the
database rejects the second overlapping insert (SQLSTATE `23P01`), which the API
maps to a clean `409`. A test seeds two Redis holds and fires two confirms
concurrently to prove exactly one wins.

### Money is always integer cents

Prices, subtotals, tax, and totals are integer minor units end to end — no
floats touch currency. Tax is computed from a basis-points rate on the integer
subtotal.

### Seat holds

A hold is a short-lived Redis entry (5-minute TTL) written atomically as a
seat-scoped key plus a token key. Confirming a reservation consumes the token;
an expired or already-used token is rejected.

---

## Environment variables

See `.env.example`. The backend validates its environment at startup with Zod
and refuses to boot on a missing or malformed value.

| Variable | Purpose | Default (dev) |
|----------|---------|---------------|
| `DATABASE_URL` | Postgres connection string | `postgres://postgres:postgres@localhost:5432/brewspace_dev` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SESSION_SECRET` | Session signing secret (≥ 32 chars) | — |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | Allowed browser origin | `http://localhost:3000` |
| `COOKIE_SECURE` | Set `true` behind HTTPS in production | `false` |
| `SEAT_HOLD_TTL_SECONDS` | Hold lifetime | `300` |
| `NEXT_PUBLIC_API_URL` | API base URL for the web app | `http://localhost:4000` |

---

## Production build

```bash
bun run build            # builds both apps
bun run --cwd apps/api start
bun run --cwd apps/web start
```

Set `COOKIE_SECURE=true`, a strong `SESSION_SECRET`, and a real `CORS_ORIGIN`
before deploying. Session cookies are `httpOnly`, `sameSite=lax`, and 7-day.

---

## Known limitations

Honest notes on what's intentionally out of scope or left for a follow-up:

- **Auth hardening:** rate limiting on the auth endpoints and CSRF tokens are
  not implemented. The session cookie is `sameSite=lax`, which covers the common
  cases; add CSRF and rate limits before public production use.
- **Cross-midnight opening hours** are not modeled (the seeded branch closes at
  22:00). Hours that wrap past midnight would need a small extension to the
  opening-hours check.
- **Frontend visual QA:** the web app type-checks and `next build`s cleanly, and
  every route was smoke-tested returning 200, but the 3D scenes and dashboards
  have not been through a full manual/visual QA pass across devices.
- **Menu item options** (e.g. milk choice, size) are modeled in the schema and
  priced by the order service via option snapshots, but the customer ordering UI
  currently orders base items without an option picker.
