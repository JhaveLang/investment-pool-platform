import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
// Relative import: drizzle-kit loads this file without the "@/" path alias.
import { PAYMENT_METHODS } from "../../lib/fees";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["investor", "admin"]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "deposit",
  "withdrawal",
  "deposit_reversal",
  "withdrawal_reversal",
  "deposit_fee",
  "withdrawal_fee",
  "monthly_return",
]);

export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);

export const depositStatusEnum = pgEnum("deposit_status", ["pending", "reconciled", "rejected"]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected"]);

export type AuditAction =
  | "auth.registered"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "deposit.created"
  | "deposit.reconciled"
  | "deposit.rejected"
  | "withdrawal.requested"
  | "withdrawal.approved"
  | "withdrawal.rejected"
  | "returns.booked"
  | "report.exported"
  | "auth.password_changed"
  | "auth.password_change_failed"
  | "user.updated"
  | "user.password_reset"
  | "user.created"
  | "user.deactivated"
  | "user.activated"
  | "auth.login_blocked";

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Money is always stored as integer cents to avoid floating point rounding. */
const cents = (columnName: string) => bigint(columnName, { mode: "number" });

// ---------------------------------------------------------------------------
// Identity & sessions
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    /** Permanent public investor ID like 01GR01; null only for non-investors. */
    investorCode: varchar("investor_code", { length: 6 }).unique("users_investor_code_unique"),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("investor"),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Set while an admin has deactivated the investor: no sign-in, no sessions. Their money is untouched. */
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    check("users_investor_code_format", sql`${table.investorCode} ~ '^[0-9]{2}[A-HJ-NP-Z]{2}[0-9]{2}$'`),
    check("users_investor_code_required", sql`${table.role} <> 'investor' OR ${table.investorCode} IS NOT NULL`),
    check("users_only_investors_deactivated", sql`${table.role} = 'investor' OR ${table.deactivatedAt} IS NULL`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hash of the random cookie token; the raw token is never stored. */
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    /** Denormalised running balance; always equals the sum of the account's ledger entries. */
    balanceCents: cents("balance_cents").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("accounts_balance_non_negative", sql`${table.balanceCents} >= 0`)],
);

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    /** Amount the investor sends (gross). */
    amountCents: cents("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull(),
    /** Taken from the amount received (bank 2 %, exchange 3 %); the account is credited amount − fee. */
    feeCents: cents("fee_cents").notNull(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    status: depositStatusEnum("status").notNull().default("pending"),
    /** Day the payment arrived, entered when reconciling. Returns accrue from 7 days after it. */
    receivedOn: date("received_on", { mode: "string" }),
    /** When amount and fee were booked to the ledger: on reconciliation (before 2026-11-23: on submission). */
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    /** Generated per form render; prevents double bookings from repeated submits. */
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewNote: varchar("review_note", { length: 500 }),
  },
  (table) => [
    check("deposits_amount_positive", sql`${table.amountCents} > 0`),
    check("deposits_fee_range", sql`${table.feeCents} >= 0 and ${table.feeCents} < ${table.amountCents}`),
    check(
      "deposits_received_when_reconciled",
      sql`(${table.status} = 'reconciled') = (${table.receivedOn} is not null)`,
    ),
    check("deposits_credited_when_reconciled", sql`${table.status} <> 'reconciled' or ${table.creditedAt} is not null`),
    uniqueIndex("deposits_account_idempotency_idx").on(table.accountId, table.idempotencyKey),
    index("deposits_account_created_idx").on(table.accountId, table.createdAt),
    index("deposits_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    /** Amount paid out to the investor, in full. */
    amountCents: cents("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull(),
    /** Added on top of the payout (bank 2 %, exchange 3 %, grossed up); the account is debited amount + fee. */
    feeCents: cents("fee_cents").notNull(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    /** Payout destination: an IBAN for bank transfers, a wallet address for crypto and exchange payouts. */
    iban: varchar("iban", { length: 34 }),
    walletAddress: varchar("wallet_address", { length: 128 }),
    status: withdrawalStatusEnum("status").notNull().default("pending"),
    /** When payout and fee were booked to the ledger: on approval (before 2026-11-23: on request). */
    debitedAt: timestamp("debited_at", { withTimezone: true }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: createdAt(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewNote: varchar("review_note", { length: 500 }),
  },
  (table) => [
    check("withdrawals_amount_positive", sql`${table.amountCents} > 0`),
    check("withdrawals_debited_when_approved", sql`${table.status} <> 'approved' or ${table.debitedAt} is not null`),
    check("withdrawals_fee_non_negative", sql`${table.feeCents} >= 0`),
    check(
      "withdrawals_single_destination",
      sql`num_nonnulls(${table.iban}, ${table.walletAddress}) = 1 and (${table.method} = 'bank_transfer') = (${table.iban} is not null)`,
    ),
    uniqueIndex("withdrawals_account_idempotency_idx").on(table.accountId, table.idempotencyKey),
    index("withdrawals_account_created_idx").on(table.accountId, table.createdAt),
    index("withdrawals_status_created_idx").on(table.status, table.createdAt),
  ],
);

/**
 * One row per booked month. The admin enters the pool's result for the previous month and
 * every account receives it on its day-weighted capital. Append-only, like the ledger.
 */
export const returnPeriods = pgTable(
  "return_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** First day of the booked month, e.g. 2026-10-01 for October 2026. */
    periodStart: date("period_start", { mode: "string" }).notNull().unique(),
    /** Monthly result in parts per million of the capital (2,35 % = 23 500); negative for a loss. */
    ratePpm: integer("rate_ppm").notNull(),
    /** Sum of all return entries booked for the month. */
    totalCents: cents("total_cents").notNull(),
    accountCount: integer("account_count").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    check("return_periods_rate_range", sql`${table.ratePpm} > -1000000 and ${table.ratePpm} <= 1000000`),
    check("return_periods_first_of_month", sql`extract(day from ${table.periodStart}) = 1`),
  ],
);

/**
 * Append-only ledger: every money movement is one immutable row holding the signed
 * amount and the resulting balance. UPDATE/DELETE are blocked by a database trigger
 * (see the `append_only_tables` migration); corrections are new reversal entries.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    entryType: ledgerEntryTypeEnum("entry_type").notNull(),
    /** Signed amount: credits are positive, debits negative. */
    amountCents: cents("amount_cents").notNull(),
    balanceAfterCents: cents("balance_after_cents").notNull(),
    depositId: uuid("deposit_id").references(() => deposits.id),
    withdrawalId: uuid("withdrawal_id").references(() => withdrawals.id),
    returnPeriodId: uuid("return_period_id").references(() => returnPeriods.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    check("ledger_entries_amount_non_zero", sql`${table.amountCents} <> 0`),
    check("ledger_entries_balance_non_negative", sql`${table.balanceAfterCents} >= 0`),
    check(
      "ledger_entries_single_source",
      sql`num_nonnulls(${table.depositId}, ${table.withdrawalId}, ${table.returnPeriodId}) = 1`,
    ),
    index("ledger_entries_account_created_idx").on(table.accountId, table.createdAt, table.id),
    /** Each account receives at most one return per booked month. */
    uniqueIndex("ledger_entries_account_return_period_idx")
      .on(table.accountId, table.returnPeriodId)
      .where(sql`${table.returnPeriodId} is not null`),
    index("ledger_entries_created_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Activity logging (append-only, protected by the same trigger as the ledger)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 64 }).$type<AuditAction>().notNull(),
    entityType: varchar("entity_type", { length: 32 }),
    entityId: varchar("entity_id", { length: 64 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: createdAt(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt), index("audit_logs_actor_idx").on(table.actorUserId)],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
/** Derived from `users.deactivated_at` (null = active). */
export type InvestorStatus = "active" | "deactivated";
export type Account = typeof accounts.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type DepositStatus = (typeof depositStatusEnum.enumValues)[number];
export type Withdrawal = typeof withdrawals.$inferSelect;
export type WithdrawalStatus = (typeof withdrawalStatusEnum.enumValues)[number];
export type ReturnPeriod = typeof returnPeriods.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type LedgerEntryType = (typeof ledgerEntryTypeEnum.enumValues)[number];
