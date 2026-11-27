import { cn } from "@/lib/cn";
import { niceScale, plotDatedValues, smoothLinePath, type DatedValue } from "./geometry";

type SparklineProps = {
  values: DatedValue[];
  /** Unique within the page, for the gradient id. */
  id: string;
  className?: string;
};

/** A smooth balance trend with a dot on today's value. */
export function Sparkline({ values, id, className }: SparklineProps) {
  if (values.length < 2) {
    return null;
  }
  const scale = niceScale(Math.max(...values.map((value) => value.cents)), 1);
  const points = plotDatedValues(values, scale.max);
  const line = smoothLinePath(points);
  const last = points[points.length - 1];
  const gradientId = `sparkline-${id}`;

  return (
    <div aria-hidden className={cn("relative", className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-400)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent-400)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} V100 H${points[0].x} Z`} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent-400)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* An HTML dot stays round although the SVG stretches to any aspect ratio. */}
      <span
        className="absolute size-2 -translate-1/2 rounded-full bg-accent-400"
        style={{ left: `${last.x}%`, top: `${last.y}%` }}
      />
    </div>
  );
}
