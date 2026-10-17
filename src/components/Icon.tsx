import type { SVGProps } from "react";

const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  swords: "M4 4l9 9m-9 0 3 3m-2 1-2 2M20 4l-9 9m9 0-3 3m2 1 2 2M4 4h4M20 4h-4",
  cards: "M8 3.5h9a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2ZM4 7v12.5a1.5 1.5 0 0 0 1.5 1.5H15",
  deck: "M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 16.5l8 4 8-4",
  map: "M9 4 3.5 6.5v13L9 17m0-13 6 2.5M9 4v13m6-10.5L20.5 4v13L15 19.5m0-13v13M9 17l6 2.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12.5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4",
  star: "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5Z",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5 -1.5L20 20",
  close: "M6 6l12 12M18 6 6 18",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm11 .5a3.5 3.5 0 0 1 0 4m2.5-6.5a7 7 0 0 1 0 9",
  mute: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm11 1 5 3m0-3-5 3",
  grid: "M4 4h6.5v6.5H4V4Zm9.5 0H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5Zm9.5 0H20V20h-6.5v-6.5Z",
  list: "M8.5 6H20M8.5 12H20M8.5 18H20M4 6h.01M4 12h.01M4 18h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  flip: "M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5",
  chevron: "m9 5 7 7-7 7",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19.5h14",
  upload: "M12 15V4m0 0-4 4m4-4 4 4M5 19.5h14",
  copy: "M8.5 8.5h10v11h-10v-11ZM5.5 15.5v-11h10",
  trash: "M5 7h14M10 7V4.5h4V7m-7 0 .8 12.5h8.4L17 7M10.5 11v5m3-5v5",
  edit: "M4 20h4l11-11-4-4L4 16v4Zm9.5-13.5 4 4",
  check: "m5 12.5 4.5 4.5L19 7.5",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9Z",
  spark: "M12 3v5m0 8v5M3 12h5m8 0h5M6 6l3 3m6 6 3 3m0-12-3 3M9 15l-3 3",
  zoom: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm0-9.5v4m-2-2h4M15.5 15.5 20 20",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  skip: "M6 6v12l9-6-9-6Zm11 0v12",
  history: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5M12 8v4.5l3 1.5",
  flag: "M6 21V4m0 1h11l-2 4 2 4H6",
  heart: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z",
  info: "M12 11v6m0-9.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  send: "M4 12 20 4l-5 16-3.5-6.5L4 12Zm7.5 1.5L20 4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false, ...rest }: { name: IconName; size?: number; filled?: boolean } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
