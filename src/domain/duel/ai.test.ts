import { describe, expect, it } from "vitest";
import { chooseAction, runAiTurn } from "./ai";
import { applyAction, createDuel, getLegalActions } from "./engine";
import { STARTER_DECKS, starterCardIds } from "../decks/starters";
import { must, newDuel, rig, toTurn, withHand, withMonster } from "./testkit";
import type { DuelState } from "./types";

const asOpponentTurn = (s: DuelState) => must(s, { type: "end_turn", player: "player" });

describe("oponente automatizado", () => {
  it("invoca o melhor monstro possível e depois encerra o turno sem jogada inválida", () => {
    let s = withHand(newDuel(), "opponent", ["Filhote de Brasa", "Serpe da Tempestade", "Cura do Santuário"]);
    s = asOpponentTurn(s);
    const r = runAiTurn(s, "opponent");
    expect(r.state.active).toBe("player");
    const summons = r.events.filter((e) => e.kind === "summon");
    expect(summons).toHaveLength(1);
  });

  it("ataca diretamente quando pode causar dano letal", () => {
    let s = toTurn(newDuel(), 4);
    s = rig(withMonster(s, "opponent", 0, "Dragão de Basalto"), (c) => { c.players.player.lp = 2000; c.phase = "battle"; });
    const a = chooseAction(s, "opponent");
    expect(a).toMatchObject({ type: "attack", attackerZone: 0, targetZone: null });
  });

  it("escolhe alvo que consegue destruir e evita ataques perdedores", () => {
    let s = toTurn(newDuel(), 4);
    s = withMonster(s, "opponent", 0, "Serpe da Tempestade"); // 1700
    s = withMonster(s, "player", 0, "Cavaleiro de Cinza");   // 2100 -> perderia
    s = withMonster(s, "player", 1, "Escriba Silencioso");   // 700 -> ganharia
    s = rig(s, (c) => { c.phase = "battle"; });
    expect(chooseAction(s, "opponent")).toMatchObject({ type: "attack", attackerZone: 0, targetZone: 1 });
    const hopeless = rig(s, (c) => { c.players.player.monsters[1] = null; });
    expect(chooseAction(hopeless, "opponent")).toMatchObject({ type: "end_turn" });
  });

  it("usa magia de destruição no monstro mais forte do jogador", () => {
    let s = toTurn(newDuel(), 4);
    s = withHand(s, "opponent", ["Fenda Destruidora"]);
    s = withMonster(withMonster(s, "player", 0, "Escriba Silencioso"), "player", 3, "Colosso do Eclipse");
    expect(chooseAction(s, "opponent")).toMatchObject({ type: "activate_spell", targetZone: 3 });
  });

  it("tributa apenas quando o ganho compensa", () => {
    let s = toTurn(newDuel(), 4);
    s = withHand(s, "opponent", ["Dragão de Basalto"]);
    s = withMonster(s, "opponent", 0, "Filhote de Brasa");
    const a = chooseAction(s, "opponent");
    expect(a).toMatchObject({ type: "summon", tributeZones: [0], zone: 0 });
    const weak = withMonster(rig(s, (c) => { c.players.opponent.monsters[0] = null; }), "opponent", 0, "Wyrm das Cinzas Vivas"); // 2600 > 2200: não compensa
    expect(chooseAction(weak, "opponent").type).not.toBe("summon");
  });

  it("só devolve ações que o motor aceita", () => {
    let s = toTurn(newDuel(3), 2);
    for (let i = 0; i < 6 && s.status === "playing"; i++) {
      const a = chooseAction(s, s.active);
      expect(getLegalActions(s, s.active)).toContainEqual(a);
      const r = applyAction(s, a);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
  });
});

describe("partidas completas IA contra IA", () => {
  const pairs = STARTER_DECKS.flatMap((a) => STARTER_DECKS.map((b) => [a.id, b.id] as const));

  it("termina com vencedor ou empate válido, sem jogadas inválidas, para várias sementes e baralhos", () => {
    let finished = 0, total = 0;
    const reasons = new Set<string>();
    for (const [pa, pb] of pairs) {
      for (const seed of [1, 2, 3]) {
        total++;
        let s = createDuel({ playerDeck: starterCardIds(pa), opponentDeck: starterCardIds(pb), seed, first: seed % 2 ? "player" : "opponent" });
        for (let guard = 0; guard < 200 && s.status === "playing"; guard++) s = runAiTurn(s, s.active).state;
        if (s.status === "finished") {
          finished++;
          expect(s.winner).not.toBeNull();
          reasons.add(String(s.endReason));
        }
      }
    }
    expect(finished).toBe(total);
    expect(reasons.size).toBeGreaterThan(0);
  });

  it("é determinístico: mesma semente gera exatamente o mesmo histórico", () => {
    const play = () => {
      let s = createDuel({ playerDeck: starterCardIds("starter-dragoes"), opponentDeck: starterCardIds("starter-ruinas"), seed: 99 });
      for (let g = 0; g < 200 && s.status === "playing"; g++) s = runAiTurn(s, s.active).state;
      return JSON.stringify(s.log);
    };
    expect(play()).toBe(play());
  });
});
