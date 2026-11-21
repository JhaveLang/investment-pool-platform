import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { accounts, deposits, ledgerEntries, returnPeriods, users, withdrawals } from "@/server/db/schema";
import { createdWithinRange, type DateRange } from "./filters";
import { ledgerReference } from "./ledger";

// Full (unpaginated) datasets for CSV exports, always in ascending date order.

export async function loadLedgerExportRows(range: DateRange) {
  return getDb()
    .select({
      id: ledgerEntries.id,
      createdAt: ledgerEntries.createdAt,
      investorName: users.fullName,
      investorCode: users.investorCode,
      investorEmail: users.email,
      entryType: ledgerEntries.entryType,
      amountCents: ledgerEntries.amountCents,
      balanceAfterCents: ledgerEntries.balanceAfterCents,
      reference: ledgerReference,
    })
    .from(ledgerEntries)
    .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
    .innerJoin(users, eq(accounts.userId, users.id))
    .leftJoin(deposits, eq(ledgerEntries.depositId, deposits.id))
    .leftJoin(withdrawals, eq(ledgerEntries.withdrawalId, withdrawals.id))
    .leftJoin(returnPeriods, eq(ledgerEntries.returnPeriodId, returnPeriods.id))
    .where(createdWithinRange(ledgerEntries.createdAt, range))
    .orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id));
}

export async function loadDepositExportRows(range: DateRange) {
  return getDb()
    .select({
      createdAt: deposits.createdAt,
      reference: deposits.reference,
      investorName: users.fullName,
      investorCode: users.investorCode,
      investorEmail: users.email,
      amountCents: deposits.amountCents,
      method: deposits.method,
      feeCents: deposits.feeCents,
      status: deposits.status,
      receivedOn: deposits.receivedOn,
      reviewedAt: deposits.reviewedAt,
      reviewNote: deposits.reviewNote,
    })
    .from(deposits)
    .innerJoin(accounts, eq(deposits.accountId, accounts.id))
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(createdWithinRange(deposits.createdAt, range))
    .orderBy(asc(deposits.createdAt));
}

export async function loadWithdrawalExportRows(range: DateRange) {
  return getDb()
    .select({
      createdAt: withdrawals.createdAt,
      reference: withdrawals.reference,
      investorName: users.fullName,
      investorCode: users.investorCode,
      investorEmail: users.email,
      amountCents: withdrawals.amountCents,
      method: withdrawals.method,
      feeCents: withdrawals.feeCents,
      iban: withdrawals.iban,
      walletAddress: withdrawals.walletAddress,
      status: withdrawals.status,
      reviewedAt: withdrawals.reviewedAt,
      reviewNote: withdrawals.reviewNote,
    })
    .from(withdrawals)
    .innerJoin(accounts, eq(withdrawals.accountId, accounts.id))
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(createdWithinRange(withdrawals.createdAt, range))
    .orderBy(asc(withdrawals.createdAt));
}

export async function loadBalanceExportRows() {
  return getDb()
    .select({
      investorName: users.fullName,
      investorCode: users.investorCode,
      investorEmail: users.email,
      balanceCents: accounts.balanceCents,
      registeredAt: users.createdAt,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .orderBy(asc(users.fullName));
}
