export const MAX_PROMO_DETAILS_LENGTH = 2_000;
export const MIN_STANDARD_POOL_BALANCE_CENTS = 100_000;
export const PROMO_TRANSFER_PROCESSING_DAYS = 7;
export const PROMO_CONFIRMATION_DEADLINE_DAYS = 10;

type StandardPoolFunds = {
  balanceCents: number;
  lockedCents: number;
  reservedCents: number;
  pendingPromoCents: number;
};

export function isPromoBookable(offer: { visible: boolean; bookingUntil: string }, today: string) {
  return offer.visible && offer.bookingUntil >= today;
}

export function availableForFixedIncomesCents(pool: StandardPoolFunds, limitCents = Infinity): number {
  // Start from the total balance. The withdrawable balance may already exclude the reserve.
  const unlockedCents = pool.balanceCents - pool.lockedCents - pool.reservedCents - pool.pendingPromoCents;
  const transferableCents = Math.max(0, unlockedCents - MIN_STANDARD_POOL_BALANCE_CENTS);
  return Math.floor(Math.min(limitCents, transferableCents) / 100) * 100;
}

export function maxPromoBookingCents(
  offer: { minDepositCents: number; maxDepositCents: number },
  pool: StandardPoolFunds,
): number {
  const wholeEuroCents = availableForFixedIncomesCents(pool, offer.maxDepositCents);
  return wholeEuroCents >= offer.minDepositCents ? wholeEuroCents : 0;
}

export function promoMaturityPayoutCents(principalCents: number, totalReturnBps: number): number {
  const returnCents = Math.floor((principalCents * totalReturnBps) / 10_000);
  return principalCents + returnCents;
}
