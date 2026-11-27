import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { normalizeInvestorCodeQuery } from "@/lib/investor-code";
import { DEFAULT_PAGE_SIZE, toPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type { StatementPeriod } from "@/lib/statement-period";
import { getDb } from "@/server/db/client";
import type { PaymentMethod } from "@/lib/fees";
import {
  accounts,
  auditLogs,
  deposits,
  ledgerEntries,
  users,
  withdrawals,
  type AuditAction,
  type DepositStatus,
  type InvestorStatus,
  type WithdrawalStatus,
} from "@/server/db/schema";
import { toContainsPattern } from "./filters";
import { accountsWithStatementActivity } from "./statements";

const countAndSum = (amountColumn: AnyPgColumn) => ({
  count: sql<number>`count(*)`.mapWith(Number),
  totalCents: sql<number>`coalesce(sum(${amountColumn}), 0)`.mapWith(Number),
});

export async function getPoolOverview() {
  const db = getDb();
  const [[poolTotals], investorCount, [pendingDeposits], [pendingWithdrawals]] = await Promise.all([
    db.select({ balanceCents: sql<number>`coalesce(sum(${accounts.balanceCents}), 0)`.mapWith(Number) }).from(accounts),
    db.$count(users, and(eq(users.role, "investor"), isNull(users.deactivatedAt))),
    db.select(countAndSum(deposits.amountCents)).from(deposits).where(eq(deposits.status, "pending")),
    db.select(countAndSum(withdrawals.amountCents)).from(withdrawals).where(eq(withdrawals.status, "pending")),
  ]);

  return {
    poolBalanceCents: poolTotals.balanceCents,
    investorCount,
    pendingDeposits,
    pendingWithdrawals,
  };
}

/** Net change of all balances since `since`, and how many entries made it up. */
export async function getNetMovementSince(since: Date): Promise<{ netCents: number; entryCount: number }> {
  const [movement] = await getDb()
    .select({
      netCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)`.mapWith(Number),
      entryCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.createdAt} >= ${since.toISOString()}`);
  return movement;
}

/**
 * The README's consistency check: every account balance must equal the sum of its ledger
 * entries. Also counts accounts without money, for the admin overview.
 */
export async function getLedgerIntegrity(): Promise<{ mismatchedAccounts: number; zeroBalanceAccounts: number }> {
  const ledgerSum = sql`(select coalesce(sum(${ledgerEntries.amountCents}), 0) from ${ledgerEntries} where ${ledgerEntries.accountId} = ${accounts.id})`;
  const [integrity] = await getDb()
    .select({
      mismatchedAccounts: sql<number>`count(*) filter (where ${accounts.balanceCents} <> ${ledgerSum})`.mapWith(Number),
      zeroBalanceAccounts: sql<number>`count(*) filter (where ${accounts.balanceCents} = 0)`.mapWith(Number),
    })
    .from(accounts);
  return integrity;
}

/** Status filter for the review queues; "all" shows every record. */
export type ReviewFilter<Status extends string> = Status | "all";

type ReviewListOptions<Status extends string> = {
  status: ReviewFilter<Status>;
  page: number;
  pageSize?: number;
  /** Newest first unless asked otherwise (the payout-deadline card wants the oldest, most urgent requests). */
  order?: "oldestFirst" | "newestFirst";
};

function reviewOrder<Status extends string>(options: ReviewListOptions<Status>): "oldestFirst" | "newestFirst" {
  return options.order ?? "newestFirst";
}

export type DepositReviewRow = {
  id: string;
  accountId: string;
  createdAt: Date;
  amountCents: number;
  method: PaymentMethod;
  feeCents: number;
  reference: string;
  status: DepositStatus;
  receivedOn: string | null;
  investorName: string;
  investorCode: string | null;
  investorEmail: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  promoName: string | null;
  promoTermMonths: number | null;
};

export async function listDepositsForReview(
  options: ReviewListOptions<DepositStatus>,
): Promise<PaginatedResult<DepositReviewRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = options.status === "all" ? undefined : eq(deposits.status, options.status);
  const order = reviewOrder(options) === "oldestFirst" ? asc(deposits.createdAt) : desc(deposits.createdAt);

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: deposits.id,
        accountId: deposits.accountId,
        createdAt: deposits.createdAt,
        amountCents: deposits.amountCents,
        method: deposits.method,
        feeCents: deposits.feeCents,
        reference: deposits.reference,
        status: deposits.status,
        receivedOn: deposits.receivedOn,
        investorName: users.fullName,
        investorCode: users.investorCode,
        investorEmail: users.email,
        reviewedAt: deposits.reviewedAt,
        reviewNote: deposits.reviewNote,
        promoName: deposits.promoName,
        promoTermMonths: deposits.promoTermMonths,
      })
      .from(deposits)
      .innerJoin(accounts, eq(deposits.accountId, accounts.id))
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(filter)
      .orderBy(order)
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db.$count(deposits, filter),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}

export type WithdrawalReviewRow = {
  id: string;
  accountId: string;
  createdAt: Date;
  amountCents: number;
  method: PaymentMethod;
  feeCents: number;
  reference: string;
  iban: string | null;
  walletAddress: string | null;
  status: WithdrawalStatus;
  investorName: string;
  investorCode: string | null;
  investorEmail: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
};

