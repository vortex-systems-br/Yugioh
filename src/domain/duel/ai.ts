import { getCard } from "../cards/data";
import type { MonsterCard } from "../cards/schema";
import { applyAction, effectiveAtk, getLegalActions } from "./engine";
import { otherPlayer, type DuelAction, type DuelEvent, type DuelState, type MonsterSlot, type PlayerId } from "./types";

/**
 * Oponente por regras: local, determinístico e sem modelo de linguagem.
 * Toda decisão sai da lista de ações legais do motor, então nunca produz jogada inválida.
 */

const mc = (m: MonsterSlot): MonsterCard => getCard(m.cardId) as MonsterCard;
const valueOf = (m: MonsterSlot): number => (m.position === "attack" ? effectiveAtk(m, mc(m)) : mc(m).def);

type Summon = Extract<DuelAction, { type: "summon" }>;
type Spell = Extract<DuelAction, { type: "activate_spell" }>;
type Attack = Extract<DuelAction, { type: "attack" }>;

function spellScore(state: DuelState, me: PlayerId, a: Spell): number {
  const mine = state.players[me];
  const foe = state.players[otherPlayer(me)];
  const inst = mine.hand.find((c) => c.uid === a.handUid)!;
  const card = getCard(inst.cardId);
  if (!card || card.kind !== "spell") return -1;
  const e = card.effect;
  switch (e.type) {
    case "gain_lp": return mine.lp <= 4000 ? 50 + e.amount / 100 : mine.lp <= 6000 ? e.amount / 200 : -1;
    case "deal_damage": return foe.lp <= e.amount ? 10000 : 30 + e.amount / 100;
    case "draw": return mine.deck.length > 6 ? 60 : -1;
    case "destroy_monster": {
      const t = foe.monsters[a.targetZone!];
      return t ? 80 + valueOf(t) / 100 : -1;
    }
    case "boost_atk": {
      if (state.turn === 1) return -1;
      const m = mine.monsters[a.targetZone!];
      if (!m || m.position !== "attack" || m.hasAttacked) return -1;
      const atk = effectiveAtk(m, mc(m));
      const foeMons = foe.monsters.filter((x): x is MonsterSlot => x !== null);
      if (foeMons.length === 0) return 15;
      return foeMons.some((t) => valueOf(t) >= atk && valueOf(t) < atk + e.amount) ? 40 + valueOf(m) / 1000 : -1;
    }
  }
}

function pickSummon(state: DuelState, me: PlayerId, legal: Summon[]): Summon | null {
  if (legal.length === 0) return null;
  const mine = state.players[me];
  const foe = state.players[otherPlayer(me)];
  const oppMax = Math.max(0, ...foe.monsters.filter((x): x is MonsterSlot => x !== null && x.position === "attack").map((x) => valueOf(x)));
  const foeEmpty = !foe.monsters.some(Boolean);
  let best: { a: Summon; score: number } | null = null;
  for (const a of legal) {
    const card = getCard(mine.hand.find((c) => c.uid === a.handUid)!.cardId) as MonsterCard;
    const lost = a.tributeZones.reduce((n, z) => n + (mine.monsters[z] ? valueOf(mine.monsters[z]!) : 0), 0);
    const wantsDefense = !foeEmpty && card.atk < oppMax && card.def > card.atk;
    const position = wantsDefense ? "defense" : "attack";
    if (a.position !== position) continue;
    const gain = (position === "attack" ? card.atk : card.def) - lost;
    if (a.tributeZones.length > 0 && gain < 500) continue;
    // desempate estável: menor zona, depois menor uid
    const score = gain * 1000 - a.zone;
    if (!best || score > best.score) best = { a, score };
  }
  return best?.a ?? null;
}

function attackScore(state: DuelState, me: PlayerId, a: Attack): number {
  const mine = state.players[me];
  const foe = state.players[otherPlayer(me)];
  const att = mine.monsters[a.attackerZone]!;
  const atk = effectiveAtk(att, mc(att));
  if (a.targetZone === null) return atk >= foe.lp ? 10000 : 500 + atk / 10;
  const t = foe.monsters[a.targetZone]!;
  const tv = valueOf(t);
  if (t.position === "attack") {
    if (atk > tv) return (atk - tv >= foe.lp ? 10000 : 300) + tv / 10 + (atk - tv) / 20;
    return -1; // empate ou derrota: o oponente evita trocas
  }
  return atk > tv ? 200 + tv / 10 : -1;
}

export function chooseAction(state: DuelState, me: PlayerId): DuelAction {
  const legal = getLegalActions(state, me);
  const endTurn = legal.find((a) => a.type === "end_turn");
  if (!endTurn) throw new Error("Sem ação legal para o oponente.");
  if (state.status !== "playing" || state.active !== me) return endTurn;

  if (state.phase === "main") {
    const mine = state.players[me];
    const foe = state.players[otherPlayer(me)];

    const spells = legal.filter((a): a is Spell => a.type === "activate_spell");
    let bestSpell: { a: Spell; s: number } | null = null;
    for (const a of spells) {
      const s = spellScore(state, me, a);
      if (s > 0 && (!bestSpell || s > bestSpell.s)) bestSpell = { a, s };
    }
    if (bestSpell) return bestSpell.a;

    const summon = pickSummon(state, me, legal.filter((a): a is Summon => a.type === "summon"));
    if (summon) return summon;

    const sets = legal.filter((a) => a.type === "set_trap");
    if (sets.length > 0) {
      const rank = (a: DuelAction) => {
        if (a.type !== "set_trap") return 0;
        const c = getCard(mine.hand.find((h) => h.uid === a.handUid)!.cardId);
        return c?.kind === "trap" && c.effect.type === "destroy_attacker" ? 1 : 0;
      };
      return sets.slice().sort((x, y) => rank(y) - rank(x))[0];
    }

    // Proteção: monstros em ataque que perderiam para o melhor atacante inimigo viram defesa.
    const foeMax = Math.max(0, ...foe.monsters.filter((x): x is MonsterSlot => x !== null && x.position === "attack").map((x) => valueOf(x)));
    for (const a of legal) {
      if (a.type !== "change_position") continue;
      const m = mine.monsters[a.zone]!;
      if (m.position === "attack" && effectiveAtk(m, mc(m)) < foeMax && mc(m).def > mc(m).atk) return a;
    }

    const advance = legal.find((a) => a.type === "advance_phase");
    return advance ?? endTurn;
  }

  // fase de batalha
  let best: { a: Attack; s: number } | null = null;
  for (const a of legal) {
    if (a.type !== "attack") continue;
    const s = attackScore(state, me, a);
    if (s > 0 && (!best || s > best.s)) best = { a, s };
  }
  return best ? best.a : endTurn;
}

/** Joga o turno inteiro do oponente (uso em testes e simulações). */
export function runAiTurn(state: DuelState, me: PlayerId, maxSteps = 60): { state: DuelState; events: DuelEvent[] } {
  let s = state;
  const events: DuelEvent[] = [];
  for (let i = 0; i < maxSteps && s.status === "playing" && s.active === me; i++) {
    const r = applyAction(s, chooseAction(s, me));
    if (!r.ok) throw new Error(`IA tentou jogada inválida: ${r.error.code}`);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
