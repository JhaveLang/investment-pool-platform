# Bitcoin Magazin Pool – Investment Pool Platform

A full-stack investment-pool platform. Investors register, deposit funds, request withdrawals and follow every money movement with a running balance. Admins reconcile deposits, approve withdrawals, export CSV reports and review an immutable activity log. **The user interface is German by default, with an English option** (DE | EN switch in the header and on the login page).

| Investor | Admin |
| --- | --- |
| Registration & login, with an automatically assigned investor ID (e.g. `01GR01`) | Pool overview (volume, open items) |
| Dashboard with live balance, returns and withdrawable amount | Reconcile deposits with their receipt date, or cancel them |
| Deposits by bank transfer, crypto or exchange (`1.234,56` in German, `1,234.56` in English) | Approve or reject withdrawals (with 7-day payout deadline) |
| Withdrawals to an IBAN, a wallet or an exchange, with live fee preview | Book the monthly result for every investor, with preview |
| Paginated ledger with resulting balance per entry | Investor list with search by name, email or investor ID |
| Profile with account details and own password change | Investor detail page: edit name and email, set a new password |
| | CSV reports (journal, deposits, withdrawals, balances), with investor ID |
| | Activity log of all security- and money-relevant actions |
| | Own profile with password change |

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **TypeScript**
- **PostgreSQL** via **Drizzle ORM** (SQL migrations in `drizzle/`)
- **Redis** via **ioredis** (rate limiting)
- **Zod** validation, **Tailwind CSS 4**
- **Vitest** unit tests, ESLint
- **Docker** multi-stage image + **Docker Compose**

---

## Quick start with Docker (recommended)

Requirements: Docker with Docker Compose v2.

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, ADMIN_EMAIL and ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, or register a new investor account.

Compose starts four services:

| Service | Purpose |
| --- | --- |
| `db` | PostgreSQL 17 (data in the `postgres-data` volume) |
| `redis` | Redis 7 (rate limiting) |
| `migrate` | One-off job: applies migrations and creates the admin user, then exits |
| `app` | The Next.js server on port `APP_PORT` (default 3000) |

Useful commands:

```bash
docker compose logs -f app        # follow application logs
docker compose ps                 # service status
docker compose down               # stop (data is kept in volumes)
docker compose down -v            # stop AND delete all data
```

## Local development (without Docker)

Requirements: Node.js 22+, a running PostgreSQL and Redis.

```bash
npm install
cp .env.example .env              # point DATABASE_URL / REDIS_URL at your local services
createdb investment_pool          # or: psql -c 'CREATE DATABASE investment_pool;'
npm run db:migrate                # create tables and triggers
npm run db:seed                   # create the admin user from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                       # http://localhost:3000
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (includes the naming rules below) |
| `npm run typecheck` | Generates route types and runs `tsc` |
| `npm test` | Unit tests (Vitest) |
| `npm run db:generate` | Create a new migration after changing `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Create the admin user (idempotent) |
| `npm run db:studio` | Browse the database with Drizzle Studio |

## Environment variables

| Variable | Required | Used by | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | app, migrations | PostgreSQL connection string. In Compose it is built from the `POSTGRES_*` values. |
| `REDIS_URL` | yes | app | Redis connection string. In Compose: `redis://redis:6379`. |
| `COOKIE_SECURE` | no | app | Session cookies are `Secure` in production by default. Set `false` **only** if production runs on plain HTTP (not recommended). |
| `ADMIN_EMAIL` | for seed | seed | Email of the initial admin account. |
| `ADMIN_PASSWORD` | for seed | seed | Password of the initial admin (min. 10 characters). |
| `ADMIN_NAME` | no | seed | Display name of the admin (default `Administrator`). |
| `POSTGRES_USER` | Compose | Compose | Database user (default `pool`). |
| `POSTGRES_PASSWORD` | Compose | Compose | Database password. Use URL-safe characters (letters, digits, `-`, `_`). |
| `POSTGRES_DB` | Compose | Compose | Database name (default `investment_pool`). |
| `APP_PORT` | no | Compose | Host port for the app (default `3000`). |

The admin seed only creates the account if it does not exist; changing `ADMIN_PASSWORD` later does not change an existing password.

---

## How money moves

All balances are derived from an **append-only ledger**. Every movement is one immutable row in `ledger_entries` holding timestamp, signed amount and **resulting balance**. Amounts are stored as integer cents (`bigint`), never as floats.