export async function listWithdrawalsForReview(
  options: ReviewListOptions<WithdrawalStatus>,
): Promise<PaginatedResult<WithdrawalReviewRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = options.status === "all" ? undefined : eq(withdrawals.status, options.status);
  const order = reviewOrder(options) === "oldestFirst" ? asc(withdrawals.createdAt) : desc(withdrawals.createdAt);

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: withdrawals.id,
        accountId: withdrawals.accountId,
        createdAt: withdrawals.createdAt,
        amountCents: withdrawals.amountCents,
        method: withdrawals.method,
        feeCents: withdrawals.feeCents,
        reference: withdrawals.reference,
        iban: withdrawals.iban,
        walletAddress: withdrawals.walletAddress,
        status: withdrawals.status,
        investorName: users.fullName,
        investorCode: users.investorCode,
        investorEmail: users.email,
        reviewedAt: withdrawals.reviewedAt,
        reviewNote: withdrawals.reviewNote,
      })
      .from(withdrawals)
      .innerJoin(accounts, eq(withdrawals.accountId, accounts.id))
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(filter)
      .orderBy(order)
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db.$count(withdrawals, filter),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}

export type InvestorRow = {
  id: string;
  accountId: string;
  investorCode: string;
  fullName: string;
  email: string;
  balanceCents: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** `null` while the investor is active. */
  deactivatedAt: Date | null;
};

const investorRowColumns = {
  id: users.id,
  accountId: accounts.id,
  investorCode: sql<string>`${users.investorCode}`,
  fullName: users.fullName,
  email: users.email,
  balanceCents: accounts.balanceCents,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
  deactivatedAt: users.deactivatedAt,
};

const investorStatusFilters: Record<InvestorStatus, SQL> = {
  active: isNull(users.deactivatedAt),
  deactivated: isNotNull(users.deactivatedAt),
};

/** Status filter of the investor list, in tab order; the first ("all") is the default. */
export const INVESTOR_LIST_FILTERS: readonly (InvestorStatus | "all")[] = ["all", "active", "deactivated"];

type InvestorListFilter = { status: InvestorStatus | "all"; search?: string; period?: StatementPeriod };

/** Applies the same status, search and activity filters to table rows, pagination and exports. */
function investorListFilter({ status, search, period }: InvestorListFilter): SQL | undefined {
  const searchTerm = search?.trim();
  const searchPattern = searchTerm ? toContainsPattern(searchTerm) : undefined;
  return and(
    eq(users.role, "investor"),
    status === "all" ? undefined : investorStatusFilters[status],
    period ? inArray(accounts.id, accountsWithStatementActivity(period)) : undefined,
    searchPattern
      ? or(
          ilike(users.fullName, searchPattern),
          ilike(users.email, searchPattern),
          ilike(users.investorCode, toContainsPattern(normalizeInvestorCodeQuery(search ?? ""))),
        )
      : undefined,
  );
}

export async function listInvestors(
  options: InvestorListFilter & { page: number; pageSize?: number },
): Promise<PaginatedResult<InvestorRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = investorListFilter(options);

  const [rows, [{ totalCount }]] = await Promise.all([
    db
      .select(investorRowColumns)
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(filter)
      // Newest registrations first, like every other list.
      .orderBy(desc(users.createdAt), asc(users.fullName))
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db
      .select({ totalCount: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(filter),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}

/** Every investor matching the list's filter (all pages), by name like the other CSV exports. */
export async function listInvestorsForExport(filter: InvestorListFilter): Promise<InvestorRow[]> {
  return getDb()
    .select(investorRowColumns)
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(investorListFilter(filter))
    .orderBy(asc(users.fullName), asc(users.investorCode));
}

export type InvestorDetail = InvestorRow & {
  /** Deposits awaiting reconciliation plus withdrawals under review. */
  openRequestCount: number;
};

/** One investor for the admin detail page; `null` for an unknown id, a non-uuid string or a non-investor. */
export async function getInvestorDetail(userId: string): Promise<InvestorDetail | null> {
  // Postgres throws on an invalid uuid cast, so reject anything else before querying.
  if (!z.uuid().safeParse(userId).success) {
    return null;
  }
  const pendingDeposits = sql`(select count(*) from ${deposits} where ${deposits.accountId} = ${accounts.id} and ${deposits.status} = 'pending')`;
  const pendingWithdrawals = sql`(select count(*) from ${withdrawals} where ${withdrawals.accountId} = ${accounts.id} and ${withdrawals.status} = 'pending')`;
  const [row] = await getDb()
    .select({
      ...investorRowColumns,
      openRequestCount: sql<number>`${pendingDeposits} + ${pendingWithdrawals}`.mapWith(Number),
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(and(eq(users.id, userId), eq(users.role, "investor")))
    .limit(1);
  return row ?? null;
}

export type AuditLogRow = {
  id: number;
  createdAt: Date;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  actorName: string | null;
  actorInvestorCode: string | null;
  actorEmail: string | null;
};

export async function listAuditLogs(options: {
  page: number;
  pageSize?: number;
  /** Only what this user did themselves (an investor's own activity log). */
  actorUserId?: string;
}): Promise<PaginatedResult<AuditLogRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = options.actorUserId ? eq(auditLogs.actorUserId, options.actorUserId) : undefined;

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        actorName: users.fullName,
        actorInvestorCode: users.investorCode,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db.$count(auditLogs, where),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}

/**
 * Everything the activity log holds about one investor, newest first: what they did, what was done to their account
 * (edits, status changes), decisions on their deposits and withdrawals, and booked months they received a return in.
 */

/** How many deposits and withdrawal requests an account has in total (for "newest 50 of N"). */
export async function countAccountRequests(accountId: string): Promise<{ deposits: number; withdrawals: number }> {
  const db = getDb();
  const [depositCount, withdrawalCount] = await Promise.all([
    db.$count(deposits, eq(deposits.accountId, accountId)),
    db.$count(withdrawals, eq(withdrawals.accountId, accountId)),
  ]);
  return { deposits: depositCount, withdrawals: withdrawalCount };
}
