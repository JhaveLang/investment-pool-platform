export type DomainErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "ALREADY_PROCESSED"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "ACCOUNT_MISSING"
  | "MINIMUM_TERM"
  | "INVALID_RECEIPT_DATE"
  | "PERIOD_NOT_ENDED"
  | "PERIOD_ALREADY_BOOKED"
  | "PERIOD_OUT_OF_ORDER"
  | "UNRECONCILED_DEPOSITS"
  | "PREVIEW_OUTDATED"
  | "WRONG_PASSWORD"
  | "ACCOUNT_DEACTIVATED";

/**
 * An expected business rule violation. Server actions translate the code into a
 * localised message for the user; anything else is treated as an unexpected error.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(code);
    this.name = "DomainError";
    this.code = code;
  }
}
