# Live balance updates for investors – design

Date: 2026-11-23 · Status: implemented

## Intent

The user asked to make acceptance criterion 2 real time: "Deposits and withdrawals trigger balance updates that appear within one page refresh". Balances still change only when the admin decides (approval-only booking, see `2026-11-23-approval-booking-design.md`). The investor now sees that change at once, without refreshing. Their own submit already showed immediately ("+… warten auf Abgleich").

## Decisions

- **Same channel as the admin notifications.** `recordAudit` notifies for `deposit.reconciled`, `deposit.rejected`, `withdrawal.approved`, `withdrawal.rejected` and `returns.booked` as well; delivery happens on commit only. The NOTIFY payload stays the bare activity-log id; the channel is now `live_events`.
- **Recipients are resolved on the server.**
  - `getLiveEvent(id)` joins the audit row to the decided deposit or withdrawal and its account owner.
  - For a booked month it joins `return_periods` to `ledger_entries`, so only investors with a return posting are told, each with their own signed amount.
  - The browser only supplies `after`.
  - The replay query uses the same joins, scoped to the session's user.
- **Hub:** admin listeners plus investor listeners keyed by user id, on one `LISTEN` connection per process (`liveEventHub` on `globalThis`; the old key isn't reused, so a running dev server can't keep the old shape).
- **Endpoints:** `/api/investor/notifications` (investors only; admins get 403) and the existing admin endpoint, both built on `notificationStream()` (`src/server/notification-stream.ts`): subscribe-then-replay, heartbeat, 4-minute lifetime, no-transform headers.
- **Client:**
  - `InvestorLiveUpdates` wraps the investor shell. The stream starts after the newest activity-log id at first render; the id is frozen, so refreshes don't reconnect.
  - Every event shows a toast. `/dashboard` and `/transactions` call `router.refresh()`.
  - `/deposit`, `/withdraw` and `/profile` only show the toast, because a refresh would issue a new idempotency key under an open money form (the same reason the dashboard has no live form).
  - The admin and investor UIs share `useEventStream` / `useToasts` (`src/components/live-events.ts`) and `Toast` / `ToastRegion` (`src/components/ui/toast.tsx`).

## Testing done

- **Unit:** event classification, links and refresh paths.
- **Routing, with three parallel streams on the production build (admin, investor A, investor B):**
  - A's reconcile reached only A;
  - B's reject, approve, cancel and booked month reached only B (with B's own +62,00 €);
  - A, without October capital, got no month message;
  - the admin received only admin events;
  - `?after=0` replays only each investor's own events;
  - 401 / 403 both ways;
  - listeners back to 0 with one `LISTEN` connection.
- **Browser:** with B's dashboard open, the admin approved, rejected, reconciled and cancelled in the admin UI. Each time B's balance or reservation changed within about 40–250 ms, with one toast and no reload. The admin toast, bell and queue still work after the refactor.
