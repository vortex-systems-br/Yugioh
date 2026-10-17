import { getCard } from "../cards/data";
import type { Card, MonsterCard, SpellCard, TrapCard } from "../cards/schema";
import {
  MIN_DECK_SIZE, STARTING_HAND, STARTING_LP, ZONES, otherPlayer,
  type ActionResult, type CardInstance, type DuelAction, type DuelError, type DuelErrorCode, type DuelEvent,
  type DuelState, type MonsterSlot, type PlayerId, type PlayerState, type Position,
} from "./types";

/* ----------------------------- utilitários ----------------------------- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const tributesRequired = (level: number): number => (level >= 7 ? 2 : level >= 5 ? 1 : 0);
export const effectiveAtk = (slot: MonsterSlot, card: MonsterCard): number => card.atk + slot.atkBonus;

const MESSAGES: Record<DuelErrorCode, string> = {
  duel_finished: "O duelo já terminou.",
  not_your_turn: "Não é o seu turno.",
  wrong_phase: "Essa ação não é permitida na fase atual.",
  card_not_in_hand: "A carta não está na mão.",
  wrong_card_kind: "Essa carta não pode ser usada desta forma.",
  extra_deck_unsupported: "Cartas do Extra Deck ainda não são suportadas no duelo.",
  zone_invalid: "Zona inválida.",
  zone_occupied: "A zona já está ocupada.",
  already_summoned: "Você já fez a invocação normal deste turno.",
  tribute_count: "Quantidade de tributos incorreta para o nível do monstro.",
  tribute_invalid: "Tributo inválido: escolha monstros seus em campo, sem repetir.",
  target_required: "Esta ação precisa de um alvo.",
  target_invalid: "Alvo inválido.",
  deck_too_small: "Não há cartas suficientes no baralho.",
  cannot_attack_first_turn: "O primeiro jogador não pode atacar no primeiro turno.",
  already_attacked: "Este monstro já atacou neste turno.",
  not_attack_position: "Só monstros em posição de ataque podem atacar.",
  direct_attack_blocked: "O oponente tem monstros: ataque um deles.",
  monster_missing: "Não há monstro nessa zona.",
  position_locked: "Este monstro não pode mudar de posição agora.",
  battle_unavailable: "A fase de batalha não está disponível neste turno.",
  unknown_action: "Ação desconhecida.",
};

const err = (code: DuelErrorCode): DuelError => ({ code, message: MESSAGES[code] });

const isZone = (z: unknown): z is number => typeof z === "number" && Number.isInteger(z) && z >= 0 && z < ZONES;

function monsterCard(inst: CardInstance): MonsterCard {
  const c = getCard(inst.cardId);
  if (!c || c.kind !== "monster") throw new Error(`Instância inválida: ${inst.cardId}`);
  return c;
}

/* ------------------------------- criação ------------------------------- */

export interface CreateDuelOptions {
  playerDeck: string[];
  opponentDeck: string[];
  seed: number;
  first?: PlayerId;
}

export function createDuel(opts: CreateDuelOptions): DuelState {
  const first = opts.first ?? "player";
  const rand = mulberry32(opts.seed);
  let uid = 0;

  const build = (ids: string[], owner: PlayerId): CardInstance[] => {
    if (ids.length < MIN_DECK_SIZE) throw new Error(`Baralho com menos de ${MIN_DECK_SIZE} cartas.`);
    return ids.map((cardId) => {
      const card = getCard(cardId);
      if (!card) throw new Error(`Carta desconhecida: ${cardId}`);
      if (card.kind === "monster" && card.monsterType === "ascended") throw new Error(`Carta do Extra Deck no baralho principal: ${cardId}`);
      return { uid: `${owner[0]}${++uid}`, cardId };
    });
  };

  const mk = (ids: string[], owner: PlayerId): PlayerState => ({
    lp: STARTING_LP,
    deck: shuffle(build(ids, owner), rand),
    hand: [],
    graveyard: [],
    monsters: Array<MonsterSlot | null>(ZONES).fill(null),
    spellTraps: Array(ZONES).fill(null),
    normalSummoned: false,
  });

  const state: DuelState = {
    version: 1, seed: opts.seed, turn: 1, active: first, first, phase: "main",
    players: { player: mk(opts.playerDeck, "player"), opponent: mk(opts.opponentDeck, "opponent") },
    status: "playing", winner: null, endReason: null, uidCounter: uid, seq: 0, log: [],
  };

  const events: DuelEvent[] = [];
  const emit = makeEmitter(state, events);
  emit({ kind: "duel_start", first });
  for (const p of ["player", "opponent"] as const) {
    for (let i = 0; i < STARTING_HAND; i++) {
      const c = state.players[p].deck.shift()!;
      state.players[p].hand.push(c);
      emit({ kind: "draw", player: p, uid: c.uid, cardId: c.cardId, initial: true });
    }
  }
  emit({ kind: "turn_start", player: first });
  emit({ kind: "phase", player: first, phase: "main" });
  state.log = events;
  return state;
}

