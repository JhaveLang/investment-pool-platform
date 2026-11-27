import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { listInvestorsForNotification } from "./queries/notifications";
import { sendInvestorUpdateMail, sendRequestMail } from "./request-mail";

type TestMessage = { to: string[]; subject: string; text: string };
const sendMail = vi.hoisted(() => vi.fn<(mail: TestMessage) => Promise<{ rejected: string[] }>>());
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));
vi.mock("./queries/notifications", () => ({ listInvestorsForNotification: vi.fn() }));

const request = {
  reference: "EZ-321",
  amountCents: 100_000,
  feeCents: 2_000,
  method: "bank_transfer",
  createdAt: new Date("2026-05-01T12:00:00Z"),
} as const;
const investor = { email: "first@example.com", fullName: "First Investor", investorCode: "I-321" };

beforeEach(() => {
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "pool@example.com");
  vi.stubEnv("SMTP_PASSWORD", "test");
  vi.stubEnv("MAIL_FROM", "pool@example.com");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");
  sendMail.mockReset().mockResolvedValue({ rejected: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("delivers a deposit receipt to the investor when the admin list is empty", async () => {
  await sendRequestMail("deposit", request, investor);
  expect(sendMail).toHaveBeenCalledTimes(1);
  expect(sendMail).toHaveBeenCalledWith({
    to: [investor.email],
    subject: "Deposit request received · EZ-321",
    text: expect.stringContaining("Investor ID: I-321"),
  });
  const [{ text }] = sendMail.mock.calls[0];
  expect(text).toContain(`Dear ${investor.fullName},`);
  expect(text).toContain("awaiting review");
  expect(text).toContain("add to your investment");
  expect(text).toContain("fee and minimum term");
  expect(text).toMatch(/Kind regards,\nThe Bitcoin Magazin Pool team$/);
});

it("delivers an investor receipt even when SMTP rejects the separate admin alert", async () => {
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "team@example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
  sendMail.mockImplementation(async ({ to }) => {
    if (to.includes("team@example.com")) throw new Error("Rejected");
    return { rejected: [] };
  });
  await sendRequestMail("withdrawal", { ...request, reference: "AZ-321" }, investor);
  const messages = sendMail.mock.calls.map(([mail]) => mail);
  expect(messages.map(({ to }) => to)).toEqual([[investor.email], ["team@example.com"]]);
  expect(messages[0].text).toContain("Total debit if approved:");
  expect(messages[0].text).toContain("track your request");
  expect(messages[0].text).not.toContain("add to your investment");
  expect(messages[1].text).not.toContain("add to your investment");
  expect(messages[0].text).not.toContain("team@example.com");
});

it("sends monthly updates as individual messages with each recipient's own ID and signed amount", async () => {
  const event = {
    id: 7,
    type: "returns.booked",
    createdAt: request.createdAt.toISOString(),
    reference: null,
    month: "2026-04",
  } as const;
  vi.mocked(listInvestorsForNotification).mockResolvedValueOnce([
    { ...investor, userId: "first", notification: { ...event, amountCents: 2_000 } },
    { userId: "second", email: "second@example.com", investorCode: "I-432", notification: { ...event, amountCents: -800 } },
  ]);
  await sendInvestorUpdateMail(event.id);
  expect(listInvestorsForNotification).toHaveBeenCalledWith(event.id);
  const messages = sendMail.mock.calls.map(([mail]) => mail);
  expect(messages.map(({ to }) => to)).toEqual([[investor.email], ["second@example.com"]]);
  expect(messages[0].text).toContain("Investor ID: I-321");
  expect(messages[0].text).toContain("20.00");
  expect(messages[0].text).toContain("add to your investment");
  expect(messages[1].text).toContain("Investor ID: I-432");
  expect(messages[1].text).toMatch(/−.*8\.00/);
  expect(messages[1].text).toContain("Transactions");
  expect(messages[1].text).not.toContain("add to your investment");
});

it.each([
  ["deposit.reconciled", "add to your investment"],
  ["deposit.rejected", "Contact page"],
  ["withdrawal.approved", "payout details"],
  ["withdrawal.rejected", "Contact page"],
] as const)("includes a relevant next step for %s", async (type, nextStep) => {
  const reference = type.startsWith("deposit.") ? "EZ-321" : "AZ-321";
  vi.mocked(listInvestorsForNotification).mockResolvedValueOnce([{
    ...investor,
    userId: "first",
    notification: {
      id: 8, type, reference, amountCents: 10_000, createdAt: request.createdAt.toISOString(), month: null,
    },
  }]);
  await sendInvestorUpdateMail(8);
  const [{ text }] = sendMail.mock.calls[0];
  expect(text).toContain(reference);
  expect(text).toContain(`Investor ID: ${investor.investorCode}`);
  expect(text).toContain(nextStep);
  if (type !== "deposit.reconciled") expect(text).not.toContain("add to your investment");
});
