# Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every investor an auto-generated ID like `01GR01`, a profile page with self-service password change, and let the admin edit an investor's name, email and password on a new investor detail page.

**Architecture:** One new column (`users.investor_code`) plus a migration with backfill; a pure ID generator in `src/lib`; a new `account` service (password change, admin edits) behind Server Actions in `src/actions/account.ts`; two new pages (`/profile` + `/admin/profile` sharing one component, and `/admin/investors/[userId]`); the ID threaded through existing admin queries, tables and CSV reports.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Drizzle ORM + node-postgres, Zod 4, Vitest, Tailwind 4 (Aegis tokens).

**Spec:** `docs/superpowers/specs/2026-11-21-account-management-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing routes, pages or actions (AGENTS.md). Dynamic route props use the existing `PageProps<"/…">` pattern.
- Architecture: thin pages in `src/app`; Server Actions in `src/actions` (validate → authorize → call a service); logic in `src/server/services`; reads in `src/server/queries`; `requireInvestor()` / `requireAdmin()` / `requireUser()` at the top of every page and action.
- No hard-coded UI text: every string goes into **both** `src/i18n/messages/de.ts` and `en.ts` (formal "Sie" in German). Single-letter identifiers are rejected by ESLint `id-length`.
- Investor ID: 2 digits, 2 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (no I, O), 2 digits; random via `crypto.randomInt`; regex `^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$`; never changes after assignment; admins have none.
- Passwords: 10–128 characters (existing `newPasswordSchema`). Never written to audit metadata, logs or UI in readable form.
- Own password change: requires current password; deletes the user's **other** sessions, keeps the current one; rate limit 5 attempts / 15 min per user.
- Admin-set password: no old password; replaces the old one; deletes **all** of the investor's sessions; no forced change at next sign-in.
- Admin name/email edit: name 2–120 chars, email via existing `emailSchema` (trim + lower-case); email unique → "already in use"; unchanged submit = no-op, no audit row; investor stays signed in.
- Admin's own profile: password change only. Admins cannot open the investor detail page for admin accounts.
- Don't touch the user's own database or their dev server on :3000. Verify in a scratch database + APFS clone on another port (see "Verification environment"). The user applies the migration with `npm run db:migrate`.
- `tsconfig` targets ES2017: use `BigInt(…)`, not `0n`. Prettier `--print-width 120` (`npx prettier`).
- The project is not a git repository: there are no commit steps; each task ends with its verification instead.

## Verification environment (set up once, before Task 2)

- Scratch DB: `createdb -U postgres -h /tmp investment_pool_plan` (Postgres socket `/tmp:5432`), URL `postgresql://postgres@%2Ftmp/investment_pool_plan`. Redis `redis://localhost:6379`.
- Service-level scripts run from inside the project folder: `DATABASE_URL=… REDIS_URL=… npx tsx --conditions=react-server <script>` (scripts live in the session scratchpad and import via relative paths into `src/`).
- App checks: APFS clone in the scratchpad (`cp -cR node_modules src public drizzle scripts package.json tsconfig.json next.config.ts postcss.config.mjs … <clone>`, without `.env`), `rsync src/ drizzle/` into it after edits, run `next dev -p 3100` with `DATABASE_URL`, `REDIS_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` set explicitly.

## Review Focus

