/** Query parameter that opens the welcome popup on the investor dashboard once. */
export const WELCOME_PARAM = "welcome";

/** Where a new investor lands after signing up (and after signing in until their first deposit). */
export const WELCOME_PATH = `/dashboard?${WELCOME_PARAM}=1`;
