# Deactivation pauses returns and losses – design

Date: 2026-11-23 · Status: implemented

## Intent

Until now a deactivated investor's balance kept earning (a call made when deactivation was built). The user decided otherwise: "yes stop returns and losses when deactivated, its common sense".

## Rule

From the day of deactivation up to, but not including, the day of reactivation, the investor's capital counts for neither return nor loss. Deactivated on the 10th and activated on the 20th leaves out the 10th–19th; a month spent fully deactivated brings nothing either way. This mirrors withdrawals, which stop earning on their request day. Balance, bookings and requests are untouched.

## Decisions

- **Source of the periods: the activity log.** `user.deactivated` / `user.activated` entries are written in the same transaction as the status change, so they are a complete history (`users.deactivated_at` only holds the current state).
  - `loadPausedRanges()` (`src/server/queries/accrual.ts`) pairs them per account by Berlin calendar day.
  - No migration is needed, and periods from before this change are honoured too.
- **The calculation stays in the pure rules module.** `sumCapitalDays()` takes the paused ranges and subtracts the paused days from every capital change; `pausedDaysBetween()` is unit-tested.
  - Because only earning days are removed, the cap for losses and the rest of the booking are unchanged.
- **Scope:** months booked from now on. Booked months are immutable and are not recalculated.
- **Visibility:**
  - The return preview marks affected investors ("Deaktiviert: 22 Tage ohne Rendite und Verlust").
  - The calculation rules list the rule.
  - The deactivate card, the confirmation dialog and the activate card say that returns stop / resume.

## Testing done

- **Unit:** paused from the 10th → 9 days, reactivated on the 20th → 20 days, a full month → no loss, ranges outside the month, same-day reactivation, a deposit that starts earning inside a pause.
- **Scratch database:** three investors with 10.000 € since August.
  - October at +3,1 %: normal 310,00 €; deactivated 10 Oct and never reactivated 90,00 €; deactivated 10–19 Oct 210,00 €. At −3,1 % the same amounts are lost. The booked balances matched.
  - Deactivating and activating through the real service produces the expected ranges.
- **The client's balance-rules scenario is unchanged:** 240,00 / 250,00 / 91,45 €, plus fees, minimum term and reservations.
- **Browser:** preview markers and the updated texts on the detail page and in the confirmation dialog.
