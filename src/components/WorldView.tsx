"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getCard } from "@/domain/cards/data";
import { AREAS, MISSIONS, type Area } from "@/domain/progression/data";
import { areaStatus, levelForXp, missionProgress, xpForLevel } from "@/domain/progression/progression";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";

const NODES: Record<string, { x: number; y: number }> = { templo: { x: 90, y: 250 }, biblioteca: { x: 250, y: 110 }, arena: { x: 420, y: 230 }, ruinas: { x: 560, y: 90 } };
const LINKS: [string, string][] = [["templo", "biblioteca"], ["templo", "arena"], ["arena", "ruinas"], ["biblioteca", "ruinas"]];

export function WorldView() {
  const params = useSearchParams();
  const hydrated = useApp((s) => s.hydrated);
  const profile = useApp((s) => s.profile);
  const claim = useApp((s) => s.claimMission);
  const [selected, setSelected] = useState<string>(() => (AREAS.some((a) => a.id === params.get("area")) ? (params.get("area") as string) : "templo"));
  const { toast, show } = useToast();

  if (!hydrated) return <p className="muted p-6" role="status">Carregando o mapa…</p>;

  const level = levelForXp(profile.xp);
  const area = AREAS.find((a) => a.id === selected) as Area;
  const st = areaStatus(area, profile);
  const missions = MISSIONS.filter((m) => m.areaId === area.id);
  const next = xpForLevel(level + 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl sm:text-4xl">Mundo e missões</h1><p className="muted mt-1 text-sm">Nível {level}, {profile.xp} de {next} XP para o próximo nível.</p></div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-label="Mapa" className="panel overflow-hidden p-2">
          <svg viewBox="0 0 650 340" className="w-full" role="group" aria-label="Mapa com quatro áreas">
            <defs>
              <radialGradient id="mapbg" cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#1b1738" /><stop offset="1" stopColor="#0a0b14" /></radialGradient>
              <pattern id="mapgrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#ffffff" strokeOpacity=".04" /></pattern>
            </defs>
            <rect width="650" height="340" fill="url(#mapbg)" /><rect width="650" height="340" fill="url(#mapgrid)" />
            {LINKS.map(([a, b]) => <line key={a + b} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#d6b36a" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="4 6" />)}
            {AREAS.map((a) => {
              const n = NODES[a.id];
              const unlocked = areaStatus(a, profile).unlocked;
              const on = a.id === selected;
              return (
                <g key={a.id} transform={`translate(${n.x} ${n.y})`}>
                  <foreignObject x="-70" y="-48" width="140" height="96" style={{ overflow: "visible" }}>
                    <button type="button" onClick={() => { setSelected(a.id); audio.sfx("select"); }} aria-pressed={on} aria-label={`${a.name}${unlocked ? "" : ", bloqueada"}`} className="grid h-full w-full place-items-center rounded-2xl border text-center text-xs font-semibold transition" style={{ borderColor: on ? "#d6b36a" : "#2a2f48", backgroundColor: "#0b0c16", backgroundImage: `linear-gradient(160deg, hsl(${a.hue} 55% ${unlocked ? 22 : 12}% / 0.9), #0b0c16)`, opacity: unlocked ? 1 : 0.7, boxShadow: on ? "0 0 0 2px rgb(214 179 106 / 0.5)" : undefined }}>
                      <span className="grid gap-1 px-2">{!unlocked && <Icon name="lock" size={16} className="mx-auto text-gold" />}<span className="font-display text-sm leading-tight">{a.name}</span></span>
                    </button>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </section>

        <section aria-label={`Detalhes de ${area.name}`} className="panel p-4" style={{ background: `linear-gradient(160deg, hsl(${area.hue} 60% 16% / 0.5), transparent 60%)` }}>
          <h2 className="text-2xl">{area.name}</h2>
          <p className="muted mt-1 text-sm">{area.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed">{area.description}</p>
          <p className="mt-3 text-sm">Rival: <strong>{area.opponent.name}</strong></p>
          {st.unlocked ? (
            <Link href={`/arena?area=${area.id}`} className="btn btn-gold mt-4">Duelar nesta área</Link>
          ) : (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm"><p className="mb-1 flex items-center gap-2 font-semibold"><Icon name="lock" size={16} /> Área bloqueada</p><ul className="list-disc pl-5">{st.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
          )}

          <h3 className="mb-2 mt-6 text-lg">Missões</h3>
          <ul className="grid gap-2">
            {missions.map((m) => {
              const p = missionProgress(m, profile);
              const claimed = profile.claimedMissions.includes(m.id);
              const reward = m.reward.cardId ? getCard(m.reward.cardId) : null;
              return (
                <li key={m.id} className="rounded-xl border border-edge bg-surface p-3">
                  <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{m.title}</p><p className="muted text-sm">{m.description}</p></div>{claimed && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok">Resgatada</span>}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-edge" role="progressbar" aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.current} aria-label={`Progresso de ${m.title}`}><div className="h-full bg-blue" style={{ width: `${(p.current / p.target) * 100}%` }} /></div>
                  <p className="muted mt-1 text-xs">{p.current}/{p.target} vitórias. Recompensa: {m.reward.xp} XP{reward ? ` e a carta ${reward.name}` : ""}.</p>
                  {!claimed && (
                    <button type="button" className="btn btn-primary btn-sm mt-2" disabled={!p.done || !st.unlocked} onClick={() => { const r = claim(m.id); if (r.ok) { audio.sfx("win"); show(`Recompensa de “${m.title}” resgatada.`); } else { audio.sfx("error"); show(r.error, "error"); } }}>
                      {p.done ? "Resgatar recompensa" : "Objetivo incompleto"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