type Body = DuelEvent extends infer E ? (E extends DuelEvent ? Omit<E, "seq" | "turn"> : never) : never;

function makeEmitter(state: DuelState, out: DuelEvent[]) {
  return (body: Body) => {
    out.push({ ...(body as object), seq: ++state.seq, turn: state.turn } as DuelEvent);
  };
}

/* ----------------------------- validação ------------------------------- */

export function validateAction(state: DuelState, action: DuelAction): DuelError | null {
  if (state.status === "finished") return err("duel_finished");
  if (action.type === "surrender") return null;
  if (action.player !== state.active) return err("not_your_turn");
  const me = state.players[action.player];
  const foe = state.players[otherPlayer(action.player)];

  switch (action.type) {
    case "summon": {
      if (state.phase !== "main") return err("wrong_phase");
      const inst = me.hand.find((c) => c.uid === action.handUid);
      if (!inst) return err("card_not_in_hand");
      const card = getCard(inst.cardId);
      if (!card || card.kind !== "monster") return err("wrong_card_kind");
      if (card.monsterType === "ascended") return err("extra_deck_unsupported");
      if (me.normalSummoned) return err("already_summoned");
      if (!isZone(action.zone)) return err("zone_invalid");
      if (action.position !== "attack" && action.position !== "defense") return err("unknown_action");
      const need = tributesRequired(card.level);
      if (!Array.isArray(action.tributeZones) || action.tributeZones.length !== need) return err("tribute_count");
      const seen = new Set<number>();
      for (const z of action.tributeZones) {
        if (!isZone(z) || seen.has(z) || !me.monsters[z]) return err("tribute_invalid");
        seen.add(z);
      }
      if (me.monsters[action.zone] && !seen.has(action.zone)) return err("zone_occupied");
      return null;
    }
    case "set_trap": {
      if (state.phase !== "main") return err("wrong_phase");
      const inst = me.hand.find((c) => c.uid === action.handUid);
      if (!inst) return err("card_not_in_hand");
      if (getCard(inst.cardId)?.kind !== "trap") return err("wrong_card_kind");
      if (!isZone(action.zone)) return err("zone_invalid");
      if (me.spellTraps[action.zone]) return err("zone_occupied");
      return null;
    }
    case "activate_spell": {
      if (state.phase !== "main") return err("wrong_phase");
      const inst = me.hand.find((c) => c.uid === action.handUid);
      if (!inst) return err("card_not_in_hand");
      const card = getCard(inst.cardId);
      if (!card || card.kind !== "spell") return err("wrong_card_kind");
      const eff = card.effect;
      if (eff.type === "destroy_monster") {
        if (action.targetZone === undefined) return err("target_required");
        if (!isZone(action.targetZone) || !foe.monsters[action.targetZone]) return err("target_invalid");
      } else if (eff.type === "boost_atk") {
        if (action.targetZone === undefined) return err("target_required");
        if (!isZone(action.targetZone) || !me.monsters[action.targetZone]) return err("target_invalid");
      } else if (eff.type === "draw") {
        if (me.deck.length < eff.amount) return err("deck_too_small");
      }
      return null;
    }
    case "change_position": {
      if (state.phase !== "main") return err("wrong_phase");
      if (!isZone(action.zone)) return err("zone_invalid");
      const m = me.monsters[action.zone];
      if (!m) return err("monster_missing");
      if (m.positionChanged || m.hasAttacked || m.summonedTurn === state.turn) return err("position_locked");
      return null;
    }
    case "attack": {
      if (state.phase !== "battle") return err("wrong_phase");
      if (state.turn === 1) return err("cannot_attack_first_turn");
      if (!isZone(action.attackerZone)) return err("zone_invalid");
      const a = me.monsters[action.attackerZone];
      if (!a) return err("monster_missing");
      if (a.position !== "attack") return err("not_attack_position");
      if (a.hasAttacked) return err("already_attacked");
      const foeHasMonsters = foe.monsters.some(Boolean);
      if (action.targetZone === null) {
        if (foeHasMonsters) return err("direct_attack_blocked");
        return null;
      }
      if (!isZone(action.targetZone) || !foe.monsters[action.targetZone]) return err("target_invalid");
      return null;
    }
    case "advance_phase": {
      if (state.phase !== "main") return err("wrong_phase");
      if (state.turn === 1) return err("battle_unavailable");
      return null;
    }
    case "end_turn":
      return null;
    default:
      return err("unknown_action");
  }
}

