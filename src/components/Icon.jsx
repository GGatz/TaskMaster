// Small stroke icon set (16x16 grid). Paths are intentionally simple.
const P = {
  chevronRight: 'M6 3.5l4.5 4.5L6 12.5',
  chevronDown: 'M3.5 6l4.5 4.5L12.5 6',
  chevronLeft: 'M10 3.5L5.5 8l4.5 4.5',
  plus: 'M8 3v10M3 8h10',
  search: 'M7 12.2a5.2 5.2 0 100-10.4 5.2 5.2 0 000 10.4zM11 11l3.2 3.2',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.8 7v4M9.2 7v4',
  star: 'M8 2.3l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11l-3.4 1.8.7-3.8L2.5 6.3l3.8-.5z',
  dots: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  grip: 'M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01',
  page: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  table: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M6.2 3.5v9',
  board: 'M2.5 3h3v10h-3zM6.5 3h3v6.5h-3zM10.5 3h3v8.5h-3z',
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  gallery: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z',
  calendar: 'M2.8 3.8h10.4v9.4H2.8zM2.8 6.8h10.4M5.5 2.3v2.5M10.5 2.3v2.5',
  filter: 'M2.5 3.5h11L9.5 8.5V13l-3-1.5V8.5z',
  sort: 'M5 13V3M2.5 5.5L5 3l2.5 2.5M11 3v10M8.5 10.5L11 13l2.5-2.5',
  x: 'M4 4l8 8M12 4l-8 8',
  check: 'M3.5 8.5l3 3 6-7',
  copy: 'M5.5 5.5h7v8h-7zM3.5 10.5v-8h7',
  link: 'M7 9a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.7.7M9 7a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 007 12.5l.7-.7',
  image: 'M2.5 3.5h11v9h-11zM2.5 11l3-3 2.5 2.5 2-2 3.5 3.5M10.5 6.5h.01',
  settings: 'M8 10.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1',
  sidebar: 'M2.5 3h11v10h-11zM6.2 3v10',
  clock: 'M8 14a6 6 0 100-12 6 6 0 000 12zM8 4.8V8l2.2 1.4',
  arrowUp: 'M8 13V3M3.8 7.2L8 3l4.2 4.2',
  arrowDown: 'M8 3v10M3.8 8.8L8 13l4.2-4.2',
  arrowRight: 'M3 8h10M8.8 3.8L13 8l-4.2 4.2',
  eye: 'M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8zM8 9.8a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  eyeOff: 'M2 2l12 12M6.4 6.4a1.8 1.8 0 002.5 2.5M4 4.6C2.8 5.6 1.8 8 1.8 8s2.2 4.2 6.2 4.2c1 0 1.9-.3 2.7-.7M12.2 10.6c1.2-1 2-2.6 2-2.6S12 3.8 8 3.8c-.4 0-.8 0-1.2.1',
  edit: 'M3 13l.6-3L10.8 2.8a1.4 1.4 0 012 2L5.6 12zM9.5 4.2l2.3 2.3',
  moon: 'M13 9.5A5.5 5.5 0 116.5 3a4.3 4.3 0 006.5 6.5z',
  sun: 'M8 10.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6zM8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1',
  home: 'M2.5 7.5L8 2.8l5.5 4.7M4 6.8v6.2h8V6.8',
  download: 'M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10',
  lock: 'M4.5 7.2h7v5.8h-7zM6 7.2V5.3a2 2 0 014 0v1.9',
  undo: 'M5 3L2.5 5.5 5 8M2.7 5.5h6a3.8 3.8 0 010 7.6H6',
  external: 'M9 3h4v4M13 3L7.5 8.5M11 9v3.5H3.5V5H7',
  type: 'M3.5 4V3h9v1M8 3v10M6 13h4',
  properties: 'M3 4.5h10M3 8h10M3 11.5h6',
  duplicate: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  move: 'M2.5 8h11M10 4.5L13.5 8 10 11.5',
  expand: 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9',
};

export default function Icon({ name, size = 16, className = '', style }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={name === 'starFilled' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function StarFilled({ size = 16 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
      <path d={P.star} />
    </svg>
  );
}
