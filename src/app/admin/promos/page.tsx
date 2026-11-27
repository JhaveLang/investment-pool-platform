import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashAlert } from "@/components/ui/flash-alert";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n, pageMetadata } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { requireAdmin } from "@/server/auth/guards";
import { listDuePromoMaturities, listPromoBookings, listPromoOffers } from "@/server/queries/promos";
import { PromoVisibilityButton } from "@/components/admin/promo-visibility-button";
import { EditPromoButton } from "@/components/admin/promo-form";
import { PromoMaturitySettlement } from "@/components/admin/promo-maturity-settlement";
import { MarkPromoConfirmationSent, ProcessPromoBookings, SettlePromoBookings } from "@/components/admin/promo-booking-actions";
import { promoMaturityPayoutCents } from "@/lib/promo";
import { formatIsoDate } from "@/lib/format";
import { addDays } from "@/lib/calendar";
import { PROMO_CONFIRMATION_DEADLINE_DAYS } from "@/lib/promo";

export const generateMetadata = pageMetadata((messages) => messages.admin.promos.title);

export default async function AdminPromosPage({ searchParams }: PageProps<"/admin/promos">) {
  await requireAdmin();
  const [{ messages, format }, offers, maturities, pendingBookings, bookedBookings, params] = await Promise.all([
    getI18n(), listPromoOffers(), listDuePromoMaturities(todayIsoDate()), listPromoBookings("pending"), listPromoBookings("booked"), searchParams,
  ]);
  const text = messages.admin.promos;
  const flash = params.created ? "created" : params.saved ? "saved" : null;
  const today = todayIsoDate();
  return (
    <>
      <PageHeader title={text.title} description={text.subtitle} actions={<Link href="/admin/promos/new" className={buttonStyles()}><Icon name="plusCircle" className="size-4" />{text.add}</Link>} />
      {flash ? <FlashAlert param={flash} tone="success" className="mb-4 lg:mb-6">{text[flash]}</FlashAlert> : null}
      <Card className="mb-4 lg:mb-6">
        <CardHeader title={text.pendingBookingsTitle} description={text.processingDelay} icon="clock" />
        <CardContent className="space-y-4">
          {pendingBookings.length === 0 ? <p className="text-sm text-subtle">{text.noPendingBookings}</p> : <div className="space-y-2">{pendingBookings.map((row) => <div key={row.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-well px-3.5 py-2.5 text-sm"><span className="font-medium">{row.investorName} · {row.promoName} · {row.reference}</span><span className="text-muted">{format.currency(row.amountCents)} · {format.calendarDate(formatIsoDate(row.requestedAt))}</span></div>)}</div>}
          <ProcessPromoBookings />
        </CardContent>
      </Card>
      <Card className="mb-4 lg:mb-6">
        <CardHeader title={text.bookedBookingsTitle} description={text.confirmationDue} icon="file" />
        <CardContent className="space-y-4">
          {bookedBookings.length === 0 ? <p className="text-sm text-subtle">{text.noBookedBookings}</p> : <div className="space-y-3">{bookedBookings.map((row) => {
            const payout = promoMaturityPayoutCents(row.amountCents, row.totalReturnBps);
            const confirmationDeadline = addDays(formatIsoDate(row.requestedAt), PROMO_CONFIRMATION_DEADLINE_DAYS);
            const subject = encodeURIComponent(text.confirmationSubject(row.reference));
            const body = encodeURIComponent(text.confirmationBody(row.reference, format.currency(row.amountCents), format.currency(payout), row.processedAt ? format.calendarDate(formatIsoDate(row.processedAt)) : "", row.maturityOn ? format.calendarDate(row.maturityOn) : ""));
            return <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-well px-3.5 py-2.5 text-sm">
              <div><p className="font-medium">{row.investorName} · {row.promoName} · {row.reference}</p><p className="text-muted">{format.currency(row.amountCents)} → {format.currency(payout)} · {row.maturityOn ? format.calendarDate(row.maturityOn) : ""} · {row.investorEmail}</p>{row.confirmationSentAt ? <p className="text-xs text-subtle">{text.confirmationSent}: {format.calendarDate(formatIsoDate(row.confirmationSentAt))}</p> : <p className="text-xs text-subtle">{confirmationDeadline < today ? text.confirmationOverdue(format.calendarDate(confirmationDeadline)) : text.confirmationDeadline(format.calendarDate(confirmationDeadline))}</p>}</div>
              {!row.confirmationSentAt ? <div className="flex flex-wrap gap-2"><a className={buttonStyles({ variant: "secondary", size: "sm" })} href={`mailto:${encodeURIComponent(row.investorEmail)}?subject=${subject}&body=${body}`}>{text.printConfirmation}</a><MarkPromoConfirmationSent bookingId={row.id} /></div> : null}
            </div>;
          })}</div>}
          {bookedBookings.length > 0 ? <SettlePromoBookings /> : null}
        </CardContent>
      </Card>
      <Card className="mb-4 lg:mb-6">
        <CardHeader title={text.maturitiesTitle} description={text.maturitiesSubtitle} icon="clock" />
        <CardContent className="space-y-4">
          {maturities.length === 0 ? <p className="text-sm text-subtle">{text.noMaturities}</p> : (
            <>
              <div className="space-y-2">{maturities.map((row) => {
                const credited = row.amountCents - row.feeCents;
                const returnCents = Math.floor((credited * row.totalReturnBps) / 10_000);
                return <div key={row.depositId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-well px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-fg">{row.investorName} · {row.offerName} · {row.reference}</span>
                  <span className="text-muted">{format.calendarDate(row.maturityOn)} · {format.currency(returnCents)}</span>
                </div>;
              })}</div>
              <PromoMaturitySettlement />
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        {offers.length === 0 ? <EmptyState title={text.empty} /> : (
          <Table>
            <thead><tr>
              <TableHeaderCell>{text.name}</TableHeaderCell>
              <TableHeaderCell>{text.bookingUntil}</TableHeaderCell>
              <TableHeaderCell>{text.minDeposit} / {text.maxDeposit}</TableHeaderCell>
              <TableHeaderCell>{text.termMonths}</TableHeaderCell>
              <TableHeaderCell>{text.totalReturn}</TableHeaderCell>
              <TableHeaderCell>{text.bookable}</TableHeaderCell>
              <TableHeaderCell>{messages.admin.news.actions}</TableHeaderCell>
            </tr></thead>
            <TableBody>{offers.map((offer) => (
              <tr key={offer.id}>
                <TableCell className="font-medium text-fg"><span className="inline-flex flex-wrap items-center gap-2">{offer.name}{offer.isExample ? <Badge tone="info">{text.example}</Badge> : null}</span><span className="block text-xs text-subtle">{offer.visible ? text.visibleStatus : text.hiddenStatus}</span></TableCell>
                <TableCell className="whitespace-nowrap">{format.calendarDate(offer.bookingUntil)}</TableCell>
                <TableCell className="whitespace-nowrap">{format.currency(offer.minDepositCents)} – {format.currency(offer.maxDepositCents)}</TableCell>
                <TableCell>{text.months(offer.termMonths)}</TableCell>
                <TableCell>{format.rate(offer.totalReturnBps * 100)}</TableCell>
                <TableCell><Badge tone={offer.visible && !offer.isExample && offer.bookingUntil >= today ? "success" : "neutral"}>{offer.bookingUntil < today ? text.closed : offer.isExample ? text.example : offer.visible ? text.bookable : text.hiddenStatus}</Badge></TableCell>
                <TableCell className="min-w-36"><div className="inline-flex items-start gap-2">
                  <EditPromoButton offer={offer} />
                  <PromoVisibilityButton promoId={offer.id} name={offer.name} visible={offer.visible} />
                </div></TableCell>
              </tr>
            ))}</TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
