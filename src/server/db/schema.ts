import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
  "promo_return",
  "promo_transfer",
  "promo_principal_return",
]);

export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);

export const depositStatusEnum = pgEnum("deposit_status", ["pending", "reconciled", "rejected"]);

export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected"]);
export const promoBookingStatusEnum = pgEnum("promo_booking_status", ["pending", "booked", "rejected", "matured"]);

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
  | "auth.login_blocked"
  | "news.created"
  | "news.updated"
  | "news.deleted"
  | "pool.settings_updated"
  | "promotion.created"
  | "promotion.updated"
  | "promotion.maturity_paid"
  | "promo_booking.requested"
  | "promo_booking.processed"
  | "promo_booking.rejected"
  | "promo_booking.confirmation_sent"
  | "promo_booking.matured";

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
    /** Public investor ID like 01GR01 or INV-0042, editable by the admin; null only for non-investors. */
    investorCode: varchar("investor_code", { length: 20 }).unique("users_investor_code_unique"),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("investor"),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Set while an admin has deactivated the investor: no sign-in, no sessions. Their money is untouched. */
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    // Same rule as INVESTOR_CODE_PATTERN in src/lib/investor-code.ts.
    check("users_investor_code_format", sql`${table.investorCode} ~ '^[A-Z0-9-]{6,20}$'`),
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


/** Fixed-return offer terms used to validate enrollments and calculate maturity credits. */
export const promoOffers = pgTable(
  "promo_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    bookingUntil: date("booking_until", { mode: "string" }).notNull(),
    minDepositCents: cents("min_deposit_cents").notNull(),
    maxDepositCents: cents("max_deposit_cents").notNull(),
    termMonths: integer("term_months").notNull(),
    totalReturnBps: integer("total_return_bps").notNull(),
    details: text("details").notNull().default(""),
    visible: boolean("visible").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("promo_offers_visible_booking_idx").on(table.visible, table.bookingUntil),
    check("promo_offers_name_length", sql`char_length(${table.name}) between 1 and 100`),
    check("promo_offers_deposit_limits", sql`${table.minDepositCents} > 0 and ${table.minDepositCents} <= ${table.maxDepositCents}`),
    check("promo_offers_term_months", sql`${table.termMonths} between 1 and 120`),
    check("promo_offers_return_range", sql`${table.totalReturnBps} between 0 and 10000`),
    check("promo_offers_details_length", sql`char_length(${table.details}) <= 2000`),
  ],
);

/** A requested transfer from the standard pool into a fixed-return promo. */
export const promoBookings = pgTable(
  "promo_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    promoOfferId: uuid("promo_offer_id").notNull().references(() => promoOffers.id),
    promoName: varchar("promo_name", { length: 100 }).notNull(),
    amountCents: cents("amount_cents").notNull(),
    termMonths: integer("term_months").notNull(),
    totalReturnBps: integer("total_return_bps").notNull(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    status: promoBookingStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    maturityOn: date("maturity_on", { mode: "string" }),
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewNote: varchar("review_note", { length: 500 }),
  },
  (table) => [
    uniqueIndex("promo_bookings_account_idempotency_idx").on(table.accountId, table.idempotencyKey),
    index("promo_bookings_status_requested_idx").on(table.status, table.requestedAt),
    check("promo_bookings_amount_whole_euros", sql`${table.amountCents} > 0 and ${table.amountCents} % 100 = 0`),
    check("promo_bookings_term_months", sql`${table.termMonths} between 1 and 120`),
    check("promo_bookings_return_range", sql`${table.totalReturnBps} between 1 and 10000`),
    check("promo_bookings_processed_fields", sql`(${table.status} in ('booked', 'matured')) = (${table.processedAt} is not null) and (${table.status} in ('booked', 'matured')) = (${table.maturityOn} is not null)`),
    check("promo_bookings_confirmation_after_request", sql`${table.confirmationSentAt} is null or ${table.confirmationSentAt} >= ${table.requestedAt}`),
  ],
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
    /** A selected fixed-return offer; null means this is a standard pool deposit. */
    promoOfferId: uuid("promo_offer_id").references(() => promoOffers.id),
    /** Terms copied at booking so later offer edits cannot change an investor's agreement. */
    promoName: varchar("promo_name", { length: 100 }),
    promoTermMonths: integer("promo_term_months"),
    promoTotalReturnBps: integer("promo_total_return_bps"),
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
    check("deposits_promo_terms_snapshot", sql`(${table.promoOfferId} is null and ${table.promoName} is null and ${table.promoTermMonths} is null and ${table.promoTotalReturnBps} is null) or (${table.promoOfferId} is not null and ${table.promoName} is not null and ${table.promoTermMonths} is not null and ${table.promoTermMonths} between 1 and 120 and ${table.promoTotalReturnBps} is not null and ${table.promoTotalReturnBps} between 1 and 10000)`),
    check(
      "deposits_received_when_reconciled",
      sql`(${table.status} = 'reconciled') = (${table.receivedOn} is not null)`,
    ),
    check("deposits_credited_when_reconciled", sql`${table.status} <> 'reconciled' or ${table.creditedAt} is not null`),
    uniqueIndex("deposits_account_idempotency_idx").on(table.accountId, table.idempotencyKey),
    index("deposits_account_created_idx").on(table.accountId, table.createdAt),
    index("deposits_status_created_idx").on(table.status, table.createdAt),
    /** The activity log names its entity by id as text; live updates look the deposit up by it. */
    index("deposits_id_text_idx").on(sql`(${table.id}::text)`),
    index("deposits_promo_offer_id_idx").on(table.promoOfferId),
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
    /** The activity log names its entity by id as text; live updates look the withdrawal up by it. */
    index("withdrawals_id_text_idx").on(sql`(${table.id}::text)`),
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
    /** The activity log names its entity by id as text; live updates look the booked month up by it. */
    index("return_periods_id_text_idx").on(sql`(${table.id}::text)`),
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
    promoBookingId: uuid("promo_booking_id").references(() => promoBookings.id),
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
      sql`num_nonnulls(${table.depositId}, ${table.withdrawalId}, ${table.returnPeriodId}, ${table.promoBookingId}) = 1`,
    ),
    index("ledger_entries_account_created_idx").on(table.accountId, table.createdAt, table.id),
    /** Each account receives at most one return per booked month. */
    uniqueIndex("ledger_entries_account_return_period_idx")
      .on(table.accountId, table.returnPeriodId)
      .where(sql`${table.returnPeriodId} is not null`),
    /** Exactly one maturity return can be posted for a promotional deposit. */
    uniqueIndex("ledger_entries_promo_return_deposit_idx")
      .on(table.depositId)
      .where(sql`${table.entryType} = 'promo_return'`),
    uniqueIndex("ledger_entries_promo_booking_type_idx")
      .on(table.promoBookingId, table.entryType)
      .where(sql`${table.promoBookingId} is not null`),
    /** A booked month's entries, e.g. for its live update; the index above leads with the account. */
    index("ledger_entries_return_period_idx")
      .on(table.returnPeriodId)
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
// Public website
// ---------------------------------------------------------------------------

