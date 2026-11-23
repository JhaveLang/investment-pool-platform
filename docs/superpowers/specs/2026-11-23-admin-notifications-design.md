# Real-time admin notifications – design

Date: 2026-11-23 · Status: implemented

## Intent

The user asked: "in admin panel, add real time notification, in dashboard overview, display first the last queue".

- **Notifications:** the admin learns at once about every new withdrawal request, deposit and investor registration, without reloading.
- **Queue order:** the approval queue on the admin overview shows the newest request first, with withdrawals and deposits mixed by time. The alternative reading (move the queue above the key figures) was not built.

## Decisions

- **Source of truth: the activity log.** `recordAudit` sends `pg_notify('admin_notifications', <audit id>)` with the same executor that wrote the entry. Inside a booking transaction, PostgreSQL delivers the notification only on commit. A rolled-back booking or a refused request (minimum term, insufficient funds) therefore never notifies. A repeated form submit doesn't either, because idempotent replays write no audit entry. No migration is needed.
- **Events:** `withdrawal.requested`, `deposit.created`, `auth.registered` (`src/lib/notifications.ts`). Admin-created investors (`user.created`) are not announced to the admin who created them.
- **Transport:** Server-Sent Events, `GET /api/admin/notifications`.
  - **Access:** 401 without a session, 403 for investors.
  - **Shared listener:** each server process keeps one `pg.Client` with `LISTEN`, stored on `globalThis` and reconnected on error. It fans out to the open streams (`src/server/notifications.ts`).
  - **Streams:** each stream subscribes first and then replays missed rows from the activity log. The browser's first connection passes `?after=<newest id rendered>`, later reconnects send `Last-Event-ID`, so no event falls between page render and connection.
  - **Keep-alive and re-auth:** heartbeat every 25 s. Streams end after 4 minutes; the browser reconnects, which re-checks the session.
  - **Buffering:** headers `text/event-stream`, `Cache-Control: no-cache, no-transform` (keeps compression from buffering) and `X-Accel-Buffering: no`.
- **Client:** `AdminNotificationsProvider` keeps the single `EventSource` per tab. `NotificationBell` sits in both top bars.
  - **Bell:** unread count and a panel with the latest 20.
  - **Read marker:** stored in `localStorage` and read through `useSyncExternalStore`. On a first visit, everything already present counts as read.
  - **Toasts:** live in an `aria-live="polite"` region.
  - **Refresh:** on `/admin`, `/admin/deposits`, `/admin/withdrawals` and `/admin/investors` a live event calls `router.refresh()`. Other admin pages only show the bell and the toast, so half-filled forms are never reset.
- **Queue:** `listDepositsForReview` / `listWithdrawalsForReview` take an explicit `order`. (Update, same day: at the user's request every list now shows the newest entry first, the review pages included; only the payout-deadline card asks for `oldestFirst`.)
  - The overview fetches the newest 8 of each, merges them by time and shows 8.
  - The payout-deadline card keeps its own oldest-first query, because there the most urgent requests matter.
- **Also fixed:** the overview's side column overflowed at phone width (an implicit grid track grew to its content; `grid-cols-1` fixes it). The same overflow existed before this change.

## Testing done

- Unit tests for the notification helpers.
- **Production build on a scratch database:**
  - delivery delay of about 15–50 ms after commit;
  - duplicate submits and refused withdrawals send nothing;
  - replay on connect;
  - 401/403 responses, no compression;
  - listeners drop back to 0 after 12 open/close cycles, with one `LISTEN` connection.
- **Browser, admin and investor in parallel:**
  - toast, bell count and the new request at the top of the queue, with no page reload;
  - registration toast on a phone;
  - panel layout at 375 and 1440 px;
  - no horizontal overflow at 375 / 1024 / 1280 / 1440.
