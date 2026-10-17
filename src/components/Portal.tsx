/** Portal arcano em SVG: anéis girando, runas geradas por código e profundidade por camadas. */
const RUNES = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  const cx = 250 + Math.cos(a) * 205, cy = 250 + Math.sin(a) * 205;
  const rot = (a * 180) / Math.PI + 90;
  const k = (i * 5) % 4;
  const shapes = ["M0-14V14M0-4 8-12M0 4 8-4", "M-7-14V14M-7-14 7-2-7 10", "M0-14V14M-8-6 0 2 8-6", "M-8-14 8 14M8-14-8 14M0-14V14"];
  return { cx, cy, rot, d: shapes[k] };
});

export function Portal({ intro = false, className = "" }: { intro?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} role="img" aria-label="Portal arcano com runas">
      <defs>
        <radialGradient id={`pg${intro ? "i" : "h"}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0a0a18" /><stop offset=".45" stopColor="#2a1670" stopOpacity=".9" /><stop offset=".8" stopColor="#397bff" stopOpacity=".5" /><stop offset="1" stopColor="#8c48ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={intro ? "intro-portal" : ""}><circle cx="250" cy="250" r="190" fill={`url(#pg${intro ? "i" : "h"})`} /></g>
      <g className="ring-a" fill="none" stroke="#d6b36a" strokeWidth="1.4"><circle cx="250" cy="250" r="238" opacity=".7" /><circle cx="250" cy="250" r="226" strokeDasharray="2 10" opacity=".6" /></g>
      <g className="ring-b" fill="none" stroke="#8c48ff" strokeWidth="1.2"><circle cx="250" cy="250" r="172" strokeDasharray="22 8" opacity=".8" /><circle cx="250" cy="250" r="150" opacity=".35" /></g>
      <g fill="none" stroke="#f2f4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {RUNES.map((r, i) => (
          <g key={i} className={intro ? "intro-rune" : ""} style={intro ? { animationDelay: `${0.15 + i * 0.05}s` } : { opacity: 0.75 }} transform={`translate(${r.cx} ${r.cy}) rotate(${r.rot})`}><path d={r.d} /></g>
        ))}
      </g>
    </svg>
  );
}
