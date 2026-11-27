import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PromoBookingForm } from "@/components/promos/promo-booking-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { isPromoBookable, maxPromoBookingCents, MIN_STANDARD_POOL_BALANCE_CENTS } from "@/lib/promo";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview } from "@/server/queries/investor";
import { getPromoOffer } from "@/server/queries/promos";

export default async function BookPromoPage({ params }: PageProps<"/promos/[promoId]/book">) {
  const user = await requireInvestor();
  const { promoId } = await params;
  const [offer, overview, { messages, format }] = await Promise.all([getPromoOffer(promoId), getAccountOverview(user.id), getI18n()]);
  if (!offer) notFound();
  if (!isPromoBookable(offer, todayIsoDate())) redirect("/promos");
  const reservedCents = overview.reservedCents + overview.pendingPromoCents;
  const bookableCents = maxPromoBookingCents(offer, overview);
  const text = messages.admin.promos;
  return <>
    <PageHeader title={offer.name} description={text.bookingTerms} actions={<Link className="text-sm text-accent-700 underline" href="/promos">{text.backToPromos}</Link>} />
    <Card className="max-w-2xl"><CardHeader title={text.requestBooking} icon="percent" />
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-subtle">{text.minimum}</dt><dd className="font-medium">{format.currency(offer.minDepositCents)}</dd></div>
          <div><dt className="text-subtle">{text.maximum}</dt><dd className="font-medium">{format.currency(offer.maxDepositCents)}</dd></div>
          <div><dt className="text-subtle">{text.term}</dt><dd className="font-medium">{text.months(offer.termMonths)}</dd></div>
          <div><dt className="text-subtle">{text.totalReturnLabel}</dt><dd className="font-medium">{format.rate(offer.totalReturnBps * 100)}</dd></div>
        </dl>
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt>{messages.dashboard.balance}</dt>
            <dd className="amount font-medium">{format.currency(overview.balanceCents)}</dd>
          </div>
          {overview.lockedCents > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt>{messages.dashboard.locked}
                {overview.nextUnlockOn && <span className="block text-xs text-subtle">{messages.dashboard.nextDepositUnlock(format.calendarDate(overview.nextUnlockOn))}</span>}
              </dt>
              <dd className="amount">{format.currency(overview.lockedCents)}</dd>
            </div>
          )}
          {reservedCents > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt>{text.pendingReservations}</dt>
              <dd className="amount">{format.currency(reservedCents)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 font-semibold">
            <dt>{text.availableTransfer}</dt>
            <dd className="amount">{format.currency(bookableCents)}</dd>
          </div>
        </dl>
        {bookableCents === 0 ? (
          <p role="status" className="rounded-lg bg-well p-3 text-sm text-muted">
            {text.notEnoughTransferable(format.currency(offer.minDepositCents + MIN_STANDARD_POOL_BALANCE_CENTS), format.currency(MIN_STANDARD_POOL_BALANCE_CENTS))}
          </p>
        ) : (
          <PromoBookingForm promoId={offer.id} idempotencyKey={randomUUID()} minCents={offer.minDepositCents} maxCents={bookableCents} />
        )}
      </CardContent>
    </Card>
  </>;
}
