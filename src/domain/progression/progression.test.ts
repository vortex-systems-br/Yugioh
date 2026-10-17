import { describe, expect, it } from "vitest";
import { achievementsFor, areaStatus, canEnterArea, claimMission, emptyProfile, isCardUnlocked, levelForXp, matchFromDuel, missionProgress, recordMatch, type MatchRecord } from "./progression";
import { AREAS, MISSIONS, getMission } from "./data";
import { getCard } from "../cards/data";
import { must, newDuel } from "../duel/testkit";

const win = (id: string, areaId: string | null): MatchRecord => ({ id, at: 1, areaId, result: "win", turns: 5, playerDeck: "A", opponentDeck: "B" });

describe("níveis e áreas", () => {
  it("calcula nível por experiência", () => {
    expect([0, 99, 100, 399, 400, 900].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 4]);
  });

  it("apenas o Templo está liberado no início e as demais exigem requisitos reais", () => {
    const p = emptyProfile();
    expect(AREAS.map((a) => areaStatus(a, p).unlocked)).toEqual([true, false, false, false]);
    expect(canEnterArea("biblioteca", p).ok).toBe(false);
    expect(canEnterArea("nao-existe", p).ok).toBe(false);
  });

  it("não aceita partida registrada em área bloqueada (URL manipulada)", () => {
    const r = recordMatch(emptyProfile(), win("x", "ruinas"));
    expect(r.ok).toBe(false);
  });

  it("rejeita partida duplicada", () => {
    const a = recordMatch(emptyProfile(), win("m1", "templo"));
    expect(a.ok).toBe(true);
    if (a.ok) expect(recordMatch(a.value, win("m1", "templo")).ok).toBe(false);
  });
});

describe("missões e recompensas", () => {
  it("não resgata sem concluir, resgata uma vez e persiste a recompensa", () => {
    let p = emptyProfile();
    expect(claimMission(p, "m-templo-1").ok).toBe(false);
    const rec = recordMatch(p, win("m1", "templo"));
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    p = rec.value;
    expect(missionProgress(getMission("m-templo-1")!, p).done).toBe(true);
    const claimed = claimMission(p, "m-templo-1");
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value.xp).toBe(p.xp + 150);
    expect(claimMission(claimed.value, "m-templo-1").ok).toBe(false);
    expect(claimMission(p, "m-inexistente").ok).toBe(false);
  });

  it("vitórias em outra área não contam para a missão", () => {
    const base = { ...emptyProfile(), xp: 5000 };
    const r = recordMatch(base, win("m1", "arena"));
    expect(r.ok && missionProgress(getMission("m-templo-1")!, r.value).current).toBe(0);
  });

  it("a carta Mythic só é liberada pela missão das Ruínas", () => {
    const mythic = getCard("arconte-do-intervalo")!;
    let p = { ...emptyProfile(), xp: 900, claimedMissions: ["m-biblioteca-1"] };
    expect(areaStatus(AREAS[3], p).unlocked).toBe(true);
    expect(isCardUnlocked(mythic, p)).toBe(false);
    const r = recordMatch(p, win("r1", "ruinas"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = claimMission(r.value, "m-ruinas-selo");
    expect(c.ok).toBe(true);
    if (c.ok) { p = c.value; expect(isCardUnlocked(mythic, p)).toBe(true); }
    expect(achievementsFor(p).find((a) => a.id === "a-mythic")?.earned).toBe(true);
  });

  it("toda missão aponta para uma área existente e toda carta de recompensa existe e está bloqueada", () => {
    for (const m of MISSIONS) {
      expect(AREAS.some((a) => a.id === m.areaId)).toBe(true);
      if (m.reward.cardId) expect(getCard(m.reward.cardId)?.unlock?.missionId).toBe(m.id);
    }
  });
});

describe("registro a partir do motor", () => {
  it("só gera registro de duelos terminados e deriva o resultado do motor", () => {
    const s = newDuel();
    expect(matchFromDuel(s, { id: "a", areaId: null, playerDeck: "A", opponentDeck: "B" }).ok).toBe(false);
    const lost = must(s, { type: "surrender", player: "player" });
    const r = matchFromDuel(lost, { id: "a", areaId: null, playerDeck: "A", opponentDeck: "B" });
    expect(r.ok && r.value.result).toBe("surrender");
    const won = must(s, { type: "surrender", player: "opponent" });
    const w = matchFromDuel(won, { id: "b", areaId: "templo", playerDeck: "A", opponentDeck: "B" });
    expect(w.ok && w.value.result).toBe("win");
  });
});
