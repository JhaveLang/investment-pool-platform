import { daysBetween, type IsoDate } from "@/lib/calendar";

export type DatedValue = { day: IsoDate; cents: number };

/** SVG plot coordinates, with x increasing from left to right. */
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

/** Smoothly connect time-ordered samples, staying within each interval's observed range. */
export function smoothLinePath(points: readonly PlotPoint[]): string {
  // Today's balance can repeat the last ledger date. Use the closing value for that date.
  const samples = points.filter((point, index) => point.x !== points[index + 1]?.x);
  if (samples.length === 0) return "";

  const slopes = samples.slice(1).map((point, index) => (point.y - samples[index].y) / (point.x - samples[index].x));
  const tangents = samples.map((_point, index) => {
    const before = slopes[index - 1] ?? 0;
    const after = slopes[index] ?? 0;
    // Horizontal at endpoints and turning points. Elsewhere, use the gentler slope on either side.
    return before * after > 0 ? Math.sign(before) * Math.min(Math.abs(before), Math.abs(after)) : 0;
  });

  const xy = (horizontal: number, vertical: number) => `${Number(horizontal.toFixed(3))} ${Number(vertical.toFixed(3))}`;
  const path = [`M${xy(samples[0].x, samples[0].y)}`];
  for (let index = 1; index < samples.length; index++) {
    const start = samples[index - 1];
    const end = samples[index];
    const dx = (end.x - start.x) / 3;
    const control1 = xy(start.x + dx, start.y + dx * tangents[index - 1]);
    const control2 = xy(end.x - dx, end.y - dx * tangents[index]);
    path.push(`C${control1} ${control2} ${xy(end.x, end.y)}`);
  }
  return path.join(" ");
}