/* ------------------------------- execução ------------------------------ */

export function applyAction(state: DuelState, action: DuelAction): ActionResult {
  const error = validateAction(state, action);
  if (error) return { ok: false, error };
  const draft: DuelState = { ...state, players: structuredClone(state.players) };
  const events: DuelEvent[] = [];
  const emit = makeEmitter(draft, events);
  execute(draft, action, emit);
  draft.log = [...state.log, ...events];
  return { ok: true, state: draft, events };
}

type Emit = ReturnType<typeof makeEmitter>;

function finish(s: DuelState, winner: PlayerId | "draw", reason: "lp" | "deck_out" | "surrender", emit: Emit) {
  if (s.status === "finished") return;
  s.status = "finished";
  s.winner = winner;
  s.endReason = reason;
  emit({ kind: "duel_end", winner, reason });
}

function checkLp(s: DuelState, emit: Emit) {
  const p = s.players.player.lp <= 0;
  const o = s.players.opponent.lp <= 0;
  if (p && o) finish(s, "draw", "lp", emit);
  else if (p) finish(s, "opponent", "lp", emit);
  else if (o) finish(s, "player", "lp", emit);
}

function changeLp(s: DuelState, who: PlayerId, delta: number, cause: "battle" | "spell", emit: Emit) {
  const ps = s.players[who];
  ps.lp = Math.max(0, ps.lp + delta);
  emit({ kind: "lp", player: who, delta, value: ps.lp, cause });
}

function drawCard(s: DuelState, who: PlayerId, emit: Emit): boolean {
  const ps = s.players[who];
  const c = ps.deck.shift();
  if (!c) return false;
  ps.hand.push(c);
  emit({ kind: "draw", player: who, uid: c.uid, cardId: c.cardId, initial: false });
  return true;
}

function destroyMonster(s: DuelState, who: PlayerId, zone: number, cause: "battle" | "spell" | "trap" | "tribute", emit: Emit) {
  const ps = s.players[who];
  const m = ps.monsters[zone];
  if (!m) return;
  ps.monsters[zone] = null;
  ps.graveyard.push({ uid: m.uid, cardId: m.cardId });
  emit({ kind: "destroyed", player: who, zone, uid: m.uid, cardId: m.cardId, cause });
}

