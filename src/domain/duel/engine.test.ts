import { describe, expect, it } from "vitest";
import { applyAction, createDuel, getLegalActions, validateAction } from "./engine";
import { starterCardIds } from "../decks/starters";
import { must, newDuel, rig, toBattle, toTurn, withHand, withMonster, withTrap } from "./testkit";
import { STARTING_HAND, STARTING_LP } from "./types";

describe("preparação", () => {
  it("distribui 5 cartas, 8000 PV e baralhos restantes corretos", () => {
    const s = newDuel();
    expect(s.players.player.hand).toHaveLength(STARTING_HAND);
    expect(s.players.opponent.hand).toHaveLength(STARTING_HAND);
    expect(s.players.player.lp).toBe(STARTING_LP);
    expect(s.players.player.deck).toHaveLength(starterCardIds("starter-sombras").length - STARTING_HAND);
    expect(s.status).toBe("playing");
    expect(s.turn).toBe(1);
  });

  it("é reproduzível com a mesma semente e diferente com outra", () => {
    const a = newDuel(11), b = newDuel(11), c = newDuel(12);
    expect(a.players.player.hand.map((x) => x.cardId)).toEqual(b.players.player.hand.map((x) => x.cardId));
    expect(a.players.player.hand.map((x) => x.cardId)).not.toEqual(c.players.player.hand.map((x) => x.cardId));
  });

  it("rejeita baralhos pequenos, cartas desconhecidas e cartas do Extra Deck", () => {
    expect(() => createDuel({ playerDeck: ["vulto-ancestral"], opponentDeck: starterCardIds("starter-sombras"), seed: 1 })).toThrow();
    const ids = starterCardIds("starter-sombras");
    expect(() => createDuel({ playerDeck: [...ids.slice(1), "nao-existe"], opponentDeck: ids, seed: 1 })).toThrow();
    expect(() => createDuel({ playerDeck: [...ids.slice(1), "dragao-ascendido-vortice"], opponentDeck: ids, seed: 1 })).toThrow();
  });

  it("o primeiro jogador não compra no turno 1; o segundo compra no início do seu turno", () => {
    const s = newDuel();
    expect(s.players.player.hand).toHaveLength(5);
    const s2 = must(s, { type: "end_turn", player: "player" });
    expect(s2.active).toBe("opponent");
    expect(s2.players.opponent.hand).toHaveLength(6);
    expect(s2.turn).toBe(2);
  });
});

