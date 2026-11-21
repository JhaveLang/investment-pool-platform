import { daysBetween, type IsoDate } from "@/lib/calendar";

export type DatedValue = { day: IsoDate; cents: number };

/** Plot coordinates in a 0–100 box: x left to right, y top to bottom. */
export type PlotPoint = { x: number; y: number };

/** A rounded axis maximum and its tick values, e.g. 18 585 € → 0, 5 000, 10 000, 15 000, 20 000 €. */
export function niceScale(maxCents: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (maxCents <= 0) {
    return { max: 100, ticks: [0, 100] };
  }
  const roughStep = maxCents / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const max = Math.ceil(maxCents / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) {
    ticks.push(tick);
  }
  return { max, ticks };
}

/** Positions dated values on a time-proportional x axis and a zero-based y axis. */
export function plotDatedValues(values: readonly DatedValue[], maxCents: number): PlotPoint[] {
  const firstDay = values[0].day;
  const span = Math.max(1, daysBetween(firstDay, values[values.length - 1].day));
  return values.map((value) => ({
    x: (daysBetween(firstDay, value.day) / span) * 100,
    y: 100 - (Math.max(0, value.cents) / maxCents) * 100,
  }));
}

/**
 * A balance holds until the next movement, so the line steps: flat to the next day with
 * a movement, then straight up or down to the new value.
 */
export function stepLinePath(points: readonly PlotPoint[]): string {
  return points.map((point, index) => (index === 0 ? `M${point.x} ${point.y}` : `H${point.x}V${point.y}`)).join("");
}

export function stepAreaPath(points: readonly PlotPoint[]): string {
  return `${stepLinePath(points)}V100H${points[0].x}Z`;
}
