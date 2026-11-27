# Pool settings – design

Date: 2026-11-25 · Status: implemented

## Intent

The user asked for "pool management in the admin", with the pool's fixed-return packages as the example. The packages and commissions were not built (see "Not built"); the user agreed to a settings page for the existing pool instead.

## Decisions

- **Page:** `/admin/pool`, one form: deposits open or closed, minimum and maximum per deposit and per withdrawal request, and a notice (German, English; either falls back to the other) above the investors' forms.
- **Storage:** one row in `pool_settings` (migration 0009), starting with the limits in force before (1,00 € – 10.000,00 €). Each change is logged as `pool.settings_updated` with old and new values.
- **Closed pool:** `createDeposit` refuses in its transaction, after the check for a repeated submit. Submitted deposits can still be reconciled.
- **Deposit dates** (migration 0010): an optional first and last day for new deposits, both included, in Berlin time. One rule (`depositState`) decides for the investor's page, the admin badge and `createDeposit`; the closed switch wins over the dates. They belong to the standard pool: no separate pools, terms or rates.
- **Withdrawals can't be blocked:** minimum at most 100 €, maximum at least 1.000 € (form and database checks), and whoever has less than the minimum can withdraw all of it.
- **Limits** are checked in the actions, like the fixed limits before; the demo seed calls the services directly and isn't limited. `MIN_` / `MAX_TRANSACTION_CENTS` are only outer bounds now (1 € – 1.000.000 €).

## Not built

Fixed or promised returns, packages with a term and rate, and partner commissions: see `2026-11-23-public-website-design.md`.

## Testing done

Unit tests for the rules, and a browser run on a scratch database (admin and investor): validation, saving, closing while a form is open, limits on both forms, small balances, repeated submit, activity log, both languages, phone width, no access for investors.

Deposit dates: unit tests, and a browser run on a scratch database: reversed dates refused (form and database), one-day range, not started, ended, switch closed inside the dates, dates ending while a form is open, withdrawals still open, activity log, both languages, phone width.
