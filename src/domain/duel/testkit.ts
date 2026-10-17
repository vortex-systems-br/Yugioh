import { slug } from "../cards/data";
import { createDuel, applyAction } from "./engine";
import { starterCardIds } from "../decks/starters";
import type { CardInstance, DuelAction, DuelState, MonsterSlot, PlayerId, Position } from "./types";

export function newDuel(seed = 7, first: PlayerId = "player"): DuelState {
  return createDuel({ playerDeck: starterCardIds("starter-sombras"), opponentDeck: starterCardIds("starter-dragoes"), seed, first });
}

let n = 0;
export const inst = (name: string): CardInstance => ({ uid: `t${++n}`, cardId: slug(name) });

export function rig(state: DuelState, fn: (s: DuelState) => void): DuelState {
  const c = structuredClone(state);
  fn(c);
  return c;
}

export const withHand = (s: DuelState, p: PlayerId, names: string[]) => rig(s, (c) => { c.players[p].hand = names.map(inst); });

export function withMonster(s: DuelState, p: PlayerId, zone: number, name: string, opts: Partial<Pick<MonsterSlot, "position" | "summonedTurn" | "hasAttacked" | "atkBonus">> = {}) {
  return rig(s, (c) => {
    const i = inst(name);
    c.players[p].monsters[zone] = { ...i, position: "attack" as Position, summonedTurn: 0, hasAttacked: false, positionChanged: false, atkBonus: 0, ...opts };
  });
}

export const withTrap = (s: DuelState, p: PlayerId, zone: number, name: string, setTurn = 0) =>
  rig(s, (c) => { c.players[p].spellTraps[zone] = { ...inst(name), setTurn }; });

export function must(state: DuelState, action: DuelAction): DuelState {
  const r = applyAction(state, action);
  if (!r.ok) throw new Error(`Ação rejeitada: ${r.error.code}`);
  return r.state;
}

/** Leva o duelo ao turno N do jogador indicado, na fase principal (apenas passando turnos). */
export function toTurn(state: DuelState, turn: number): DuelState {
  let s = state;
  while (s.turn < turn) s = must(s, { type: "end_turn", player: s.active });
  return s;
}

/** Vai para a fase de batalha do turno atual. */
export const toBattle = (s: DuelState) => must(s, { type: "advance_phase", player: s.active });
