const UNIQUE_VIOLATION_CODE = "23505";

/**
 * Drizzle wraps driver errors, so the Postgres error code (and the violated constraint's name) may sit on `cause`.
 * Pass `constraintName` to match only that constraint.
 */
export function isUniqueViolation(error: unknown, constraintName?: string): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === UNIQUE_VIOLATION_CODE && (constraintName === undefined || constraint === constraintName)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
