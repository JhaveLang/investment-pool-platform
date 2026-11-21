import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import type { DbTransaction } from "@/server/db/client";
import { accounts, ledgerEntries, type Account, type LedgerEntry, type LedgerEntryType } from "@/server/db/schema";

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
  | { depositId: string; withdrawalId?: never; returnPeriodId?: never }
  | { withdrawalId: string; depositId?: never; returnPeriodId?: never }
  | { returnPeriodId: string; depositId?: never; withdrawalId?: never };

type LedgerPosting = {
  accountId: string;
  entryType: LedgerEntryType;
  /** Signed amount in cents: positive credits, negative debits. */
  amountCents: number;
  createdByUserId: string;
} & LedgerSource;

/**
 * The single code path that changes a balance. It locks the account, rejects any
 * posting that would overdraw it, appends the immutable ledger entry with the
 * resulting balance and updates the running balance, all within the caller's
 * transaction, so concurrent requests are serialised per account.
 */
export async function postLedgerEntry(tx: DbTransaction, posting: LedgerPosting): Promise<LedgerEntry> {
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, posting.accountId)).for("update");
  if (!account) {
    throw new DomainError("ACCOUNT_MISSING");
  }

  const balanceAfterCents = account.balanceCents + posting.amountCents;
  if (balanceAfterCents < 0) {
    throw new DomainError("INSUFFICIENT_FUNDS");
  }

  const [entry] = await tx
    .insert(ledgerEntries)
    .values({
      accountId: account.id,
      entryType: posting.entryType,
      amountCents: posting.amountCents,
      balanceAfterCents,
      depositId: posting.depositId ?? null,
      withdrawalId: posting.withdrawalId ?? null,
      returnPeriodId: posting.returnPeriodId ?? null,
      createdByUserId: posting.createdByUserId,
    })
    .returning();

  await tx
    .update(accounts)
    .set({ balanceCents: balanceAfterCents, updatedAt: new Date() })
    .where(eq(accounts.id, account.id));

  return entry;
}

// Unambiguous characters only (no 0/O, 1/I). 32 symbols divide 256 evenly, so there is no modulo bias.
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly booking reference, e.g. "EZ-7KQ2M9XA" (EZ = Einzahlung, AZ = Auszahlung). */
export function generateReference(prefix: "EZ" | "AZ"): string {
  const suffix = Array.from(randomBytes(8), (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}
