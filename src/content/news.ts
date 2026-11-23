import type { Locale } from "@/i18n/config";
import type { IsoDate } from "@/lib/calendar";

/**
 * Operational notices for the public News page: support hours, outages, statements and balances, bank accounts,
 * payment methods, limits and fees, closures, trader departures. Taken from the old website without return figures,
 * fixed-return offers, bonuses, commissions, review incentives, the waiting list or trader and strategy promotions
 * (see README, "Public website"). Add new entries anywhere; the page sorts them newest first. Every entry needs both
 * languages.
 */
export type NewsEntry = { date: IsoDate; text: Record<Locale, string> };

export const newsEntries: NewsEntry[] = [
  {
    date: "2026-11-03",
    text: {
      de: "Zwei unserer Trader sind unerwartet ausgeschieden.",
      en: "Two of our traders have unexpectedly left the company.",
    },
  },
  {
    date: "2026-10-20",
    text: {
      de: "Vom 22.10. bis 27.10. treffen wir uns mit Tradern, der Support antwortet ggf. verzögert.",
      en: "From 22.10. to 27.10. we will be meeting with traders; support may respond with a delay.",
    },
  },
  {
    date: "2026-10-10",
    text: {
      de: "Neue EU-SEPA-Bankverbindung ist da, Einzahlungen von 200 bis 700 €.",
      en: "A new EU SEPA bank account is available, for deposits of €200 to €700.",
    },
  },
  {
    date: "2026-10-09",
    text: {
      de: "Einzahlungen per Monero (XMR, anonymer Coin) sind ab sofort möglich, Auszahlungen ab 01.27.",
      en: "Deposits via Monero (XMR, anonymous coin) are now possible; withdrawals from January 2027.",
    },
  },
  {
    date: "2026-10-02",
    text: {
      de: "Die Zusammenarbeit mit einem Trader wurde beendet.",
      en: "Our collaboration with one trader has ended.",
    },
  },
  {
    date: "2026-08-21",
    text: {
      de: "Neue EU-SEPA-Bankverbindung ist da, Einzahlungen von 100 bis 900 €.",
      en: "A new EU SEPA bank account is available, for deposits of €100 to €900.",
    },
  },
  {
    date: "2026-07-08",
    text: {
      de: "Wegen eines Live-Business-Meetings vom 09.07. bis 12.07. ist der Support nur per E-Mail erreichbar.",
      en: "Due to a live business meeting from 09.07. to 12.07., support is only available via email.",
    },
  },
  {
    date: "2026-06-30",
    text: {
      de: "Wegen Büroumzug werden Kontostände bis zum 03.07. aktualisiert.",
      en: "Due to an office move, account balances will be updated until 03.07.",
    },
  },
  {
    date: "2026-06-02",
    text: {
      de: "Voraussichtlich ab dem 05.06. stehen die Renditen für den Mai fest und sind sichtbar.",
      en: "The returns for May are expected to be final and visible from 05.06.",
    },
  },
  {
    date: "2026-05-03",
    text: {
      de: "Die Kontostände werden nach dem 05.05. aktualisiert.",
      en: "Account balances will be updated after 05.05.",
    },
  },
  {
    date: "2026-04-05",
    text: {
      de: "Die ersten Konten werden ab dem 06.04. berechnet.",
      en: "The first accounts will be calculated from 06.04.",
    },
  },
  {
    date: "2026-04-01",
    text: {
      de: "Der Pool ist für neue Investoren geschlossen.",
      en: "The pool is closed to new investors.",
    },
  },
  {
    date: "2026-03-30",
    text: {
      de: "Der Pool wurde für Neukunden geschlossen, Anfragen bis zum 30.03.26 werden noch beantwortet.",
      en: "The pool has been closed to new customers; enquiries received by 30.03.26 will still be answered.",
    },
  },
  {
    date: "2026-03-20",
    text: {
      de: "Ab sofort akzeptieren wir für Ein- und Auszahlungen Monero (XMR, anonymer Coin) bis 3.000 Euro.",
      en: "We now accept Monero (XMR, anonymous coin) for deposits and withdrawals up to €3,000.",
    },
  },
  {
    date: "2026-03-01",
    text: {
      de: "Die Renditen der Trader für Februar erscheinen voraussichtlich ab dem 04.03.26 online.",
      en: "The traders' returns for February are expected to be online from 04.03.26.",
    },
  },
  {
    date: "2026-02-18",
    text: {
      de: "Das Limit für Einzahlungen ändert sich ab dem 10.03.26 zu mindestens 750 Euro bis maximal 75.000 Euro.",
      en: "From 10.03.26 the deposit limit changes to a minimum of €750 and a maximum of €75,000.",
    },
  },
  {
    date: "2025-11-03",
    text: {
      de: "Aufgrund des Tsunamis gibt es Verzögerungen wegen der folgenden Strom- und Internetausfälle.",
      en: "Due to the tsunami, there are delays because of the resulting power and internet outages.",
    },
  },
  {
    date: "2025-10-18",
    text: {
      de: "Ab 20.10. können unsere Kunden eine eigene EU-IBAN bekommen, mit angeschlossener dezentraler Exchange und VISA-Karte. Damit sind auch Ein- und Auszahlungen gebührenfrei.",
      en: "From 20.10. our customers can get their own EU IBAN, with an associated decentralized exchange and VISA card; deposits and withdrawals are then free of charge.",
    },
  },
  {
    date: "2025-10-09",
    text: {
      de: "Aufgrund des Erdbebens mit Stromausfällen erfolgt die Abrechnung zum Teil 1–4 Tage später.",
      en: "Due to the earthquake and resulting power outages, some billing will be delayed by 1–4 days.",
    },
  },
  {
    date: "2025-09-28",
    text: {
      de: "Eigenes Team für den Versand der Kontoauszüge, der Versand erfolgt über Tuta-Mail (siehe „Kontakt“).",
      en: "A dedicated team now sends the account statements, via Tuta mail (see “Contact”).",
    },
  },
  {
    date: "2025-07-24",
    text: {
      de: "Die ersten 50 Investoren können nach dem 02.08.25 ihren Kontostand online einsehen.",
      en: "The first 50 investors can view their account balance online after 02.08.25.",
    },
  },
  {
    date: "2025-07-23",
    text: {
      de: "Eine Einzahlung per deutscher Kreditkarte (Visa / Mastercard, auch Debit) ist ab sofort auf Anfrage möglich.",
      en: "Deposits by German credit card (Visa / Mastercard, also debit) are possible now, on request.",
    },
  },
  {
    date: "2025-07-02",
    text: {
      de: "Voraussichtlich ab 20.07.25 ist eine Einzahlung auch per Kreditkarte (auch Debitkarte) möglich.",
      en: "From about 20.07.25, deposits will also be possible by credit card (including debit card).",
    },
  },
  {
    date: "2025-06-07",
    text: {
      de: "Geplante Zusammenarbeit mit einem Zahlungsdienstleister, Zahlart wählbar (SWIFT, BTC, Kreditkarte usw.).",
      en: "Planned cooperation with a payment service provider, with a selectable payment method (SWIFT, BTC, credit card etc.).",
    },
  },
  {
    date: "2025-05-01",
    text: {
      de: "Das Einzahlungslimit wurde von 50.000 Euro auf 60.000 Euro angepasst (der Kontostand darf höher sein).",
      en: "The deposit limit has been raised from €50,000 to €60,000 (the account balance may be higher).",
    },
  },
  {
    date: "2025-04-10",
    text: {
      de: "Bei Ein- und Auszahlungen von Börsen werden ab 16.04.25 3 % Gebühr berechnet (private Wallets 0 Euro).",
      en: "From 16.04.25 a 3% fee applies to deposits and withdrawals from exchanges (private wallets €0).",
    },
  },
  {
    date: "2025-04-10",
    text: {
      de: "Ab 15.04.25 akzeptieren wir keine Ein- und Auszahlungen von Börsen mehr, nur noch von privaten Wallets.",
      en: "From 15.04.25 we no longer accept deposits and withdrawals from exchanges, only from private wallets.",
    },
  },
  {
    date: "2025-03-28",
    text: {
      de: "Aufstockungen können ab sofort zwischen 100 und 300 Euro auch in XRP (Ripple) erfolgen.",
      en: "Top-ups between €100 and €300 can now also be made in XRP (Ripple).",
    },
  },
  {
    date: "2025-03-03",
    text: {
      de: "Nach dem Betatest wird ab Ende April für einige Kunden eine Guthabenabfrage online verfügbar sein.",
      en: "After beta testing, an online balance check will be available for some customers from the end of April.",
    },
  },
  {
    date: "2025-03-01",
    text: {
      de: "Unsere neue IBAN-Bank hat den Start im Mai 2025 nach langer Vorlaufzeit jetzt offiziell bestätigt.",
      en: "Our new IBAN bank has now officially confirmed its launch in May 2025 after a long lead time.",
    },
  },
  {
    date: "2025-02-01",
    text: {
      de: "Ab dem 02.02.25 können Einzahlungen bis 500 Euro auch per TRX (Tron) und SOL (Solana) erfolgen.",
      en: "From 02.02.25, deposits up to €500 can also be made via TRX (Tron) and SOL (Solana).",
    },
  },
  {
    date: "2025-02-01",
    text: {
      de: "Ab sofort können Einzahlungen auch in USDC (BEP20) bis 10.000 USDC erfolgen.",
      en: "Deposits can now also be made in USDC (BEP20), up to 10,000 USDC.",
    },
  },
  {
    date: "2025-01-30",
    text: {
      de: "Der Start der neuen Bank mit weiterer IBAN verzögert sich auf voraussichtlich 31.03.25.",
      en: "The launch of the new bank with an additional IBAN is delayed until about 31.03.25.",
    },
  },
  {
    date: "2024-11-24",
    text: {
      de: "Unsere neue Bank mit SEPA-Anbindung wird definitiv im April 2025 aktiv und kann dann genutzt werden.",
      en: "Our new bank with SEPA connection will definitely be active in April 2025 and can then be used.",
    },
  },
  {
    date: "2024-11-23",
    text: {
      de: "Ab dem 01.01.2025 ändert sich die Mindesteinzahlung im Pool für Neukunden auf 500 Euro.",
      en: "From 01.01.2025 the minimum deposit in the pool for new customers changes to €500.",
    },
  },
  {
    date: "2024-10-14",
    text: {
      de: "Ab dem 30.12.24 steht auch eine Adresse für USDC zur Verfügung, USDC-Auszahlungen ab 05.01.25.",
      en: "From 30.12.24 an address for USDC will also be available; USDC withdrawals from 05.01.25.",
    },
  },
  {
    date: "2024-07-27",
    text: {
      de: "Ab sofort kann auch per Tron (TRX) und BNB (Binance Coin) eingezahlt oder aufgestockt werden.",
      en: "Deposits and top-ups can now also be made via Tron (TRX) and BNB (Binance Coin).",
    },
  },
  {
    date: "2024-07-16",
    text: {
      de: "Unsere neue Bank mit IBAN ohne Ein- oder Auszahlungslimit wird voraussichtlich zum 25.12.24 aktiv sein.",
      en: "Our new bank with an IBAN and no deposit or withdrawal limits is expected to be active from 25.12.24.",
    },
  },
  {
    date: "2024-07-01",
    text: {
      de: "Investoren aus Asien können jetzt auch per Maya und GCash einzahlen oder Auszahlungen erhalten.",
      en: "Investors in Asia can now also deposit or receive withdrawals via Maya and GCash.",
    },
  },
  {
    date: "2024-07-01",
    text: {
      de: "Das Limit für Einzahlungen wurde von 30.000 Euro auf 50.000 Euro je Konto angehoben.",
      en: "The deposit limit was raised from €30,000 to €50,000 per account.",
    },
  },
  {
    date: "2024-07-01",
    text: {
      de: "Eine weitere SWIFT-Bankverbindung wurde freigeschaltet und steht ab sofort zur Verfügung.",
      en: "Another SWIFT bank account has been activated and is available now.",
    },
  },
  {
    date: "2024-06-16",
    text: {
      de: "Neue und Bestandskunden können ab sofort auch mit USDT BEP20 und TRC20 (Stablecoin) einzahlen.",
      en: "New and existing customers can now also deposit with USDT BEP20 and TRC20 (stablecoin).",
    },
  },
  {
    date: "2024-06-15",
    text: {
      de: "Voraussichtlich ab dem 28.06.24 steht eine weitere SWIFT-Bankverbindung zur Verfügung.",
      en: "Another SWIFT bank account is expected to be available from 28.06.24.",
    },
  },
  {
    date: "2024-06-14",
    text: {
      de: "Unsere Bestandskunden können ab sofort auch mit Western Union einzahlen, Details auf Anfrage.",
      en: "Our existing customers can now also deposit via Western Union; details on request.",
    },
  },
  {
    date: "2024-06-03",
    text: {
      de: "Unsere Bestandskunden können ab sofort auch mit RIA Money Transfer einzahlen, Details auf Anfrage.",
      en: "Our existing customers can now also deposit via RIA Money Transfer; details on request.",
    },
  },
  {
    date: "2024-02-17",
    text: {
      de: "Unsere neue IBAN ist voraussichtlich ab dem 30.09.2024 für Neu- und Bestandskunden aktiv.",
      en: "Our new IBAN is expected to be active from 30.09.2024 for new and existing customers.",
    },
  },
  {
    date: "2024-02-02",
    text: {
      de: "Unsere Bestandskunden können ab sofort auch mit Remitly per SEPA einzahlen, Details auf Anfrage.",
      en: "Our existing customers can now also pay by SEPA using Remitly; details on request.",
    },
  },
  {
    date: "2024-01-30",
    text: {
      de: "Für bestehende Kunden steht jetzt auch ein SWIFT-Konto zur Aufstockung per Überweisung bereit.",
      en: "A SWIFT account is now available for existing customers to top up their balance by bank transfer.",
    },
  },
  {
    date: "2024-01-10",
    text: {
      de: "Unsere Bank führt ein Empfangslimit ein, Bitcoin- und Litecoin-Zahlungen gehen weiterhin bis 30.000 Euro.",
      en: "Our bank is introducing a receiving limit; Bitcoin and Litecoin payments are still accepted up to €30,000.",
    },
  },
];

/** Newest first. */
export function sortedNews(entries: readonly NewsEntry[] = newsEntries): NewsEntry[] {
  return entries.toSorted((left, right) => right.date.localeCompare(left.date));
}