1. **Email that differs only in case/whitespace** (admin enters ` Anna.Schmidt@Example.de ` for another user's address) → rejected as "already in use", never a second account with the same address. Pinned in Task 5.
2. **Malformed or wrong-role ids in the detail URL** (`/admin/investors/abc`, `/admin/investors/<admin's own uuid>`) → standard not-found page, not a Postgres uuid cast error or an editable admin record. Pinned in Task 8.
3. **Repeated wrong current password** → field error each time, an audit row each time, rate-limited after 5 within 15 min, and no session is deleted. Pinned in Task 5.
4. **ID collision at registration** → registration still succeeds with a different code; an email collision still shows "email taken". Pinned in Task 3.
5. **Investor signed in while the admin edits them** → after a name/email edit they stay signed in and see the new values on the next request; after an admin password reset their next request lands on `/login`. Pinned in Tasks 5 and 10.

---

### Task 1: Investor ID generator

**Files:**
- Create: `src/lib/investor-code.ts`
- Test: `src/lib/investor-code.test.ts`

**Interfaces:**
- Produces: `INVESTOR_CODE_LETTERS: string` (`"ABCDEFGHJKLMNPQRSTUVWXYZ"`), `INVESTOR_CODE_PATTERN: RegExp`, `generateInvestorCode(randomIndex?: (exclusiveMax: number) => number): string` (default `crypto.randomInt`), `normalizeInvestorCodeQuery(value: string): string` (trim + upper-case, for search).

- [ ] **Step 1: Write the failing tests**

```ts
describe("generateInvestorCode", () => {
  it("matches the 2-digit, 2-letter, 2-digit shape", () => {
    for (let round = 0; round < 500; round += 1) expect(generateInvestorCode()).toMatch(/^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$/);
  });
  it("never uses I or O", () => {
    expect(INVESTOR_CODE_LETTERS).not.toMatch(/[IO]/);
    expect(INVESTOR_CODE_LETTERS).toHaveLength(24);
  });
  it("builds the code from the injected random source", () => {
    const sequence = [0, 1, 6, 15, 0, 1]; // digits 0,1 · letters G (6), R (15 – I and O are skipped) · digits 0,1
    expect(generateInvestorCode(() => sequence.shift()!)).toBe("01GR01");
  });
  it("covers the lowest and highest values", () => {
    expect(generateInvestorCode((max) => max - 1)).toBe("99ZZ99");
    expect(generateInvestorCode(() => 0)).toBe("00AA00");
  });
});
describe("INVESTOR_CODE_PATTERN", () => {
  it("rejects I/O and wrong shapes", () => {
    for (const bad of ["01IO01", "1GR01", "01GR1", "01gr01", "01GR012"]) expect(INVESTOR_CODE_PATTERN.test(bad)).toBe(false);
  });
});
describe("normalizeInvestorCodeQuery", () => {
  it("trims and upper-cases", () => expect(normalizeInvestorCodeQuery(" 01gr01 ")).toBe("01GR01"));
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/investor-code.test.ts` — expected FAIL (module not found).
- [ ] **Step 3: Implement** the module. Order of draws: digit, digit, letter, letter, digit, digit (`randomIndex(10)` / `randomIndex(24)`).
- [ ] **Step 4: Run** the same command — expected PASS.

---

### Task 2: Schema, migration and backfill

**Files:**
- Modify: `src/server/db/schema.ts` (users table, `AuditAction`)
- Create: `drizzle/0003_<generated-name>.sql` (via `npm run db:generate`, then hand-edited), `drizzle/meta/*` (generated)

**Interfaces:**
- Produces: `users.investorCode` (`varchar("investor_code", { length: 6 })`, nullable, unique constraint named **`users_investor_code_unique`**); CHECK constraints **`users_investor_code_format`** and **`users_investor_code_required`**. `AuditAction` gains `"auth.password_changed" | "auth.password_change_failed" | "user.updated" | "user.password_reset"`.

- [ ] **Step 1: Edit the schema.** Add the column with `.unique()`; add both checks in the table's extra-config callback: format `investor_code ~ '^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$'`, required `role <> 'investor' OR investor_code IS NOT NULL`. Extend `AuditAction`.
- [ ] **Step 2: Generate** `npm run db:generate` — expected: a new `drizzle/0003_*.sql` plus snapshot.
- [ ] **Step 3: Hand-edit the migration** so it runs in this order, with a comment block at the top explaining the backfill (as in `0002_balance_rules.sql`): add nullable column → add unique + format constraints → backfill every row with `role = 'investor' AND investor_code IS NULL` using a `DO $$ … $$` loop that draws random codes in the same shape from the same alphabet and retries on `unique_violation` → add the `required` check last.
- [ ] **Step 4: Verify the backfill on the scratch DB.** Migrate a fresh DB with the 0003 files temporarily moved out (`npx drizzle-kit migrate` with the scratch `DATABASE_URL`), insert 3 investors (+ accounts) and 1 admin with plain SQL, put the 0003 files back and migrate again. Expected:
  `SELECT count(*) FROM users WHERE role='investor' AND investor_code ~ '^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$'` → 3; admin's `investor_code` → NULL; `INSERT` of an investor without a code → fails with `users_investor_code_required`; `UPDATE users SET investor_code='01IO01'` → fails with `users_investor_code_format`.

---

### Task 3: Registration assigns the ID

**Files:**
- Modify: `src/server/db/errors.ts`, `src/server/services/auth.ts`
- Test: `src/server/db/errors.test.ts`

**Interfaces:**
- Consumes: `generateInvestorCode` (Task 1), `users.investorCode` (Task 2).
- Produces: `isUniqueViolation(error: unknown, constraintName?: string): boolean` (matches node-postgres `constraint` on the error or its `cause`); `registerInvestor` unchanged signature, now stores `investorCode`; internal `MAX_CODE_ATTEMPTS = 5`.

- [ ] **Step 1: Write the failing tests**

```ts
const pgError = (constraint: string) => ({ code: "23505", constraint });
it("matches any unique violation without a name", () => expect(isUniqueViolation(pgError("users_email_unique"))).toBe(true));
it("matches the named constraint through `cause`", () =>
  expect(isUniqueViolation({ cause: pgError("users_investor_code_unique") }, "users_investor_code_unique")).toBe(true));
it("does not match a different constraint", () =>
  expect(isUniqueViolation(pgError("users_email_unique"), "users_investor_code_unique")).toBe(false));
it("ignores other error codes", () => expect(isUniqueViolation({ code: "23503" })).toBe(false));
```

- [ ] **Step 2: Run** `npx vitest run src/server/db/errors.test.ts` — expected FAIL on the named-constraint cases.
- [ ] **Step 3: Implement** the optional `constraintName` match; in `registerInvestor`, retry the whole transaction with a fresh code when `isUniqueViolation(error, "users_investor_code_unique")` (a failed insert aborts the transaction, so retry outside it), up to `MAX_CODE_ATTEMPTS`, then rethrow; keep mapping the email constraint to `DomainError("EMAIL_TAKEN")`. Accept an optional internal `generateCode` parameter (default `generateInvestorCode`) so the collision path is testable.
- [ ] **Step 4: Run** unit tests — PASS. Then a scratch-DB script: register two investors → both have valid, different codes; register with a `generateCode` that returns an existing code once, then a new one → succeeds with the new code; register an existing email → `EMAIL_TAKEN`. Fresh registration still creates a zero-balance account.

---

### Task 4: Validation schemas

**Files:**
- Modify: `src/lib/validation.ts`, `src/i18n/messages/de.ts`, `src/i18n/messages/en.ts` (`validation` section)
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Produces (on `getSchemas(locale)`):
  - `changePasswordSchema`: `{ currentPassword, newPassword, newPasswordConfirmation }` → errors on `newPasswordConfirmation` (mismatch, `passwordMismatch`) and `newPassword` (equals current, new key `passwordUnchanged`).
  - `adminUpdateInvestorSchema`: `{ userId: uuid, fullName, email }` (same name rules as `registerSchema`, `emailSchema`).
  - `adminSetPasswordSchema`: `{ userId: uuid, newPassword, newPasswordConfirmation }`.
- New dictionary key `validation.passwordUnchanged` — DE "Das neue Passwort muss sich vom aktuellen unterscheiden." / EN "The new password must be different from the current one."

- [ ] **Step 1: Write the failing tests** (in the file's existing style, using `failedField`)

```ts
describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old-password-1", newPassword: "new-password-1", newPasswordConfirmation: "new-password-1" };
  it("accepts a valid change", () => expect(changePasswordSchema.safeParse(valid).success).toBe(true));
  it("flags a mismatch on the confirmation", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, newPasswordConfirmation: "x".repeat(12) }))).toBe("newPasswordConfirmation"));
  it("flags a short new password", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, newPassword: "short", newPasswordConfirmation: "short" }))).toBe("newPassword"));
  it("rejects reusing the current password", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, newPassword: valid.currentPassword, newPasswordConfirmation: valid.currentPassword }))).toBe("newPassword"));
  it("requires the current password", () =>
    expect(failedField(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }))).toBe("currentPassword"));
});
describe("adminUpdateInvestorSchema", () => {
  it("trims and lower-cases the email", () => {
    const result = adminUpdateInvestorSchema.safeParse({ userId: IDEMPOTENCY_KEY, fullName: " Anna Schmidt ", email: " Anna@Example.DE " });
    expect(result.success && result.data).toMatchObject({ fullName: "Anna Schmidt", email: "anna@example.de" });
  });
  it("rejects a non-uuid user id", () =>
    expect(failedField(adminUpdateInvestorSchema.safeParse({ userId: "abc", fullName: "Anna Schmidt", email: "a@b.de" }))).toBe("userId"));
});
describe("adminSetPasswordSchema", () => {
  it("flags a mismatch on the confirmation", () =>
    expect(failedField(adminSetPasswordSchema.safeParse({ userId: IDEMPOTENCY_KEY, newPassword: "a".repeat(10), newPasswordConfirmation: "b".repeat(10) }))).toBe("newPasswordConfirmation"));
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/validation.test.ts` — expected FAIL (schemas undefined).
- [ ] **Step 3: Implement** the three schemas; extract the registration name rule into a shared `fullNameSchema` building block.
- [ ] **Step 4: Run** — PASS.

---

### Task 5: Account service

**Files:**
- Create: `src/server/services/account.ts`
- Modify: `src/server/auth/session.ts`, `src/server/rate-limit.ts`, `src/lib/errors.ts`, `src/i18n/messages/{de,en}.ts` (`domainErrors`)

**Interfaces:**
- Consumes: `verifyPassword`, `hashPassword` (`src/server/auth/password.ts`), `recordAudit`, `isUniqueViolation`, new `AuditAction`s (Task 2).
- Produces:
  - `getCurrentSessionId(): Promise<string | null>` in `session.ts` (hash of the cookie token, same hashing as today).
  - `rateLimitRules.passwordChangePerUser = { limit: 5, windowSeconds: 15 * 60 }`.
  - `DomainErrorCode` gains `"WRONG_PASSWORD"` (DE "Das aktuelle Passwort ist nicht korrekt." / EN "The current password is incorrect.").
  - `changeOwnPassword(input: { userId: string; currentPassword: string; newPassword: string; keepSessionId: string | null; ipAddress: string | null }): Promise<void>` — wrong current password: audit `auth.password_change_failed`, throw `DomainError("WRONG_PASSWORD")`, sessions untouched. Success, one transaction: new hash, delete the user's sessions except `keepSessionId`, audit `auth.password_changed`.
  - `updateInvestorProfile(input: { adminId: string; userId: string; fullName: string; email: string; ipAddress: string | null }): Promise<"updated" | "unchanged">` — `NOT_FOUND` unless the user exists with role `investor`; `EMAIL_TAKEN` on the email unique violation; `"unchanged"` writes nothing; `"updated"` audits `user.updated` with `entityType "user"`, `entityId userId`, metadata `{ investorName, investorCode, changes: { fullName?: { from, to }, email?: { from, to } } }`.
  - `setInvestorPassword(input: { adminId: string; userId: string; newPassword: string; ipAddress: string | null }): Promise<void>` — `NOT_FOUND` unless role `investor`; one transaction: new hash, delete **all** the investor's sessions, audit `user.password_reset` with metadata `{ investorName, investorCode }`.

- [ ] **Step 1: Write a scratch-DB verification script** (`account-service.check.ts` in the scratchpad) asserting:
  - wrong current password → throws `WRONG_PASSWORD`, an `auth.password_change_failed` row exists, session count unchanged;
  - correct change → the old password no longer verifies, the new one does; with sessions A (kept) and B, only A remains; audit metadata contains no `password` key at any depth;
  - `updateInvestorProfile` with ` Anna.Schmidt@Example.de ` (after schema parsing) for another investor's address → `EMAIL_TAKEN`; same values → `"unchanged"` and no new audit row; new name → `"updated"` with `changes.fullName.from/to`; the investor's session still resolves;
  - `updateInvestorProfile` / `setInvestorPassword` on the admin's id → `NOT_FOUND`;
  - `setInvestorPassword` → all the investor's sessions gone, new password verifies, audit row has `investorCode`.
- [ ] **Step 2: Run it** — expected FAIL (module missing).
- [ ] **Step 3: Implement** the session helper, rate-limit rule, error code (+ both dictionaries) and the service.
- [ ] **Step 4: Run the script** — all assertions pass. `npx tsc --noEmit` clean.

---

### Task 6: Server Actions

**Files:**
- Create: `src/actions/account.ts`

**Interfaces:**
- Consumes: Task 4 schemas, Task 5 service + `getCurrentSessionId`, `consumeRateLimits`, `rateLimitedState`, `toErrorState`, `validationErrorState`, `successState`, `errorState`, `readFormText`.
- Produces:
  - `changePasswordAction(previous: ActionState, formData: FormData): Promise<ActionState>` — `requireUser()`; rate limit key `password-change:user:<id>`; maps `WRONG_PASSWORD` to `fieldErrors.currentPassword`; success message `messages.profile.passwordChanged`. Never echoes password fields in `values`.
  - `updateInvestorAction(userId: string, previous: ActionState, formData: FormData): Promise<ActionState>` — `requireAdmin()`; maps `EMAIL_TAKEN` to `fieldErrors.email`; returns `messages.admin.investorDetail.saved` or `.unchanged`; echoes `fullName`/`email` in `values` on error; `revalidatePath("/admin", "layout")` on update.
  - `setInvestorPasswordAction(userId: string, previous: ActionState, formData: FormData): Promise<ActionState>` — `requireAdmin()`; success `messages.admin.investorDetail.passwordSet`.
  - Bind `userId` on the server with `action.bind(null, userId)`, as `admin.ts` does for review actions.

- [ ] **Step 1: Implement** the three actions following `src/actions/admin.ts` / `auth.ts`.
- [ ] **Step 2: Verify** `npx tsc --noEmit` and `npm run lint` — clean. (Behaviour is exercised end-to-end in Tasks 7, 8 and 10.)

---

### Task 7: Profile page (investor + admin)

**Files:**
- Create: `src/server/queries/account.ts`, `src/components/account/profile-view.tsx`, `src/components/account/change-password-form.tsx`, `src/app/(investor)/profile/page.tsx`, `src/app/admin/profile/page.tsx`
- Modify: `src/components/layout/user-chip.tsx`, `src/components/layout/app-shell.tsx`, `src/proxy.ts`, `src/i18n/messages/{de,en}.ts` (new `profile` section, `nav.profile`)

**Interfaces:**
- Consumes: `changePasswordAction` (Task 6).
- Produces: `getProfile(userId: string): Promise<{ fullName: string; email: string; investorCode: string | null; role: UserRole; createdAt: Date } | null>`; `<ProfileView profile={…} />` (server component rendering both cards); profile href per role: `"/profile"` / `"/admin/profile"` (export `profilePathForRole(role)` next to `homePathForRole` in `guards.ts`).
- Copy (DE / EN): page title "Profil" / "Profile"; cards "Kontodaten" / "Account details", "Passwort ändern" / "Change password"; fields "Anleger-ID" / "Investor ID", "Mitglied seit" / "Member since", "Aktuelles Passwort" / "Current password", "Neues Passwort" / "New password", "Neues Passwort bestätigen" / "Confirm new password"; hint (investors only) "Um Ihren Namen oder Ihre E-Mail-Adresse zu ändern, wenden Sie sich bitte an die Pool-Verwaltung." / "To change your name or email, please contact the pool administrator."; success "Ihr Passwort wurde geändert. Andere Geräte wurden abgemeldet." / "Your password has been changed. Other devices have been signed out."

- [ ] **Step 1: Implement** query, components (layout per the spec sketch, Aegis `Card`/`CardHeader`/`FormField`/`SubmitButton`/`ActionStateAlert`; ID shown in monospace `reference` style), both pages (`requireInvestor()` / `requireAdmin()`), the desktop `UserChip` as a link to the profile, a "Profil" link above language in the phone `AccountMenu`, `"/profile/:path*"` in the proxy matcher. The form resets after success (key the form on the success state).
- [ ] **Step 2: Verify on the clone (port 3100):** investor `/profile` shows ID, name, email, member-since and the hint; admin `/admin/profile` shows name/email, no ID, no hint; wrong current password → field error; valid change → success, sign-in with the new password works and the old one fails; a second browser context signed in as the same user is sent to `/login` on its next request. Guest visiting `/profile` → `/login`. Check DE + EN at 375 and 1280 px.

---

### Task 8: Admin investor detail page

**Files:**
- Create: `src/app/admin/investors/[userId]/page.tsx`, `src/components/admin/investor-profile-form.tsx`, `src/components/admin/investor-password-form.tsx`
- Modify: `src/server/queries/admin.ts` (`getInvestorDetail`, `listInvestors`), `src/components/admin/investor-table.tsx`, `src/i18n/messages/{de,en}.ts` (`admin.investorDetail`, `columns.investorId`)

**Interfaces:**
- Consumes: `updateInvestorAction`, `setInvestorPasswordAction` (Task 6), `normalizeInvestorCodeQuery` (Task 1).
- Produces: `getInvestorDetail(userId: string): Promise<{ id: string; fullName: string; email: string; investorCode: string; balanceCents: number; createdAt: Date; lastLoginAt: Date | null } | null>` — returns `null` for a non-uuid string (check with `z.uuid()` before querying) or a non-investor; `InvestorRow` gains `investorCode: string`; `listInvestors` search also matches `investor_code = normalizeInvestorCodeQuery(search)`.
- Copy (DE / EN): "Name & E-Mail" / "Name & email", "Neues Passwort festlegen" / "Set new password", saved "Änderungen gespeichert." / "Changes saved.", unchanged "Keine Änderungen." / "No changes.", password set "Neues Passwort gespeichert. Der Anleger wurde überall abgemeldet – teilen Sie ihm das neue Passwort mit." / "New password saved. The investor has been signed out everywhere – please pass the new password on to them.", back link "Alle Anleger" / "All investors".

- [ ] **Step 1: Implement** the query changes, the page (`requireAdmin()`; `notFound()` when `getInvestorDetail` returns `null`; header with name, ID, email; facts: balance, registered on, last sign-in; the two forms), investor-table "Anleger-ID" column and row links to `/admin/investors/<id>`.
- [ ] **Step 2: Verify on the clone:** `/admin/investors/abc` and `/admin/investors/<admin uuid>` → not-found page; list shows IDs; searching `01gr01`-style lower-case code finds the investor (top-bar search too); edit name → saved, list and the investor's header show it; edit email to another user's address in different case → field error "already in use"; unchanged submit → "No changes."; set password → investor's open session lands on `/login`, new password works.

---

### Task 9: Investor ID across admin views, CSV and activity log

**Files:**
- Create: `src/components/admin/investor-code.tsx`
- Modify: `src/server/queries/admin.ts` (`DepositReviewRow`, `WithdrawalReviewRow`, `AuditLogRow`), `src/server/queries/ledger.ts` (`LedgerRow`), `src/server/queries/reports.ts` (all four loaders), `src/server/services/reports.ts`, `src/components/admin/review-tables.tsx`, `src/components/admin/approval-queue.tsx`, `src/components/dashboard/payout-deadlines.tsx`, `src/components/transactions/transaction-table.tsx` (admin `showInvestor` mode), `src/components/admin/activity-log-table.tsx`, `src/i18n/messages/{de,en}.ts` (`csv.investorId`, `audit.actions.*`)

**Interfaces:**
- Consumes: `users.investorCode`.
- Produces: `<InvestorCode code={string | null} />` (renders nothing for null; monospace small label); `investorCode: string | null` on the review rows, `LedgerRow`, export rows; `actorInvestorCode: string | null` on `AuditLogRow`.
- CSV header `csv.investorId`: DE "Anleger-ID" / EN "Investor ID", inserted directly after the investor-name column in transactions, deposits, withdrawals and balances.
- Audit labels: `auth.password_changed` DE "Passwort geändert" / EN "Password changed"; `auth.password_change_failed` "Passwortänderung fehlgeschlagen" / "Password change failed"; `user.updated` "Anlegerdaten geändert" / "Investor details changed"; `user.password_reset` "Passwort durch Admin gesetzt" / "Password set by admin". `describeEntry` renders `changes.fullName` as "Name: from → to", `changes.email` as "E-Mail: from → to" (localised label), and `investorName (investorCode)` for `user.*` entries.

- [ ] **Step 1: Implement** the query fields, component and renders listed above.
- [ ] **Step 2: Unit-check the CSV** — extend an existing CSV test or add `src/server/services/reports.test.ts` only if the column builder is importable without a DB; otherwise verify by download in Step 3.
- [ ] **Step 3: Verify on the clone:** ID visible in deposit and withdrawal review tables, approval queue, latest pool entries, payout deadlines, activity-log actor column for investors; all four CSVs have the "Anleger-ID" column with correct values; activity log shows the four new actions with details and no password data.

---

### Task 10: Docs, spreadsheet and full verification

**Files:**
- Modify: `README.md`, `docs/Modules-and-Functions-by-Role.xlsx` (regenerate with the scratchpad builder script, updated content)

- [ ] **Step 1: README** — feature table (profile, password change, investor IDs, admin edit), activity-logging list (four new events), project structure (`components/account/`), a "Profile & account management" note: admin-set passwords replace the old one; the seed never changes an existing admin's password; run `npm run db:migrate` after updating.
- [ ] **Step 2: Spreadsheet** — add Profile rows to Investor and Admin tables, the investor detail module to Admin, ID mentions, new activity-log events; remove "read-only" / "cannot edit investors" statements; rebuild, re-run the cached-value injection and the formula check.
- [ ] **Step 3: Full checks** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass.
- [ ] **Step 4: Regression on the clone** — fresh registration lands on `/dashboard` with a zero balance and an investor ID on `/profile`, and can book a deposit immediately; Review Focus 5 end-to-end (investor signed in during admin name edit stays signed in and sees the new name; after admin password reset their next request goes to `/login`).
- [ ] **Step 5: Clean up** — drop the scratch DB, delete the clone and any `.playwright-mcp/` folder; report the migration command to the user.