describe("invocação", () => {
  it("invoca monstro de nível baixo e consome a invocação normal", () => {
    let s = withHand(newDuel(), "player", ["Vulto Ancestral", "Sentinela do Crepúsculo"]);
    const uid = s.players.player.hand[0].uid;
    s = must(s, { type: "summon", player: "player", handUid: uid, zone: 2, position: "attack", tributeZones: [] });
    expect(s.players.player.monsters[2]?.cardId).toBe("vulto-ancestral");
    expect(s.players.player.hand).toHaveLength(1);
    const again = applyAction(s, { type: "summon", player: "player", handUid: s.players.player.hand[0].uid, zone: 3, position: "attack", tributeZones: [] });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("already_summoned");
  });

  it("exige tributos conforme o nível e rejeita tributos inválidos", () => {
    let s = withHand(newDuel(), "player", ["Cavaleiro de Cinza", "Colosso do Eclipse"]);
    const [lvl5, lvl7] = s.players.player.hand.map((c) => c.uid);
    const noTribute = applyAction(s, { type: "summon", player: "player", handUid: lvl5, zone: 0, position: "attack", tributeZones: [] });
    expect(!noTribute.ok && noTribute.error.code).toBe("tribute_count");
    s = withMonster(s, "player", 1, "Vulto Ancestral");
    const emptyZoneTribute = applyAction(s, { type: "summon", player: "player", handUid: lvl5, zone: 0, position: "attack", tributeZones: [3] });
    expect(!emptyZoneTribute.ok && emptyZoneTribute.error.code).toBe("tribute_invalid");
    const one = applyAction(s, { type: "summon", player: "player", handUid: lvl5, zone: 0, position: "attack", tributeZones: [1] });
    expect(one.ok).toBe(true);
    if (one.ok) {
      expect(one.state.players.player.monsters[1]).toBeNull();
      expect(one.state.players.player.graveyard.map((c) => c.cardId)).toContain("vulto-ancestral");
    }
    const needTwo = applyAction(s, { type: "summon", player: "player", handUid: lvl7, zone: 0, position: "attack", tributeZones: [1] });
    expect(!needTwo.ok && needTwo.error.code).toBe("tribute_count");
    const dup = applyAction(withMonster(s, "player", 2, "Vulto Ancestral"), { type: "summon", player: "player", handUid: lvl7, zone: 0, position: "attack", tributeZones: [1, 1] });
    expect(!dup.ok && dup.error.code).toBe("tribute_invalid");
  });

  it("rejeita zona ocupada, zona inválida, magia/armadilha como monstro e Extra Deck", () => {
    let s = withHand(newDuel(), "player", ["Vulto Ancestral", "Cura do Santuário"]);
    s = withMonster(s, "player", 0, "Sentinela do Crepúsculo");
    const [mon, spell] = s.players.player.hand.map((c) => c.uid);
    expect(validateAction(s, { type: "summon", player: "player", handUid: mon, zone: 0, position: "attack", tributeZones: [] })?.code).toBe("zone_occupied");
    expect(validateAction(s, { type: "summon", player: "player", handUid: mon, zone: 9, position: "attack", tributeZones: [] })?.code).toBe("zone_invalid");
    expect(validateAction(s, { type: "summon", player: "player", handUid: spell, zone: 1, position: "attack", tributeZones: [] })?.code).toBe("wrong_card_kind");
    const ext = rig(s, (c) => { c.players.player.hand.push({ uid: "x1", cardId: "dragao-ascendido-vortice" }); });
    expect(validateAction(ext, { type: "summon", player: "player", handUid: "x1", zone: 1, position: "attack", tributeZones: [] })?.code).toBe("extra_deck_unsupported");
  });

  it("não permite agir fora do turno nem com carta que não está na mão", () => {
    const s = newDuel();
    const oppUid = s.players.opponent.hand[0].uid;
    expect(validateAction(s, { type: "summon", player: "opponent", handUid: oppUid, zone: 0, position: "attack", tributeZones: [] })?.code).toBe("not_your_turn");
    expect(validateAction(s, { type: "summon", player: "player", handUid: oppUid, zone: 0, position: "attack", tributeZones: [] })?.code).toBe("card_not_in_hand");
  });
});

