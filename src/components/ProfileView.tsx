"use client";

import Link from "next/link";
import { getCard } from "@/domain/cards/data";
import { getArea } from "@/domain/progression/data";
import { achievementsFor, levelForXp, xpForLevel } from "@/domain/progression/progression";
import { useApp } from "@/store/app-store";
import { HoloCard } from "./HoloCard";
import { Icon } from "./Icon";

const RESULT = { win: "Vitória", loss: "Derrota", draw: "Empate", surrender: "Rendição" } as const;

export function ProfileView() {
  const hydrated = useApp((s) => s.hydrated);
  const profile = useApp((s) => s.profile);
  const decks = useApp((s) => s.decks);
  const favorites = useApp((s) => s.favorites);
  if (!hydrated) return <p className="muted p-6" role="status">Carregando o perfil…</p>;

  const level = levelForXp(profile.xp);
  const base = xpForLevel(level), next = xpForLevel(level + 1);
  const pct = Math.round(((profile.xp - base) / (next - base)) * 100);
  const wins = profile.matches.filter((m) => m.result === "win").length;
  const achievements = achievementsFor(profile);
  const rewards = profile.unlockedCards.map((id) => getCard(id)).filter((c) => !!c);

  return (
    <div className="grid gap-5">
      <div><h1 className="text-3xl sm:text-4xl">Perfil</h1><p className="muted mt-1 text-sm">Progresso salvo neste dispositivo. Não há conta nem validação por servidor.</p></div>

      <section className="panel grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="grid size-20 place-items-center rounded-full border-2 border-gold bg-surface-2"><span className="font-display text-3xl">{level}</span></div>
        <div>
          <p className="text-lg font-semibold">Nível {level}</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-edge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso até o próximo nível"><div className="h-full bg-gradient-to-r from-blue to-violet" style={{ width: `${pct}%` }} /></div>
          <p className="muted mt-1 text-sm">{profile.xp} XP. Faltam {next - profile.xp} para o nível {level + 1}.</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Duelos", profile.matches.length], ["Vitórias", wins], ["Baralhos", decks.length], ["Favoritas", favorites.length]].map(([l, v]) => (
          <div key={l} className="panel p-4"><p className="muted text-sm">{l}</p><p className="font-display text-3xl">{v}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="panel p-4" aria-label="Conquistas">
          <h2 className="mb-3 text-xl">Conquistas</h2>
          <ul className="grid gap-2">
            {achievements.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 rounded-lg border p-3 ${a.earned ? "border-gold/50 bg-gold/10" : "border-edge opacity-70"}`}>
                <Icon name={a.earned ? "check" : "lock"} className={a.earned ? "text-gold" : "text-mute"} />
                <div><p className="font-semibold">{a.title}</p><p className="muted text-sm">{a.description}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-4" aria-label="Histórico de partidas">
          <h2 className="mb-3 text-xl">Últimos duelos</h2>
          {profile.matches.length === 0 ? (
            <div className="grid gap-3"><p className="muted text-sm">Nenhum duelo registrado ainda.</p><Link href="/arena" className="btn btn-primary w-fit">Entrar no duelo</Link></div>
          ) : (
            <ul className="grid gap-2">
              {profile.matches.slice(-8).reverse().map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface p-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-semibold">{RESULT[m.result]} contra {m.opponentDeck}</p><p className="muted truncate">{m.areaId ? getArea(m.areaId)?.name : "Duelo livre"}, {m.turns} turnos, {m.playerDeck}</p></div>
                  <time className="muted shrink-0 text-xs" dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleDateString("pt-BR")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel p-4" aria-label="Recompensas">
        <h2 className="mb-3 text-xl">Cartas de recompensa</h2>
        {rewards.length === 0 ? <p className="muted text-sm">Conclua missões para desbloquear cartas exclusivas da demonstração.</p> : (
          <ul className="flex flex-wrap gap-4">{rewards.map((c) => <li key={c.id} className="w-36"><HoloCard card={c} /></li>)}</ul>
        )}
      </section>
    </div>
  );
}
