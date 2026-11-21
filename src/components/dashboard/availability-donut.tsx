import { Card, CardHeader } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import type { AccountOverview } from "@/server/queries/investor";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The balance split into withdrawable and locked capital, as a ring with a legend. */
export async function AvailabilityDonut({ overview }: { overview: AccountOverview }) {
  const { messages, format } = await getI18n();
  const text = messages.dashboard;
  const total = overview.balanceCents;
  const freeShare = total > 0 ? overview.availableCents / total : 0;
  const lockedShare = total > 0 ? overview.lockedCents / total : 0;
  // A 2-unit gap between the slices, only when both exist.
  const gap = freeShare > 0 && lockedShare > 0 ? 2 : 0;
  const freeLength = Math.max(0, freeShare * CIRCUMFERENCE - gap);
  const lockedLength = Math.max(0, lockedShare * CIRCUMFERENCE - gap);
  const rows = [
    { label: text.available, cents: overview.availableCents, share: freeShare, swatch: "bg-chart-free" },
    { label: text.locked, cents: overview.lockedCents, share: lockedShare, swatch: "bg-chart-locked" },
  ];

  return (
    <Card className="@container">
      <CardHeader title={text.availabilityTitle} icon="wallet" />
      <div className="flex flex-col items-center gap-5 px-5 pb-4 @[19rem]:flex-row">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-overlay)" strokeWidth="10" />
            {freeLength > 0 ? (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="var(--color-chart-free)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${freeLength} ${CIRCUMFERENCE}`}
              />
            ) : null}
            {lockedLength > 0 ? (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="var(--color-chart-locked)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${lockedLength} ${CIRCUMFERENCE}`}
                strokeDashoffset={-(freeShare * CIRCUMFERENCE)}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-bold text-fg">
              {total > 0 ? format.percent(Math.round(freeShare * 100)) : messages.common.emptyValue}
            </span>
            <span className="label-caps text-subtle">{text.freeShort}</span>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-3">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 flex-1 items-start gap-2 text-fg">
                <span aria-hidden className={`mt-1 size-2.5 shrink-0 rounded-full ${row.swatch}`} />
                <span>
                  {row.label}
                  <span className="amount block text-xs text-subtle">{format.currency(row.cents)}</span>
                </span>
              </span>
              <span className="amount shrink-0 font-semibold text-fg">
                {format.percent(Math.round(row.share * 100))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px]">
        <span className="text-muted">{text.nextUnlock}</span>
        <span className="font-semibold text-fg">
          {overview.nextUnlockOn ? format.calendarDate(overview.nextUnlockOn) : text.nothingLocked}
        </span>
      </div>
    </Card>
  );
}
