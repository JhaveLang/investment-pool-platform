# New Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the whole app the look of `~/Downloads/bitcoin_magazin_pool_enhanced_landing.html` (palette, fonts, logo mark, cards) and rebuild the start page in that file's layout, without its photo, performance curve and "live" badge.

**Architecture:** Every screen reads colours and fonts from the `@theme` block in `src/app/globals.css` and the `next/font` variables in `src/app/layout.tsx`; changing those restyles the app. The start page (`src/app/(public)/page.tsx`) is rebuilt from three new server components in `src/components/public/`. Texts go into both dictionaries (`de.ts` is the type, `en.ts` must match).

**Tech Stack:** Next.js 16.4 App Router (read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` before touching fonts), Tailwind CSS 4 (`@theme`, `@utility`), Vitest (node environment, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-26-new-design-design.md`

## Global Constraints

- **Do not commit.** `de.ts`, `en.ts` and many other files hold unrelated uncommitted work (promo feature) that must not be swept into a commit. Leave all changes in the working tree; the user commits.
- Fonts: Afacad Flux → `--font-display`; Instrument Sans → `--font-sans`; Source Code Pro 500 → `--font-mono`.
- Colours: values exactly as in the spec's table; `subtle` = `#6B616B` (meets 4.5:1 on `overlay`, the darkest text surface; the Task 1 test confirms).
- Money colours `gain` / `loss` / `warn`, `indigo`, `chart-free` / `chart-locked` keep their current values.
- Button corners stay `rounded-lg`; the file's square buttons come from a nonexistent class.
- No photos of people, no curve or calendar dates on the timeline, no return rows or return amounts in the account preview, nothing labelled "live".
- Every user-facing string lives in `src/i18n/messages/de.ts` and `en.ts`, never in components.
- Numbers on the start page come from `MINIMUM_TERM_DAYS`, `ACCRUAL_DELAY_DAYS`, `PAYOUT_DEADLINE_DAYS` (`src/lib/returns.ts`), never literals.

## Review Focus

1. **Phone width (375 and 320 px):** the timeline's "day 0" and "day 7" labels sit 12 % apart and must not overlap; the account preview and facts row must not overflow. → Task 3 places the day-7 label above the line; Task 4 checks `scrollWidth` and screenshots at 375 px.
2. **German is longer than English** ("Volle Auszahlung möglich", "Transparente Buchführung", "Mindestlaufzeit"): it must wrap inside cards, not overflow or clip. → Task 4 screenshots German at 375 and 1440 px.
3. **Amounts still line up in ledger tables** with Instrument Sans, and references/IBANs in the wider code font don't break table columns. → Task 4 screenshots the transaction table and admin review tables.
4. **Inputs on raised panels stay visible** (`well` vs `raised`). → Task 1 test asserts they differ; Task 4 screenshots the deposit form.
5. **Optional content still renders correctly:** pool open (`SITE.closedToNewInvestorsSince === null`) hides the "closed since" note; no news shows `newsEmpty`; signed-in users see "Mein Konto" on every account button. → Task 3 keeps these branches; Task 4 checks a signed-in start page.

---

### Task 1: App-wide palette, fonts and shared pieces

**Files:**
- Create: `src/lib/theme-contrast.test.ts`
- Modify: `src/app/globals.css` (header comment, `@theme` fonts and colours, `.amount`, `.reference`)
- Modify: `src/app/layout.tsx` (fonts, `themeColor`)
- Modify: `src/components/layout/brand.tsx` (`BrandMark`)
- Modify: `src/components/ui/button.tsx` (`secondary` variant)
- Modify: `src/components/public/site-header.tsx`, `src/components/public/site-footer.tsx` (backgrounds)

**Interfaces:**
- Produces: Tailwind utilities `font-mono` (Source Code Pro), `font-display` (Afacad Flux), `font-sans` (Instrument Sans); colour tokens with the new values. Later tasks use `text-accent-300` for website headings.

- [ ] **Step 1: Write the failing test** `src/lib/theme-contrast.test.ts`

Reads `src/app/globals.css` with `readFileSync`, extracts `--color-<name>: #rrggbb;` values (lower-cased), and computes WCAG 2 contrast. Helpers `token(name: string): string` and `contrast(a: string, b: string): number` live in the test file.

```ts
const TEXT_SURFACES = ["canvas", "surface", "raised", "well", "overlay"];

describe("theme", () => {
  it("uses the new palette", () => {
    expect(token("canvas")).toBe("#fff7fb");
    expect(token("accent-400")).toBe("#4d245b");
    expect(token("accent-300")).toBe("#350c44");
    expect(token("footer")).toBe("#332f33");
  });
  it.each(["fg", "muted", "subtle", "accent-400", "accent-300", "gain", "loss", "warn"])(
    "%s meets 4.5:1 on every text surface",
    (text) => TEXT_SURFACES.forEach((s) => expect(contrast(token(text), token(s))).toBeGreaterThanOrEqual(4.5)),
  );
  it.each(["fg", "muted", "accent-400"])("%s meets 4.5:1 on highest (secondary button hover)", (text) =>
    expect(contrast(token(text), token("highest"))).toBeGreaterThanOrEqual(4.5),
  );
  it("white text meets 4.5:1 on accent-400, accent-300 and footer", () =>
    ["accent-400", "accent-300", "footer"].forEach((bg) =>
      expect(contrast("#ffffff", token(bg))).toBeGreaterThanOrEqual(4.5),
    ));
  it("keeps well and raised apart, so inputs stay visible on raised panels", () =>
    expect(token("well")).not.toBe(token("raised")));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/lib/theme-contrast.test.ts`
Expected: FAIL on "uses the new palette" (`#f6f4f8` ≠ `#fff7fb`).

- [ ] **Step 3: Change the theme in `src/app/globals.css`**

- `@theme` fonts: `--font-sans: var(--font-instrument), ui-sans-serif, system-ui, sans-serif;` `--font-display: var(--font-afacad), var(--font-instrument), ui-sans-serif, sans-serif;` `--font-mono: var(--font-source-code), ui-monospace, monospace;`
- Colours from the spec table: canvas `#FFF7FB`, surface/sidebar `#FFFFFF`, raised `#FAF1F7`, well `#F4EBF1`, overlay `#EFE6EB`, highest `#E9E0E6`, line `#E4DCE3`, line-strong `#CFC3CE`, fg `#1E1A1E`, muted `#4D444D`, subtle `#6B616B`, accent-400/500 `#4D245B`, accent-300/600 `#350C44`, footer `#332F33`.
- `.amount`: drop `"cv05" 1` (Inter-only), keep `"tnum" 1`.
- `.reference`: add `font-family: var(--font-mono);`.
- Rewrite the header comment: palette after the "enhanced landing" file, Afacad Flux / Instrument Sans / Source Code Pro, keep the 4.5:1 sentence.
- Add a `grid-backdrop` utility for Task 2: two 1 px `linear-gradient`s (to right, to bottom) in `color-mix(in srgb, var(--color-accent-400) 4.5%, transparent)`, `background-size: 40px 40px`.

- [ ] **Step 4: Fonts in `src/app/layout.tsx`**

Replace Inter / Plus_Jakarta_Sans with `Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] })`, `Afacad_Flux({ variable: "--font-afacad", subsets: ["latin"] })` (both variable, no weight), `Source_Code_Pro({ variable: "--font-source-code", subsets: ["latin"], weight: "500" })`; put all three `.variable`s on `<html>`. Update the two font comments. `viewport.themeColor` → `"#FFF7FB"`.

- [ ] **Step 5: Shared pieces**

- `BrandMark`: `bg-accent-400` instead of `bg-highest`, SVG `text-accent-ink` instead of `text-accent-400`; update its doc comment.
- `button.tsx` `secondary`: `"bg-overlay text-accent-400 hover:bg-highest"`.
- `site-header.tsx`: header background `bg-canvas/95`.
- `site-footer.tsx`: footer background `bg-surface` instead of `bg-sidebar/50`.

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run && npm run lint && npm run typecheck`
Expected: all tests PASS (including the new file), lint and typecheck clean. If `typecheck` fails only on `react 2` / `react-dom 2` type folders, report it and continue: those are stray duplicate folders in `node_modules/@types`, not code errors.

---

### Task 2: Start page hero

**Files:**
- Create: `src/components/public/hero-backdrop.tsx`
- Create: `src/components/public/account-preview.tsx`
- Modify: `src/app/(public)/page.tsx` (hero section; move the account card down)
- Modify: `src/i18n/messages/de.ts`, `src/i18n/messages/en.ts` (`site` block, after `allNews`)

**Interfaces:**
- Consumes: `grid-backdrop` utility, `font-mono`, `text-accent-300` (Task 1); `SignedAmount({ cents, className })` from `src/components/ui/amount.tsx`; `addDays`, `todayIsoDate` from `src/lib/calendar.ts`; `messages.entryTypes`, `messages.paymentMethods`.
- Produces: `HeroBackdrop(): JSX.Element`; `AccountPreview(): Promise<JSX.Element>`; site strings below.

- [ ] **Step 1: Strings** (DE / EN, in `site`)

| Key | DE | EN |
|---|---|---|
| `termLabel` | Mindestlaufzeit | Min. term |
| `termValue(days)` | `${days} Tage` | `${days} days` |
| `accrualLabel` | Renditen | Returns |
| `accrualValue(day)` | `ab Tag ${day}` | `from day ${day}` |
| `payoutLabel` | Auszahlung | Payout |
| `payoutValue(days)` | `in ${days} Tagen` | `in ${days} days` |
| `previewLabel` | Beispiel | Example |
| `previewTitle` | Ihre Buchungen | Your bookings |
| `previewBalance(amount)` | `Saldo ${amount}` | `Balance ${amount}` |

- [ ] **Step 2: `HeroBackdrop`** in `hero-backdrop.tsx`

`aria-hidden`, `pointer-events-none absolute inset-0 size-full`, `text-accent-400`. The file's SVG (viewBox `0 0 1440 620`, `preserveAspectRatio="none"`): the filled area under the main curve (gradient `currentColor` 14 % → 0), the main curve stroke (22 % opacity, 2 px), the dashed second curve (14 %, `6 6`), the two small dots. Copy the path data from the file. No text.

- [ ] **Step 3: `AccountPreview`** in `account-preview.tsx`

White card `rounded-3xl border border-line bg-surface p-6 shadow-xl`. Header: `label-caps` `previewLabel` badge and `previewTitle`. Rows, newest first, from this constant (crypto only, so no fee rows are needed for the balances to add up):

```ts
const EXAMPLE_ROWS = [
  { daysAgo: 2, type: "withdrawal", method: "crypto", amountCents: -25_000, balanceCents: 125_000 },
  { daysAgo: 20, type: "deposit", method: "crypto", amountCents: 50_000, balanceCents: 150_000 },
  { daysAgo: 45, type: "deposit", method: "crypto", amountCents: 100_000, balanceCents: 100_000 },
] as const;
```

Each row: left `entryTypes[type] · paymentMethods[method]`, below it the date (`format.calendarDate(addDays(todayIsoDate(), -daysAgo))`) in `font-mono text-[13px] text-muted`; right `<SignedAmount cents={amountCents} />`, below it `previewBalance(format.currency(balanceCents))` in `text-[13px] text-muted`. Rows separated by `divide-y divide-line`.

- [ ] **Step 4: Hero in `page.tsx`**

- Section: `relative overflow-hidden grid-backdrop border-b border-line`, `<HeroBackdrop />` first, content in `publicContainer` with `relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16`.
- Left column: today's badge, h1 (`text-accent-300`, 32/38 px on phones, 52/58 px from `md`, `tracking-[-0.02em]`), tagline, text, the two buttons, then a `<dl>` facts row: `mt-8 grid grid-cols-3 gap-4 border-t border-line pt-5`, each `<dt className="label-caps text-muted">` + `<dd className="mt-1 font-semibold text-accent-300">` from the Step 1 strings and the three constants.
- Right column: `<AccountPreview />`.
- Move today's account `<aside>` unchanged into a new section directly below the hero (Task 3 restyles it and adds its neighbour). Remove `ambient-glow` from it.

- [ ] **Step 5: Check**

Run: `npx vitest run && npm run lint && npm run typecheck`, then open `http://localhost:3000/` in German and English (DE/EN toggle in the header) at 1440 and 375 px.
Expected: checks clean; hero shows grid, faint curve, facts row and example card; no horizontal scroll at 375 px.

---

### Task 3: Second row, lower sections, website headings, news dates

**Files:**
- Create: `src/components/public/rules-timeline.tsx`
- Modify: `src/app/(public)/page.tsx` (second row, how-it-works, notices, questions)
- Modify: `src/app/(public)/news/page.tsx` (date font)
- Modify: `src/components/ui/icon.tsx` (add `arrowRight`)
- Modify: `src/components/public/public-page-header.tsx`, `src/components/public/legal-page.tsx`, `src/app/(public)/contact/page.tsx` (heading colour)
- Modify: `src/i18n/messages/de.ts`, `src/i18n/messages/en.ts` (`site` block)

**Interfaces:**
- Consumes: Task 1 tokens and `font-mono`; constants from `src/lib/returns.ts`.
- Produces: `RulesTimeline(): Promise<JSX.Element>`; icon name `arrowRight`.

- [ ] **Step 1: Strings** (DE / EN, in `site`)

| Key | DE | EN |
|---|---|---|
| `ledgerLabel` | Transparente Buchführung | Transparent accounting |
| `ledgerTitle` | Jede Buchung mit Zeitstempel | Every booking, timestamped |
| `ledgerText` | Jede Ein- und Auszahlung und jede Rendite wird mit Datum, Betrag und Saldo danach gebucht. | Every deposit, withdrawal and return is booked with its date, amount and the balance after it. |
| `timelineTitle` | Fristen ab Zahlungseingang | Days from payment |
| `timelineDay(day)` | `Tag ${day}` | `Day ${day}` |
| `timelinePayment` | Zahlungseingang | Payment received |
| `timelineAccrual` | Renditen beginnen | Returns start |
| `timelineTerm` | Volle Auszahlung möglich | Full withdrawal possible |
| `timelinePayout(days)` | `Auszahlung binnen ${days} Tagen nach dem Antrag` | `Payout within ${days} days of a request` |

- [ ] **Step 2: `RulesTimeline`** in `rules-timeline.tsx`

Inner panel `rounded-2xl border border-line bg-raised p-5`. Header `label-caps text-muted` `timelineTitle`. A 2 px `bg-accent-400/30` line with three dots placed at `left: day / MINIMUM_TERM_DAYS * 100%` for days `0`, `ACCRUAL_DELAY_DAYS`, `MINIMUM_TERM_DAYS` (white fill, `accent-300` ring; the last dot solid `accent-300`). Each point has a `font-mono text-[13px] text-accent-300` `timelineDay(day)` line and a `text-[13px] text-muted` label. Placement so labels never overlap: day 0 label below, left-aligned at the dot; day `ACCRUAL_DELAY_DAYS` label **above** the line, left-aligned at the dot; day `MINIMUM_TERM_DAYS` label below, right-aligned at the dot. Footer under a `border-t border-line`: `timelinePayout(PAYOUT_DEADLINE_DAYS)` in `font-mono text-[13px] text-muted`. No SVG curve, no calendar dates.

- [ ] **Step 3: Second row in `page.tsx`**

`publicContainer` grid `gap-6 py-12 lg:grid-cols-2 lg:py-16`.
- Left card `rounded-2xl border border-line bg-surface p-8 shadow-sm`: top row with `label-caps text-muted` `ledgerLabel`, h2 `ledgerTitle` (`text-[22px] leading-7 font-bold text-accent-300`), `ledgerText` (`text-sm text-muted`), and on the right a `size-10 rounded-lg bg-overlay text-accent-400` box with `<Icon name="receipt" />`; then `<RulesTimeline />`.
- Right: the account card moved in Task 2, now `rounded-3xl border border-line bg-surface p-8 shadow-lg`, h2 28/34 px `text-accent-300`; tick list, full-width button and the `closedSince` note (`rounded-xl border border-line bg-raised`) keep their current content and the `SITE.closedToNewInvestorsSince ? … : null` branch.

- [ ] **Step 4: Lower sections in `page.tsx`**

- How it works: h2 `text-[28px] leading-[34px] text-accent-300`; cards `rounded-2xl border border-line bg-surface p-6 shadow-sm`, icon box `bg-overlay`.
- Notices card (`lg:col-span-7` of a 12-column grid) and Questions card (`lg:col-span-5`): `rounded-2xl border border-line bg-surface p-8 shadow-sm`, h2 22 px `text-accent-300`; notice dates `font-mono text-[13px] text-muted` in a `sm:grid-cols-12` row (date `sm:col-span-3`, text `sm:col-span-9`); "All notices" link text followed by `<Icon name="arrowRight" className="size-4" />` instead of "→". Keep the `latest.length === 0` branch.
- `icon.tsx`: `arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />`.

- [ ] **Step 5: Website headings and news dates**

- `text-accent-400` → `text-accent-300` on the headings in `public-page-header.tsx` (h1), `legal-page.tsx` (h2) and `contact/page.tsx` (h2). Links and icons stay `accent-400`.
- `news/page.tsx` `<time>`: `font-mono text-[13px] font-medium text-accent-400`.

- [ ] **Step 6: Check**

Run: `npx vitest run && npm run lint && npm run typecheck`, then view `/`, `/news`, `/contact`, `/imprint` at 1440 and 375 px in German and English.
Expected: checks clean; timeline labels don't overlap at 375 px; layout matches the file apart from the three replacements.

---

### Task 4: Whole-app check and fixes

**Files:**
- Modify: whatever the checks show is broken (expected: none or small spacing fixes)
- Modify: `docs/superpowers/specs/2026-11-26-new-design-design.md` (status → implemented, plus a short "Testing done")

- [ ] **Step 1: Build**

Run: `npx vitest run && npm run lint && npm run typecheck && npm run build`
Expected: all pass (bar the known `react 2` type-folder issue, if still present).

- [ ] **Step 2: Screenshots and overflow check** (dev server on `http://localhost:3000`, Playwright)

Pages: `/`, `/news`, `/contact`, `/login`; signed in as investor (`anna.becker@example.com`, password `DEMO_PASSWORD` from the environment or `demo-investor-2026`): `/dashboard`, `/deposit`, `/transactions`; signed in as admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`): `/admin`, `/admin/deposits`, `/admin/withdrawals`. Each at 1440 and 375 px, German and English. On each, `document.documentElement.scrollWidth <= window.innerWidth` must be true. Look for: German text overflowing cards, amounts out of line, reference/IBAN columns wrapping badly in the code font, inputs invisible on raised panels, start page signed in shows "Mein Konto" on all account buttons.

- [ ] **Step 3: Fix what Step 2 found, re-run Step 1**

Expected: clean.

- [ ] **Step 4: Update the spec**

Status `implemented`, and a "Testing done" list naming the checks above and their results.
