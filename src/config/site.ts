import type { IsoDate, IsoMonth } from "@/lib/calendar";

/** Facts shown on the public website (start page, contact, footer). */
export const SITE = {
  /** General enquiries; answered by the team. */
  contactEmail: "bitcoin-magazin-pool@online.ms",
  /** Sends the account statements; replies to it aren't read. */
  billingEmail: "bitcoin-magazin-pool-1@tuta.com",
  foundedMonth: "2022-08" satisfies IsoMonth,
  /** Since when the pool takes no new investors; `null` while it is open. */
  closedToNewInvestorsSince: "2026-04-01" as IsoDate | null,
  copyrightSince: 2023,
} as const;
