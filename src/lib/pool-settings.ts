import type { Locale } from "@/i18n/config";
import { maxWithdrawalPayoutCents, type PaymentMethod } from "./fees";
import { MIN_TRANSACTION_CENTS } from "./money";

/** Longest notice the admin can write for the deposit and withdrawal pages, per language. */
export const MAX_POOL_NOTICE_LENGTH = 500;

// Withdrawals can't be blocked through their limits: the minimum stays low and the maximum stays usable.
export const HIGHEST_WITHDRAWAL_MIN_CENTS = 10_000; // 100,00 €
export const LOWEST_WITHDRAWAL_MAX_CENTS = 100_000; // 1.000,00 €

/** What the admin sets on the pool page. */
export type PoolSettings = {
  /** Closed: no new deposits. Submitted ones can still be reconciled, and withdrawals stay possible. */
  depositsOpen: boolean;
  depositMinCents: number;
  depositMaxCents: number;
  withdrawalMinCents: number;
  withdrawalMaxCents: number;
  noticeDe: string | null;
  noticeEn: string | null;
};

/** Limits of one request, for the amount the investor enters. */
export type AmountLimits = { minCents: number; maxCents: number };

export function limitViolation(amountCents: number, limits: AmountLimits): "tooSmall" | "tooLarge" | null {
  if (amountCents < limits.minCents) {
    return "tooSmall";
  }
  return amountCents > limits.maxCents ? "tooLarge" : null;
}

export function depositLimits(settings: Pick<PoolSettings, "depositMinCents" | "depositMaxCents">): AmountLimits {
  return { minCents: settings.depositMinCents, maxCents: settings.depositMaxCents };
}

/**
 * An investor with less than the minimum left can still take out all of it (the payout fee on top must fit). With
 * nothing left, only the outer minimum applies, so a repeated submit of that last payout isn't refused as too small.
 */
export function withdrawalLimits(
  settings: Pick<PoolSettings, "withdrawalMinCents" | "withdrawalMaxCents">,
  availableCents: number,
  method: PaymentMethod,
): AmountLimits {
  const maxPayoutCents = maxWithdrawalPayoutCents(availableCents, method);
  return {
    minCents: Math.min(settings.withdrawalMinCents, Math.max(maxPayoutCents, MIN_TRANSACTION_CENTS)),
    maxCents: settings.withdrawalMaxCents,
  };
}

/** The notice in the visitor's language, or in the other one when only that was written. */
export function poolNotice(settings: Pick<PoolSettings, "noticeDe" | "noticeEn">, locale: Locale): string | null {
  return locale === "en" ? (settings.noticeEn ?? settings.noticeDe) : (settings.noticeDe ?? settings.noticeEn);
}
