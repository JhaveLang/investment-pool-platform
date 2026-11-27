import type { Locale } from "@/i18n/config";
import type { PaymentMethod } from "@/lib/fees";

type FaqFacts = {
  depositMin: string;
  depositMax: string;
  depositsOpen: boolean;
  accrualDays: number;
  lockDays: number;
  payoutDays: number;
  bankFee: string;
  walletFee: string;
  exchangeFee: string;
};

type GuideTopic = {
  title: string;
  summary: string;
  link: string;
  questions: { question: string; answer: string | ((facts: FaqFacts) => string); source?: { label: string; href: string } }[];
};

export const topicIds = ["pool", "returns", "payments"] as const;
type Guide = {
  servicesIntro: string;
  faqLink: string;
  faqTitle: string;
  faqIntro: string;
  topicsLabel: string;
  contactLink: string;
  helpTitle: string;
  helpText: string;
  feesTitle: string;
  feesIntro: string;
  feeMethods: Record<PaymentMethod, string>;
  topics: Record<(typeof topicIds)[number], GuideTopic>;
};

const riskSource = "https://www.esma.europa.eu/sites/default/files/2025-10/Joint_ESAs_revised_warning_on_crypto-assets.pdf";

export const investorGuide: Record<Locale, Guide> = {
  en: {
    servicesIntro: "Get to know the pool, follow your monthly results and see how money moves into and out of your account.",
    faqLink: "Browse the FAQs",
    faqTitle: "Frequently asked questions",
    faqIntro: "Find answers about the pool, your statements and everyday account requests.",
    topicsLabel: "On this page",
    contactLink: "Contact the team",
    helpTitle: "A question about your account?",
    helpText: "The pool team can look into a specific booking, statement or payment.",
    feesTitle: "Transfer fees",
    feesIntro: "Your payment method determines the fee. You can review the exact amount before submitting a request.",
    feeMethods: { bank_transfer: "Bank transfer", crypto: "Private crypto wallet", exchange: "Crypto exchange" },
    topics: {
      pool: {
        title: "The investment pool",
        summary: "The pool has reported activities in crypto trading, staking and decentralized finance. Ask the team for the current allocation.",
        link: "Investments and risk",
        questions: [
          { question: "What does the pool invest in?", answer: "The pool has described activities including crypto trading, staking and decentralized finance, as well as earlier lending to local businesses. For the current holdings and the share allocated to each activity, contact the pool team." },
          { question: "What risks should I understand?", answer: "Crypto-asset prices can rise or fall sharply. You can lose part or all of the money you invest. A monthly result shown in your account records a past outcome.", source: { label: "Read the European financial regulators’ risk warning (PDF)", href: riskSource } },
          { question: "Who can I ask about referring someone?", answer: "Contact the pool team about introductions and current admission terms before referring someone." },
        ],
      },
      returns: {
        title: "Returns and statements",
        summary: "Your monthly result reflects the days your capital participated. Each booking in your transaction history shows how your balance changed.",
        link: "How returns are booked",
        questions: [
          { question: "When do standard-pool returns start?", answer: ({ accrualDays }) => `A deposit starts participating in the pool result ${accrualDays} calendar days after the payment is received. Weekends count toward that period.` },
          { question: "How is my monthly result calculated?", answer: "The pool applies the month’s result to your eligible capital for the days it participated. Your transactions show the amount credited or debited when that month is booked." },
          { question: "Where can I see my statement?", answer: "Sign in and open Transactions to review your bookings and the balance after each one. For a copy of an account statement, contact the billing team through the Contact page." },
        ],
      },
      payments: {
        title: "Deposits and withdrawals",
        summary: "Your account shows the current deposit limits, the amount available for withdrawal and the status of each payment request.",
        link: "Limits, fees and payouts",
        questions: [
          { question: "How do I make a deposit, and what are the limits?", answer: ({ depositsOpen, depositMin, depositMax }) => depositsOpen
            ? `You can request a standard-pool deposit between ${depositMin} and ${depositMax}. Sign in, open Deposit, enter the amount and choose a payment method. Use the reference from your request when sending the payment.`
            : "New standard-pool deposits are currently paused. You can still see the status of earlier requests in your account." },
          { question: "What fees apply?", answer: ({ bankFee, walletFee, exchangeFee }) => `The platform fee is ${bankFee} for a bank transfer, ${walletFee} for a private crypto wallet and ${exchangeFee} for an exchange. A deposit fee comes out of the amount received. For a withdrawal, the form shows the total debit, including the fee, before you submit.` },
          { question: "When can I withdraw my deposit?", answer: ({ lockDays }) => `Standard-pool deposits unlock ${lockDays} days after receipt. Your dashboard shows the next release date and how much you can withdraw today. Booked returns are available subject to funds reserved for pending requests or bookings.` },
          { question: "How do I request a payout?", answer: ({ payoutDays }) => `Open Withdraw in your account, choose the amount and enter your bank or wallet details. Check the fee and submit the request. The standard payout period is ${payoutDays} days from the request.` },
        ],
      },
    },
  },
  de: {
    servicesIntro: "Lernen Sie den Pool kennen, verfolgen Sie Ihre Monatsergebnisse und erfahren Sie, wie Ein- und Auszahlungen ablaufen.",
    faqLink: "Zu den häufigen Fragen",
    faqTitle: "Häufig gestellte Fragen",
    faqIntro: "Antworten zu den Anlagen des Pools, Ihren Abrechnungen und den Abläufen rund um Ihr Konto.",
    topicsLabel: "Auf dieser Seite",
    contactLink: "Team kontaktieren",
    helpTitle: "Eine Frage zu Ihrem Konto?",
    helpText: "Das Pool-Team hilft Ihnen bei einzelnen Buchungen, Abrechnungen und Zahlungen.",
    feesTitle: "Gebühren nach Zahlungsweg",
    feesIntro: "Die Gebühr richtet sich nach Ihrem Zahlungsweg. Den genauen Betrag sehen Sie vor dem Absenden Ihres Antrags.",
    feeMethods: { bank_transfer: "Banküberweisung", crypto: "Private Krypto-Wallet", exchange: "Kryptobörse" },
    topics: {
      pool: {
        title: "Der Investmentpool",
        summary: "Der Pool hat über Kryptohandel, Staking und dezentrale Finanzanwendungen berichtet. Die aktuelle Gewichtung erfahren Sie beim Team.",
        link: "Anlagen und Risiken",
        questions: [
          { question: "Worin investiert der Pool?", answer: "Der Pool hat unter anderem Kryptohandel, Staking und dezentrale Finanzanwendungen sowie frühere Darlehen an lokale Unternehmen beschrieben. Die aktuelle Zusammensetzung und Gewichtung der Anlagen erfahren Sie beim Pool-Team." },
          { question: "Welche Risiken bestehen?", answer: "Die Preise von Kryptowerten können stark schwanken. Ein teilweiser oder vollständiger Verlust des eingesetzten Kapitals ist möglich. Ein verbuchtes Monatsergebnis zeigt die Entwicklung des jeweiligen vergangenen Monats.", source: { label: "Risikohinweis der europäischen Finanzaufsichtsbehörden lesen (PDF, Englisch)", href: riskSource } },
          { question: "An wen wende ich mich bei einer Empfehlung?", answer: "Wenn Sie jemanden empfehlen möchten, erkundigen Sie sich zuvor beim Pool-Team nach den aktuellen Aufnahmebedingungen." },
        ],
      },
      returns: {
        title: "Renditen und Abrechnungen",
        summary: "Für Ihr Monatsergebnis zählen die Tage, an denen Ihr Kapital am Pool teilgenommen hat. Unter Transaktionen sehen Sie, wie jede Buchung Ihren Kontostand verändert hat.",
        link: "So wird das Ergebnis verbucht",
        questions: [
          { question: "Ab wann nimmt meine Einzahlung am Ergebnis teil?", answer: ({ accrualDays }) => `Eine Einzahlung im Standard-Pool nimmt ab ${accrualDays} Kalendertagen nach Zahlungseingang am Ergebnis teil. Samstage und Sonntage zählen mit.` },
          { question: "Wie wird mein Monatsergebnis berechnet?", answer: "Für das Monatsergebnis zählt Ihr teilnahmeberechtigtes Kapital an den einzelnen Tagen des Monats. Nach der Buchung sehen Sie die Gutschrift oder Belastung unter Transaktionen." },
          { question: "Wo finde ich meinen Kontoauszug?", answer: "Unter Transaktionen sehen Sie Ihre Buchungen und den jeweiligen Kontostand. Eine Kopie Ihrer Abrechnung können Sie über die Kontaktseite beim Abrechnungsteam anfordern." },
        ],
      },
      payments: {
        title: "Ein- und Auszahlungen",
        summary: "In Ihrem Konto sehen Sie die aktuellen Einzahlungsgrenzen, Ihr auszahlbares Guthaben und den Bearbeitungsstand jeder Zahlung.",
        link: "Grenzen, Gebühren und Fristen",
        questions: [
          { question: "Wie zahle ich ein und welche Grenzen gelten?", answer: ({ depositsOpen, depositMin, depositMax }) => depositsOpen
            ? `Einzahlungen im Standard-Pool sind zwischen ${depositMin} und ${depositMax} pro Antrag möglich. Öffnen Sie nach der Anmeldung die Seite Einzahlung und wählen Sie Betrag und Zahlungsweg. Geben Sie bei der Zahlung die Referenz aus Ihrem Antrag an.`
            : "Neue Einzahlungen im Standard-Pool sind derzeit pausiert. Den Status früherer Anträge sehen Sie weiterhin in Ihrem Konto." },
          { question: "Welche Gebühren fallen an?", answer: ({ bankFee, walletFee, exchangeFee }) => `Die Plattformgebühr beträgt ${bankFee} bei Banküberweisungen, ${walletFee} bei privaten Krypto-Wallets und ${exchangeFee} bei Kryptobörsen. Bei Einzahlungen wird die Gebühr vom Eingangsbetrag abgezogen. Bei Auszahlungen sehen Sie die gesamte Belastung einschließlich Gebühr vor dem Absenden.` },
          { question: "Wann kann ich meine Einzahlung auszahlen lassen?", answer: ({ lockDays }) => `Einzahlungen im Standard-Pool werden ${lockDays} Tage nach Zahlungseingang frei. Die Übersicht zeigt die nächste Freigabe und den aktuell auszahlbaren Betrag. Gebuchte Renditen stehen zur Verfügung, soweit das Guthaben nicht für Anträge oder Buchungen reserviert ist.` },
          { question: "Wie beantrage ich eine Auszahlung?", answer: ({ payoutDays }) => `Öffnen Sie Auszahlung in Ihrem Konto, wählen Sie den Betrag und geben Sie Ihre Bank- oder Walletdaten ein. Prüfen Sie die Gebühr und senden Sie den Antrag ab. Die reguläre Auszahlungsfrist beträgt ${payoutDays} Tage ab Antragstellung.` },
        ],
      },
    },
  },
};
