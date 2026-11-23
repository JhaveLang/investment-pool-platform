import { SITE } from "@/config/site";
import type { Locale } from "@/i18n/config";

/**
 * Impressum and privacy policy of the public website. They are templates: what the app itself does (data it
 * stores, cookies) is filled in; the operator's details stand in [brackets] and must be completed,
 * and the texts reviewed by a lawyer, before `LEGAL_TEMPLATES_PENDING` is set to `false`.
 */
export const LEGAL_TEMPLATES_PENDING = true;

export type LegalSection = {
  heading: string;
  /** Running text. */
  paragraphs?: string[];
  /** Lines without bullets, e.g. an address. */
  lines?: string[];
  /** A bulleted list. */
  items?: string[];
};

export type LegalDocument = { intro?: string; sections: LegalSection[] };

export type LegalPage = "imprint" | "privacy";

export const legalDocuments: Record<LegalPage, Record<Locale, LegalDocument>> = {
  imprint: {
    de: {
      sections: [
        {
          heading: "Angaben gemäß § 5 DDG",
          lines: ["[Name bzw. Firma des Betreibers]", "[Straße und Hausnummer]", "[PLZ Ort, Land]"],
        },
        { heading: "Kontakt", lines: [`E-Mail: ${SITE.contactEmail}`, "Telefon: [Telefonnummer]"] },
        { heading: "Vertreten durch", lines: ["[Name der vertretungsberechtigten Person]"] },
        { heading: "Registereintrag", lines: ["[Registergericht und Registernummer, falls vorhanden]"] },
        {
          heading: "Umsatzsteuer-ID",
          lines: ["[Umsatzsteuer-Identifikationsnummer nach § 27a UStG, falls vorhanden]"],
        },
        {
          heading: "Erlaubnis und Aufsicht",
          paragraphs: [
            "[Angaben zur Erlaubnis für die angebotenen Finanzdienstleistungen und zur zuständigen Aufsichtsbehörde (z. B. BaFin) – oder der Grund, warum keine Erlaubnis erforderlich ist.]",
          ],
        },
        { heading: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", lines: ["[Name, Anschrift]"] },
        {
          heading: "Verbraucherstreitbeilegung",
          paragraphs: [
            "[Angabe, ob der Betreiber an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilnimmt (§ 36 VSBG).]",
          ],
        },
      ],
    },
    en: {
      sections: [
        {
          heading: "Information pursuant to § 5 DDG",
          lines: ["[Name or company of the operator]", "[Street and number]", "[Postcode, city, country]"],
        },
        { heading: "Contact", lines: [`Email: ${SITE.contactEmail}`, "Phone: [phone number]"] },
        { heading: "Represented by", lines: ["[Name of the authorised representative]"] },
        { heading: "Register entry", lines: ["[Register court and registration number, if any]"] },
        { heading: "VAT ID", lines: ["[VAT identification number under § 27a UStG, if any]"] },
        {
          heading: "Licence and supervision",
          paragraphs: [
            "[Details of the licence for the financial services offered and of the competent supervisory authority (e.g. BaFin) – or the reason why no licence is required.]",
          ],
        },
        { heading: "Responsible for the content under § 18(2) MStV", lines: ["[Name, address]"] },
        {
          heading: "Consumer dispute resolution",
          paragraphs: [
            "[Whether the operator takes part in dispute resolution proceedings before a consumer arbitration board (§ 36 VSBG).]",
          ],
        },
      ],
    },
  },

  privacy: {
    de: {
      sections: [
        {
          heading: "Verantwortlicher",
          lines: ["[Name bzw. Firma des Betreibers]", "[Anschrift]", `E-Mail: ${SITE.contactEmail}`],
        },
        {
          heading: "Welche Daten wir verarbeiten",
          items: [
            "Konto: Name, E-Mail-Adresse, Anleger-ID und Passwort (nur als nicht umkehrbarer Hash gespeichert).",
            "Konto- und Buchungsdaten: Einzahlungen, Auszahlungen, Renditen und Kontostand.",
            "Auszahlungsziele: die IBAN bzw. Wallet-Adresse, die Sie bei einer Auszahlung angeben.",
            "Aktivitätsprotokoll: An- und Abmeldungen, Anträge und Änderungen mit Zeitpunkt und IP-Adresse.",
            "E-Mails, die Sie uns senden, mit ihrem Inhalt.",
          ],
        },
        {
          heading: "Zwecke und Rechtsgrundlagen",
          items: [
            "Führung Ihres Kontos und Abwicklung von Ein- und Auszahlungen (Art. 6 Abs. 1 lit. b DSGVO).",
            "Erfüllung gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).",
            "Sicherheit der Konten und Nachvollziehbarkeit jeder Buchung über das Aktivitätsprotokoll (Art. 6 Abs. 1 lit. f DSGVO).",
            "Beantwortung Ihrer Anfragen (Art. 6 Abs. 1 lit. b bzw. f DSGVO).",
          ],
        },
        {
          heading: "Cookies und lokale Speicherung",
          paragraphs: [
            "Die Website setzt nur technisch notwendige Cookies: ein Sitzungs-Cookie für die Anmeldung und ein Cookie für die gewählte Sprache (ein Jahr). Zum Schutz vor Missbrauch werden Anmeldeversuche je IP-Adresse und E-Mail-Adresse kurzzeitig gezählt. Im Admin-Bereich speichert der Browser lokal, welche Benachrichtigungen gelesen wurden.",
            "Es gibt keine Analyse- oder Werbe-Cookies und keine Dienste Dritter zur Reichweitenmessung.",
          ],
        },
        { heading: "Hosting", paragraphs: ["[Hosting-Anbieter, Serverstandort und Auftragsverarbeitungsvertrag]"] },
        {
          heading: "Empfänger",
          paragraphs: [
            "[Empfänger der Daten, z. B. Banken, Zahlungsdienstleister oder Handelspartner, und etwaige Übermittlungen in Drittländer]",
          ],
        },
        {
          heading: "Speicherdauer",
          paragraphs: [
            "Kontodaten speichern wir, solange Ihr Konto besteht, und danach für die Dauer der gesetzlichen Aufbewahrungspflichten. Buchungen und Einträge im Aktivitätsprotokoll werden nicht verändert oder gelöscht, damit jede Buchung nachvollziehbar bleibt. [Konkrete Fristen ergänzen.]",
          ],
        },
        {
          heading: "Ihre Rechte",
          items: [
            "Auskunft (Art. 15 DSGVO)",
            "Berichtigung (Art. 16 DSGVO)",
            "Löschung (Art. 17 DSGVO), soweit keine Aufbewahrungspflicht besteht",
            "Einschränkung der Verarbeitung (Art. 18 DSGVO)",
            "Datenübertragbarkeit (Art. 20 DSGVO)",
            "Widerspruch (Art. 21 DSGVO)",
            "Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO)",
          ],
        },
        {
          heading: "Kontakt zum Datenschutz",
          paragraphs: [`Fragen zum Datenschutz richten Sie an ${SITE.contactEmail}.`],
        },
      ],
    },
    en: {
      sections: [
        {
          heading: "Controller",
          lines: ["[Name or company of the operator]", "[Address]", `Email: ${SITE.contactEmail}`],
        },
        {
          heading: "What data we process",
          items: [
            "Account: name, email address, investor ID and password (stored only as an irreversible hash).",
            "Account and booking data: deposits, withdrawals, returns and balance.",
            "Payout destinations: the IBAN or wallet address you enter for a withdrawal.",
            "Activity log: sign-ins and sign-outs, requests and changes with time and IP address.",
            "Emails you send us, with their content.",
          ],
        },
        {
          heading: "Purposes and legal bases",
          items: [
            "Running your account and processing deposits and withdrawals (Art. 6(1)(b) GDPR).",
            "Statutory retention obligations (Art. 6(1)(c) GDPR).",
            "Account security and a traceable record of every booking in the activity log (Art. 6(1)(f) GDPR).",
            "Answering your enquiries (Art. 6(1)(b) or (f) GDPR).",
          ],
        },
        {
          heading: "Cookies and local storage",
          paragraphs: [
            "The website only sets technically necessary cookies: a session cookie for signing in and a cookie for the chosen language (one year). To prevent abuse, sign-in attempts are briefly counted per IP address and email address. In the admin area, the browser stores locally which notifications have been read.",
            "There are no analytics or advertising cookies and no third-party audience measurement.",
          ],
        },
        { heading: "Hosting", paragraphs: ["[Hosting provider, server location and data processing agreement]"] },
        {
          heading: "Recipients",
          paragraphs: [
            "[Recipients of the data, e.g. banks, payment service providers or trading partners, and any transfers to third countries]",
          ],
        },
        {
          heading: "Retention",
          paragraphs: [
            "We keep account data for as long as your account exists and afterwards for the statutory retention periods. Bookings and activity log entries are never changed or deleted, so every booking stays traceable. [Add the specific periods.]",
          ],
        },
        {
          heading: "Your rights",
          items: [
            "Access (Art. 15 GDPR)",
            "Rectification (Art. 16 GDPR)",
            "Erasure (Art. 17 GDPR), unless a retention obligation applies",
            "Restriction of processing (Art. 18 GDPR)",
            "Data portability (Art. 20 GDPR)",
            "Objection (Art. 21 GDPR)",
            "Complaint to a data protection authority (Art. 77 GDPR)",
          ],
        },
        { heading: "Privacy contact", paragraphs: [`Send questions about data protection to ${SITE.contactEmail}.`] },
      ],
    },
  },
};
