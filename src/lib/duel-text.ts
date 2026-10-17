import { getCard } from "@/domain/cards/data";
import type { DuelEvent, PlayerId } from "@/domain/duel/types";

const who = (p: PlayerId) => (p === "player" ? "Você" : "O oponente");
const poss = (p: PlayerId) => (p === "player" ? "seu" : "do oponente");
const name = (id: string) => getCard(id)?.name ?? "uma carta";

/** Texto do histórico. Informação oculta do oponente (mão e armadilhas baixadas) nunca aparece. */
export function describeEvent(e: DuelEvent): string | null {
  switch (e.kind) {
    case "duel_start": return e.first === "player" ? "Você começa o duelo." : "O oponente começa o duelo.";
    case "turn_start": return `Turno ${e.turn}: vez ${e.player === "player" ? "de você" : "do oponente"}.`;
    case "phase": return e.phase === "draw" ? "Fase de compra." : e.phase === "battle" ? "Fase de batalha." : e.phase === "end" ? "Fase final." : null;
    case "draw": return e.initial ? null : e.player === "player" ? `Você comprou ${name(e.cardId)}.` : "O oponente comprou uma carta.";
    case "summon": {
      const t = e.tributes.length ? ` (tributo: ${e.tributes.map((x) => name(x.cardId)).join(", ")})` : "";
      return `${who(e.player)} invocou ${name(e.cardId)} em ${e.position === "attack" ? "ataque" : "defesa"}${t}.`;
    }
    case "set_trap": return e.player === "player" ? `Você baixou ${name(e.cardId)} virada para baixo.` : "O oponente baixou uma carta virada para baixo.";
    case "spell": return `${who(e.player)} ativou ${name(e.cardId)}.`;
    case "trap": return `${who(e.player)} ativou a armadilha ${name(e.cardId)}.`;
    case "position": return `${who(e.player)} colocou um monstro em ${e.position === "attack" ? "ataque" : "defesa"}.`;
    case "attack": return `${name(e.attackerCardId)} ${poss(e.player)} ataca ${e.targetCardId ? name(e.targetCardId) : "diretamente"}.`;
    case "attack_negated": return "O ataque foi anulado.";
    case "battle": {
      if (e.outcome === "direct") return `Ataque direto: ${e.damage} de dano.`;
      const base = { target_destroyed: "O alvo foi destruído", attacker_destroyed: "O atacante foi destruído", both_destroyed: "Ambos foram destruídos", no_destruction: "Nenhum monstro foi destruído" }[e.outcome];
      return `${base}${e.damage > 0 ? ` e ${e.damage} de dano foi causado a ${e.damaged === "player" ? "você" : "o oponente"}` : ""}.`;
    }
    case "destroyed": return `${name(e.cardId)} ${poss(e.player)} foi ${e.cause === "tribute" ? "oferecido como tributo" : "destruído"}.`;
    case "lp": return e.delta < 0 ? `${who(e.player)} perdeu ${-e.delta} PV.` : `${who(e.player)} recuperou ${e.delta} PV.`;
    case "atk_boost": return `+${e.amount} de ATK até o fim do turno.`;
    case "turn_end": return null;
    case "surrender": return `${who(e.player)} se rendeu.`;
    case "duel_end": return e.winner === "draw" ? "O duelo terminou empatado." : e.winner === "player" ? "Você venceu o duelo." : "O oponente venceu o duelo.";
  }
}