function execute(s: DuelState, a: DuelAction, emit: Emit) {
  switch (a.type) {
    case "surrender": {
      emit({ kind: "surrender", player: a.player });
      finish(s, otherPlayer(a.player), "surrender", emit);
      return;
    }
    case "summon": {
      const me = s.players[a.player];
      const idx = me.hand.findIndex((c) => c.uid === a.handUid);
      const [inst] = me.hand.splice(idx, 1);
      const tributes = a.tributeZones.map((z) => ({ uid: me.monsters[z]!.uid, cardId: me.monsters[z]!.cardId, zone: z }));
      for (const z of a.tributeZones) destroyMonster(s, a.player, z, "tribute", emit);
      me.monsters[a.zone] = { ...inst, position: a.position, summonedTurn: s.turn, hasAttacked: false, positionChanged: false, atkBonus: 0 };
      me.normalSummoned = true;
      emit({ kind: "summon", player: a.player, uid: inst.uid, cardId: inst.cardId, zone: a.zone, position: a.position, tributes });
      return;
    }
    case "set_trap": {
      const me = s.players[a.player];
      const idx = me.hand.findIndex((c) => c.uid === a.handUid);
      const [inst] = me.hand.splice(idx, 1);
      me.spellTraps[a.zone] = { ...inst, setTurn: s.turn };
      emit({ kind: "set_trap", player: a.player, uid: inst.uid, cardId: inst.cardId, zone: a.zone });
      return;
    }
    case "activate_spell": {
      const me = s.players[a.player];
      const foeId = otherPlayer(a.player);
      const idx = me.hand.findIndex((c) => c.uid === a.handUid);
      const [inst] = me.hand.splice(idx, 1);
      const card = getCard(inst.cardId) as SpellCard;
      const eff = card.effect;
      emit({ kind: "spell", player: a.player, uid: inst.uid, cardId: inst.cardId, effect: eff.type, targetZone: a.targetZone ?? null });
      me.graveyard.push(inst);
      switch (eff.type) {
        case "gain_lp": changeLp(s, a.player, eff.amount, "spell", emit); break;
        case "deal_damage": changeLp(s, foeId, -eff.amount, "spell", emit); break;
        case "draw": for (let i = 0; i < eff.amount; i++) drawCard(s, a.player, emit); break;
        case "destroy_monster": destroyMonster(s, foeId, a.targetZone!, "spell", emit); break;
        case "boost_atk": {
          const m = me.monsters[a.targetZone!]!;
          m.atkBonus += eff.amount;
          emit({ kind: "atk_boost", player: a.player, zone: a.targetZone!, amount: eff.amount });
          break;
        }
      }
      checkLp(s, emit);
      return;
    }
    case "change_position": {
      const m = s.players[a.player].monsters[a.zone]!;
      m.position = m.position === "attack" ? "defense" : "attack";
      m.positionChanged = true;
      emit({ kind: "position", player: a.player, zone: a.zone, position: m.position });
      return;
    }
    case "advance_phase": {
      s.phase = "battle";
      emit({ kind: "phase", player: a.player, phase: "battle" });
      return;
    }
    case "attack": {
      resolveAttack(s, a, emit);
      return;
    }
    case "end_turn": {
      endTurn(s, a.player, emit);
      return;
    }
  }
}

function resolveAttack(s: DuelState, a: Extract<DuelAction, { type: "attack" }>, emit: Emit) {
  const atkId = a.player;
  const defId = otherPlayer(atkId);
  const me = s.players[atkId];
  const foe = s.players[defId];
  const attacker = me.monsters[a.attackerZone]!;
  attacker.hasAttacked = true;
  emit({ kind: "attack", player: atkId, attackerZone: a.attackerZone, targetZone: a.targetZone, attackerCardId: attacker.cardId, targetCardId: a.targetZone === null ? null : foe.monsters[a.targetZone]!.cardId });

  // Armadilhas: a primeira elegível (ordem de zona) ativa sozinha.
  const trapZone = foe.spellTraps.findIndex((t) => t !== null && t.setTurn < s.turn);
  if (trapZone >= 0) {
    const slot = foe.spellTraps[trapZone]!;
    const trap = getCard(slot.cardId) as TrapCard;
    foe.spellTraps[trapZone] = null;
    foe.graveyard.push({ uid: slot.uid, cardId: slot.cardId });
    emit({ kind: "trap", player: defId, uid: slot.uid, cardId: slot.cardId, zone: trapZone, effect: trap.effect.type });
    if (trap.effect.type === "destroy_attacker") destroyMonster(s, atkId, a.attackerZone, "trap", emit);
    emit({ kind: "attack_negated", player: atkId, attackerZone: a.attackerZone });
    return;
  }

  const attackerCard = monsterCard(attacker);
  const atk = effectiveAtk(attacker, attackerCard);

  if (a.targetZone === null) {
    emit({ kind: "battle", player: atkId, attackerZone: a.attackerZone, targetZone: null, attackerCardId: attacker.cardId, targetCardId: null, attackerAtk: atk, targetValue: null, outcome: "direct", damage: atk, damaged: defId });
    changeLp(s, defId, -atk, "battle", emit);
    checkLp(s, emit);
    return;
  }

  const target = foe.monsters[a.targetZone]!;
  const targetCard = monsterCard(target);
  const targetValue = target.position === "attack" ? effectiveAtk(target, targetCard) : targetCard.def;
  let outcome: "target_destroyed" | "attacker_destroyed" | "both_destroyed" | "no_destruction";
  let damage = 0;
  let damaged: PlayerId | null = null;

  if (target.position === "attack") {
    if (atk > targetValue) { outcome = "target_destroyed"; damage = atk - targetValue; damaged = defId; }
    else if (atk < targetValue) { outcome = "attacker_destroyed"; damage = targetValue - atk; damaged = atkId; }
    else outcome = "both_destroyed";
  } else if (atk > targetValue) outcome = "target_destroyed";
  else if (atk < targetValue) { outcome = "no_destruction"; damage = targetValue - atk; damaged = atkId; }
  else outcome = "no_destruction";

  emit({ kind: "battle", player: atkId, attackerZone: a.attackerZone, targetZone: a.targetZone, attackerCardId: attacker.cardId, targetCardId: target.cardId, attackerAtk: atk, targetValue, outcome, damage, damaged });
  if (outcome === "target_destroyed" || outcome === "both_destroyed") destroyMonster(s, defId, a.targetZone, "battle", emit);
  if (outcome === "attacker_destroyed" || outcome === "both_destroyed") destroyMonster(s, atkId, a.attackerZone, "battle", emit);
  if (damaged && damage > 0) changeLp(s, damaged, -damage, "battle", emit);
  checkLp(s, emit);
}

