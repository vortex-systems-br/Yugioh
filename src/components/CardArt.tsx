import { useId } from "react";
import type { Card } from "@/domain/cards/schema";

type Art = Card["art"];

function Motif({ motif, c1, c2 }: { motif: Art["motif"]; c1: string; c2: string }) {
  const stroke = { stroke: "rgb(255 255 255 / 0.65)", strokeWidth: 0.9, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (motif) {
    case "dragon":
      return (
        <g>
          <path d="M14 54C22 24 40 14 50 26 60 14 78 24 86 54 74 42 62 42 50 58 38 42 26 42 14 54Z" fill={c1} {...stroke} />
          <path d="M50 26 54 12 46 12Z M50 58V68" fill={c2} {...stroke} />
          <circle cx="45" cy="34" r="2" fill="#fff" /><circle cx="55" cy="34" r="2" fill="#fff" />
        </g>
      );
    case "eye":
      return (
        <g>
          <path d="M10 38Q50 4 90 38 50 72 10 38Z" fill={c2} {...stroke} />
          <circle cx="50" cy="38" r="15" fill={c1} {...stroke} />
          <ellipse cx="50" cy="38" rx="4" ry="11" fill="#0b0b12" />
          <circle cx="45" cy="32" r="2.4" fill="#fff" />
        </g>
      );
    case "tome":
      return (
        <g>
          <path d="M16 20 50 27 84 20V58L50 65 16 58Z" fill={c2} {...stroke} />
          <path d="M50 27V65M24 28 44 32M24 36 44 40M24 44 44 48M56 32 76 28M56 40 76 36M56 48 76 44" fill="none" {...stroke} />
          <circle cx="50" cy="16" r="3.5" fill={c1} {...stroke} />
        </g>
      );
    case "blade":
      return (
        <g>
          <path d="M26 66 70 12 78 18 36 72Z" fill={c1} {...stroke} />
          <path d="M24 52 40 68M18 74 30 62" fill="none" {...stroke} strokeWidth={2.4} />
          <path d="M70 12 80 8 82 20Z" fill={c2} {...stroke} />
        </g>
      );
    case "rune":
      return (
        <g fill="none" {...stroke}>
          <circle cx="50" cy="38" r="26" fill={c2} fillOpacity="0.5" />
          <circle cx="50" cy="38" r="19" />
          <path d="M50 22V54M50 30 40 40M50 36 60 26M50 46 42 52" stroke={c1} strokeWidth={2.4} />
        </g>
      );
    case "beast":
      return (
        <g>
          <path d="M26 14 36 32Q50 28 64 32L74 14 80 42Q50 70 20 42Z" fill={c1} {...stroke} />
          <path d="M40 46 50 58 60 46Z" fill={c2} {...stroke} />
          <circle cx="41" cy="38" r="2.6" fill="#fff" /><circle cx="59" cy="38" r="2.6" fill="#fff" />
        </g>
      );
    case "orb":
      return (
        <g>
          <circle cx="50" cy="38" r="24" fill={c1} fillOpacity="0.8" {...stroke} />
          <ellipse cx="50" cy="38" rx="34" ry="9" fill="none" {...stroke} />
          <circle cx="42" cy="30" r="6" fill="#fff" fillOpacity="0.55" />
        </g>
      );
    case "tower":
      return (
        <g>
          <path d="M36 66V28L50 12 64 28V66Z" fill={c2} {...stroke} />
          <path d="M44 66V50H56V66M36 40H64M42 28H58" fill="none" {...stroke} />
          <circle cx="50" cy="12" r="3" fill={c1} {...stroke} />
        </g>
      );
    case "wing":
      return (
        <g fill={c1} {...stroke}>
          <path d="M50 62C30 60 14 44 10 18 28 24 38 32 50 46 62 32 72 24 90 18 86 44 70 60 50 62Z" />
          <path d="M50 46C40 36 30 30 20 28M50 46C42 42 34 40 26 40M50 46C46 46 40 48 34 50" fill="none" />
        </g>
      );
    case "shard":
      return (
        <g {...stroke}>
          <path d="M40 66 32 30 44 10 56 34 52 66Z" fill={c1} />
          <path d="M56 66 60 38 74 24 80 52 70 66Z" fill={c2} />
          <path d="M44 10 40 66M60 38 56 66" fill="none" />
        </g>
      );
  }
}

export function CardArt({ art, label }: { art: Art; label: string }) {
  const id = useId().replace(/:/g, "");
  const { hue, motif } = art;
  const c1 = `hsl(${hue} 78% 58%)`;
  const c2 = `hsl(${(hue + 40) % 360} 65% 32%)`;
  const dark = `hsl(${hue} 55% 7%)`;
  const stars = Array.from({ length: 9 }, (_, i) => ({ x: (hue * (i + 3) * 7) % 100, y: (hue * (i + 5) * 3) % 76, r: 0.4 + ((i * 37) % 10) / 14 }));
  return (
    <svg viewBox="0 0 100 76" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="42%" r="75%"><stop offset="0" stopColor={c2} /><stop offset="1" stopColor={dark} /></radialGradient>
        <linearGradient id={`fg${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor={c1} stopOpacity="0.35" /></linearGradient>
      </defs>
      <rect width="100" height="76" fill={`url(#bg${id})`} />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity="0.6" />)}
      <g transform="translate(0 2)"><Motif motif={motif} c1={c1} c2={c2} /></g>
      <rect y="50" width="100" height="26" fill={`url(#fg${id})`} />
    </svg>
  );
}