/** Notices on the public News page, written by the admin. Not money data, so they can be edited and deleted. */
export const newsEntries = pgTable(
  "news_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The date shown with the notice; the website lists notices newest first. */
    publishedOn: date("published_on", { mode: "string" }).notNull(),
    textDe: text("text_de").notNull(),
    /** Optional; the English website shows the German text when it is missing. */
    textEn: text("text_en"),
    /** Hidden notices stay in the admin list but are not shown on the website. */
    visible: boolean("visible").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same date: the notice added later comes first.
    index("news_entries_published_idx").on(table.publishedOn.desc(), table.createdAt.desc()),
    check("news_entries_text_de_length", sql`char_length(${table.textDe}) between 1 and 500`),
    check(
      "news_entries_text_en_length",
      sql`${table.textEn} IS NULL OR char_length(${table.textEn}) between 1 and 500`,
    ),
  ],
);


// ---------------------------------------------------------------------------
// Pool settings
// ---------------------------------------------------------------------------

/** One row (id 1, created by its migration) with what the admin sets on the pool page; see `src/lib/pool-settings.ts`. */
export const poolSettings = pgTable(
  "pool_settings",
  {
    id: integer("id").primaryKey().default(1),
    depositsOpen: boolean("deposits_open").notNull().default(true),
    depositsFrom: date("deposits_from", { mode: "string" }),
    depositsUntil: date("deposits_until", { mode: "string" }),
    depositMinCents: cents("deposit_min_cents").notNull(),
    depositMaxCents: cents("deposit_max_cents").notNull(),
    withdrawalMinCents: cents("withdrawal_min_cents").notNull(),
    withdrawalMaxCents: cents("withdrawal_max_cents").notNull(),
    noticeDe: text("notice_de"),
    noticeEn: text("notice_en"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("pool_settings_single_row", sql`${table.id} = 1`),
    check("pool_settings_deposit_dates", sql`${table.depositsFrom} <= ${table.depositsUntil}`),
    check(
      "pool_settings_deposit_limits",
      sql`${table.depositMinCents} > 0 and ${table.depositMinCents} <= ${table.depositMaxCents}`,
    ),
    // Withdrawals can't be blocked through their limits.
    check(
      "pool_settings_withdrawal_limits",
      sql`${table.withdrawalMinCents} between 1 and 10000 and ${table.withdrawalMaxCents} >= 100000`,
    ),
    check(
      "pool_settings_notice_de_length",
      sql`${table.noticeDe} IS NULL OR char_length(${table.noticeDe}) between 1 and 500`,
    ),
    check(
      "pool_settings_notice_en_length",
      sql`${table.noticeEn} IS NULL OR char_length(${table.noticeEn}) between 1 and 500`,
    ),
  ],
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
export type NewsEntry = typeof newsEntries.$inferSelect;
export type PromoOffer = typeof promoOffers.$inferSelect;
export type PromoBooking = typeof promoBookings.$inferSelect;
export type PromoBookingStatus = (typeof promoBookingStatusEnum.enumValues)[number];
export type PoolSettingsRow = typeof poolSettings.$inferSelect;