| Action | Ledger effect | Status |
| --- | --- | --- |
| Investor deposits | `+amount` (deposit) and `−fee` (deposit_fee) immediately | `pending` until reconciled |
| Admin reconciles deposit, entering the receipt date | none | `reconciled` |
| Admin cancels deposit (funds never arrived) | `−(amount − fee)` (deposit_reversal) | `rejected` |
| Investor requests withdrawal | `−payout` (withdrawal) and `−fee` (withdrawal_fee) immediately | `pending` |
| Admin approves withdrawal (payout sent) | none | `approved` |
| Admin rejects withdrawal | `+(payout + fee)` (withdrawal_reversal) | `rejected` |
| Admin books a month's result | `±return` (monthly_return) per account | – |

Fee entries are only written when the fee is above zero (crypto is free).

Guarantees:

- **Atomic and race-free.** Every posting runs in one database transaction that locks the account row (`SELECT … FOR UPDATE`), checks the balance, inserts the ledger row and updates the balance. Parallel withdrawals can never overdraw an account. `postLedgerEntry()` in `src/server/services/ledger.ts` is the only code path that changes a balance.
- **Immutable history.** PostgreSQL triggers block `UPDATE`, `DELETE` and `TRUNCATE` on `ledger_entries` and `audit_logs`. Corrections are always new reversal entries.
- **No double bookings.** Each form carries an idempotency key, so a double click or a retried request books only once.
- **Database constraints as a safety net.** Balances can't be negative, amounts must be positive, each ledger entry references exactly one deposit, withdrawal or booked month, and each account receives at most one return per month.
- **Consistency check.** The query below should always return `true`:

  ```sql
  SELECT bool_and(a.balance_cents = (SELECT coalesce(sum(amount_cents), 0) FROM ledger_entries WHERE account_id = a.id))
  FROM accounts a;
  ```

> Deposits are credited immediately (net of fee), then confirmed by an admin ("reconcile"), so the balance updates as soon as the investor acts. Returns and the minimum term are driven by the receipt date the admin enters when reconciling, not by the booking time.

## Balance rules

The rules live in pure, unit-tested modules (`src/lib/fees.ts`, `src/lib/returns.ts`); the matching SQL is in `src/server/queries/accrual.ts`. All dates are calendar days in Berlin time.

### Fees per payment method

| Method | Deposit | Withdrawal |
| --- | --- | --- |
| Bank transfer | 98 % credited | Payout in full, debit = payout ÷ 0,98 (1.000 € → 1.020,40 €) |
| Crypto | 100 % credited | Payout in full, no fee |
| Exchange | 97 % credited | Payout in full, debit = payout ÷ 0,97 (1.000 € → 1.030,92 €) |

Fees are always rounded **down** to the cent, which reproduces the reference figures above and never rounds against the investor. Bank payouts need an IBAN, crypto and exchange payouts a wallet address.

### Minimum term

Every deposit's credited amount is locked for **60 days from its receipt date** (until reconciled: from its booking date). Returns and capital older than 60 days can be withdrawn at any time. A withdrawal (payout + fee) must fit within *balance − locked capital*; the check runs inside the same locked transaction as the booking.

### Monthly returns

On the 2nd or 3rd of each month the admin opens **Admin → Rendite**, picks the previous month, enters its result in percent (e.g. `2,35`, negative for a loss) and checks the preview before booking.

Each account receives `result × Σ(earning capital per day) ÷ days in month`, rounded to the cent. Each ledger entry changes the earning capital from a specific day on:

| Entry | Earning from |
| --- | --- |
| Deposit (and its fee) | 7 days after receipt: received on the 1st → earns from the 8th; never on the day itself |
| Withdrawal (and its fee) | Stops on the request day: requested on the 20th → 19 earning days that month |
| Booked monthly return | The 1st of the following month (returns compound monthly) |
| Cancellation / rejection | Same day as the original, so it nets to zero in every month booked afterwards |

Safeguards when booking:

- Months are booked once, in order and without gaps, and only after they have ended. The very first booking may pick any ended month since the first deposit.
- A month can't be booked while an unreconciled deposit could still earn in it (booked at least 7 days before month end).
- Withdrawals still awaiting a decision count as paid out; the preview warns about them. A withdrawal rejected only after its month was booked doesn't change that month (booked entries are immutable), so decide open withdrawals before booking where possible.
- Booking recalculates under lock and stops if the total differs from the confirmed preview.
- A loss larger than an investor's current balance (because they withdrew in the meantime) is capped at the balance and listed in the activity log.
- `return_periods` is append-only, like the ledger.

