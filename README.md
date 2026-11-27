# Bitcoin Magazin Pool – Investment Pool Platform

A full-stack investment-pool platform. Investors sign in to accounts the admin creates for them, deposit funds, request withdrawals and follow every money movement with a running balance. Admins manage investor accounts (create, edit, deactivate / activate), reconcile deposits, approve withdrawals, export CSV reports, manage the notices on the public News page and review an immutable activity log. **The user interface is German by default, with an English option** (DE | EN switch in the header and on the login page). A small public website (start page, news, contact, Impressum, privacy policy) sits in front of the sign-in.

| Investor | Admin |
| --- | --- |
| Login to an account created by the admin, with an investor ID (e.g. `01GR01`); a welcome popup with the zero balance leads straight to the first deposit | Pool overview (volume, open items) with the approval queue: one card per investor, newest request first; several requests show as one card with their count, opening all of them in a grid |
| Dashboard with live balance, returns and withdrawable amount | Reconcile deposits with their receipt date, or cancel them |
| Deposits by bank transfer, crypto or exchange (`1.234,56` in German, `1,234.56` in English) | Approve or reject withdrawals (with 7-day payout deadline) |
| Withdrawals to an IBAN, a wallet or an exchange, with live fee preview | Book the monthly result for every investor, with preview |
| [Fixed Incomes](#fixed-incomes) offers, transfer requests and booking status | Create and edit offers, manage visibility, process transfers and credit maturity payouts |
| Paginated ledger with resulting balance per entry | Investor list with status filter (all / active / deactivated) and search by name, email or investor ID |
| Profile with account details and own password change | Create investors; investor list with the chosen month's investment, return and deposits / withdrawals; investor view page with everything about one investor; edit page: name and email, new password, deactivate / activate |
| | CSV reports (journal, deposits, withdrawals, balances), with investor ID |
| | News: add, edit, hide / show and delete the notices of the public News page (written in German, translated to English by DeepL) |
| | Activity log of all security- and money-relevant actions |
| | Own profile with password change |
| Live updates: balance, open requests and ledger refresh by themselves when the admin decides | Real-time notifications: bell and toast for new withdrawal requests and deposits |

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

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then create investor accounts under Investors → Neuer Anleger. There is no self-registration.

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
| `DEEPL_API_KEY` | no | app | DeepL API key for translating news notices to English when the admin saves them. A free key (ending in `:fx`, 500,000 characters a month) from https://www.deepl.com/pro-api is enough. Without it, notices are saved untranslated and the English website shows the German text. |
| `ADMIN_EMAIL` | for seed | seed | Email of the initial admin account. |
| `ADMIN_PASSWORD` | for seed | seed | Password of the initial admin (min. 10 characters). |
| `ADMIN_NAME` | no | seed | Display name of the admin (default `Administrator`). |
| `POSTGRES_USER` | Compose | Compose | Database user (default `pool`). |
| `POSTGRES_PASSWORD` | Compose | Compose | Database password. Use URL-safe characters (letters, digits, `-`, `_`). |
| `POSTGRES_DB` | Compose | Compose | Database name (default `investment_pool`). |
| `APP_PORT` | no | Compose | Host port for the app (default `3000`). |

The admin seed only creates the account if it does not exist; changing `ADMIN_PASSWORD` later does not change an existing password.

### Admin email notifications

The app emails the team when an investor submits a new deposit or withdrawal request. The email includes the investor’s name, investor ID and email address, along with the booking reference, amount, fees and time of submission. Withdrawals also include the payout deadline. Replaying the same submission sends a single notification.

In `.env`, set `ADMIN_NOTIFICATION_EMAIL` to the receiving mailbox (or a comma-separated list) and supply the sending mailbox’s `SMTP_HOST`, `SMTP_USER` and `SMTP_PASSWORD`. The default port is 587 with STARTTLS. For implicit TLS set `SMTP_PORT=465`. The sender defaults to `SMTP_USER`. Set `MAIL_FROM` if your provider authorizes a different sender address.

Restart the local app or recreate the Compose app container after changing mail settings. Delivery runs after the request commits, including when all admin browsers are closed. The server logs SMTP failures under `[mail]`. The request remains in the review queue if delivery fails.

---

## First steps for a new investor

The admin creates the account (see Creating investors) and passes on the email and starting password. On the first sign-in the investor lands on the dashboard with a zero balance and a **welcome popup**:
- what the popup shows: the balance (0,00 €), how a first deposit works (create it, transfer with the reference shown, credited after fees once the payment is matched), and the 60-day minimum term and 7-day payout deadline;
- **Erste Einzahlung anlegen** opens the deposit form; **Später**, Esc or a click beside it closes the popup.

Signing in shows the popup again until the investor has started a first deposit. After that, it never appears. Sign-in redirects to `/dashboard?welcome=1`; the dashboard opens the popup only while the investor has no deposit, and removes the parameter at once, so a refresh doesn't open it again.

## Approval queue on the admin overview

Open withdrawals and unreconciled deposits appear as **one card per investor**, the investor with the newest request first (at most 8 cards).
- **One request:** its card keeps its own controls: reconcile with the receipt date, approve, reject or cancel.
- **Several requests:** they show as one card with a count badge, the deposit and withdrawal totals, the most urgent payout deadline and "Alle N anzeigen". A click opens a popup that fades and scales in, with all of the investor's requests popping into a grid one after another (3 columns on wide screens, 1 on phones), each with its own controls.
- **Deciding requests in the popup:** the popup stays open and the count updates. When only one request is left, the investor's card turns back into a normal card.
- The overview loads up to 200 open requests of each kind for this, so the counts are complete in practice. Without motion (reduced-motion setting) the popup simply appears.

## How money moves

All balances are derived from an **append-only ledger**. Every movement is one immutable row in `ledger_entries` holding timestamp, signed amount and **resulting balance**. Amounts are stored as integer cents (`bigint`), never as floats.

| Action | Ledger effect | Status |
| --- | --- | --- |
| Investor submits a deposit | none – shown as "awaiting reconciliation" | `pending` |
| Admin reconciles the deposit, entering the receipt date | `+amount` (deposit) and `−fee` (deposit_fee) | `reconciled` |
| Admin cancels the deposit (funds never arrived) | none | `rejected` |
| Investor requests a withdrawal | none – payout + fee are **reserved** (no longer available) | `pending` |
| Admin approves the withdrawal (payout sent) | `−payout` (withdrawal) and `−fee` (withdrawal_fee) | `approved` |
| Admin rejects the withdrawal | none – the reservation is released | `rejected` |
| Admin books a month's result | `±return` (monthly_return) per account | – |

Fee entries are only written when the fee is above zero (crypto is free). The balance therefore changes only when the admin approves; the investor sees open deposits and withdrawals under "Offene Vorgänge" and on the dashboard ("+… warten auf Abgleich", "… für Auszahlungen reserviert"). What can be withdrawn is the balance minus capital in its minimum term minus reserved payouts.

**Items from before the approval rule** (migration `0005`, 2026-11-23): until then deposits and withdrawals were booked when the investor submitted them. `deposits.credited_at` / `withdrawals.debited_at` record when an item was booked, and the migration sets them for all existing rows, so those items are never booked twice: approving them books nothing, and rejecting them still writes the reversal (`deposit_reversal`, `−(amount − fee)`) or refund (`withdrawal_reversal`, `+(payout + fee)`) as before. Cancelling such a deposit is refused while its money is reserved for a pending withdrawal.

Guarantees:

- **Atomic and race-free.** Every posting runs in one database transaction that locks the account row (`SELECT … FOR UPDATE`), checks the balance, inserts the ledger row and updates the balance. Withdrawal requests are checked against the balance minus earlier reservations under the same lock, so parallel requests can never reserve more than there is, and an approval can always be debited. `postLedgerEntry()` in `src/server/services/ledger.ts` is the only code path that changes a balance.
- **Immutable history.** PostgreSQL triggers block `UPDATE`, `DELETE` and `TRUNCATE` on `ledger_entries` and `audit_logs`. Corrections are always new reversal entries.
- **No double bookings.** Each form carries an idempotency key, so a double click or a retried request books only once.
- **Database constraints as a safety net.** Balances can't be negative, amounts must be positive, each ledger entry references exactly one deposit, withdrawal or booked month, each account receives at most one return per month, a reconciled deposit is always credited and an approved withdrawal always debited.
- **Consistency check.** The query below should always return `true`:

  ```sql
  SELECT bool_and(a.balance_cents = (SELECT coalesce(sum(amount_cents), 0) FROM ledger_entries WHERE account_id = a.id))
  FROM accounts a;
  ```

> Deposits are credited when the admin reconciles them and withdrawals debited when the admin approves them; the investor's open dashboard shows the new balance within about a second of that decision (live update, see below), and every later page load shows it too. Returns and the minimum term are driven by the receipt date the admin enters when reconciling, and a withdrawal stops earning on the day it is requested, even though it is debited later.

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
- Deactivated investors earn and lose nothing from the day of deactivation up to the day before they are activated again (deactivated on the 10th, activated on the 20th → no result for the 10th–19th). The periods come from the activity log's deactivation/activation entries; the preview marks affected investors with the number of days.
- A loss larger than an investor's current balance minus payouts reserved for pending withdrawals (because they withdrew or requested a withdrawal in the meantime) is capped at that amount and listed in the activity log, so approving the withdrawal later can never overdraw the account.
- `return_periods` is append-only, like the ledger.

## Fixed Incomes

Admins manage offers under **Admin → Fixed Incomes** (`/admin/promos`). Investors browse visible offers and track their own requests under **Fixed Incomes** (`/promos`).

1. **Set the offer terms.** Enter the minimum and maximum transfer in whole euros, the term in calendar months, the total return at maturity and the **Bookable through** date. Investors can book through the end of that date in Berlin time. From the next day, the offer shows **No longer bookable**. **Edit** changes the offer for future requests. **Hide** opens a modal naming the offer. Confirm to hide it from investors, or select **Cancel** or press **Esc** to keep it visible. **Show** restores visibility.
2. **Request a transfer.** The investor chooses a whole-euro amount within the offer’s inclusive limits. The transfer is free. After locked funds and pending requests are accounted for, at least €1,000 must remain in the standard pool. For example, €2,000 of available funds supports a €1,000 transfer. Investors can top up through a separate standard deposit, which retains its 60-day lock from receipt. Each request reserves its amount and records the offer name, term and rate.
3. **Process and confirm.** After seven days, an admin selects **Process ready transfers**. The app checks the available balance again, debits eligible transfers and calculates maturity from the processing date. If the target month is shorter, maturity falls on its last day. Written confirmation is due within ten days of the original request. Select **Prepare confirmation email**, send it through your mail app, then select **Confirmation sent**. The email includes the transferred amount, transfer date, maturity date and payout.
4. **Credit the payout.** On or after maturity, an admin selects **Credit matured returns**. The app returns the principal to the standard pool and credits the fixed return once. The percentage applies once to the principal over the full term. Any fraction of a cent in the return rounds down.

The seeded **Promo Return 5** is an example-only offer with a June 26, 2026 deadline, a €1,000–€25,000 range and a five-month term. Its 31% total return illustrates a €1,310 maturity credit on €1,000 of principal. Create a separate offer for live bookings.

## Profile & account management

Admins manage investors on **Anleger / Investors** (`/admin/investors`): create (`/admin/investors/new`), view (`/admin/investors/<id>`), edit (`/admin/investors/<id>/edit`: name, email, password) and deactivate / activate. Investors are never deleted, because every booking and log entry must stay attached to its account. Each row of the list has an **Aktionen** column with three icon buttons (the tooltip names the action): **Ansehen** (eye) opens the view page, **Bearbeiten** (pencil) the edit page, **Deaktivieren / Aktivieren** (lock) switches the status (the edit page additionally takes a note and shows remaining money). Deactivating always asks for confirmation first, in the list and on the edit page; activating doesn't.

- **Investor list and month filter:** columns investor ID, name, balance, **Anlage am 1. {Monat}** (investment on the 1st), **Rendite {Monat}** (the month's return), **Sonstiges {Monat}** (the month's deposits and withdrawals as `+1.074,00 € (26.09.)`, newest first, trimmed to two entries and `+N`; a click opens a popup with all of them, their reference and status, and the booked total), registered, actions. There is no email or last sign-in column (the search still finds investors by email; the last sign-in shows on the view and edit pages). The **Monat** select (current month by default, back to the first deposit) chooses the month; it keeps the search and the status filter, and paging keeps the month. The figures follow the booking rules: amounts are net of fees (a deposit counts with its credit after the fee, a withdrawal with payout plus fee), dated by value date (deposits by their receipt date, withdrawals by their request day), and a month's return counts from the 1st of the next month, so it is part of the next month's investment. Open requests appear marked "offen" but aren't counted yet; "–" means nothing to show (no investment yet, or the month's return isn't booked). Because bookings are dated by value date, a figure for a past month can still change when a late deposit is reconciled or a return is booked.
- **CSV exports of the monthly statement:**
  - **All investors** ("CSV" above the list): choose **Von / Bis** (default: the shown month and the two before it). One row per investor of the current filter (status and search, all pages) with three columns per month, oldest month first, like the client's sheet: `Anlage am 1. Okt. 2026 (EUR)`, `Rendite Okt. 2026 (EUR)`, `Sonstiges Okt. 2026`. `GET /api/admin/investors/statements?from=YYYY-MM&to=YYYY-MM&status=…&q=…`.
  - **One investor** (download icon in the row: all months; or "CSV" on the view page with a month range): one row per month with investment on the 1st, return, the booked deposits and withdrawals, and Sonstiges. `GET /api/admin/investors/<id>/statement?from=YYYY-MM&to=YYYY-MM`.
  - Amounts are after fees and written as plain numbers (`10000,00`); Sonstiges reads `26.09.2026: +1074,00 · 13.10.2026: -415,00 (offen)`, oldest first. Without a range, the export runs from the first deposit to the current month; swapped months are put in order; at most 60 months. Semicolons in German, commas in English, like the other CSV reports. Every export is logged as "Bericht exportiert" with its month range (and the investor).
- **Investor view page** (`/admin/investors/<id>`): balance, freely available, in the minimum term and total returns; the **monthly statement** (one row per month from the first deposit, newest first, with the same three figures as the list and the same Sonstiges popup; "CSV" downloads it for a month range); all deposits and withdrawals (newest 50 each, with the total); the paginated ledger; and the investor's **own activity log** (only what they did themselves: registration, sign-ins and sign-outs including failed or refused attempts, deposits booked, withdrawals requested, password changes; paginated). The admin's decisions show in the request tables and in the pool-wide activity log. **Bearbeiten** leads to the edit page. New investors land here after creation.

- **Investor ID:** every investor has a unique ID of 6–20 upper-case letters, digits and hyphens, e.g. `01GR01` or `INV-0042`. An ID that is shorter than 6 characters, empty or already taken is refused. The admin can type one when creating the investor or leave the field empty for a random one (shape `01GR01`: 2 digits, 2 letters without I and O, 2 digits), and can change it later on the investor edit page or **right in the investor list**: a click on an ID turns it into a field, the save button beside the Monat select saves all changed IDs at once (Enter saves, Esc reverts a row; all or nothing, every taken, malformed or twice-entered ID is marked on its row). While IDs are unsaved, leaving the list asks first (links, filters, month, search and sign-out in our own dialog; a reload or closed tab in the browser's), the CSV export and the language switch don't; the browser's back button can't be held. Swapping two IDs takes two saves (first move one to a free ID). Lower-case input is stored upper-case; a taken ID is refused. It is only a display code, not the primary key: records reference the internal user id, so a change keeps bookings, history and links intact (activity-log entries keep the ID they were written with; the change itself is logged as `user.updated` with old and new ID). It is shown on the profile, in the admin investor list (searchable), the review queues, the activity log and the CSV reports.
- **Profile** (`/profile` for investors, `/admin/profile` for the admin): opened from the name in the top bar (on phones from the account menu). Shows ID (investors only), name, email and member-since date, and lets users change their own password. Changing it needs the current password, signs the user out on all other devices and is rate-limited to 5 attempts per 15 minutes.
- **Pool settings** (`/admin/pool`): open or close the pool to new deposits, minimum and maximum per deposit and per withdrawal request, and a notice (German, English) above the investors' forms. Closing deposits does not affect withdrawals or deposits already submitted, and the withdrawal limits can't be used to block payouts: the minimum is at most 100,00 €, the maximum at least 1.000,00 €, and whoever has less than the minimum can withdraw all of it. One row in `pool_settings`; every change is logged as `pool.settings_updated` with old and new values.
- **Password fields** (sign-in, own password, new investor, new investor password) have an eye button that shows and hides what was typed; submitting hides it again.
- **Investor ID, name and email** can only be changed by the admin on the investor edit page (`/admin/investors/<id>/edit`, reached from the Investors list or the view page). Investors who need a change contact the admin; there is no request workflow. A change does not sign the investor out.
- **Forgotten password:** the app sends no email. The admin sets a new password on the investor edit page; it replaces the old one at once, signs the investor out everywhere and stays valid until the investor changes it on their profile.
- **Creating investors:** investors cannot register themselves; the admin creates every account with "Neuer Anleger" on the Investors list. Name, email, an optional investor ID and a starting password (at least 10 characters); the investor gets the investor ID (random if left empty) and a zero-balance account, and the admin passes the email and starting password on. Logged as `user.created`.
- **Deactivate / activate:** in the Investors list or on the investor edit page (there with an optional note for the activity log). A deactivated investor is signed out everywhere and cannot sign in (with the right password they see "account deactivated", with a wrong one the usual generic error). The balance stays, but it **earns no return and takes no loss** from the day of deactivation until the day the investor is activated again (see Monthly returns); open deposits and withdrawals can still be reconciled, approved or rejected, and the investor can withdraw again once activated. Activating restores sign-in with the existing password and returns from that day. The Investors list shows all investors by default (tabs: All / Active / Deactivated); searches, such as from the top bar, cover all unless a tab is chosen. The admin overview counts active investors only; the balances CSV has a status column. Admin accounts can never be deactivated (database check).
- The admin's own email and name are not editable in the UI. The seed never changes an existing admin's password, so `ADMIN_PASSWORD` does not conflict with a password changed on `/admin/profile`.
- **Updating an existing installation:** run `npm run db:migrate` immediately after updating the code. Until it has run, sign-in and the admin pages fail with `column "investor_code" does not exist` or `column "deactivated_at" does not exist`. Compose runs it through the `migrate` service. Migration `0003` adds `users.investor_code` and assigns a code to every existing investor; `0004` adds `users.deactivated_at` (every existing investor stays active); `0005` adds `deposits.credited_at` and `withdrawals.debited_at` for approval-only booking (all existing items count as already booked). `0006` widens `users.investor_code` to 20 characters and replaces the `01GR01` format check with the free-form rule (existing IDs are kept). Until it has run, saving an ID longer than 6 characters or outside the old shape fails with a database error. `0007` creates `news_entries` with the 49 existing notices; until it has run, the start page and `/news` fail with `relation "news_entries" does not exist`.

## Public website

Open to everyone, in German and English, in the app's design: **Startseite** (`/`), **News** (`/news`), **Kontakt** (`/contact`), plus **Impressum** (`/imprint`) and **Datenschutz** (`/privacy`) in the footer. The header's **Anmelden** button (the old site's "Konten" tab) opens `/login`; signed-in users see **Mein Konto** instead, leading to their dashboard or the admin overview. `/` used to redirect to the sign-in or the home page; it now always shows the start page.

- **Start page:** the pool's name and founding date, the way into the online account for existing investors, how the account works (minimum term, start of returns, payout deadline, journal), the latest three notices, the contact address and, while set, the note that the pool takes no new investors. It makes no offer and states no returns.
- **News:** the old website's operational notices from January 2024 on (49 entries: support hours, outages, statements and balances, bank accounts, payment methods, limits and fees, closures, trader departures), newest first and grouped by year. Entries that mixed an operational notice with a bonus or a return figure were shortened to the notice; entries that were only promotional (see below) are not listed. The start page shows the three newest under "Aktuelle Mitteilungen".
- **News management (Admin → News):** the notices live in the `news_entries` table (migration `0007` copied in the 49 entries above, which used to sit in `src/content/news.ts`). The admin list shows every notice, hidden ones included, newest first, with its English text below the German one. **Neue Mitteilung** and **Bearbeiten** open a form with the date (today by default; the website sorts by it), the German text (required, up to 500 characters) and **Auf der Website anzeigen**. The admin writes German only: when a notice is saved, **DeepL** translates it to British English (`DEEPL_API_KEY`, see Environment variables) and the English website shows that translation; the edit page shows it read-only. DeepL is only called when the German text is new or changed, or when a notice has no English text yet, so changing just the date or visibility keeps the English text (the 49 copied notices keep their hand-written ones). Without a key, or when DeepL fails (8-second timeout, quota used up), the notice is still saved, the English website shows the German text, the list says "noch nicht übersetzt" and a warning names the reason; saving the notice again retries. A changed German text whose translation fails drops the old English text instead of keeping an outdated one. Only the admin's notice texts are sent to DeepL, never visitor or investor data. **Ausblenden / Einblenden** takes a notice off the website and back without deleting it; **Löschen** removes it for good after a confirmation. Of two notices on the same date, the one added later comes first. Every change is logged (`news.created`, `news.updated` with the changed fields, `news.deleted` with the deleted text). Changes appear on `/` and `/news` at once, since both pages render on every request.
- **Contact:** general enquiries and the billing team that sends the statements, both at `bitcoin-magazin-pool-team1@online.ms`, as email links. The app sends no email, so there is no contact form.
- **Legal pages** (`src/content/legal.ts`): templates. What the app itself does is filled in (stored data, the two necessary cookies, no tracking); the operator's details stand in [brackets]. A notice on each page says so until `LEGAL_TEMPLATES_PENDING` is set to `false`, which should only happen once the placeholders are filled and a lawyer has reviewed the texts.
- Contact addresses, founding month, "closed to new investors since" and the copyright year live in `src/config/site.ts`.
- There is no risk notice page: the user removed the drafted template; it can be added again once the operator supplies its own text.
- Deliberately not part of the public website: return figures or targets, fixed-return packages, referral commissions, review bonuses, invitations to invest, and the named waiting list (see the design note in `docs/superpowers/specs/`).

## Real-time notifications and live balances

- **Investors:** as soon as the admin reconciles or cancels one of their deposits, approves or rejects a withdrawal, or books a monthly return, the investor's open dashboard and ledger reload their data by themselves and a toast says what happened ("Ihre Einzahlung … ist abgeglichen: 980,00 € gutgeschrieben"). The balance therefore changes on screen within about a second of the admin's decision, without a refresh. Each investor receives only events about their own account; a booked month only reaches investors who received a return, with their own amount. Deposit and withdrawal pages show the toast but don't reload, so an open form keeps its state (and its idempotency key). The dashboard's 30-second refresh stays as a fallback.
- **Admins:** every new withdrawal request and deposit appears at once in the admin area. A toast pops up, the bell in the top bar counts unread events, and its panel lists the latest ones with a link to the queue or the investor. On the overview, the queues and the investor list, the page data also reloads, so a new request appears at the top of the approval queue without a manual refresh. Pages with forms (new investor, monthly result) are not reloaded.
- **How:** writing the activity-log entry for one of these events also sends a PostgreSQL `NOTIFY` inside the same transaction, so a booking that fails or a repeated form submit never notifies. Each server process keeps one `LISTEN` connection and passes events to the open pages through Server-Sent Events: `GET /api/admin/notifications` (admins only) and `GET /api/investor/notifications` (the signed-in investor only; the recipient is resolved on the server from the deposit, withdrawal or return booking, never from the request). The browser reconnects on its own (the server ends each stream after 4 minutes, so the session is checked again) and missed events are replayed from the activity log. The bell's read marker is stored per browser.
- **Fallback:** if the stream can't connect, the panel shows "Getrennt" and the overview keeps refreshing every 30 seconds as before.
- **Deployment:** reverse proxies must not buffer the stream. The endpoint sends `X-Accel-Buffering: no` and `Cache-Control: no-transform` for nginx and compressors; Caddy needs nothing. Over plain HTTP/1.1 (local development) browsers allow about 6 connections per site, so many open admin tabs at once can stall; HTTPS with HTTP/2 in production lifts this limit.

## Security

- **Passwords**: scrypt (memory-hard, built into Node) with a per-user salt. Login timing is equalised for unknown emails.
- **Sessions**: random 256-bit tokens in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only the SHA-256 hash is stored in the database. Sessions expire after 12 hours.
- **Role-based access**: `investor` and `admin`. Every page, Server Action and Route Handler calls `requireInvestor()` / `requireAdmin()` (`src/server/auth/guards.ts`). The proxy only performs an optimistic redirect. The notification streams answer 401 without a session and 403 to the other role.
- **Input validation**: Zod schemas for every form (`src/lib/validation.ts`), including IBAN checksum and amount limits (per deposit or withdrawal request, set by the admin under Pool; at first 1,00 € – 10.000,00 €).
- **Rate limiting** (Redis): login per IP and per email, money movements per user. If Redis is unreachable, requests are allowed (fail-open) and an error is logged.
- **Activity logging**: logins (including failed ones), logouts, every booking, every admin decision and every report export, with actor, IP and details. Account events: `auth.password_changed` and `auth.password_change_failed` (own password), `user.updated` (admin edits investor ID, name or email, with old and new value), `user.password_reset` (admin sets a password), `user.created`, `auth.registered` (self-registrations from before it was removed; still shown in old logs), `user.deactivated` and `user.activated` (with the admin's optional note) and `auth.login_blocked` (correct password for a deactivated account). News events: `news.created`, `news.updated` (with the changed fields) and `news.deleted` (with the deleted text). Passwords and hashes are never logged.
- **Password changes**: a changed or admin-set password deletes the other sessions of that user. **Deactivation** deletes all of the investor's sessions, and the session lookup ignores deactivated users as a second safeguard.
- **CSRF**: Server Actions only accept same-origin requests. **Headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **CSV injection**: cells starting with `= + - @` are neutralised in exports.

## Project structure

```
src/
├── app/                    Routes only (thin pages)
│   ├── (public)/           Public website: /, /news, /contact, /imprint, /privacy
│   ├── (auth)/             /login
│   ├── (investor)/         /dashboard, /transactions, /deposit, /withdraw, /profile
│   ├── admin/              /admin, deposits, withdrawals, investors (+ new, view page, edit page), returns, reports, activity, profile
│   └── api/                /api/health, /api/reports/[reportType] and /api/admin/investors/statements, …/[userId]/statement (CSV), /api/admin/notifications and /api/investor/notifications (live events)
├── actions/                Server Actions: validate → authorize → call a service
├── components/
│   ├── ui/                 Design-system primitives (Button, Card, Table, FormField, …)
│   ├── layout/             App shell: sidebar, top bar and navigation
│   ├── public/             Public website: header, footer, legal page
│   ├── charts/             Sparkline for balance trends (inline SVG, no chart library)
│   ├── dashboard/          Overview cards shared by the investor and admin dashboards
│   ├── account/            Profile view and password form (shared by investor and admin)
│   ├── auth/ transactions/ admin/   Feature components
├── config/                Menu entries (navigation.ts), public website facts (site.ts)
├── content/                Public website texts: legal.ts (news notices are in the database)
├── lib/                    Pure helpers: money parsing, formatting, IBAN, CSV, validation
├── i18n/                   Languages: dictionaries (messages/de.ts, messages/en.ts), locale config, helpers
├── server/
│   ├── auth/               Password hashing, sessions, role guards
│   ├── db/                 Drizzle schema and client
│   ├── services/           Business logic and transactions (ledger, deposits, withdrawals, reports, account)
│   ├── queries/            Read-only queries for pages and exports
│   └── rate-limit.ts, redis.ts, env.ts, notifications.ts (live admin events)
└── proxy.ts                Optimistic auth redirect
deploy/                     setup.sh (one-command server setup with HTTPS), update.sh
drizzle/                    SQL migrations (incl. append-only triggers)
scripts/seed.ts             Admin seed
```

Lists show the newest entry first: queues, ledgers, request histories, investors (by creation), activity log, booked months and notifications. The one exception is the admin's payout-deadline card, which lists the oldest (most urgent) open withdrawals first. CSV exports stay in chronological order for spreadsheets.

Conventions: descriptive camelCase names (single-letter identifiers are rejected by ESLint `id-length`). UI text is never hard-coded; it lives in the dictionaries under `src/i18n/messages/`. Money is handled as integer cents end to end. Dates are always shown in `Europe/Berlin`.

## Languages (German / English)

- **German is the default.** Every visitor sees German until they pick English with the DE | EN switch. The choice is stored in a `locale` cookie for one year.
- **Everything follows the language:** page text, validation and error messages, number and date formats (`1.234,56 €` / `€1,234.56`), the accepted amount input notation, and CSV exports (German: `;` separator with decimal comma; English: `,` separator with decimal point).
- **Changing text:** edit `src/i18n/messages/de.ts` or `en.ts`. The English dictionary is typed against the German one, so a missing or misspelled key fails `npm run typecheck`.
- **Adding a language:** add the code to `LOCALES` and its settings (`INTL_LOCALES`, `LOCALE_LABELS`, `CSV_DELIMITERS`) in `src/i18n/config.ts`, create `src/i18n/messages/<code>.ts` typed as `Messages`, register it in `src/i18n/dictionaries.ts`, and add its amount notation in `src/lib/money.ts`.
- Server components read text with `const { messages, format } = await getI18n()`; client components use `useMessages()`.

---

## Production deployment

### Quickest: one command on an Ubuntu or Debian server (no domain needed)

On a fresh server with at least 2 GB of memory (e.g. Hetzner CX22 or a DigitalOcean droplet), with ports 80 and 443 open:

```bash
git clone https://github.com/JhaveLang/investment-pool-platform.git && cd investment-pool-platform
sudo bash deploy/setup.sh
```

If the repository is private, `git clone` asks for a GitHub username and a personal access token (GitHub › Settings › Developer settings › Personal access tokens, read access to the repository is enough).

`deploy/setup.sh` does the whole of Option A below:
- installs Docker and [Caddy](https://caddyserver.com), and adds swap on small servers;
- writes `.env` with generated passwords (it asks for the admin email);
- builds and starts the stack and, if you say yes, fills the empty pool with demo data;
- configures HTTPS.

Without a domain it serves the site as `https://<server-ip-with-dashes>.sslip.io` (sslip.io turns an IP address into a public host name, free, no sign-up). Set `SITE_HOST=pool.example.com` to use your own domain instead.

The whole site sits behind a browser password prompt (user `client`) until you turn it off with `ACCESS_PASSWORD=none`, so a demo stays private and unindexed.

At the end the script prints the link and every login, and saves them to `/root/investment-pool-access.txt`. Running it again is safe: passwords already in `.env` are kept.

To update later: `sudo bash deploy/update.sh` (pull, rebuild, restart; migrations run automatically).

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

### Demo data for a presentation

For a separate demo installation (e.g. for a client), on an **empty** pool, i.e. a fresh database after the migrations and the admin seed:

```bash
npm run db:seed:demo                                   # local
docker compose run --rm migrate npm run db:seed:demo   # Docker
```

It adds six demo investors (`anna.becker@example.com` … `felix.neumann@example.com`). Their password is `DEMO_PASSWORD` from the environment, or `demo-investor-2026` if not set. The data covers:
- four months of reconciled deposits and two paid-out withdrawals;
- four booked months, one of them a loss;
- open requests for the approval queue, with one investor having three so the queue groups them;
- a deactivated investor;
- a new investor with a zero balance, who sees the welcome popup.

Value dates follow the demo timeline. Booking times in the journal and the activity log are the time the script ran.

The ledger is append-only, so demo data can never be removed. The script therefore refuses to run as soon as the pool has an investor or a booked month. Use it on a demo installation only, never on the real database.

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
| Pages fail with `column "investor_code"`, `"deactivated_at"`, `"credited_at"` or `"debited_at" does not exist` | The code was updated but the migrations have not run yet. Run `npm run db:migrate`. |
| Admin overview reports a missing `deposits.promo_name` column, or Fixed Incomes reports a missing `promo_bookings` table | Run `npm run db:migrate` against the same `DATABASE_URL` as the app. Fixed Incomes uses migrations `0011` through `0016`. |
| Need a clean database in development | Ledger and audit tables are append-only (TRUNCATE is blocked). Drop and recreate the database, then run `npm run db:migrate && npm run db:seed`. |
