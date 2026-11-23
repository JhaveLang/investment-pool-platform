# Grouped approval queue – design

Date: 2026-11-23 · Status: implemented

## Intent

The user asked: "in admin, approval queue section, if the same account, just display 1 card but have count indicator, and if click, have animation that popup all in grid view".

## Decisions

- **Grouping:** `groupByAccount` (`src/lib/approval-queue.ts`, unit-tested) groups the open requests by investor account.
  - Each group is newest first, and the groups are ordered by their newest request, so the queue still reads "newest first".
  - At most 8 cards (`QUEUE_SIZE`), now one per investor.
  - The review rows carry `accountId` for this.
- **Card for a single request:** unchanged, with its controls.
- **Card for several requests:** one summary card. The whole card is the button that opens the popup. It shows:
  - name, investor ID and newest request time;
  - a count badge;
  - deposit and withdrawal counts with totals;
  - a badge with the most urgent payout deadline (or "overdue"), else "awaiting reconciliation";
  - "Alle N anzeigen".
- **Popup:** the shared `Popup` component, with a new `wide` size (76 rem), scrolling inside when taller than the screen.
  - The grid has 1, 2 or 3 columns by width and holds the full request cards with their controls.
- **Animation:**
  - `Popup` now fades and scales in on opening and out on closing (`@starting-style` with discrete transitions of display and the top layer), with the backdrop fading along. This applies to every popup of the app (Sonstiges, CSV export).
  - The cards in the grid use a new `animate-pop-in` keyframe (rise and scale from 94 %), staggered 60 ms apart and capped after 8 cards. CSS animations restart whenever the dialog is shown, so they play on every opening.
  - Both are disabled under `prefers-reduced-motion`.
- **Live behaviour:** deciding a request in the popup revalidates the page, so the popup stays open with the remaining cards and the count drops. When one request is left, the group becomes a normal card and the popup closes.
- **Data:** the overview now loads up to 200 open requests of each kind (`QUEUE_REQUESTS`) instead of 8, so every investor's count includes all of their requests.

## Testing done

- **Unit:** grouping, order within a group, order of the groups, empty queue.
- **Browser, production build:** test data has Ben with 3 deposits and 1 withdrawal, Carla with 2 deposits, and Anna with 1 withdrawal.
  - Cards: Carla (2), Ben (4), Anna as a normal card.
  - Opening Ben's card: the popup was caught mid-fade (opacity 0.51), and its 4 cards animate with delays 0 / 60 / 120 / 180 ms in 3 columns. Esc closes it.
  - Deciding a deposit inside the popup keeps it open with 3 cards, and the count reads 3. After two more decisions, Ben shows as a normal withdrawal card and the popup is gone.
  - At 375 px: no page overflow, a one-column popup that scrolls inside.
