import type { ReactElement, CSSProperties } from "react";

const ICONS: Record<string, ReactElement> = {
  back: <path d="M15 18l-6-6 6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  rupee: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  list: <path d="M4 6h16M4 12h16M4 18h16" />,
  star: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />,
  chev: <path d="M9 6l6 6-6 6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  bulb: <path d="M12 3a5 5 0 0 1 5 5c0 2-1.5 3-2 4H9c-.5-1-2-2-2-4a5 5 0 0 1 5-5zM9 18h6M10 21h4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>,
  warn: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  refresh: <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sch: <path d="M12 2l2.4 5 5.6.5-4.2 3.8 1.3 5.7L12 14l-5.1 3 1.3-5.7L4 7.5 9.6 7z" />,
  sciences: <path d="M5 4h14v16l-7-3-7 3z" />,
  commerce: <path d="M4 19V5m0 14h16M8 15l3-4 3 2 4-6" />,
  humanities: <><path d="M12 3l4 4-9 9-4 1 1-4z" /><path d="M14 5l3 3" /></>,
  building: <path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4 12H1M23 12h-3M6 6l2 2M18 18l-2-2" /></>,
};

export function Icon(
  { name, size = 20, stroke = 1.9, style }: { name: string; size?: number; stroke?: number; style?: CSSProperties }
) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}

export function Compass({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20c4-1 5-8 8-9s5 2 8-3" />
      <circle cx="4" cy="20" r="1.4" fill="var(--primary)" />
      <circle cx="20" cy="8" r="1.4" fill="var(--primary)" />
    </svg>
  );
}

export function Bookmark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" strokeWidth={1} aria-hidden="true">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}
