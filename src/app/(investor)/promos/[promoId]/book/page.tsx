import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PromoBookingForm } from "@/components/promos/promo-booking-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview } from "@/server/queries/investor";
import { getPromoOffer } from "@/server/queries/promos";

export default async function BookPromoPage({ params }: PageProps<"/promos/[promoId]/book">) {
  const user = await requireInvestor();
  const { promoId } = await params;
  const [offer, overview, { messages, format }] = await Promise.all([getPromoOffer(promoId), getAccountOverview(user.id), getI18n()]);
  if (!offer) notFound();
  if (!offer.visible || offer.isExample || offer.bookingUntil < todayIsoDate()) redirect("/promos");
  const transferableCents = Math.max(0, overview.balanceCents - overview.lockedCents - overview.reservedCents - overview.pendingPromoCents - 100_000);
  const maxCents = Math.min(offer.maxDepositCents, transferableCents);
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
          <div className="col-span-2"><dt className="text-subtle">{text.availableTransfer}</dt><dd className="font-medium">{format.currency(transferableCents)}</dd></div>
        </dl>
        {maxCents < offer.minDepositCents ? <p role="status" className="rounded-lg bg-well p-3 text-sm text-muted">{text.notEnoughTransferable}</p> : <PromoBookingForm promoId={offer.id} idempotencyKey={randomUUID()} minCents={offer.minDepositCents} maxCents={maxCents} />}
      </CardContent>
    </Card>
  </>;
}