## Profile & account management

- **Investor ID:** every investor gets a unique, random ID of the shape `01GR01` (2 digits, 2 letters without I and O, 2 digits) when registering. It reveals nothing about the number of investors, never changes, and is shown on the profile, in the admin investor list (searchable), the review queues, the activity log and the CSV reports.
- **Profile** (`/profile` for investors, `/admin/profile` for the admin): opened from the name in the top bar (on phones from the account menu). Shows ID (investors only), name, email and member-since date, and lets users change their own password. Changing it needs the current password, signs the user out on all other devices and is rate-limited to 5 attempts per 15 minutes.
- **Name and email** can only be changed by the admin on the investor detail page (`/admin/investors/<id>`, reached from the Investors list). Investors who need a change contact the admin; there is no request workflow. A name or email change does not sign the investor out.
- **Forgotten password:** the app sends no email. The admin sets a new password on the investor detail page; it replaces the old one at once, signs the investor out everywhere and stays valid until the investor changes it on their profile.
- The admin's own email and name are not editable in the UI. The seed never changes an existing admin's password, so `ADMIN_PASSWORD` does not conflict with a password changed on `/admin/profile`.
- **Updating an existing installation:** run `npm run db:migrate` immediately after updating the code. Until it has run, sign-in, registration and the admin pages fail with `column "investor_code" does not exist`. Compose runs it through the `migrate` service. The migration adds `users.investor_code` and assigns a code to every existing investor.

## Security

- **Passwords**: scrypt (memory-hard, built into Node) with a per-user salt. Login timing is equalised for unknown emails.
- **Sessions**: random 256-bit tokens in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only the SHA-256 hash is stored in the database. Sessions expire after 12 hours.
- **Role-based access**: `investor` and `admin`. Every page, Server Action and Route Handler calls `requireInvestor()` / `requireAdmin()` (`src/server/auth/guards.ts`). The proxy only performs an optimistic redirect.
- **Input validation**: Zod schemas for every form (`src/lib/validation.ts`), including IBAN checksum and amount limits (1,00 € – 1.000.000,00 €).
- **Rate limiting** (Redis): login per IP and per email, registration per IP, money movements per user. If Redis is unreachable, requests are allowed (fail-open) and an error is logged.
- **Activity logging**: registrations, logins (including failed ones), logouts, every booking, every admin decision and every report export, with actor, IP and details. Account events: `auth.password_changed` and `auth.password_change_failed` (own password), `user.updated` (admin edits name or email, with old and new value) and `user.password_reset` (admin sets a password). Passwords and hashes are never logged.
- **Password changes**: a changed or admin-set password deletes the other sessions of that user.
- **CSRF**: Server Actions only accept same-origin requests. **Headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **CSV injection**: cells starting with `= + - @` are neutralised in exports.

## Project structure

```
src/
├── app/                    Routes only (thin pages)
│   ├── (auth)/             /login, /register
│   ├── (investor)/         /dashboard, /transactions, /deposit, /withdraw, /profile
│   ├── admin/              /admin, deposits, withdrawals, investors (+ detail page), returns, reports, activity, profile
│   └── api/                /api/health, /api/reports/[reportType] (CSV)
├── actions/                Server Actions: validate → authorize → call a service
├── components/
│   ├── ui/                 Design-system primitives (Button, Card, Table, FormField, …)
│   ├── layout/             App shell: sidebar, top bar and navigation
│   ├── charts/             Sparkline for balance trends (inline SVG, no chart library)
│   ├── dashboard/          Overview cards shared by the investor and admin dashboards
│   ├── account/            Profile view and password form (shared by investor and admin)
│   ├── auth/ transactions/ admin/   Feature components
├── config/navigation.ts    Menu entries
├── lib/                    Pure helpers: money parsing, formatting, IBAN, CSV, validation
├── i18n/                   Languages: dictionaries (messages/de.ts, messages/en.ts), locale config, helpers
├── server/
│   ├── auth/               Password hashing, sessions, role guards
│   ├── db/                 Drizzle schema and client
│   ├── services/           Business logic and transactions (ledger, deposits, withdrawals, reports, account)
│   ├── queries/            Read-only queries for pages and exports
│   └── rate-limit.ts, redis.ts, env.ts
└── proxy.ts                Optimistic auth redirect
drizzle/                    SQL migrations (incl. append-only triggers)
scripts/seed.ts             Admin seed
```

