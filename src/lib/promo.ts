export const MAX_PROMO_DETAILS_LENGTH = 2_000;
export const MIN_STANDARD_POOL_BALANCE_CENTS = 100_000;
export const PROMO_TRANSFER_PROCESSING_DAYS = 7;
export const PROMO_CONFIRMATION_DEADLINE_DAYS = 10;

export function promoMaturityPayoutCents(principalCents: number, totalReturnBps: number): number {
  const returnCents = Math.floor((principalCents * totalReturnBps) / 10_000);
  return principalCents + returnCents;
}