describe("fases e ataques", () => {
  it("no turno 1 não há fase de batalha nem ataque", () => {
    let s = withMonster(newDuel(), "player", 0, "Vulto Ancestral");
    expect(validateAction(s, { type: "advance_phase", player: "player" })?.code).toBe("battle_unavailable");
    expect(validateAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null })?.code).toBe("wrong_phase");
    s = rig(s, (c) => { c.phase = "battle"; });
    expect(validateAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null })?.code).toBe("cannot_attack_first_turn");
  });

  it("ataque direto só é permitido se o oponente não tem monstros", () => {
    let s = toTurn(newDuel(), 3);
    s = withMonster(s, "player", 0, "Vulto Ancestral");
    s = withMonster(s, "opponent", 0, "Fragmento Errante");
    s = toBattle(s);
    expect(validateAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null })?.code).toBe("direct_attack_blocked");
    expect(validateAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: 4 })?.code).toBe("target_invalid");
    const empty = rig(s, (c) => { c.players.opponent.monsters[0] = null; });
    const r = applyAction(empty, { type: "attack", player: "player", attackerZone: 0, targetZone: null });
    expect(r.ok && r.state.players.opponent.lp).toBe(8000 - 1600);
  });

  const duelWith = (attName: string, defName: string, defPos: "attack" | "defense") => {
    let s = toTurn(newDuel(), 3);
    s = withMonster(s, "player", 0, attName);
    s = withMonster(s, "opponent", 0, defName, { position: defPos });
    return toBattle(s);
  };
  const hit = (s: ReturnType<typeof duelWith>) => must(s, { type: "attack", player: "player", attackerZone: 0, targetZone: 0 });

  it("ATK maior contra ATK: destrói o alvo e causa a diferença como dano", () => {
    const s = hit(duelWith("Lâmina Sem Reflexo", "Vulto Ancestral", "attack")); // 1800 x 1600
    expect(s.players.opponent.monsters[0]).toBeNull();
    expect(s.players.opponent.lp).toBe(8000 - 200);
    expect(s.players.player.lp).toBe(8000);
    expect(s.players.opponent.graveyard.map((c) => c.cardId)).toContain("vulto-ancestral");
  });

  it("ATK menor contra ATK: destrói o atacante e o dano vai ao atacante", () => {
    const s = hit(duelWith("Vulto Ancestral", "Lâmina Sem Reflexo", "attack")); // 1600 x 1800
    expect(s.players.player.monsters[0]).toBeNull();
    expect(s.players.player.lp).toBe(8000 - 200);
    expect(s.players.opponent.monsters[0]).not.toBeNull();
  });

  it("ATK igual: ambos destruídos, sem dano", () => {
    const s = hit(duelWith("Vulto Ancestral", "Vulto Ancestral", "attack"));
    expect(s.players.player.monsters[0]).toBeNull();
    expect(s.players.opponent.monsters[0]).toBeNull();
    expect(s.players.player.lp).toBe(8000);
    expect(s.players.opponent.lp).toBe(8000);
  });

  it("ATK contra DEF: maior destrói sem dano; menor causa dano ao atacante; igual nada", () => {
    const win = hit(duelWith("Lâmina Sem Reflexo", "Guardião da Soleira", "defense")); // 1800 x DEF 2000 -> perde
    expect(win.players.player.lp).toBe(8000 - 200);
    expect(win.players.opponent.monsters[0]).not.toBeNull();
    const kill = hit(duelWith("Cavaleiro de Cinza", "Guardião da Soleira", "defense")); // 2100 x 2000
    expect(kill.players.opponent.monsters[0]).toBeNull();
    expect(kill.players.opponent.lp).toBe(8000);
    const tie = hit(duelWith("Vulto Ancestral", "Sentinela do Crepúsculo", "defense")); // 1600 x DEF 1000 -> destrói
    expect(tie.players.opponent.monsters[0]).toBeNull();
    const equal = hit(duelWith("Lâmina Sem Reflexo", "Sentinela Rachada", "defense")); // 1800 x 1900
    expect(equal.players.player.lp).toBe(8000 - 100);
  });

  it("um monstro ataca uma vez por turno e só em posição de ataque", () => {
    let s = duelWith("Vulto Ancestral", "Fragmento Errante", "attack");
    s = must(s, { type: "attack", player: "player", attackerZone: 0, targetZone: 0 });
    expect(validateAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null })?.code).toBe("already_attacked");
    let d = toBattle(withMonster(toTurn(newDuel(), 3), "player", 0, "Vulto Ancestral", { position: "defense" }));
    expect(validateAction(d, { type: "attack", player: "player", attackerZone: 0, targetZone: null })?.code).toBe("not_attack_position");
    d = withMonster(d, "player", 1, "Vulto Ancestral");
    expect(getLegalActions(d, "player").filter((a) => a.type === "attack")).toHaveLength(1);
  });

  it("muda de posição uma vez por turno e não no turno da invocação", () => {
    let s = withHand(newDuel(), "player", ["Vulto Ancestral"]);
    s = must(s, { type: "summon", player: "player", handUid: s.players.player.hand[0].uid, zone: 0, position: "attack", tributeZones: [] });
    expect(validateAction(s, { type: "change_position", player: "player", zone: 0 })?.code).toBe("position_locked");
    s = toTurn(s, 3);
    s = must(s, { type: "change_position", player: "player", zone: 0 });
    expect(s.players.player.monsters[0]?.position).toBe("defense");
    expect(validateAction(s, { type: "change_position", player: "player", zone: 0 })?.code).toBe("position_locked");
  });
});

