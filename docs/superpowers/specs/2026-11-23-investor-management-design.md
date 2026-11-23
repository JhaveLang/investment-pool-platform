# Investor management (CRUD) – design

Date: 2026-11-23 · Status: implemented

## Intent

Admins can already view investors and edit their name, email and password (see `2026-11-21-account-management-design.md`). This change completes the set:

- **Create** an investor from the admin area.
- **Read**: the Investors list gains a status filter; the detail page shows the status.
- **Update**: unchanged (name, email, password on the detail page).
- **Deactivate / activate** instead of delete. The user asked for "no deletion, just activate or deactivate".

Deleting is not possible anyway: ledger entries and audit logs are append-only and reference the user, and the original brief requires every money movement to stay retrievable.

## Decisions

### Create

- Route `/admin/investors/new`, reached from a "Neuer Anleger" button on the list. It is a page with a form, not a dialog, matching the rest of the admin area.
- Fields and rules are the same as self-registration (`registerSchema`). The admin sets a starting password and passes it on, the same as with "set new password".
- `registerInvestor` takes an optional `createdByAdminId`. It still runs one transaction with investor-code retry and creates the zero-balance account. Self-registration still logs `auth.registered` with the investor as actor; admin creation logs `user.created` with the admin as actor and `{ investorName, investorCode }`.
- On success the action redirects to `/admin/investors/<id>?created=1`. The confirmation is a `FlashAlert` that removes the parameter with `history.replaceState`, so later saves on the page don't show it again.

### Deactivate / activate

- Column `users.deactivated_at timestamptz` (NULL = active), migration `0004_investor_status`. A CHECK makes sure admin accounts are never deactivated.
- `setInvestorStatus` (`src/server/services/account.ts`) locks the user row and sets or clears the timestamp. Deactivating also deletes all of the investor's sessions, all in one transaction. It logs `user.deactivated` / `user.activated` with an optional note. A repeated request throws `ALREADY_PROCESSED`.
- One Server Action, `setInvestorStatusAction`; the form sends the target status, so the outcome message survives the card switching between "deactivate" and "activate".
- Sign-in: `authenticate` checks the password first (same timing path as before). With a correct password for a deactivated account it logs `auth.login_blocked` and throws `ACCOUNT_DEACTIVATED` ("This account has been deactivated…"). It doesn't update `last_login_at` or create a session. With a wrong password the generic message stays, so the status is only revealed to the password holder. The existing login rate limit applies.
- `getCurrentUser` ignores deactivated users as a second safeguard, in case a session survived.

### Money is not touched (call made by Claude, open to correction)

Deactivation only blocks access:

- The balance stays in the pool and keeps receiving the monthly result.
- Pending deposits and withdrawals of a deactivated investor stay in the review queues and can be reconciled, approved or rejected.
- The investor can withdraw again once activated.

The deactivate card shows a notice when there is still a balance or open requests. The alternative, requiring a zero balance and no outstanding monthly result before deactivating, would have ruled out suspending an account and needed a "returns still due" check. It was not chosen.

### Read

- List filter Active (default) / Deactivated / All via the shared `StatusFilter`, which now keeps other query parameters (the search).
- A search without an explicit status (e.g. from the top-bar search) covers all statuses, so deactivated investors stay findable by name, email or ID.
- Deactivated investors carry a "Deaktiviert" badge in the list and on the detail page; the facts list shows the status and date.
- The admin overview counts active investors only (pool volume still includes every balance). The balances CSV gets a trailing Status column.

### Update

Name, email and password can still be edited while an investor is deactivated (e.g. to correct an email before activating).

## Testing done

- Unit: `adminInvestorStatusSchema` (statuses, empty note, note length).
- Integration against a scratch database: 30 service/query checks. They cover creation and audit actor, duplicate email, deactivation clearing sessions, double requests, blocked sign-in without `last_login_at` change, filters and search, the overview count, the CSV field, activation, and the admin guard in service and database.
- Browser (production build on a scratch port):
  - create with validation errors and email normalisation;
  - an open investor session ends on deactivation;
  - deactivated sign-in message vs. generic wrong-password message;
  - activate;
  - filters keep the search;
  - activity log entries;
  - DE/EN at 375, 1024 and 1440 px;
  - regression: a fresh registration still lands on a zero balance and can deposit immediately.
