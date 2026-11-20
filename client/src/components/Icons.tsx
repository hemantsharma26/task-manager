import type { SVGProps } from 'react';

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

type P = { size?: number };

export const CalendarIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

export const PlusIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const CloseIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const CheckIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

export const BoardIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <rect x="2" y="2.5" width="3.5" height="11" rx="1" />
    <rect x="6.25" y="2.5" width="3.5" height="7" rx="1" />
    <rect x="10.5" y="2.5" width="3.5" height="9" rx="1" />
  </svg>
);

export const ListIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
  </svg>
);

export const TrashIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4" />
  </svg>
);

export const AlertIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 11h.01" />
  </svg>
);

export const FlagIcon = ({ size = 16, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M4 14V2.5M4 3h8l-1.5 3L12 9H4" />
  </svg>
);


export const ChevronLeftIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </svg>
);

export const ChevronRightIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);

export const ClockIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.2 1.4" />
  </svg>
);

export const GripIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01" />
  </svg>
);

export const DotsIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" />
  </svg>
);
