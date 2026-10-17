import { getCard } from "@/domain/cards/data";
import type { MonsterCard } from "@/domain/cards/schema";
import { tributesRequired } from "@/domain/duel/engine";
import type { DuelState, PlayerId } from "@/domain/duel/types";

export function whyNotSummon(state: DuelState, card: MonsterCard, player: PlayerId): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  if (state.active !== player) return "Aguarde o seu turno.";
  if (state.phase !== "main") return "Invocações só na fase principal.";
  const me = state.players[player];
  if (card.monsterType === "ascended") return "Cartas do Extra Deck ainda não entram no duelo.";
  if (me.normalSummoned) return "Você já fez a invocação normal deste turno.";
  const need = tributesRequired(card.level);
  const onField = me.monsters.filter(Boolean).length;
  if (onField < need) return `Precisa de ${need} tributo${need > 1 ? "s" : ""}; você tem ${onField} monstro${onField === 1 ? "" : "s"} em campo.`;
  if (need === 0 && !me.monsters.includes(null)) return "Todas as zonas de monstro estão ocupadas.";
  return null;
}

/** Tributos sugeridos: os monstros mais fracos do jogador. */
export function defaultTributes(state: DuelState, player: PlayerId, need: number): number[] {
  const me = state.players[player];
  return me.monsters
    .flatMap((m, z) => (m ? [{ z, v: (getCard(m.cardId) as MonsterCard).atk }] : []))
    .sort((a, b) => a.v - b.v || a.z - b.z)
    .slice(0, need)
    .map((x) => x.z)
    .sort((a, b) => a - b);
}

export const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
