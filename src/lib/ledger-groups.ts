import type { LedgerEntryType } from "@/server/db/schema";

/**
 * Ledger filter groups, summed the same way as the account overview: deposits include their
 * fees and cancellations, withdrawals their fees and refunds.
 */
export const ENTRY_GROUPS = ["deposits", "returns", "withdrawals"] as const;
export type EntryGroup = (typeof ENTRY_GROUPS)[number];

export const ENTRY_GROUP_TYPES: Record<EntryGroup, readonly LedgerEntryType[]> = {
  deposits: ["deposit", "deposit_fee", "deposit_reversal", "promo_principal_return"],
  returns: ["monthly_return", "promo_return"],
  withdrawals: ["withdrawal", "withdrawal_fee", "withdrawal_reversal", "promo_transfer"],
};
