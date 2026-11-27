/** Faint plum curves behind the start page hero: decoration only, no labels, no data. */
export function HeroBackdrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 620"
      fill="none"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full text-accent-400"
    >
      <defs>
        <linearGradient id="hero-backdrop-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 520 C 220 490, 340 430, 520 450 C 700 470, 860 320, 1080 260 C 1220 220, 1340 150, 1440 110 L 1440 620 L 0 620 Z"
        fill="url(#hero-backdrop-fill)"
      />
      <path
        d="M0 520 C 220 490, 340 430, 520 450 C 700 470, 860 320, 1080 260 C 1220 220, 1340 150, 1440 110"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
      />
      <path
        d="M0 560 C 260 540, 460 510, 680 480 C 900 450, 1140 360, 1440 240"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />
      <circle cx="520" cy="450" r="4" fill="currentColor" fillOpacity="0.3" />
      <circle cx="1080" cy="260" r="5" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}
