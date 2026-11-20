const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const CalendarIcon = () => (
  <svg {...base}>
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

export const AlertIcon = () => (
  <svg {...base}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 11h.01" />
  </svg>
);
