import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { addCalendarMonths, type IsoDate } from "@/lib/calendar";
import { getDb } from "@/server/db/client";
import { accounts, deposits, ledgerEntries, promoBookings, promoOffers, users } from "@/server/db/schema";

export async function listPromoOffers() {
  return getDb().select().from(promoOffers).orderBy(asc(promoOffers.bookingUntil), asc(promoOffers.name));
}

export async function getPromoOffer(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [offer] = await getDb().select().from(promoOffers).where(eq(promoOffers.id, id)).limit(1);
  return offer ?? null;
}

export async function listDuePromoMaturities(today: IsoDate) {
  const db = getDb();
  const candidates = await db
    .select({
      depositId: deposits.id,
      accountId: deposits.accountId,
      reference: deposits.reference,
      amountCents: deposits.amountCents,
      feeCents: deposits.feeCents,
      receivedOn: deposits.receivedOn,
      termMonths: deposits.promoTermMonths,
      totalReturnBps: deposits.promoTotalReturnBps,
      offerName: deposits.promoName,
      investorName: users.fullName,
    })
    .from(deposits)
    .innerJoin(accounts, eq(deposits.accountId, accounts.id))
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(and(eq(deposits.status, "reconciled"), isNotNull(deposits.promoOfferId), isNotNull(deposits.promoTermMonths), isNotNull(deposits.receivedOn)));
  if (candidates.length === 0) return [];
  const alreadyPaid = await db
    .select({ depositId: ledgerEntries.depositId })
    .from(ledgerEntries)
    .where(and(inArray(ledgerEntries.depositId, candidates.map((row) => row.depositId)), eq(ledgerEntries.entryType, "promo_return")));
  const paidIds = new Set(alreadyPaid.map((row) => row.depositId));
  return candidates
    .map((row) => ({ ...row, termMonths: row.termMonths!, totalReturnBps: row.totalReturnBps!, offerName: row.offerName!, maturityOn: addCalendarMonths(row.receivedOn!, row.termMonths!) }))
    .filter((row) => row.maturityOn <= today && !paidIds.has(row.depositId))
    .sort((left, right) => left.maturityOn.localeCompare(right.maturityOn));
}

export async function listPromoBookings(status?: "pending" | "booked") {
  const db = getDb();
  return db.select({
    id: promoBookings.id, accountId: promoBookings.accountId, promoName: promoBookings.promoName,
    amountCents: promoBookings.amountCents, termMonths: promoBookings.termMonths, totalReturnBps: promoBookings.totalReturnBps,
    reference: promoBookings.reference, status: promoBookings.status, requestedAt: promoBookings.requestedAt,
    processedAt: promoBookings.processedAt, maturityOn: promoBookings.maturityOn, confirmationSentAt: promoBookings.confirmationSentAt,
    investorName: users.fullName, investorEmail: users.email,
  }).from(promoBookings).innerJoin(accounts, eq(promoBookings.accountId, accounts.id)).innerJoin(users, eq(accounts.userId, users.id))
    .where(status ? eq(promoBookings.status, status) : undefined).orderBy(asc(promoBookings.requestedAt));
}

export async function listInvestorPromoBookings(userId: string) {
  return getDb().select({ id: promoBookings.id, promoName: promoBookings.promoName, amountCents: promoBookings.amountCents, termMonths: promoBookings.termMonths, totalReturnBps: promoBookings.totalReturnBps, reference: promoBookings.reference, status: promoBookings.status, requestedAt: promoBookings.requestedAt, maturityOn: promoBookings.maturityOn, confirmationSentAt: promoBookings.confirmationSentAt })
    .from(promoBookings).innerJoin(accounts, eq(promoBookings.accountId, accounts.id)).where(eq(accounts.userId, userId)).orderBy(asc(promoBookings.requestedAt));
}
