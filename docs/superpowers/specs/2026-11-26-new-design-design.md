# New design – after the "enhanced landing" file

Date: 2026-11-26 · Status: implemented (not committed)

## Intent

The user sent `~/Downloads/bitcoin_magazin_pool_enhanced_landing.html` and asked to "change the design like this", for the
whole app (website, sign-in, investor account, admin). The file is a restyled version of today's start page with the same
texts: a new palette and fonts, a grid backdrop in the hero, a facts row, a second row with a chart card next to the
online-account card, and code-font dates.

## Goals, non-goals, anti-goals

- **Goals:** the file's look everywhere (colours, fonts, logo mark, card style), and the file's layout on the start page.
- **Non-goals:** no change to what any screen does, no new pages, no dark mode (the file has dark colours; the app is
  light only), no new layouts for investor or admin screens beyond the new colours and fonts.
- **Anti-goals:** the public site stays neutral, as agreed on 2026-11-23
  (`docs/superpowers/specs/2026-11-23-public-website-design.md`): no photos of people, no performance curves or return
  figures. So three parts of the file are replaced (see the start page below).

## Approaches

1. **Change the shared design settings (`globals.css` theme, fonts in `layout.tsx`), then rebuild the start page.**
   Picked: every screen already reads its colours and fonts from there.
2. Port the file's own colour names (`light-primary`, `surface-container-*` …) and rewrite every screen to use them.
   Same result, hundreds of files touched.
3. Apply the file's styles to the public pages only. Ruled out: the user chose the whole app.

## Decided

**Fonts** (`next/font/google`, replacing Inter and Plus Jakarta Sans):
- Afacad Flux 600/700 → `--font-display` (headings, the logo name, and the large money figures that use it today, e.g.
  the balance hero and approval queue). Checked: its digits are all the same width, so those figures stay steady;
- Instrument Sans 400–700 → `--font-sans` (body, data). Checked: `tabular-nums` makes its digits equal width, so
  `.amount` keeps aligning; drop Inter's `cv05` feature from `.amount`;
- Source Code Pro (variable, all weights) → `--font-mono`, used for the notice dates on the start and news pages, and for `.reference`
  (booking references, IBANs, wallet addresses). Checked: Instrument Sans has no slashed zero, so 0 and O look the
  same in it; Source Code Pro's dotted zero keeps them apart.

**Colours** (same token names, new values; money colours `gain` / `loss` / `warn`, `indigo` and the donut colours stay):

| Token | Now | New (file name) |
|---|---|---|
| `canvas` | #f6f4f8 | #FFF7FB (background) |
| `surface`, `sidebar` | #ffffff | #FFFFFF (container-lowest) |
| `raised` | #f9f7fb | #FAF1F7 (container-low) |
| `well` | #f4f0f7 | #F4EBF1 (container; one step below `raised`, so inputs on a raised panel stay visible) |
| `overlay` | #f1ebf4 | #EFE6EB (container-high; secondary button) |
| `highest` | #e6dbeb | #E9E0E6 (container-highest) |
| `line` / `line-strong` | #ece5f0 / #ddcbe4 | about #E4DCE3 (outline-variant at ~55 % on white) / #CFC3CE |
| `fg` / `muted` | #1d1621 / #4e4555 | #1E1A1E / #4D444D |
| `subtle` | #6b6272 | darkest grey of the file's family that still meets 4.5:1 on every surface (the file's #7E747E is only 4.3:1 on the pink background) |
| `accent-400`, `accent-500` | #563364 | #4D245B (primary-container: buttons, logo, links) |
| `accent-300`, `accent-600` | #432650, #3d2348 | #350C44 (primary: button hover, headings on the website) |
| `footer` | #333333 | #332F33 (inverse-surface) |

