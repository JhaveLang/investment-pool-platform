import "server-only";
import { createTransport } from "nodemailer";
import { z } from "zod";
import { de } from "@/i18n/messages/de";
import { en } from "@/i18n/messages/en";
import { formatIsoDate, getFormatter } from "@/lib/format";
import { describeInvestorNotification, type InvestorNotification } from "@/lib/notifications";
import { payoutDeadline } from "@/lib/returns";
import type { SessionUser } from "./auth/session";
import type { Deposit } from "./db/schema";
import { listInvestorsForNotification } from "./queries/notifications";

type RequestSummary = Pick<Deposit, "reference" | "amountCents" | "feeCents" | "method" | "createdAt">;

const depositInvitation =
  "If you’d like to add to your investment, open Move money in your account and choose Deposit. " +
  "When deposits are open, you can enter an amount to see the fee and minimum term before submitting.";
const investorSignoff = `Kind regards,\nThe ${en.app.name} team`;

function investorNextStep(update: InvestorNotification): string {
  switch (update.type) {
    case "deposit.reconciled":
      return `Thank you for investing with us. You can see your deposit and the balance after it under Transactions.\n\n${depositInvitation}`;
    case "deposit.rejected":
    case "withdrawal.rejected":
      return "If you have questions about this decision, please use the Contact page to reach our team. Include your transaction reference so we can look up your request.";
    case "withdrawal.approved":
      return "You can find the payout details under Move money by choosing Withdraw. Please keep your reference in case you need to contact us about the transfer.";
    case "returns.booked": {
      const history = "You can see this entry and the balance after it under Transactions in your account.";
      return (update.amountCents ?? 0) > 0 ? `${history}\n\n${depositInvitation}` : history;
    }
  }
}

const settings = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.email(),
});

function getMailTransport() {
  const env = process.env;
  if (!env.SMTP_HOST && !env.ADMIN_NOTIFICATION_EMAIL) return null;

  const config = settings.safeParse({
    host: env.SMTP_HOST?.trim(),
    port: env.SMTP_PORT || 587,
    user: env.SMTP_USER?.trim(),
    password: env.SMTP_PASSWORD,
    from: (env.MAIL_FROM || env.SMTP_USER)?.trim(),
  });
  if (!config.success) {
    const fields = config.error.issues.map((issue) => issue.path.join(".")).join(", ");
    console.error("[mail] Invalid SMTP settings:", fields);
    return null;
  }

  const { host, port, user, password, from } = config.data;
  return createTransport(
    {
      host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass: password },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    },
    { from },
  );
}

async function deliver(
  transport: NonNullable<ReturnType<typeof getMailTransport>>,
  recipients: string[],
  subject: string,
  text: string,
  eventId: string | number,
) {
  const addresses = z.array(z.email()).min(1).safeParse(recipients);
  if (!addresses.success) {
    console.error("[mail] Invalid recipient for", eventId);
    return;
  }
  try {
    const result = await transport.sendMail({ to: addresses.data, subject, text });
    if (result.rejected.length) console.error("[mail] Some recipients were rejected for", eventId);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : "SMTP_ERROR";
    console.error("[mail] Delivery failed:", eventId, code);
  }
}

/** Called only after a new deposit or withdrawal has committed. */
export async function sendRequestMail(
  kind: "deposit" | "withdrawal",
  request: RequestSummary,
  investor: Pick<SessionUser, "fullName" | "email" | "investorCode">,
): Promise<void> {
  const transport = getMailTransport();
  if (!transport) return;
  const format = getFormatter("de");
  const deposit = kind === "deposit";
  const title = deposit ? "Neue Einzahlung" : "Neue Auszahlungsanfrage";
  const { amountCents, feeCents, reference, createdAt, method } = request;
  const lines = [
    title,
    `Referenz: ${reference}`,
    `Anleger: ${investor.fullName} (${investor.email})`,
    `${de.profile.investorCode}: ${investor.investorCode ?? "—"}`,
    `Eingang: ${format.dateTime(createdAt)} (Berlin)`,
    `Betrag: ${format.currency(amountCents)}`,
    `Zahlungsweg: ${de.paymentMethods[method]}`,
    `Gebühr: ${format.currency(feeCents)}`,
    deposit ? `Gutschrift nach Abgleich: ${format.currency(amountCents - feeCents)}`
      : `Gesamtbelastung bei Freigabe: ${format.currency(amountCents + feeCents)}`,
  ];
  if (!deposit) {
    lines.push(`Auszahlung fällig bis: ${format.calendarDate(payoutDeadline(formatIsoDate(createdAt)))}`);
  }
  lines.push("", `Bitte prüfen Sie die Anfrage im Adminbereich unter ${deposit ? "Einzahlungen" : "Auszahlungen"}.`);

  const english = getFormatter("en");
  const receiptTitle = deposit ? "Deposit request received" : "Withdrawal request received";
  const receipt = [
    `Dear ${investor.fullName},`,
    "",
    deposit
      ? "Thank you for your deposit request. It is awaiting review while our team matches it to the incoming payment. We’ll email you with the outcome."
      : "Your withdrawal request is awaiting review. We’ve reserved the payout amount and any applicable fee in your account. We’ll email you when the review is complete.",
    "",
    `Investor ID: ${investor.investorCode ?? "—"}`,
    `Reference: ${reference}`,
    `Submitted: ${english.dateTime(createdAt)} (Berlin)`,
    `Amount: ${english.currency(amountCents)}`,
    `Payment method: ${en.paymentMethods[method]}`,
    `Fee: ${english.currency(feeCents)}`,
    deposit ? `Credit if approved: ${english.currency(amountCents - feeCents)}`
      : `Total debit if approved: ${english.currency(amountCents + feeCents)}`,
    "",
    deposit ? depositInvitation : "To track your request, open Move money in your account and choose Withdraw.",
    "",
    investorSignoff,
  ];
  const adminRecipients = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const deliveries = [
    deliver(transport, [investor.email], `${receiptTitle} · ${reference}`, receipt.join("\n"), reference),
  ];
  if (adminRecipients) {
    const team = adminRecipients.split(",").map((address) => address.trim());
    deliveries.push(deliver(transport, team, `${title} · ${reference}`, lines.join("\n"), reference));
  }
  await Promise.all(deliveries);
}

/** Each account owner gets a private copy of their own committed in-app update. */
export async function sendInvestorUpdateMail(auditLogId: number): Promise<void> {
  const transport = getMailTransport();
  if (!transport) return;
  const updates = await listInvestorsForNotification(auditLogId);
  const format = getFormatter("en");
  // A monthly posting can notify many investors. Bound concurrent SMTP connections.
  const batchSize = 5;
  for (let start = 0; start < updates.length; start += batchSize) {
    await Promise.all(updates.slice(start, start + batchSize).map(({ email, investorCode, notification }) => {
      const title = en.liveUpdates.types[notification.type];
      const detail = describeInvestorNotification(notification, en.liveUpdates, format);
      const subject = [title, notification.reference ?? notification.month].filter(Boolean).join(" · ");
      const body = [detail, `Investor ID: ${investorCode ?? "—"}`, investorNextStep(notification), investorSignoff];
      return deliver(transport, [email], subject, body.join("\n\n"), auditLogId);
    }));
  }
}
