# Account management – design

Date: 2026-11-21 · Status: draft for approval

## Intent

Today an account is only a name, an email and a password, and nobody can change any of them after registration – not the investor, not the admin. The admin also has no short way to refer to an investor.

This change adds:

1. A **unique investor ID** (shape `01GR01`) generated automatically when registration succeeds.
2. A **profile page** where every user sees their account details and can change their **own password**.
3. **Admin account management**: the admin edits an investor's **name, email and password directly** on a new investor detail page.

There is **no request workflow**. Investors who want a different name or email contact the admin outside the app, and the admin makes the change.

## Goals

- Every investor has a short, unique, human-friendly ID that the admin sees wherever investors appear.
- Investors (and the admin) can change their own password, safely.
- The admin can correct an investor's name or email and set a new password for an investor who forgot theirs, without touching the database.
- Every change is in the activity log.

## Non-goals

- Investors editing their own name or email. Display only.
- Change requests or approval flows for profile data.
- Forgot-password / reset by email. The app sends no email, so the admin setting a new password *is* the reset path.
- Managing admin accounts in the UI (creating admins, editing other admins, changing the admin's own name or email). Admins still come from the seed script.
- Deleting or deactivating accounts.
- Changing the investor ID after it is assigned.
- Temporary passwords or forcing a password change at next sign-in. A password the admin sets simply replaces the old one and stays valid until someone changes it.

## Anti-goals (would be a failure even if it works)

- The log, the database or any screen ever storing or showing a password in readable form. (The admin necessarily knows a password they set for an investor; the admin never sees a password the investor chose.)
- A changed password leaving other devices signed in with the old one.
- An investor ID that reveals how many investors the pool has.
- Breaking registration: a new investor must still land on the dashboard with a zero balance and be able to deposit straight away (original acceptance criterion 1).

## Constraints

- Follow the existing architecture: thin pages in `src/app`, Server Actions in `src/actions` (validate → authorize → call a service), business logic in `src/server/services`, read queries in `src/server/queries`, guards from `src/server/auth/guards.ts` on every page and action.
- All UI text lives in `src/i18n/messages/de.ts` and `en.ts` (German default). Use the existing Aegis design system (`Card`, `CardHeader`, `FormField`, `Badge`, `buttonStyles`, …); see the design memory. Check German labels for overflow at 375 / 1024 / 1280 / 1440 px.
- Next.js 16 in this repo differs from older versions: read the relevant guide in `node_modules/next/dist/docs/` before writing routes or actions (per `AGENTS.md`). Dynamic route props follow the existing `PageProps<"/…">` pattern.
- Schema changes go through Drizzle (`npm run db:generate`), with hand-written SQL added to the generated migration where needed (as in `drizzle/0002_balance_rules.sql`, documented with a comment at the top).
- Do not run migrations against the user's own database or restart their dev server on :3000. Test against a scratch database and a cloned project on another port (see the local-dev memory). The user applies the migration with `npm run db:migrate`.
- `next build`, `npm run lint` and `npm test` must pass; the README is updated (feature table, security/activity-logging section, project structure if new folders appear). `docs/Modules-and-Functions-by-Role.xlsx` is regenerated to match (it currently says the Investors list is read-only and admins cannot edit investors).

## Approaches considered (admin side)

1. **Investor detail page** `/admin/investors/<id>` reached from each row of the Investors list, with the read-only facts and two forms. Matches how the app is built (server-rendered pages + forms, no modals) and leaves room to show the investor's deposits and withdrawals later. **Chosen by the user.**
2. **Edit pop-up inside the Investors list.** Faster to reach, but two forms in a dialog are cramped, the app has no dialog component, and it needs more client-side code. Rejected.

## Design

### 1. Investor ID

- **Shape:** 2 digits, 2 letters, 2 digits, e.g. `01GR01`. Letters from A–Z **without I and O** (they read like 1 and 0). Each position is chosen at random with `crypto.randomInt` – random rather than a running count, so the ID reveals nothing about pool size. (10 × 10 × 24 × 24 × 10 × 10 ≈ 5.76 million combinations.)
- **Storage:** new column `users.investor_code varchar(6)`, `UNIQUE`, nullable (admins have none). Database safety nets:
  - `CHECK (investor_code ~ '^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$')`
  - `CHECK (role <> 'investor' OR investor_code IS NOT NULL)` – added after the backfill.
- **Generation:** as part of registration (`registerInvestor`). On a unique violation of the code constraint, generate a new code and retry (a few attempts, then fail loudly); a unique violation of the email constraint still maps to `EMAIL_TAKEN`. Tell the two apart by constraint name. A failed insert aborts a Postgres transaction, so the retry needs a savepoint, `ON CONFLICT`, or a retry of the whole transaction. Put the generator in a pure module (e.g. `src/lib/investor-code.ts`) so it can be unit-tested.
- **Backfill:** the migration assigns a code to every existing investor (currently 2 in the user's database, but the SQL must work for any number), using random codes in the same shape with a retry on collision, then adds the second CHECK.
- **Never changes** after assignment. The admin edit form does not include it.
- **Where it appears:**
  - Investor's own profile page.
  - Admin Investors list: new "Investor ID" column; the list search (and the admin top-bar search, which submits to the same page) also matches the code, case-insensitive.
  - Admin investor detail page header.
  - Wherever an investor is shown on admin pages: the deposit and withdrawal review tables (`InvestorCell` in `review-tables.tsx`), the approval queue, latest-entries table and payout-deadlines card on the admin overview, and the activity-log actor column for investors – as a small monospace label next to/under the name.
  - CSV exports: an "Investor ID" column next to the investor name in the transaction journal, deposits, withdrawals and balances reports (`src/server/services/reports.ts`, `messages.csv`).

### 2. Profile page (every signed-in user)

Routes: **`/profile`** for investors (inside the `(investor)` group) and **`/admin/profile`** for the admin (inside `admin/`), both rendering one shared component so the layout and nav stay role-correct. Add `/profile` to the proxy matcher in `src/proxy.ts` like the other protected routes.

Reached from the user's name/avatar: on desktop the `UserChip` in the top bar becomes a link to the profile; on phones the account menu (`account-menu.tsx`) gets a "Profile" entry above language and sign-out. Not added to the sidebar or dock.

```
Profile
┌ Account details ───────────────────────────────┐
│ Investor ID   01GR01        (investors only)    │
│ Name          Anna Schmidt                      │
│ Email         anna.schmidt@example.de           │
│ Member since  19.11.2026                        │
│ To change your name or email, please contact    │
│ the pool administrator.     (investors only)    │
└────────────────────────────────────────────────┘
┌ Change password ───────────────────────────────┐
│ Current password      [            ]            │
│ New password          [            ]            │
│ Confirm new password  [            ]            │
│                                   [Save]        │
└────────────────────────────────────────────────┘
```

**Change password:**
- Fields: current password, new password, confirmation. New password uses the existing `newPasswordSchema` (10–128 characters); confirmation must match; the new password must differ from the current one.
- The current password is verified with `verifyPassword`. Wrong current password → field error "Current password is incorrect." and an audit entry `auth.password_change_failed`.
- Rate limit: new rule, e.g. 5 attempts per 15 minutes per user (protects against someone with a stolen session guessing the current password).
- On success, in one transaction: update the hash, **delete all of that user's other sessions** (keep the current one so they stay signed in here), audit `auth.password_changed`. Show a success message and clear the form.
- Admin uses the same form on `/admin/profile` for their own password. (Note for README: the seed never changes an existing admin's password, so this does not conflict with `ADMIN_PASSWORD`.)

### 3. Admin: investor detail page `/admin/investors/<userId>`

- Each row in the Investors list (name or the whole row) links here. Guard: `requireAdmin()`; an unknown id or a non-investor id shows the standard not-found page.
- **Header / facts (read-only):** name, investor ID, email, balance, registered on, last sign-in.
- **Form "Name & email":** prefilled with current values. Validation reuses the registration rules (name 2–120 characters, valid email, stored lower-case and trimmed like registration). Email must not belong to another user → field error "This email address is already in use." Saving with no change is a no-op with a neutral message (no audit entry). On success: update, audit `user.updated` with metadata `{ changes: { fullName?: { from, to }, email?: { from, to } } }`, success message. The investor is **not** signed out by a name/email change; their header picks up the new values on the next request because `getCurrentUser` reads from the database.
- **Form "Set new password":** new password + confirmation (same rules as above). No old password needed. On success, in one transaction: update the hash, **delete all of the investor's sessions** (signed out everywhere), audit `user.password_reset` with the investor as entity. Success message tells the admin to pass the new password to the investor.
- Admins cannot open this page for admin accounts (non-goal).
- Both admin forms carry the existing CSRF/same-origin protection of Server Actions. Admin review actions have no rate limit today, and none is added here.

### 4. Activity log

New actions added to `AuditAction` (schema type), `messages.audit.actions` (DE + EN), and to `describeEntry` in `activity-log-table.tsx`:

| Action | Actor | Details shown |
| --- | --- | --- |
| `auth.password_changed` | the user | – |
| `auth.password_change_failed` | the user | – |
| `user.updated` | admin | "Name: old → new", "Email: old → new", and which investor (name + ID) |
| `user.password_reset` | admin | which investor (name + ID) |

Passwords and hashes never go into metadata.

### 5. Text (DE / EN)

All new labels, messages, errors, audit labels and the CSV header live in both dictionaries. German is the source of truth for tone (formal "Sie", as in the existing UI). Suggested German menu label for the page: "Profil".

## Testing

- Unit (Vitest): investor-code generator (shape, alphabet without I/O, randomness bounds); new validation schemas (password change, admin edit, confirmation mismatch, new = current).
- Integration against a scratch database (service level, `npx tsx --conditions=react-server`): registration assigns a valid unique code; code collision retry; migration backfills existing investors and the CHECKs hold; password change deletes other sessions but keeps the current one; admin password reset deletes all of the investor's sessions; email uniqueness on admin edit; audit rows written without secrets.
- Manual / Playwright on the cloned app: investor changes password and can sign in with the new one only; admin edits name/email and the investor sees it; admin resets a password and the investor is signed out; ID visible in list, search, queues and CSVs; DE and EN; phone and desktop widths.
- Regression: a fresh registration still lands on the dashboard with a zero balance and can deposit immediately.

## Decided by the user

- Investor ID auto-generated after successful registration; `01GR01` is only a sample of the shape – its parts carry no meaning ("01GR01 sample ID is unique auto generated ID").
- Investors see name and email display-only and can change only their password.
- The admin edits investors' name, email and password directly; no request workflow.
- Admin side built as an investor detail page (approach 1).
- A password set by the admin is a normal password that replaces the old one – no forced change at next sign-in ("if the admin sets a new password, the old password will be replaced, its simple").

## Calls made by Claude (open to correction)

- Random IDs (not a running count), without I and O; existing investors are backfilled; IDs never change.
- ID also shown in admin queues, CSV exports and searchable.
- Changing a password signs out the user's other devices; an admin-set password signs the investor out everywhere.
- The admin needs no old password to set a new one.
- The admin's own profile allows password change only (editing the admin's own email would break the seed's "already exists" check by email).
- Profile is reached from the avatar / name, not from the main navigation.

## Left to the builder

- Exact component structure, file names and query shapes, within the conventions above.
- Exact copy wording (within tone and the meaning above).
- Visual placement details, as long as they follow the Aegis design system and the sketch.
- Retry count for code collisions and the exact rate-limit numbers.
