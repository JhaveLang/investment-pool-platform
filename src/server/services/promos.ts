import "server-only";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { addCalendarMonths, todayIsoDate, type IsoDate } from "@/lib/calendar";
import { getDb } from "@/server/db/client";
import { accounts, deposits, ledgerEntries, promoBookings, promoOffers } from "@/server/db/schema";
import { recordAudit } from "./audit";
import { generateReference, lockAccountForUser, postLedgerEntries } from "./ledger";
import { loadLockedCapital, loadReservedPayoutCents, loadReservedPromoBookingCents } from "@/server/queries/accrual";
import { DomainError } from "@/lib/errors";

type PromoFields = {
  name: string;
  bookingUntil: string;
  minDepositCents: number;
  maxDepositCents: number;
  termMonths: number;
  totalReturnBps: number;
  details: string;
  isExample: boolean;
  visible: boolean;
};
type Actor = { adminId: string; ipAddress: string | null };

export async function createPromoOffer(input: PromoFields & Actor) {
  return getDb().transaction(async (tx) => {
    const { adminId, ipAddress, ...fields } = input;
    const [offer] = await tx.insert(promoOffers).values(fields).returning({ id: promoOffers.id });
    await recordAudit(tx, {
      actorUserId: adminId, action: "promotion.created", entityType: "promotion", entityId: offer.id,
      metadata: fields, ipAddress,
    });
    return offer.id;
  });
}

export async function updatePromoOffer(input: { promoId: string } & Partial<PromoFields> & Actor) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(promoOffers).where(eq(promoOffers.id, input.promoId)).for("update").limit(1);
    if (!current) return false;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of ["name", "bookingUntil", "minDepositCents", "maxDepositCents", "termMonths", "totalReturnBps", "details", "isExample", "visible"] as const) {
      const value = input[field];
      if (value !== undefined && value !== current[field]) changes[field] = { from: current[field], to: value };
    }
    if (!Object.keys(changes).length) return true;
    const values = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.to])) as Partial<PromoFields>;
    await tx.update(promoOffers).set({ ...values, updatedAt: new Date() }).where(eq(promoOffers.id, input.promoId));
    await recordAudit(tx, {
      actorUserId: input.adminId, action: "promotion.updated", entityType: "promotion", entityId: input.promoId,
      metadata: { changes }, ipAddress: input.ipAddress,
    });
    return true;
  });
}

export async function requestPromoBooking(input: { userId: string; promoId: string; amountCents: number; idempotencyKey: string; ipAddress: string | null }) {
  return getDb().transaction(async (tx) => {
    const account = await lockAccountForUser(tx, input.userId);
    const [existing] = await tx.select().from(promoBookings).where(and(eq(promoBookings.accountId, account.id), eq(promoBookings.idempotencyKey, input.idempotencyKey)));
    if (existing) return existing;
    const [offer] = await tx.select().from(promoOffers).where(eq(promoOffers.id, input.promoId)).limit(1);
    if (!offer || !offer.visible || offer.isExample || offer.bookingUntil < todayIsoDate()) throw new DomainError("PROMO_NOT_BOOKABLE");
    if (input.amountCents < offer.minDepositCents || input.amountCents > offer.maxDepositCents || input.amountCents % 100 !== 0) throw new DomainError("PROMO_AMOUNT_INVALID");
    const locked = await loadLockedCapital(tx, account.id, todayIsoDate());
    const reservedWithdrawals = await loadReservedPayoutCents(tx, account.id);
    const reservedPromos = await loadReservedPromoBookingCents(tx, account.id);
    const availableForTransfer = account.balanceCents - locked.lockedCents - reservedWithdrawals - reservedPromos - 100_000;
    if (input.amountCents > availableForTransfer) throw new DomainError("PROMO_INSUFFICIENT_STANDARD_BALANCE");
    const [booking] = await tx.insert(promoBookings).values({
      accountId: account.id, promoOfferId: offer.id, promoName: offer.name, amountCents: input.amountCents,
      termMonths: offer.termMonths, totalReturnBps: offer.totalReturnBps, reference: generateReference("AZ"), idempotencyKey: input.idempotencyKey,
    }).returning();
    await recordAudit(tx, { actorUserId: input.userId, action: "promo_booking.requested", entityType: "promo_booking", entityId: booking.id, metadata: { reference: booking.reference, amountCents: booking.amountCents, promoName: booking.promoName }, ipAddress: input.ipAddress });
    return booking;
  });
}