`themeColor` in the viewport becomes #FFF7FB. The rule in the `globals.css` header comment stays: every text colour meets
4.5:1 on all surfaces. Validate after the change, including `gain`, `loss` and `warn` on the new pink surfaces, and
every text colour against `highest` (#E9E0E6), the darkest background.

**Shared pieces:**
- `BrandMark`: solid plum square (`accent-400`) with the white three-column mark, as in the file's header.
- Secondary buttons: plum text (`accent-400`) on `overlay` instead of black text, as in the file.
- Cards on the website: white, 1 px `line` border, 16 px corners, `shadow-sm`; the online-account card 24 px and
  `shadow-lg`, as in the file.
- Header and footer keep their structure; they pick up the new colours (header `canvas/95` with blur, footer white with
  the dark bottom bar).

**Start page** (`src/app/(public)/page.tsx`), top to bottom:
1. **Hero:** the file's faint 40 px grid backdrop and the unlabeled decorative trend line behind it. Left: "since"
   badge, name, tagline, text, the two buttons, then a facts row under a thin line with three label/value pairs:
   DE "Mindestlaufzeit · 60 Tage", "Renditen · ab Tag 7", "Auszahlung · in 7 Tagen"; EN "Min. term · 60 days",
   "Returns · from day 7", "Payout · in 7 days" (numbers from `MINIMUM_TERM_DAYS`, `ACCRUAL_DELAY_DAYS`,
   `PAYOUT_DEADLINE_DAYS`).
   Right, **instead of the advisor photo:** a drawn preview of the online account in a white card with
   `shadow-xl`, labelled "Beispiel" / "Example": three booking rows (e.g. deposit by bank, deposit by crypto,
   withdrawal request) with date, amount and balance after it. No return rows or return amounts.
2. **Second row**, two cards side by side (stacked on phones):
   - left, **instead of the "Accrual curve, Aug 2022 – Nov 2026":** label "Transparente Buchführung" / "Transparent
     accounting", title "Jede Buchung mit Zeitstempel" / "Every booking, timestamped", text "Jede Ein- und Auszahlung
     und jede Rendite wird mit Datum, Betrag und Saldo danach gebucht." / "Every deposit, withdrawal and return is
     booked with its date, amount and the balance after it." Inside, a flat timeline on a day axis with three points:
     day 0 payment received, day 7 returns start, day 60 full withdrawal possible; caption below: payout within 7 days
     of a request. Code-font labels, no curve, no calendar dates;
   - right: today's online-account card (label, title, text, three ticks, button, "closed since" note), moved here
     from the hero.
3. **How your account works:** today's four cards, restyled.
4. **Latest notices and Questions:** as today, dates in the code font, "All notices" with an arrow.

**Left out of the file:** the advisor photo (a person not on the team, and a temporary Google image link that no
longer loads), the rising accrual curve with real dates (reads as the pool's track record), and the "Pool Ledger ·
24/7 Live · Daily Returns" badge (results are entered monthly, so "live" isn't true).

## My calls (for the user to check)

- **Button corners stay rounded** (about 10 px). The file's buttons look square only because its corner class
  (`rounded-DEFAULT`) doesn't exist in Tailwind; its own setting is 10 px. Square buttons next to rounded inputs in
  the forms would look off.
- Headings on the website in the darker plum (#350C44), buttons in #4D245B, as in the file. Inside the investor and
  admin areas, headings keep using `accent-400`.
- Booking references, IBANs and wallet addresses switch to the code font, because the new text font has no
  slashed zero.
- Secondary buttons get plum text everywhere in the app, as in the file.
- The duplicated facts (hero row, timeline, four cards) stay, as in the file.

## Left to the builder

- Exact values for `line` and `subtle` after contrast validation.
- Spacing and type sizes on the start page, following the file (display 52/58 px, 32/38 on phones; headline 28 and
  22 px; body 16 and 14 px).
- Whether `.ambient-glow` is still needed on the start page.

## Checks after building

- Unit tests and production build pass.
- Screenshots at 1440 and 375 px, German and English: start, news, contact, sign-in, investor dashboard, deposit form,
  admin overview, admin review tables. No horizontal overflow; amounts still line up in the ledger tables.

## Testing done

- **Unit:** `src/lib/theme-contrast.test.ts` pins the new palette and checks every text colour at 4.5:1 or more on all
  text surfaces (`gain`, `loss`, `warn` included), `fg` / `muted` / `accent-400` on `highest`, white on plum and on the
  footer, and that `well` and `raised` differ. Whole suite: 17 files, 219 tests pass.
- **Lint:** clean on every changed file. **Types:** clean apart from the duplicate `… 2` folders in
  `node_modules/@types` and one error in the uncommitted promo work (`src/actions/promos.ts:103`), neither from this
  change. **Production build:** compiles; its type check stops on the same duplicate folders.
- **Browser:** `/`, `/news`, `/contact`, `/imprint`, `/privacy`, `/login` at 320, 375 and 1440 px in German and English:
  no horizontal scroll anywhere. The timeline's labels don't overlap at 320 px; German facts labels hyphenate.
- **Found and fixed on the way:** `/login` scrolled sideways at 320 px (already so with the old font): its column now
  has `min-w-0`, so the fact lines truncate as intended.
- **Not checked:** the signed-in investor and admin screens. The README's demo investor password doesn't work on this
  database, and the admin password in `.env` wasn't used without asking.

## Rulings made while building

- Typecheck run with `--types node` to skip the duplicate `@types` folders.
- Facts labels and timeline labels hyphenate; the timeline is taller below `sm` and its lower labels take at most half
  its width each, so nothing overlaps at 320 px.
- The account preview's rows use `entryTypes` and `paymentMethods` labels; the ledger card shows a receipt icon rather
  than the file's rising-arrow icon.

## Follow-up (same day): team photo instead of the example card

The user sent the photo from the design file (a man on the phone in front of a rising chart graphic) and asked to add
it. Asked who he is, the user confirmed he is a member of the team and agreed to be shown. So the anti-goal "no photos
of people" is lifted for this photo:

- `src/assets/team-call.png` (512 × 382 px, as sent; imported, so it ships in the Docker build) fills the hero's right
  column via `next/image` (`loading="eager"`, `fetchPriority="high"`, blur placeholder), in a white card with 24 px
  corners and `shadow-xl`.
- Alt text names no role: "Ein Mitglied des Bitcoin-Magazin-Pool-Teams am Telefon" / "A member of the Bitcoin Magazin
  Pool team on the phone" (`site.heroImageAlt`).
- The drawn example account card is gone, with its strings (`previewLabel`, `previewTitle`, `previewBalance`).
- The file's "Pool Ledger · 24/7 Live · Daily Returns" badge on the photo stays out.
- The photo is only 512 px wide, so it is slightly soft on high-density screens; a larger original would fix that.

## Final review (fresh reviewer)

Verdict "with fixes"; no critical findings. Two important ones:

- **The example card showed a withdrawal the app forbids** (both deposits younger than 60 days). A test reproduced it
  (RED); the card was then removed for the team photo, which resolves it.
- **The code font was synthesized bold** where `.reference` sits in semibold text (investor transaction cards, admin
  approval queue), because only weight 500 was loaded. Now the variable font loads: the browser's font list went from
  weight `500` to `200 900`.

Minor findings were left for the user to decide (see the final message of the session).
