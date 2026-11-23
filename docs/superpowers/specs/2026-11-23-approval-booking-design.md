# Approval-only booking – design

Date: 2026-11-23 · Status: implemented

## Intent

The user: "the balance should be reflected only if balance approved withdraw or deposit". This reverses the decision of 2026-11-20 (deposits credited at submission, chosen for acceptance criterion 2 of the original brief). The user was shown that conflict. They then re-pasted their balance-calculation requirements, which say nothing about the timing; this was read as the go-ahead. None of those requirements change.

## Rules

| Event | Ledger | Effect for the investor |
| --- | --- | --- |
| Deposit submitted | – | "+… awaiting reconciliation"; listed under open requests |
| Deposit reconciled (receipt date entered) | `+amount`, `−fee` | balance rises |
| Deposit cancelled | – | disappears from open requests |
| Withdrawal requested | – | payout + fee **reserved**: available drops, balance doesn't |
| Withdrawal approved | `−payout`, `−fee` | balance drops |
| Withdrawal rejected | – | reservation released |

**Available** = balance − capital in its 60-day term − reserved payouts.

Unchanged: fees, rounding, returns from receipt + 7 days, the 60-day term per deposit and monthly booking. A withdrawal still stops earning on its **request day**: pending withdrawals are added to the accrual query as capital changes from that day.

## Decisions

- **Schema (`0005_approval_booking`):** `deposits.credited_at`, `withdrawals.debited_at`.
  - **Backfill:** every existing row gets its submission time, since everything before the change was booked at submission. Those items are never booked twice: approving them books nothing, and rejecting them still reverses or refunds as before.
  - **Checks:** reconciled ⇒ credited, approved ⇒ debited.
  - **One statement:** PostgreSQL can't defer CHECKs, so the flag is set in the same UPDATE as the status (`coalesce(..., now())` keeps a legacy stamp).
- **Locked capital** counts only credited deposits. An uncredited deposit isn't in the balance and locks nothing.
- **Reservation:** `requestWithdrawal` checks the payout against the balance minus earlier undebited pending withdrawals, then also minus locked capital, under the account lock. Legacy pending withdrawals are already out of the balance and are not subtracted again.
- **Loss cap** for monthly results: at most the balance minus reserved payouts, so a later approval can't overdraw.
- **Legacy deposit cancellation** is refused (INSUFFICIENT_FUNDS) if the reversal would cut into reserved payouts.
- **Ledger entries** for reconciled deposits and approved withdrawals carry the admin as `created_by_user_id` and the decision time as timestamp. Accrual still uses the receipt day and the request day.

## Testing done

- **Legacy path:**
  - pending items created by the previous code on a database at `0004`, then `0005` applied;
  - reconciling and approving them books nothing;
  - rejecting them reverses or refunds;
  - new items follow the new rule;
  - reservation, rejection, approval and the reversal guard;
  - integrity check clean (23 checks).
- **Balance-rules scenario from the client's requirements, re-run under the new rule (28 checks):**
  - October results still 240,00 / 250,00 / 91,45 € with a withdrawal pending at booking;
  - fee examples, the 60-day block and payout deadline;
  - loss cap with a reservation (−5.000 instead of −7.983,87).
- **Browser:**
  - a new investor registers, sees 0,00 € and deposits;
  - the dashboard shows the pending amount, the admin reconciles from the top of the queue, and 980,00 € appear after one refresh;
  - a withdrawal request reserves 200 €, the admin approves, and the balance drops.
