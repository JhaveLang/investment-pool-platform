# Public website – design

Date: 2026-11-23 · Status: implemented

## Intent

The user sent screenshots of the pool's current Webador site (German and English) with the tabs Home, Investments, Kontakt, Feste Erträge, News, Konten and Warteliste, asking for "the landing page public display".

## What was built, and what not

The screenshots' content matches published investment-fraud warning signs (about 5 % a month with almost no variance for three years, "almost impossible to incur losses", fixed packages of +31 / +82 / +24 %, 15 % commission on referred investors' returns, €5 per Trustpilot review, cash / Western Union / Monero deposits, "pool closed – join the waiting list", and the latest news of departed traders and a depleted reserve). Whether or not it is one, several items are a legal problem in Germany: misleading and paid-review advertising (UWG), deposit taking without a BaFin licence (§ 32 KWG), and named waiting-list entries with amounts (GDPR).

This was explained to the user, who chose the reduced version: a neutral public site in front of the sign-in.

- **Built:**
  - header with Startseite / News / Kontakt and an account button ("Konten": sign-in, or the own account when signed in);
  - footer with the legal pages;
  - start page;
  - news with operational notices;
  - contact with the two email addresses;
  - Impressum and privacy policy as templates.
- **Not built:**
  - the Investments, Feste Erträge and Warteliste pages;
  - return figures or targets;
  - low-risk claims;
  - fixed-return packages;
  - the referral pitch;
  - review bonuses;
  - "email us your name and amount to invest";
  - the named waiting list;
  - photos of the people shown (no files, no consent).

## Decisions

- **Routes:** a `(public)` route group with its own layout.
  - `/` renders the start page for everyone; the former redirect from `/` is gone.
  - The proxy matcher never covered these paths, so nothing changes there.
  - English paths like the rest of the app (`/news`, `/contact`, `/imprint`, `/privacy`), with localized labels.
- **Content outside the pages:**
  - `src/config/site.ts` holds the email addresses, founding month, "closed since" and copyright start.
  - `src/content/news.ts` holds the notices (date, German and English); the page sorts them newest first and groups them by year.
  - `src/content/legal.ts` holds the legal texts.
- **News selection:** only operational entries from the old site: support availability, office move, earthquake and tsunami delays, the statement team, online balances, the closure to new investors, and the departure of two traders (stated plainly, as investor-relevant information). Bonus offers, deposit channels and promotional items were left out.
- **Legal templates:**
  - What the app actually does is written out: stored data, the session and language cookies, the brief per-IP and per-email counting of sign-in attempts, the admin's local read marker, no tracking and the immutable journal.
  - The operator's details are [placeholders].
  - `LEGAL_TEMPLATES_PENDING` shows a warning on the pages until the operator has completed them and had them reviewed.
- **Design:** the app's Aegis look (navy and emerald, Plus Jakarta and Inter), max-width column, sticky blurred header.
  - On phones, a `<details>` menu that closes on navigation; its panel is opaque, because a backdrop blur inside the blurred header has no effect.
  - A new `warning` tone for `Alert` (amber, `--color-warn`).
- **No contact form:** the app sends no email; a stored form would need a migration and an admin inbox.

## Testing done

- **Unit:** news entries have real dates and both languages, and are sorted newest first.
- **Production build:** every page returns 200 with its title, in German and English, and with no horizontal overflow at 375 and 1440 px.
- **Navigation:**
  - the active tab is marked;
  - the phone menu opens and closes after following a link;
  - "Anmelden" leads to `/login`, and the logo on the sign-in page leads back to `/`;
  - signed in as admin, the button reads "Mein Konto" and leads to `/admin`, while `/` still shows the website;
  - `/dashboard` without a session still redirects to `/login`.

## Follow-up (same day): risk notice removed

The user asked whether the risk notice came from their screenshots. It didn't: the old site has no risk notice page, and its only risk text (the FAQ's "almost impossible to incur losses") had deliberately not been used. The user then asked to remove it. The `/risk-notice` page, its footer link, the short risk box on the start page and their texts are gone; `src/content/legal.ts` now holds Impressum and privacy policy only. A risk notice can be added again once the operator supplies its own text.

## Follow-up (same day): all operational news

The user asked for all news to be on the page. The old site lists about 95 entries since January 2024.

**49 are on the page.** These cover support and outages, statements and balances, bank accounts, payment methods (including Western Union, RIA, Remitly, GCash, Maya and Monero), limits and fees, the closure to new investors, and trader departures.

Five mixed entries were shortened to their operational part:

- two new SEPA accounts, without the 2 % deposit bonus;
- the trader departure of 02.10.26, without the €500 finder's commission;
- the balance updates of 03.05.26 and 05.04.26, without the monthly return figure.

**The rest stay out, under the agreed scope.** These are entries that are only:

- return figures or forecasts;
- FIX / fixed-return offers and their administration;
- deposit and top-up bonuses, fee promotions, Christmas money, the beta-test credit;
- the Trustpilot review bonus and the partner-commission prize draw;
- waiting-list and "closing at 320 investors" notices;
- new traders, strategies and yields (AI arbitrage, mining, gold, meme coins, forex);
- the "€1 million, 170th investor" milestone.
