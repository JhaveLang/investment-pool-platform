import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashAlert } from "@/components/ui/flash-alert";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { buttonStyles } from "@/components/ui/button";
import Link from "next/link";
import { requireInvestor } from "@/server/auth/guards";
import { listInvestorPromoBookings, listPromoOffers } from "@/server/queries/promos";

export const generateMetadata = pageMetadata((messages) => messages.admin.promos.investorTitle);

export default async function InvestorPromosPage({ searchParams }: PageProps<"/promos">) {
  const user = await requireInvestor();
  const [{ messages, format }, offers, bookings, params] = await Promise.all([
    getI18n(), listPromoOffers(), listInvestorPromoBookings(user.id), searchParams,
  ]);
  const requested = bookings.find((booking) => booking.reference === params.requested);
  const text = messages.admin.promos;
  const today = todayIsoDate();
  const visibleOffers = offers.filter((offer) => offer.visible);
  return <>
    <PageHeader title={text.investorTitle} description={text.investorSubtitle} />
    {requested && <FlashAlert param="requested" className="mb-5">{text.bookingRequested(requested.reference)}</FlashAlert>}
    {visibleOffers.length === 0 ? <Card><EmptyState title={text.noOffers} /></Card> : (
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleOffers.map((offer) => {
          const bookable = !offer.isExample && offer.bookingUntil >= today;
          return <Card key={offer.id} className="overflow-hidden">
            <CardHeader title={offer.name} description={text.displayOnlyNote} icon="percent" action={<div className="flex flex-wrap gap-1.5">{offer.isExample ? <Badge tone="info">{text.example}</Badge> : null}{offer.bookingUntil < today ? <Badge tone="neutral">{text.closed}</Badge> : bookable ? <Badge tone="success">{text.bookable}</Badge> : null}</div>} />
            <CardContent>
              {offer.details ? <p className="mb-5 whitespace-pre-line text-sm leading-relaxed text-muted">{offer.details}</p> : null}
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div><dt className="label-caps text-subtle">{text.bookingLabel}</dt><dd className="mt-1 font-medium text-fg">{format.calendarDate(offer.bookingUntil)}</dd></div>
                <div><dt className="label-caps text-subtle">{text.term}</dt><dd className="mt-1 font-medium text-fg">{text.months(offer.termMonths)}</dd></div>
                <div><dt className="label-caps text-subtle">{text.minimum}</dt><dd className="mt-1 font-medium text-fg">{format.currency(offer.minDepositCents)}</dd></div>
                <div><dt className="label-caps text-subtle">{text.maximum}</dt><dd className="mt-1 font-medium text-fg">{format.currency(offer.maxDepositCents)}</dd></div>
                <div className="col-span-2 border-t border-line pt-4"><dt className="label-caps text-subtle">{text.totalReturnLabel}</dt><dd className="mt-1 font-display text-2xl font-semibold text-fg">{format.rate(offer.totalReturnBps * 100)}</dd></div>
              </dl>
              {offer.isExample ? <p className="mt-4 rounded-lg border border-line bg-well px-3.5 py-2.5 text-sm font-medium text-muted">{text.exampleLabel}</p> : bookable ? <Link href={`/promos/${offer.id}/book`} className={`${buttonStyles()} mt-5`}>{text.bookPromo}</Link> : null}
            </CardContent>
          </Card>;
        })}
      </div>
    )}
    <Card className="mt-5">
      <CardHeader title={text.myBookings} icon="clock" />
      <CardContent className="space-y-2">
        {bookings.length === 0 ? <p className="text-sm text-subtle">{text.noMyBookings}</p> : bookings.map((booking) => {
          const status = booking.status === "pending" ? text.statusPending : booking.status === "booked" ? text.statusBooked : booking.status === "rejected" ? text.statusRejected : text.statusMatured;
          const payoutCents = booking.amountCents + Math.floor(booking.amountCents * booking.totalReturnBps / 10_000);
          return <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-well px-3.5 py-2.5 text-sm"><span className="font-medium">{booking.promoName} · {booking.reference}</span><span className="text-muted">{status} · {format.currency(booking.amountCents)}{booking.maturityOn ? ` → ${format.currency(payoutCents)} · ${format.calendarDate(booking.maturityOn)}` : ""}</span></div>;
        })}
      </CardContent>
    </Card>
  </>;
}
