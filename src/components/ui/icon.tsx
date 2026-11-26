import type { SVGProps } from "react";

// Line icons on a 24px grid, 1.75px stroke, drawn for this app. Each entry is the SVG body.
const icons = {
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  arrowDown: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  arrowUp: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  arrowDownLeft: <path d="M17 7 7 17M7 9v8h8" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  inbox: <path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6H3v-6z" />,
  send: <path d="M20 4 10 14M20 4l-6 16-4-6-6-4z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7" />
    </>
  ),
  trendingUp: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  trendingDown: <path d="M3 7l6 6 4-4 8 8M15 17h6v-6" />,
  file: <path d="M14 3H6.5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5zM14 3v4.5h4.5M9 13h6M9 17h6" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  logOut: <path d="M10 4H5.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1H10M15 8l4 4-4 4M19 12H9" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  bank: <path d="M3.5 9.5 12 4.5l8.5 5M5 10v7.5M9.5 10v7.5M14.5 10v7.5M19 10v7.5M3.5 20h17" />,
  wallet: (
    <>
      <path d="M4.5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V6a1.5 1.5 0 0 1 1.5-1.5H17v3" />
      <path d="M16.5 13.75h.01" />
    </>
  ),
  plusCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="18.5" cy="12" r="1.25" />
    </>
  ),
  shieldCheck: <path d="M12 3.5 5 6v5.5c0 4.25 2.9 7.6 7 9 4.1-1.4 7-4.75 7-9V6zM9 12l2.2 2.2L15.5 10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10 5.75a8.4 8.4 0 0 1 2-.25c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.5M6.4 7.2A16 16 0 0 0 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 5.1-1.6" />
      <path d="M10.05 10.05a2.75 2.75 0 0 0 3.9 3.9M4 4l16 16" />
    </>
  ),
  pencil: <path d="M15.5 5.5l3 3M4.5 19.5l1-4L15.8 5.2a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8.5 18.5z" />,
  bell: <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 21a2.2 2.2 0 0 0 4 0" />,
  swap: <path d="M7 4.5 3.5 8 7 11.5M3.5 8h14M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof icons;

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

/** Decorative by default; pass `aria-label` and `aria-hidden={false}` for a meaningful icon. */
export function Icon({ name, className, ...svgProps }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "size-5"}
      {...svgProps}
    >
      {icons[name]}
    </svg>
  );
}
