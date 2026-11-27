import type { IsoDate, IsoMonth } from "@/lib/calendar";

/** Facts shown on the public website (start page, contact, footer). */
export const SITE = {
  trustpilotUrl: "https://www.trustpilot.com/review/bitcoin-magazin-pool.com",
  /** General enquiries; answered by the team. */
  contactEmail: "bitcoin-magazin-pool-team1@online.ms",
  /** Sends the account statements. */
  billingEmail: "bitcoin-magazin-pool-team1@online.ms",
  foundedMonth: "2022-08" satisfies IsoMonth,
  /** Since when the pool takes no new investors; `null` while it is open. */
  closedToNewInvestorsSince: "2026-04-01" as IsoDate | null,
  copyrightSince: 2023,
} as const;
