import { smoothLinePath } from "@/components/charts/geometry";
import { addDays, daysBetween, type IsoDate } from "@/lib/calendar";
import { accrualStartForDeposit, minimumTermEnd, sumCapitalDays } from "@/lib/returns";

export type AccrualDay = { date: IsoDate; earningDays: number };

export function depositTimeline(receivedOn: IsoDate): AccrualDay[] {
  const termDays = daysBetween(receivedOn, minimumTermEnd(receivedOn));
  // With one cent held throughout the example, cent-days equal the number of eligible days.
  const deposit = [{ effectiveOn: accrualStartForDeposit(receivedOn), amountCents: 1 }];
  return Array.from({ length: termDays + 1 }, (_entry, day) => {
    const date = addDays(receivedOn, day);
    return { date, earningDays: Number(sumCapitalDays(deposit, receivedOn, date)) };
  });
}

type AccrualPlotProps = {
  days: AccrualDay[];
  selectedDay?: number;
  compact?: boolean;
};

export function AccrualPlot({ days, selectedDay, compact = false }: AccrualPlotProps) {
  const width = compact ? 76 : 460;
  const height = compact ? 32 : 130;
  const inset = compact ? 4 : 10;
  const baseline = height - inset;
  const lastDay = days.length - 1;
  const maxDays = Math.max(1, days[lastDay].earningDays);
  const points = days.map(({ earningDays }, index) => ({
    x: inset + (index / lastDay) * (width - 2 * inset),
    y: baseline - (earningDays / maxDays) * (height - 2 * inset),
  }));
  const line = smoothLinePath(points);
  const selected = selectedDay === undefined ? undefined : points[selectedDay];
  const last = points[lastDay];

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className={compact ? "h-8 w-[4.75rem] shrink-0 text-accent-400" : "block w-full text-accent-300"}>
      {!compact && (
        <>
          <defs>
            <linearGradient id="home-accrual-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity=".015" />
            </linearGradient>
          </defs>
          <path d="M0 10 H460 M0 65 H460 M0 120 H460" fill="none" stroke="var(--color-line-strong)" strokeDasharray="4 4" />
        </>
      )}
      <path d={`${line} V${baseline} H${inset} Z`} fill={compact ? "currentColor" : "url(#home-accrual-fill)"} fillOpacity={compact ? 0.12 : 1} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={compact ? 2.2 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={compact ? 3 : 4} fill="currentColor" />
      {selected && (
        <>
          <path d={`M${selected.x} ${inset} V${baseline}`} stroke="currentColor" strokeOpacity=".45" strokeDasharray="3 3" />
          <circle cx={selected.x} cy={selected.y} r="5" fill="var(--color-raised)" stroke="currentColor" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
