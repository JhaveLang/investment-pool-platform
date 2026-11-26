import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ACCRUAL_DELAY_DAYS, MINIMUM_TERM_DAYS, PAYOUT_DEADLINE_DAYS } from "@/lib/returns";

/**
 * The account's deadlines on a flat day axis from the payment: returns start, then the full withdrawal. A rule
 * diagram, not a chart: no curve, no calendar dates, no amounts.
 */
export async function RulesTimeline() {
  const { messages } = await getI18n();
  const text = messages.site;
  // Day 0 and the accrual start sit close together, so the accrual label goes above the line and the others below.
  const points = [
    { day: 0, label: text.timelinePayment, above: false, align: "left" },
    { day: ACCRUAL_DELAY_DAYS, label: text.timelineAccrual, above: true, align: "left" },
    { day: MINIMUM_TERM_DAYS, label: text.timelineTerm, above: false, align: "right" },
  ] as const;

  return (
    <div className="rounded-2xl border border-line bg-raised p-5">
      <p className="label-caps text-muted">{text.timelineTitle}</p>
      <div className="@container relative mt-4 h-44 sm:h-36">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent-400/30" />
        <ol>
          {points.map((point, index) => {
            const last = index === points.length - 1;
            return (
              <li
                key={point.day}
                className="absolute inset-y-0"
                style={point.align === "right" ? { right: 0 } : { left: `${(point.day / MINIMUM_TERM_DAYS) * 100}%` }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 size-3 -translate-y-1/2 rounded-full ring-2 ring-accent-300",
                    point.align === "right" ? "right-0" : "left-0",
                    last ? "bg-accent-300" : "bg-surface",
                  )}
                />
                {/* The two labels below the line share its width, so each takes at most half of it. */}
                <span
                  className={cn(
                    "absolute flex w-max flex-col break-words hyphens-auto",
                    point.above
                      ? "bottom-[calc(50%+14px)] max-w-40"
                      : "top-[calc(50%+14px)] max-w-[min(10rem,calc(50cqw-0.5rem))]",
                    point.align === "right" ? "right-0 items-end text-right" : "left-0",
                  )}
                >
                  <span className="font-mono text-[13px] text-accent-300">{text.timelineDay(point.day)}</span>
                  <span className="text-[13px] leading-snug text-muted">{point.label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-2 border-t border-line pt-3 font-mono text-[13px] text-muted">
        {text.timelinePayout(PAYOUT_DEADLINE_DAYS)}
      </p>
    </div>
  );
}
