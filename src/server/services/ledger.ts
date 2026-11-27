import "server-only";
import { randomBytes } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import type { DbTransaction } from "@/server/db/client";
import { accounts, ledgerEntries, type Account, type LedgerEntryType } from "@/server/db/schema";

/** Locks the investor's account row until the surrounding transaction ends (SELECT … FOR UPDATE). */
export async function lockAccountForUser(tx: DbTransaction, userId: string): Promise<Account> {
  const [account] = await tx.select().from(accounts).where(eq(accounts.userId, userId)).for("update");
  if (!account) {
    throw new DomainError("ACCOUNT_MISSING");
  }
  return account;
}

/** Every entry belongs to exactly one deposit, withdrawal or booked return month. */
type LedgerSource =
  | { depositId: string; withdrawalId?: never; returnPeriodId?: never; promoBookingId?: never }
  | { withdrawalId: string; depositId?: never; returnPeriodId?: never; promoBookingId?: never }
  | { returnPeriodId: string; depositId?: never; withdrawalId?: never; promoBookingId?: never }
  | { promoBookingId: string; depositId?: never; withdrawalId?: never; returnPeriodId?: never };

type LedgerPosting = {
  accountId: string;
  entryType: LedgerEntryType;
  /** Signed amount in cents: positive credits, negative debits. */
  amountCents: number;
  createdByUserId: string;
} & LedgerSource;

/**
 * The single code path that changes a balance. It locks the accounts (in id order), rejects any
 * posting that would overdraw one, appends the immutable ledger entries with the resulting
 * balances and updates the running balances, all within the caller's transaction, so
 * concurrent requests are serialised per account. Postings to the same account apply in the
 * given order. A batch takes three queries however many accounts it touches.
 */
export async function postLedgerEntries(tx: DbTransaction, postings: readonly LedgerPosting[]): Promise<void> {
  if (postings.length === 0) {
    return;
  }
  const accountIds = [...new Set(postings.map((posting) => posting.accountId))];
  const locked = await tx
    .select({ id: accounts.id, balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(inArray(accounts.id, accountIds))
    .orderBy(asc(accounts.id))
    .for("update");
  const balances = new Map(locked.map((account) => [account.id, account.balanceCents]));

  const entries = postings.map((posting) => {
    const balanceCents = balances.get(posting.accountId);
    if (balanceCents === undefined) {
      throw new DomainError("ACCOUNT_MISSING");
    }
    const balanceAfterCents = balanceCents + posting.amountCents;
    if (balanceAfterCents < 0) {
      throw new DomainError("INSUFFICIENT_FUNDS");
    }
    balances.set(posting.accountId, balanceAfterCents);
    return {
      accountId: posting.accountId,
      entryType: posting.entryType,
      amountCents: posting.amountCents,
      balanceAfterCents,
      depositId: posting.depositId ?? null,
      withdrawalId: posting.withdrawalId ?? null,
      returnPeriodId: posting.returnPeriodId ?? null,
      promoBookingId: posting.promoBookingId ?? null,
      createdByUserId: posting.createdByUserId,
    };
  });
  await tx.insert(ledgerEntries).values(entries);

  // Parameters arrive untyped, so they are cast: a CASE of untyped values would be text.
  const newBalances = sql.join(
    [...balances].map(([accountId, balanceCents]) => sql`when ${accountId}::uuid then ${balanceCents}::bigint`),
    sql` `,
  );
  await tx
    .update(accounts)
    .set({ balanceCents: sql`case ${accounts.id} ${newBalances} end`, updatedAt: new Date() })
    .where(inArray(accounts.id, accountIds));
}

export async function postLedgerEntry(tx: DbTransaction, posting: LedgerPosting): Promise<void> {
  await postLedgerEntries(tx, [posting]);
}

// Unambiguous characters only (no 0/O, 1/I). 32 symbols divide 256 evenly, so there is no modulo bias.
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly booking reference, e.g. "EZ-7KQ2M9XA" (EZ = Einzahlung, AZ = Auszahlung). */
export function generateReference(prefix: "EZ" | "AZ"): string {
  const suffix = Array.from(randomBytes(8), (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}
