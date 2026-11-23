/**
 * Fills an EMPTY pool with demo investors for showing the app (e.g. a client demo):
 * reconciled deposits in the last four months, approved withdrawals, four booked months (one of them a loss),
 * open requests for the approval queue (one investor with three, so the queue groups them), a deactivated investor
 * and a brand-new investor with a zero balance (who gets the welcome popup).
 *
 *   npm run db:seed:demo                                     (after npm run db:migrate and npm run db:seed)
 *   docker compose run --rm migrate npm run db:seed:demo     (Docker)
 *
 * The ledger is append-only, so demo data can never be removed again: the script refuses to run unless the pool has
 * no investors and no booked months yet. Investors sign in with DEMO_PASSWORD (default below).
 */
import { randomUUID } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import type { PaymentMethod } from "@/lib/fees";
import { addMonths, firstDayOfMonth, monthOf, todayIsoDate, type IsoDate, type IsoMonth } from "@/lib/calendar";
import { closeDb, getDb } from "@/server/db/client";
import { deposits, returnPeriods, users, withdrawals } from "@/server/db/schema";
import { setInvestorStatus } from "@/server/services/account";
import { registerInvestor } from "@/server/services/auth";
import { createDeposit, reconcileDeposit } from "@/server/services/deposits";
import { bookMonthlyReturn, previewMonthlyReturn } from "@/server/services/returns";
import { approveWithdrawal, requestWithdrawal } from "@/server/services/withdrawals";

const DEFAULT_DEMO_PASSWORD = "demo-investor-2026";
const MIN_PASSWORD_LENGTH = 10;
const DEMO_IBAN = "DE89370400440532013000";
const DEMO_WALLET = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

const db = getDb();
let adminId = "";

/** Day `dayOfMonth` of the month `offset` months from now (0 = this month), in the pool's calendar. */
function dayIn(offset: number, dayOfMonth: number): IsoDate {
  return `${addMonths(monthOf(todayIsoDate()), offset)}-${String(dayOfMonth).padStart(2, "0")}`;
}

function monthIn(offset: number): IsoMonth {
  return addMonths(monthOf(todayIsoDate()), offset);
}

const euro = (amount: number) => Math.round(amount * 100);

