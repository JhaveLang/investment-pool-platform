// Kept free of server-only imports so the proxy can read it without pulling in the database.
export const SESSION_COOKIE_NAME = "pool_session";

/** Sessions expire after 12 hours; investors sign in again afterwards. */
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
