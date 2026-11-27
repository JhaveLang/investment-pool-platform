"use client";

import { useState } from "react";
import { segmentStyles } from "@/components/ui/segmented";
import { useFormatter, useMessages } from "@/i18n/client";
import { ACCRUAL_DELAY_DAYS } from "@/lib/returns";
import { AccrualPlot, type AccrualDay } from "./accrual-plot";

export function RulesTimeline({ days }: { days: AccrualDay[] }) {
  const text = useMessages().site;
  const format = useFormatter();
  const [selectedDay, setSelectedDay] = useState(ACCRUAL_DELAY_DAYS);
  const lastDay = days.length - 1;
  const selected = days[selectedDay];
  const status = selectedDay === lastDay ? text.capitalAvailable : text.capitalLocked;
  const details = `${text.earningDays(selected.earningDays)} · ${status}`;

  return (
    <figure id="accrual-curve" tabIndex={-1} className="scroll-mt-20 rounded-2xl border border-line-strong/60 bg-raised p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="label-caps text-muted">{text.accrualCurve}</span>
        <span className="font-mono text-xs font-medium text-accent-300">
          <time dateTime={days[0].date}>{format.calendarDate(days[0].date)}</time>
          {" – "}
          <time dateTime={days[lastDay].date}>{format.calendarDate(days[lastDay].date)}</time>
        </span>
      </figcaption>
      <div className="relative my-2 rounded focus-within:outline-2 focus-within:outline-accent-400">
        <AccrualPlot days={days} selectedDay={selectedDay} />
        <input
          id="accrual-day"
          type="range"
          min={0}
          max={lastDay}
          value={selectedDay}
          onChange={(event) => setSelectedDay(event.currentTarget.valueAsNumber)}
          aria-valuetext={`${text.selectedDay(selectedDay)} · ${format.calendarDate(selected.date)} · ${details}`}
          className="absolute inset-0 m-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      <div className="mb-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <label htmlFor="accrual-day" className="font-semibold text-accent-300">{text.chooseAccrualDay}</label>
          <span className="font-mono text-xs text-muted">{text.selectedDay(selectedDay)} · <time dateTime={selected.date}>{format.calendarDate(selected.date)}</time></span>
        </div>
        <output htmlFor="accrual-day" className="block text-muted">{details}</output>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setSelectedDay(ACCRUAL_DELAY_DAYS)}
          aria-pressed={selectedDay === ACCRUAL_DELAY_DAYS}
          className={segmentStyles(selectedDay === ACCRUAL_DELAY_DAYS)}
        >
          {text.accrualMilestone(ACCRUAL_DELAY_DAYS)}
        </button>
        <button
          type="button"
          onClick={() => setSelectedDay(lastDay)}
          aria-pressed={selectedDay === lastDay}
          className={segmentStyles(selectedDay === lastDay)}
        >
          {text.withdrawalMilestone(lastDay)}
        </button>
      </div>
    </figure>
  );
}
