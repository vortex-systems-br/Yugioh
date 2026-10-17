import { z } from "zod";
import type { Card } from "../cards/schema";
import type { DuelState } from "../duel/types";
import { AREAS, MISSIONS, getArea, getMission, type Area, type Mission } from "./data";

export const MatchRecordSchema = z.object({
  id: z.string(),
  at: z.number(),
  areaId: z.string().nullable(),
  result: z.enum(["win", "loss", "draw", "surrender"]),
  turns: z.number().int().min(1),
  playerDeck: z.string(),
  opponentDeck: z.string(),
});
export type MatchRecord = z.infer<typeof MatchRecordSchema>;

export const ProfileSchema = z.object({
  xp: z.number().int().min(0),
  matches: z.array(MatchRecordSchema),
  claimedMissions: z.array(z.string()),
  unlockedCards: z.array(z.string()),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const emptyProfile = (): Profile => ({ xp: 0, matches: [], claimedMissions: [], unlockedCards: [] });

export const XP_BY_RESULT: Record<MatchRecord["result"], number> = { win: 120, draw: 60, loss: 40, surrender: 10 };
export const levelForXp = (xp: number): number => Math.floor(Math.sqrt(xp / 100)) + 1;
export const xpForLevel = (level: number): number => (level - 1) ** 2 * 100;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function areaStatus(area: Area, profile: Profile): { unlocked: boolean; missing: string[] } {
  const missing: string[] = [];
  const level = levelForXp(profile.xp);
  if (area.requires.level && level < area.requires.level) missing.push(`Nível ${area.requires.level} (você está no nível ${level})`);
  for (const id of area.requires.claimedMissions ?? []) {
    if (!profile.claimedMissions.includes(id)) missing.push(`Resgatar a missão “${getMission(id)?.title ?? id}”`);
  }
  return { unlocked: missing.length === 0, missing };
}

export function canEnterArea(areaId: string, profile: Profile): Result<Area> {
  const area = getArea(areaId);
  if (!area) return { ok: false, error: "Área desconhecida." };
  const st = areaStatus(area, profile);
  return st.unlocked ? { ok: true, value: area } : { ok: false, error: `Área bloqueada: ${st.missing.join("; ")}.` };
}

export function matchFromDuel(state: DuelState, meta: { id: string; areaId: string | null; playerDeck: string; opponentDeck: string; at?: number }): Result<MatchRecord> {
  if (state.status !== "finished" || state.winner === null) return { ok: false, error: "O duelo ainda não terminou." };
  const result: MatchRecord["result"] =
    state.winner === "draw" ? "draw" : state.winner === "player" ? "win" : state.endReason === "surrender" ? "surrender" : "loss";
  return { ok: true, value: { ...meta, at: meta.at ?? Date.now(), result, turns: state.turn } };
}

/** Registra uma partida. Rejeita duplicadas e áreas bloqueadas (não basta alterar a URL). */
export function recordMatch(profile: Profile, rec: MatchRecord): Result<Profile> {
  if (profile.matches.some((m) => m.id === rec.id)) return { ok: false, error: "Partida já registrada." };
  if (rec.areaId) {
    const gate = canEnterArea(rec.areaId, profile);
    if (!gate.ok) return gate;
  }
  return { ok: true, value: { ...profile, xp: profile.xp + XP_BY_RESULT[rec.result], matches: [...profile.matches, rec] } };
}

export function missionProgress(mission: Mission, profile: Profile): { current: number; target: number; done: boolean } {
  const target = mission.objective.count;
  const current = profile.matches.filter((m) => m.areaId === mission.areaId && m.result === "win").length;
  return { current: Math.min(current, target), target, done: current >= target };
}

export function claimMission(profile: Profile, missionId: string): Result<Profile> {
  const mission = getMission(missionId);
  if (!mission) return { ok: false, error: "Missão desconhecida." };
  if (profile.claimedMissions.includes(missionId)) return { ok: false, error: "Recompensa já resgatada." };
  const gate = canEnterArea(mission.areaId, profile);
  if (!gate.ok) return gate;
  if (!missionProgress(mission, profile).done) return { ok: false, error: "Objetivo ainda não concluído." };
  return {
    ok: true,
    value: {
      ...profile,
      xp: profile.xp + mission.reward.xp,
      claimedMissions: [...profile.claimedMissions, missionId],
      unlockedCards: mission.reward.cardId && !profile.unlockedCards.includes(mission.reward.cardId) ? [...profile.unlockedCards, mission.reward.cardId] : profile.unlockedCards,
    },
  };
}

export const isCardUnlocked = (card: Card, profile: Profile): boolean => !card.unlock || profile.unlockedCards.includes(card.id);

export interface Achievement { id: string; title: string; description: string; earned: boolean }
export function achievementsFor(profile: Profile): Achievement[] {
  const wins = profile.matches.filter((m) => m.result === "win").length;
  return [
    { id: "a-first-win", title: "Primeira vitória", description: "Vença um duelo.", earned: wins >= 1 },
    { id: "a-five-wins", title: "Duelista", description: "Vença 5 duelos.", earned: wins >= 5 },
    { id: "a-claim", title: "Recompensa em mãos", description: "Resgate uma missão.", earned: profile.claimedMissions.length >= 1 },
    { id: "a-areas", title: "Explorador", description: "Desbloqueie 3 áreas.", earned: AREAS.filter((a) => areaStatus(a, profile).unlocked).length >= 3 },
    { id: "a-mythic", title: "Selo do Intervalo", description: "Obtenha a carta Mythic da demo.", earned: profile.unlockedCards.includes("arconte-do-intervalo") },
  ];
}

export { AREAS, MISSIONS };