export async function processReadyPromoBookings(input: Actor & { today: IsoDate }) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('promo_booking_process'))`);
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    const ready = await tx.select().from(promoBookings).where(and(eq(promoBookings.status, "pending"), lte(promoBookings.requestedAt, cutoff))).for("update");
    let count = 0;
    for (const booking of ready) {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, booking.accountId)).for("update");
      if (!account) throw new DomainError("ACCOUNT_MISSING");
      const locked = await loadLockedCapital(tx, account.id, input.today);
      const reservedWithdrawals = await loadReservedPayoutCents(tx, account.id);
      const reservedPromos = await loadReservedPromoBookingCents(tx, account.id, booking.id);
      if (account.balanceCents - locked.lockedCents - reservedWithdrawals - reservedPromos - 100_000 < booking.amountCents) {
        await tx.update(promoBookings).set({ status: "rejected", reviewedByUserId: input.adminId, reviewNote: "Insufficient transferable standard-pool balance after processing delay." }).where(eq(promoBookings.id, booking.id));
        await recordAudit(tx, { actorUserId: input.adminId, action: "promo_booking.rejected", entityType: "promo_booking", entityId: booking.id, metadata: { reason: "insufficient_available_balance" }, ipAddress: input.ipAddress });
        continue;
      }
      const processedAt = new Date();
      const maturityOn = addCalendarMonths(input.today, booking.termMonths);
      await postLedgerEntries(tx, [{ accountId: account.id, promoBookingId: booking.id, entryType: "promo_transfer", amountCents: -booking.amountCents, createdByUserId: input.adminId }]);
      await tx.update(promoBookings).set({ status: "booked", processedAt, maturityOn, reviewedByUserId: input.adminId }).where(eq(promoBookings.id, booking.id));
      await recordAudit(tx, { actorUserId: input.adminId, action: "promo_booking.processed", entityType: "promo_booking", entityId: booking.id, metadata: { reference: booking.reference, amountCents: booking.amountCents, maturityOn }, ipAddress: input.ipAddress });
      count++;
    }
    return count;
  });
}

export async function markPromoConfirmationSent(input: Actor & { bookingId: string }) {
  return getDb().transaction(async (tx) => {
    const [booking] = await tx.select().from(promoBookings).where(eq(promoBookings.id, input.bookingId)).for("update");
    if (!booking || booking.status !== "booked" || booking.confirmationSentAt) return false;
    await tx.update(promoBookings).set({ confirmationSentAt: new Date() }).where(eq(promoBookings.id, booking.id));
    await recordAudit(tx, { actorUserId: input.adminId, action: "promo_booking.confirmation_sent", entityType: "promo_booking", entityId: booking.id, metadata: { reference: booking.reference }, ipAddress: input.ipAddress });
    return true;
  });
}

export async function settleMaturedPromoBookings(input: Actor & { today: IsoDate }) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('promo_booking_maturities'))`);
    const due = await tx.select().from(promoBookings).where(and(eq(promoBookings.status, "booked"), isNotNull(promoBookings.maturityOn), lte(promoBookings.maturityOn, input.today))).for("update");
    let totalCents = 0;
    for (const booking of due) {
      const profit = Math.floor(booking.amountCents * booking.totalReturnBps / 10_000);
      await postLedgerEntries(tx, [
        { accountId: booking.accountId, promoBookingId: booking.id, entryType: "promo_principal_return" as const, amountCents: booking.amountCents, createdByUserId: input.adminId },
        { accountId: booking.accountId, promoBookingId: booking.id, entryType: "promo_return" as const, amountCents: profit, createdByUserId: input.adminId },
      ].filter((posting) => posting.amountCents > 0));
      await tx.update(promoBookings).set({ status: "matured" }).where(eq(promoBookings.id, booking.id));
      await recordAudit(tx, { actorUserId: input.adminId, action: "promo_booking.matured", entityType: "promo_booking", entityId: booking.id, metadata: { reference: booking.reference, principalCents: booking.amountCents, profitCents: profit }, ipAddress: input.ipAddress });
      totalCents += booking.amountCents + profit;
    }
    return { count: due.length, totalCents };
  });
}

/** Posts each due fixed return once as an internal account credit; investors can then withdraw it. */
export async function settleMaturedPromoReturns(input: { adminId: string; ipAddress: string | null; today: IsoDate }) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('promo_maturities'))`);
    const rows = await tx
      .select({
        depositId: deposits.id,
        accountId: deposits.accountId,
        amountCents: deposits.amountCents,
        feeCents: deposits.feeCents,
        receivedOn: deposits.receivedOn,
        termMonths: deposits.promoTermMonths,
        totalReturnBps: deposits.promoTotalReturnBps,
      })
      .from(deposits)
      .where(and(eq(deposits.status, "reconciled"), isNotNull(deposits.promoOfferId), isNotNull(deposits.promoTermMonths), isNotNull(deposits.receivedOn)));
    const due = rows
      .filter((row) => row.receivedOn && row.termMonths && row.totalReturnBps && addCalendarMonths(row.receivedOn, row.termMonths) <= input.today)
      .map((row) => ({ ...row, termMonths: row.termMonths!, totalReturnBps: row.totalReturnBps! }));
    if (due.length === 0) return { count: 0, totalCents: 0 };
    const alreadyPaid = await tx
      .select({ depositId: ledgerEntries.depositId })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.entryType, "promo_return"), isNotNull(ledgerEntries.depositId)));
    const paidIds = new Set(alreadyPaid.map((row) => row.depositId));
    const postings = due
      .filter((row) => !paidIds.has(row.depositId))
      .map((row) => ({
        accountId: row.accountId,
        depositId: row.depositId,
        entryType: "promo_return" as const,
        amountCents: Math.floor(((row.amountCents - row.feeCents) * row.totalReturnBps) / 10_000),
        createdByUserId: input.adminId,
      }))
      .filter((row) => row.amountCents > 0);
    await postLedgerEntries(tx, postings);
    if (postings.length > 0) {
      await recordAudit(tx, {
        actorUserId: input.adminId,
        action: "promotion.maturity_paid",
        entityType: "promo_maturity_batch",
        metadata: {
          depositIds: postings.map((row) => row.depositId),
          accountCount: postings.length,
          totalCents: postings.reduce((sum, row) => sum + row.amountCents, 0),
        },
        ipAddress: input.ipAddress,
      });
    }
    return { count: postings.length, totalCents: postings.reduce((sum, row) => sum + row.amountCents, 0) };
  });
}