function endTurn(s: DuelState, who: PlayerId, emit: Emit) {
  emit({ kind: "phase", player: who, phase: "end" });
  for (const p of ["player", "opponent"] as const) for (const m of s.players[p].monsters) if (m) m.atkBonus = 0;
  emit({ kind: "turn_end", player: who });

  const next = otherPlayer(who);
  s.active = next;
  s.turn += 1;
  s.phase = "main";
  const ps = s.players[next];
  ps.normalSummoned = false;
  for (const m of ps.monsters) if (m) { m.hasAttacked = false; m.positionChanged = false; }
  emit({ kind: "turn_start", player: next });
  emit({ kind: "phase", player: next, phase: "draw" });
  if (!drawCard(s, next, emit)) {
    finish(s, who, "deck_out", emit);
    return;
  }
  emit({ kind: "phase", player: next, phase: "main" });
}

/* ------------------------- ações legais (UI e IA) ----------------------- */

function combos(zones: number[], n: number): number[][] {
  if (n === 0) return [[]];
  if (n === 1) return zones.map((z) => [z]);
  const out: number[][] = [];
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) out.push([zones[i], zones[j]]);
  return out;
}

export function getLegalActions(state: DuelState, player: PlayerId): DuelAction[] {
  if (state.status === "finished") return [];
  const out: DuelAction[] = [];
  const push = (a: DuelAction) => { if (!validateAction(state, a)) out.push(a); };
  if (player === state.active) {
    const me = state.players[player];
    const foe = state.players[otherPlayer(player)];
    const occupied = me.monsters.flatMap((m, z) => (m ? [z] : []));
    if (state.phase === "main") {
      for (const inst of me.hand) {
        const card: Card | undefined = getCard(inst.cardId);
        if (!card) continue;
        if (card.kind === "monster") {
          if (card.monsterType === "ascended") continue;
          for (const tr of combos(occupied, tributesRequired(card.level)))
            for (let zone = 0; zone < ZONES; zone++)
              for (const position of ["attack", "defense"] as Position[])
                push({ type: "summon", player, handUid: inst.uid, zone, position, tributeZones: tr });
        } else if (card.kind === "trap") {
          for (let zone = 0; zone < ZONES; zone++) push({ type: "set_trap", player, handUid: inst.uid, zone });
        } else if (card.effect.type === "destroy_monster") {
          foe.monsters.forEach((m, z) => { if (m) push({ type: "activate_spell", player, handUid: inst.uid, targetZone: z }); });
        } else if (card.effect.type === "boost_atk") {
          occupied.forEach((z) => push({ type: "activate_spell", player, handUid: inst.uid, targetZone: z }));
        } else push({ type: "activate_spell", player, handUid: inst.uid });
      }
      occupied.forEach((zone) => push({ type: "change_position", player, zone }));
      push({ type: "advance_phase", player });
    } else {
      const foeZones = foe.monsters.flatMap((m, z) => (m ? [z] : []));
      for (const zone of occupied) {
        if (foeZones.length === 0) push({ type: "attack", player, attackerZone: zone, targetZone: null });
        else foeZones.forEach((t) => push({ type: "attack", player, attackerZone: zone, targetZone: t }));
      }
    }
    push({ type: "end_turn", player });
  }
  push({ type: "surrender", player });
  return out;
}