async function investor(fullName: string, password: string) {
  const email = `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
  const user = await registerInvestor({ fullName, email, password, ipAddress: null });
  return { ...user, email };
}

/** A deposit made and received on `receivedOn`, reconciled by the admin. */
async function receivedDeposit(userId: string, amount: number, method: PaymentMethod, receivedOn: IsoDate) {
  const deposit = await createDeposit({
    userId,
    amountCents: euro(amount),
    method,
    idempotencyKey: randomUUID(),
    ipAddress: null,
  });
  await db
    .update(deposits)
    .set({ createdAt: sql`${`${receivedOn} 10:00:00`}::timestamp at time zone 'Europe/Berlin'` })
    .where(eq(deposits.id, deposit.id));
  await reconcileDeposit({ recordId: deposit.id, reviewerId: adminId, receivedOn, ipAddress: null });
}

/** A withdrawal requested on `requestedOn` and approved. */
async function paidWithdrawal(
  userId: string,
  amount: number,
  method: "bank_transfer" | "crypto",
  requestedOn: IsoDate,
) {
  const withdrawal = await requestWithdrawal({
    userId,
    amountCents: euro(amount),
    destination: method === "bank_transfer" ? { method, iban: DEMO_IBAN } : { method, walletAddress: DEMO_WALLET },
    idempotencyKey: randomUUID(),
    ipAddress: null,
  });
  await db
    .update(withdrawals)
    .set({ createdAt: sql`${`${requestedOn} 12:00:00`}::timestamp at time zone 'Europe/Berlin'` })
    .where(eq(withdrawals.id, withdrawal.id));
  await approveWithdrawal({ recordId: withdrawal.id, reviewerId: adminId, ipAddress: null });
}

async function openDeposit(userId: string, amount: number, method: PaymentMethod) {
  await createDeposit({ userId, amountCents: euro(amount), method, idempotencyKey: randomUUID(), ipAddress: null });
}

async function openWithdrawal(userId: string, amount: number, method: "bank_transfer" | "crypto") {
  await requestWithdrawal({
    userId,
    amountCents: euro(amount),
    destination: method === "bank_transfer" ? { method, iban: DEMO_IBAN } : { method, walletAddress: DEMO_WALLET },
    idempotencyKey: randomUUID(),
    ipAddress: null,
  });
}

async function bookMonth(month: IsoMonth, ratePercent: number) {
  const ratePpm = Math.round(ratePercent * 10_000);
  const preview = await previewMonthlyReturn(month, ratePpm);
  await bookMonthlyReturn({
    month,
    ratePpm,
    expectedTotalCents: preview.totalCents,
    adminUserId: adminId,
    ipAddress: null,
  });
  console.log(
    `  booked ${month}: ${ratePercent > 0 ? "+" : ""}${ratePercent.toFixed(2)} % → ${(preview.totalCents / 100).toFixed(2)} €`,
  );
}

async function seedDemo(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the process environment (e.g. inside Docker).
  }
  const password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`DEMO_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) {
    throw new Error("No admin account yet – run `npm run db:seed` first.");
  }
  adminId = admin.id;
  const [[{ investors }], [{ periods }]] = await Promise.all([
    db.select({ investors: count() }).from(users).where(eq(users.role, "investor")),
    db.select({ periods: count() }).from(returnPeriods),
  ]);
  if (investors > 0 || periods > 0) {
    console.log(
      `The pool already has ${investors} investor(s) and ${periods} booked month(s) – demo data is only added to an ` +
        "empty pool (bookings can't be removed again). Nothing was changed.",
    );
    return;
  }

  console.log("Creating demo investors …");
  const anna = await investor("Anna Becker", password);
  const ben = await investor("Ben Wagner", password);
  const carla = await investor("Carla Schmidt", password);
  const david = await investor("David Klein", password);
  const emma = await investor("Emma Fischer", password);

  // History: deposits over the last four months, two paid-out withdrawals.
  await receivedDeposit(anna.id, 15_000, "crypto", dayIn(-4, 3));
  await receivedDeposit(ben.id, 8_000, "bank_transfer", dayIn(-4, 10));
  await receivedDeposit(david.id, 12_000, "crypto", dayIn(-4, 15));
  await receivedDeposit(carla.id, 25_000, "crypto", dayIn(-3, 1));
  await receivedDeposit(emma.id, 6_000, "crypto", dayIn(-3, 18));
  await receivedDeposit(anna.id, 5_000, "bank_transfer", dayIn(-2, 12));
  await receivedDeposit(carla.id, 3_000, "exchange", dayIn(-1, 5));
  await paidWithdrawal(ben.id, 1_000, "bank_transfer", dayIn(-2, 20));
  await paidWithdrawal(anna.id, 2_000, "crypto", dayIn(-1, 9));

  // Monthly results, oldest first; one month is a loss.
  console.log("Booking monthly results …");
  await bookMonth(monthIn(-4), 1.0);
  await bookMonth(monthIn(-3), 1.2);
  await bookMonth(monthIn(-2), -0.4);
  await bookMonth(monthIn(-1), 0.9);

  // Open requests for the approval queue (after the bookings: open deposits would block booking a month).
  await openDeposit(david.id, 2_500, "bank_transfer");
  await openDeposit(david.id, 1_200, "crypto");
  await openWithdrawal(david.id, 800, "crypto");
  await openWithdrawal(ben.id, 500, "bank_transfer");
  await openDeposit(anna.id, 1_000, "crypto");

  // A deactivated investor, and a new one who hasn't deposited yet.
  await setInvestorStatus({ adminId, userId: emma.id, active: false, note: "Demo", ipAddress: null });
  const felix = await investor("Felix Neumann", password);

  console.log("\nDemo investors (password for all: DEMO_PASSWORD or the default):");
  for (const [user, note] of [
    [anna, "deposits, a withdrawal, an open deposit"],
    [ben, "an open withdrawal"],
    [carla, "two deposits"],
    [david, "three open requests (grouped in the queue)"],
    [emma, "deactivated"],
    [felix, "new, zero balance – sees the welcome popup"],
  ] as const) {
    console.log(`  ${user.email.padEnd(30)} ${note}`);
  }
  console.log(`  First booked month: ${firstDayOfMonth(monthIn(-4))}`);
}

seedDemo()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