Conventions: descriptive camelCase names (single-letter identifiers are rejected by ESLint `id-length`). UI text is never hard-coded; it lives in the dictionaries under `src/i18n/messages/`. Money is handled as integer cents end to end. Dates are always shown in `Europe/Berlin`.

## Languages (German / English)

- **German is the default.** Every visitor sees German until they pick English with the DE | EN switch. The choice is stored in a `locale` cookie for one year.
- **Everything follows the language:** page text, validation and error messages, number and date formats (`1.234,56 €` / `€1,234.56`), the accepted amount input notation, and CSV exports (German: `;` separator with decimal comma; English: `,` separator with decimal point).
- **Changing text:** edit `src/i18n/messages/de.ts` or `en.ts`. The English dictionary is typed against the German one, so a missing or misspelled key fails `npm run typecheck`.
- **Adding a language:** add the code to `LOCALES` and its settings (`INTL_LOCALES`, `LOCALE_LABELS`, `CSV_DELIMITERS`) in `src/i18n/config.ts`, create `src/i18n/messages/<code>.ts` typed as `Messages`, register it in `src/i18n/dictionaries.ts`, and add its amount notation in `src/lib/money.ts`.
- Server components read text with `const { messages, format } = await getI18n()`; client components use `useMessages()`.

---

## Production deployment

### Option A: single server with Docker Compose

1. Install Docker on the server (Ubuntu: `curl -fsSL https://get.docker.com | sh`).
2. Copy the project to the server (e.g. `git clone`) and create `.env` from `.env.example` with strong, unique passwords.
3. Start the stack: `docker compose up -d --build`
4. Put a TLS-terminating reverse proxy in front of port 3000. Example with [Caddy](https://caddyserver.com) (automatic HTTPS):

   ```
   pool.example.com {
       reverse_proxy localhost:3000
   }
   ```

   The proxy must forward `X-Forwarded-For` (Caddy and nginx do), which is used for rate limiting and the activity log. Don't expose port 3000 publicly; bind it to localhost with `APP_PORT=127.0.0.1:3000` or use a firewall.
5. Verify: `curl https://pool.example.com/api/health` should return `{"status":"ok",…}`.

**Updating:** `git pull && docker compose up -d --build`. Pending migrations run automatically through the `migrate` service before the new app container starts.

**Backups:**

```bash
docker compose exec db pg_dump -U pool investment_pool > backup-$(date +%F).sql   # create
docker compose exec -T db psql -U pool investment_pool < backup-2026-11-19.sql     # restore into an empty DB
```

### Option B: managed services

Use a managed PostgreSQL (AWS RDS, DigitalOcean, Neon, Supabase, …) and Redis (Upstash, ElastiCache, …):

1. Build the image: `docker build --target runner -t investment-pool .`
2. Run migrations once per release: `docker build --target tooling -t investment-pool-tooling . && docker run --rm -e DATABASE_URL=… -e ADMIN_EMAIL=… -e ADMIN_PASSWORD=… investment-pool-tooling`
3. Run the app container with `DATABASE_URL` and `REDIS_URL` set, behind HTTPS.

## Testing

```bash
npm test            # unit tests: money and rate parsing, fees, return calculation, dates, IBAN, CSV escaping, password hashing
npm run lint
npm run typecheck
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Login does nothing in production over HTTP | Cookies are `Secure` in production. Serve via HTTPS, or set `COOKIE_SECURE=false` for a test setup. |
| `Invalid environment configuration` | `DATABASE_URL` or `REDIS_URL` is missing. See `.env.example`. |
| Port 5432/6379 already in use locally | Compose doesn't publish db/redis ports. For local dev, point `DATABASE_URL`/`REDIS_URL` at your existing services. |
| Sign-in, registration or the admin pages fail with `column "investor_code" does not exist` | The code was updated but the migration has not run yet. Run `npm run db:migrate`. |
| Need a clean database in development | Ledger and audit tables are append-only (TRUNCATE is blocked). Drop and recreate the database, then run `npm run db:migrate && npm run db:seed`. |
