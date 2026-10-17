import type { SpellEffect, TrapEffect } from "../cards/schema";

export const ZONES = 5;
export const STARTING_LP = 8000;
export const STARTING_HAND = 5;
export const MIN_DECK_SIZE = 10;

export type PlayerId = "player" | "opponent";
export const otherPlayer = (p: PlayerId): PlayerId => (p === "player" ? "opponent" : "player");

export type Phase = "main" | "battle";
export type Position = "attack" | "defense";

export interface CardInstance {
  uid: string;
  cardId: string;
}

export interface MonsterSlot extends CardInstance {
  position: Position;
  summonedTurn: number;
  hasAttacked: boolean;
  positionChanged: boolean;
  /** Bônus de ATK que expira no fim do turno. */
  atkBonus: number;
}

export interface TrapSlot extends CardInstance {
  setTurn: number;
}

export interface PlayerState {
  lp: number;
  deck: CardInstance[];
  hand: CardInstance[];
  graveyard: CardInstance[];
  monsters: (MonsterSlot | null)[];
  spellTraps: (TrapSlot | null)[];
  normalSummoned: boolean;
}

export type EndReason = "lp" | "deck_out" | "surrender";

export interface DuelState {
  version: 1;
  seed: number;
  turn: number;
  active: PlayerId;
  first: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  status: "playing" | "finished";
  winner: PlayerId | "draw" | null;
  endReason: EndReason | null;
  uidCounter: number;
  seq: number;
  log: DuelEvent[];
}

export type DuelAction =
  | { type: "summon"; player: PlayerId; handUid: string; zone: number; position: Position; tributeZones: number[] }
  | { type: "set_trap"; player: PlayerId; handUid: string; zone: number }
  | { type: "activate_spell"; player: PlayerId; handUid: string; targetZone?: number }
  | { type: "change_position"; player: PlayerId; zone: number }
  | { type: "attack"; player: PlayerId; attackerZone: number; targetZone: number | null }
  | { type: "advance_phase"; player: PlayerId }
  | { type: "end_turn"; player: PlayerId }
  | { type: "surrender"; player: PlayerId };

export type BattleOutcome = "direct" | "target_destroyed" | "attacker_destroyed" | "both_destroyed" | "no_destruction";
export type DestroyCause = "battle" | "spell" | "trap" | "tribute";

type EventBody =
  | { kind: "duel_start"; first: PlayerId }
  | { kind: "turn_start"; player: PlayerId }
  | { kind: "phase"; player: PlayerId; phase: "draw" | "main" | "battle" | "end" }
  | { kind: "draw"; player: PlayerId; uid: string; cardId: string; initial: boolean }
  | { kind: "summon"; player: PlayerId; uid: string; cardId: string; zone: number; position: Position; tributes: { uid: string; cardId: string; zone: number }[] }
  | { kind: "set_trap"; player: PlayerId; uid: string; cardId: string; zone: number }
  | { kind: "spell"; player: PlayerId; uid: string; cardId: string; effect: SpellEffect["type"]; targetZone: number | null }
  | { kind: "trap"; player: PlayerId; uid: string; cardId: string; zone: number; effect: TrapEffect["type"] }
  | { kind: "position"; player: PlayerId; zone: number; position: Position }
  | { kind: "attack"; player: PlayerId; attackerZone: number; targetZone: number | null; attackerCardId: string; targetCardId: string | null }
  | { kind: "attack_negated"; player: PlayerId; attackerZone: number }
  | {
      kind: "battle";
      player: PlayerId;
      attackerZone: number;
      targetZone: number | null;
      attackerCardId: string;
      targetCardId: string | null;
      attackerAtk: number;
      targetValue: number | null;
      outcome: BattleOutcome;
      damage: number;
      damaged: PlayerId | null;
    }
  | { kind: "destroyed"; player: PlayerId; zone: number; uid: string; cardId: string; cause: DestroyCause }
  | { kind: "lp"; player: PlayerId; delta: number; value: number; cause: "battle" | "spell" }
  | { kind: "atk_boost"; player: PlayerId; zone: number; amount: number }
  | { kind: "turn_end"; player: PlayerId }
  | { kind: "surrender"; player: PlayerId }
  | { kind: "duel_end"; winner: PlayerId | "draw"; reason: EndReason };

export type DuelEvent = EventBody & { seq: number; turn: number };
export type EventKind = DuelEvent["kind"];

export type DuelErrorCode =
  | "duel_finished" | "not_your_turn" | "wrong_phase" | "card_not_in_hand" | "wrong_card_kind"
  | "extra_deck_unsupported" | "zone_invalid" | "zone_occupied" | "already_summoned" | "tribute_count"
  | "tribute_invalid" | "target_required" | "target_invalid" | "deck_too_small" | "cannot_attack_first_turn"
  | "already_attacked" | "not_attack_position" | "direct_attack_blocked" | "monster_missing" | "position_locked"
  | "battle_unavailable" | "unknown_action";

export interface DuelError {
  code: DuelErrorCode;
  message: string;
}

export type ActionResult =
  | { ok: true; state: DuelState; events: DuelEvent[] }
  | { ok: false; error: DuelError };
