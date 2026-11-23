# Welcome popup and "All" first – design

Date: 2026-11-23 · Status: implemented

## Intent

The user asked: "in the investors tabs, first is ALL, also A new investor can sign up, see a zero balance, and immediately initiate a deposit., means after registration and logged in, show popup to encourage to deposit". The second half quotes one of the original brief's acceptance criteria.

## Decisions

- **Investor list tabs:** `INVESTOR_LIST_FILTERS` is now `all, active, deactivated`, and the first tab is the default.
  - Without a chosen tab, the list and its CSV export (`/api/admin/investors/statements`) cover every investor, searching or not.
  - Before, the default was "active", or "all" only while searching.
- **When the popup shows:**
  - Registration always redirects to `/dashboard?welcome=1`.
  - Sign-in does so for investors who have never started a deposit (`hasDeposit`, any status), which also covers investors created by the admin on their first sign-in. Other investors and admins land as before.
- **Safety:** the dashboard renders the popup only when the parameter is set _and_ the investor has no deposit, so a stale or hand-typed `?welcome=1` changes nothing once they have deposited.
- **One-time:** `OneTimeDialog` (`src/components/ui/one-time-dialog.tsx`) opens a native `<dialog>` on mount and drops the parameter from the address bar at once, like `FlashAlert`, so a refresh doesn't reopen it. It closes with "Later", the close button, Esc or a click on the backdrop.
- **Content** (`WelcomeDialog`):
  - greeting with the name and the balance (0,00 €);
  - three steps: create the deposit, transfer with the reference shown, credited after fees once matched;
  - the minimum term and payout deadline, from the same constants as the bookings;
  - a primary button to `/deposit` and a secondary "Later".

  The wording is informational: no return figures and no pressure.

## Testing done

- **Registration:** registering lands on `/dashboard` (parameter removed) with the popup and 0,00 €; a reload shows no popup.
- **Sign-in before a deposit:** the popup shows again; "Later" and Esc close it; it fits a 375 px screen.
- **Deposit:** the popup's button opens `/deposit`; after creating a deposit, the next sign-in shows no popup, even with `?welcome=1` added by hand.
- **Admin:** still lands on `/admin`; the investor tabs read "Alle" (selected) · "Aktiv" · "Deaktiviert".
