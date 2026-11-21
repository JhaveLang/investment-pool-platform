export const PAYMENT_METHODS = ["bank_transfer", "crypto", "exchange"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Fee per payment method in percent; the same rates apply to deposits and withdrawals. */
export const FEE_PERCENT: Record<PaymentMethod, number> = {
  bank_transfer: 2,
  crypto: 0,
  exchange: 3,
};

// Fees are always rounded down to the cent, so rounding never works against the investor.

/**
 * The fee is taken from the amount received: a 1.000,00 € bank transfer credits 980,00 €
 * (98 %), a crypto deposit 100 % and a deposit from an exchange 97 %.
 */
export function depositFeeCents(amountCents: number, method: PaymentMethod): number {
  return Math.floor((amountCents * FEE_PERCENT[method]) / 100);
}

export function depositCreditCents(amountCents: number, method: PaymentMethod): number {
  return amountCents - depositFeeCents(amountCents, method);
}

/**
 * The payout arrives in full and the fee is added on top, grossed up so that the payout is
 * (100 − fee) % of the debit: 1.000,00 € by bank debits 1.000 ÷ 0,98 = 1.020,40 €,
 * to an exchange 1.000 ÷ 0,97 = 1.030,92 €. Crypto payouts are free.
 */
export function withdrawalFeeCents(payoutCents: number, method: PaymentMethod): number {
  const feePercent = FEE_PERCENT[method];
  return Math.floor((payoutCents * feePercent) / (100 - feePercent));
}

export function withdrawalDebitCents(payoutCents: number, method: PaymentMethod): number {
  return payoutCents + withdrawalFeeCents(payoutCents, method);
}

/** Largest payout whose debit (payout + fee) still fits into `availableCents`. */
export function maxWithdrawalPayoutCents(availableCents: number, method: PaymentMethod): number {
  if (availableCents <= 0) {
    return 0;
  }
  // Starts just below the exact gross-down and steps up past the rounded-down fee.
  let payoutCents = Math.floor((availableCents * (100 - FEE_PERCENT[method])) / 100);
  while (withdrawalDebitCents(payoutCents + 1, method) <= availableCents) {
    payoutCents += 1;
  }
  return payoutCents;
}
