import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { normalizeInvestorCodeQuery } from "@/lib/investor-code";
import { DEFAULT_PAGE_SIZE, toPaginatedResult, type PaginatedResult } from "@/lib/pagination";
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
  type WithdrawalStatus,
} from "@/server/db/schema";
import { toContainsPattern } from "./filters";

const countAndSum = (amountColumn: AnyPgColumn) => ({
  count: sql<number>`count(*)`.mapWith(Number),
  totalCents: sql<number>`coalesce(sum(${amountColumn}), 0)`.mapWith(Number),
});

export async function getPoolOverview() {
  const db = getDb();
  const [[poolTotals], investorCount, [pendingDeposits], [pendingWithdrawals]] = await Promise.all([
    db.select({ balanceCents: sql<number>`coalesce(sum(${accounts.balanceCents}), 0)`.mapWith(Number) }).from(accounts),
    db.$count(users, eq(users.role, "investor")),
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
};

export type DepositReviewRow = {
  id: string;
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
};

export async function listDepositsForReview(
  options: ReviewListOptions<DepositStatus>,
): Promise<PaginatedResult<DepositReviewRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = options.status === "all" ? undefined : eq(deposits.status, options.status);
  // Open items are worked through oldest first; history is shown newest first.
  const order = options.status === "pending" ? asc(deposits.createdAt) : desc(deposits.createdAt);

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: deposits.id,
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
  const order = options.status === "pending" ? asc(withdrawals.createdAt) : desc(withdrawals.createdAt);

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: withdrawals.id,
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
  investorCode: string;
  fullName: string;
  email: string;
  balanceCents: number;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export async function listInvestors(options: {
  search?: string;
  page: number;
  pageSize?: number;
}): Promise<PaginatedResult<InvestorRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const searchTerm = options.search?.trim();
  const roleFilter = eq(users.role, "investor");
  const searchPattern = searchTerm ? toContainsPattern(searchTerm) : undefined;
  const filter: SQL | undefined = searchPattern
    ? and(
        roleFilter,
        or(
          ilike(users.fullName, searchPattern),
          ilike(users.email, searchPattern),
          ilike(users.investorCode, toContainsPattern(normalizeInvestorCodeQuery(options.search ?? ""))),
        ),
      )
    : roleFilter;

  const [rows, [{ totalCount }]] = await Promise.all([
    db
      .select({
        id: users.id,
        investorCode: sql<string>`${users.investorCode}`,
        fullName: users.fullName,
        email: users.email,
        balanceCents: accounts.balanceCents,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(filter)
      .orderBy(asc(users.fullName))
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

export type InvestorDetail = InvestorRow;

/** One investor for the admin detail page; `null` for an unknown id, a non-uuid string or a non-investor. */
export async function getInvestorDetail(userId: string): Promise<InvestorDetail | null> {
  // Postgres throws on an invalid uuid cast, so reject anything else before querying.
  if (!z.uuid().safeParse(userId).success) {
    return null;
  }
  const [row] = await getDb()
    .select({
      id: users.id,
      investorCode: sql<string>`${users.investorCode}`,
      fullName: users.fullName,
      email: users.email,
      balanceCents: accounts.balanceCents,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
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
}): Promise<PaginatedResult<AuditLogRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

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
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db.$count(auditLogs),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}