describe("magias e armadilhas", () => {
  it("magias de PV, dano e compra funcionam", () => {
    let s = withHand(newDuel(), "player", ["Cura do Santuário", "Chuva de Fagulhas", "Conhecimento Proibido"]);
    const [heal, burn, draw] = s.players.player.hand.map((c) => c.uid);
    s = must(s, { type: "activate_spell", player: "player", handUid: heal });
    expect(s.players.player.lp).toBe(9000);
    s = must(s, { type: "activate_spell", player: "player", handUid: burn });
    expect(s.players.opponent.lp).toBe(7400);
    s = must(s, { type: "activate_spell", player: "player", handUid: draw });
    expect(s.players.player.hand).toHaveLength(2);
    expect(s.players.player.graveyard).toHaveLength(3);
  });

  it("destruir monstro exige alvo válido; aumento de ATK expira no fim do turno", () => {
    let s = withHand(newDuel(), "player", ["Fenda Destruidora", "Runa de Fúria"]);
    const [kill, boost] = s.players.player.hand.map((c) => c.uid);
    expect(validateAction(s, { type: "activate_spell", player: "player", handUid: kill })?.code).toBe("target_required");
    expect(validateAction(s, { type: "activate_spell", player: "player", handUid: kill, targetZone: 0 })?.code).toBe("target_invalid");
    s = withMonster(withMonster(s, "opponent", 2, "Vulto Ancestral"), "player", 1, "Vulto Ancestral");
    s = must(s, { type: "activate_spell", player: "player", handUid: kill, targetZone: 2 });
    expect(s.players.opponent.monsters[2]).toBeNull();
    s = must(s, { type: "activate_spell", player: "player", handUid: boost, targetZone: 1 });
    expect(s.players.player.monsters[1]?.atkBonus).toBe(700);
    s = must(s, { type: "end_turn", player: "player" });
    expect(s.players.player.monsters[1]?.atkBonus).toBe(0);
  });

  it("não ativa compra sem cartas suficientes no baralho", () => {
    let s = withHand(newDuel(), "player", ["Conhecimento Proibido"]);
    s = rig(s, (c) => { c.players.player.deck = c.players.player.deck.slice(0, 1); });
    expect(validateAction(s, { type: "activate_spell", player: "player", handUid: s.players.player.hand[0].uid })?.code).toBe("deck_too_small");
  });

  it("baixa armadilha e ela só ativa a partir do turno seguinte", () => {
    let s = withHand(newDuel(), "player", ["Véu Espelhado"]);
    s = must(s, { type: "set_trap", player: "player", handUid: s.players.player.hand[0].uid, zone: 0 });
    expect(s.players.player.spellTraps[0]).not.toBeNull();
    // o oponente ataca no turno 2: armadilha baixada no turno 1 já pode ativar
    s = must(s, { type: "end_turn", player: "player" });
    s = toBattle(withMonster(s, "opponent", 0, "Serpe da Tempestade"));
    s = must(s, { type: "attack", player: "opponent", attackerZone: 0, targetZone: null });
    expect(s.players.player.lp).toBe(8000);
    expect(s.players.player.spellTraps[0]).toBeNull();
    expect(s.players.player.graveyard.map((c) => c.cardId)).toContain("veu-espelhado");
  });

  it("armadilha de destruir atacante elimina o monstro; armadilha recém-baixada não ativa", () => {
    let s = toTurn(newDuel(), 3);
    s = withTrap(withMonster(s, "player", 0, "Vulto Ancestral"), "opponent", 1, "Armadilha de Cinzas", 2);
    s = toBattle(s);
    s = must(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null });
    expect(s.players.player.monsters[0]).toBeNull();
    expect(s.players.opponent.lp).toBe(8000);
    let fresh = toTurn(newDuel(), 3);
    fresh = withTrap(withMonster(fresh, "player", 0, "Vulto Ancestral"), "opponent", 1, "Armadilha de Cinzas", 3);
    fresh = must(toBattle(fresh), { type: "attack", player: "player", attackerZone: 0, targetZone: null });
    expect(fresh.players.opponent.lp).toBe(8000 - 1600);
  });
});

