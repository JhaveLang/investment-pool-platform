import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { PaymentMethod } from "@/lib/fees";
import { ENTRY_GROUP_TYPES, type EntryGroup } from "@/lib/ledger-groups";
import { DEFAULT_PAGE_SIZE, toPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { getDb } from "@/server/db/client";
import {
  accounts,
  deposits,
  ledgerEntries,
  promoBookings,
  returnPeriods,
  users,
  withdrawals,
  type DepositStatus,
  type LedgerEntryType,
  type WithdrawalStatus,
} from "@/server/db/schema";

/**
 * Booking reference of a ledger entry: the deposit's or withdrawal's reference, or
 * "RD-2026-10" (Rendite) for a monthly return. Needs those three tables left-joined.
 */
export const ledgerReference = sql<string | null>`coalesce(
  ${deposits.reference},
  ${withdrawals.reference},
  ${promoBookings.reference},
  'RD-' || to_char(${returnPeriods.periodStart}, 'YYYY-MM')
)`;

export type SortOrder = "asc" | "desc";

export type LedgerRow = {
  id: number;
  createdAt: Date;
  entryType: LedgerEntryType;
  amountCents: number;
  balanceAfterCents: number;
  reference: string | null;
  investorName: string;
  investorCode: string | null;
  /** Payment method of the deposit or withdrawal behind the entry; `null` for returns. */
  method: PaymentMethod | null;
  depositStatus: DepositStatus | null;
  withdrawalStatus: WithdrawalStatus | null;
};

type ListLedgerOptions = {
  /** Restricts the ledger to one investor; omitted for the pool-wide admin view. */
  accountId?: string;
  /** Only entries of one filter group (deposits, returns or withdrawals). */
  group?: EntryGroup;
  page: number;
  pageSize?: number;
  order?: SortOrder;
};

/** Paginated ledger in date order, newest first by default. */
export async function listLedgerEntries(options: ListLedgerOptions): Promise<PaginatedResult<LedgerRow>> {
  const db = getDb();
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filter = and(
    options.accountId ? eq(ledgerEntries.accountId, options.accountId) : undefined,
    options.group ? inArray(ledgerEntries.entryType, [...ENTRY_GROUP_TYPES[options.group]]) : undefined,
  );
  const direction = options.order === "asc" ? asc : desc;

  const [rows, totalCount] = await Promise.all([
    db
      .select({
        id: ledgerEntries.id,
        createdAt: ledgerEntries.createdAt,
        entryType: ledgerEntries.entryType,
        amountCents: ledgerEntries.amountCents,
        balanceAfterCents: ledgerEntries.balanceAfterCents,
        reference: ledgerReference,
        investorName: users.fullName,
        investorCode: users.investorCode,
        method: sql<PaymentMethod | null>`coalesce(${deposits.method}, ${withdrawals.method})`,
        depositStatus: deposits.status,
        withdrawalStatus: withdrawals.status,
      })
      .from(ledgerEntries)
      .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
      .innerJoin(users, eq(accounts.userId, users.id))
      .leftJoin(deposits, eq(ledgerEntries.depositId, deposits.id))
      .leftJoin(withdrawals, eq(ledgerEntries.withdrawalId, withdrawals.id))
      .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
      .leftJoin(promoBookings, eq(ledgerEntries.promoBookingId, promoBookings.id))
      .where(filter)
      .orderBy(direction(ledgerEntries.createdAt), direction(ledgerEntries.id))
      .limit(pageSize)
      .offset((options.page - 1) * pageSize),
    db.$count(ledgerEntries, filter),
  ]);

  return toPaginatedResult(rows, totalCount, options.page, pageSize);
}

export type EntryGroupCounts = Record<EntryGroup | "all", number>;

/** Number of entries per filter group, for the counts on the filter chips. */
export async function countLedgerGroups(accountId?: string): Promise<EntryGroupCounts> {
  const db = getDb();
  const accountFilter = accountId ? eq(ledgerEntries.accountId, accountId) : undefined;
  const countGroup = (group: EntryGroup) =>
    db.$count(ledgerEntries, and(accountFilter, inArray(ledgerEntries.entryType, [...ENTRY_GROUP_TYPES[group]])));
  const [all, deposits, returns, withdrawals] = await Promise.all([
    db.$count(ledgerEntries, accountFilter),
    countGroup("deposits"),
    countGroup("returns"),
    countGroup("withdrawals"),
  ]);
  return { all, deposits, returns, withdrawals };
}