describe("vitória, derrota e integridade", () => {
  it("vence por PV zerados e bloqueia novas ações", () => {
    let s = toTurn(newDuel(), 3);
    s = rig(withMonster(s, "player", 0, "Lâmina Sem Reflexo"), (c) => { c.players.opponent.lp = 1500; });
    s = must(toBattle(s), { type: "attack", player: "player", attackerZone: 0, targetZone: null });
    expect(s.status).toBe("finished");
    expect(s.winner).toBe("player");
    expect(s.endReason).toBe("lp");
    expect(s.players.opponent.lp).toBe(0);
    expect(validateAction(s, { type: "end_turn", player: "player" })?.code).toBe("duel_finished");
    expect(getLegalActions(s, "player")).toEqual([]);
  });

  it("perde ao sofrer o dano de uma batalha desfavorável", () => {
    let s = toTurn(newDuel(), 3);
    s = rig(withMonster(withMonster(s, "player", 0, "Vulto Ancestral"), "opponent", 0, "Lâmina Sem Reflexo"), (c) => { c.players.player.lp = 100; });
    s = must(toBattle(s), { type: "attack", player: "player", attackerZone: 0, targetZone: 0 });
    expect(s.winner).toBe("opponent");
  });

  it("perde ao não conseguir comprar no início do turno", () => {
    let s = rig(newDuel(), (c) => { c.players.opponent.deck = []; });
    s = must(s, { type: "end_turn", player: "player" });
    expect(s.status).toBe("finished");
    expect(s.winner).toBe("player");
    expect(s.endReason).toBe("deck_out");
  });

  it("rendição encerra o duelo, em qualquer turno", () => {
    const s = must(newDuel(), { type: "surrender", player: "opponent" });
    expect(s.winner).toBe("player");
    expect(s.endReason).toBe("surrender");
  });

  it("não altera o estado de entrada e registra eventos com sequência crescente", () => {
    const s = withHand(newDuel(), "player", ["Vulto Ancestral"]);
    const before = JSON.stringify(s);
    const bad = applyAction(s, { type: "attack", player: "player", attackerZone: 0, targetZone: null });
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    const good = applyAction(s, { type: "summon", player: "player", handUid: s.players.player.hand[0].uid, zone: 0, position: "attack", tributeZones: [] });
    expect(JSON.stringify(s)).toBe(before);
    expect(good.ok && good.events.map((e) => e.kind)).toEqual(["summon"]);
    const seqs = (good.ok ? good.state.log : []).map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("toda ação listada como legal é aceita pelo motor", () => {
    let s = withMonster(withMonster(toTurn(newDuel(), 3), "player", 0, "Vulto Ancestral"), "opponent", 1, "Fragmento Errante");
    for (const phase of ["main", "battle"] as const) {
      s = rig(s, (c) => { c.phase = phase; });
      for (const a of getLegalActions(s, "player")) expect(applyAction(s, a).ok).toBe(true);
    }
  });
});
