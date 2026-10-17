import { beforeEach, describe, expect, it } from "vitest";
import { flushPersist, useApp } from "./app-store";
import { kvClear, kvGet } from "@/lib/storage";
import { addCard } from "@/domain/decks/rules";

const reset = async () => {
  await kvClear();
  useApp.setState({ hydrated: false });
};

describe("persistência local (IndexedDB)", () => {
  beforeEach(reset);

  it("salva decks, favoritos e preferências e restaura após recarregar", async () => {
    await useApp.getState().hydrate();
    const deck = useApp.getState().createDeck("Meu deck", "curto");
    useApp.getState().updateDeck(deck.id, (d) => addCard(d, "vulto-ancestral", "main"));
    useApp.getState().toggleFavorite("escriba-silencioso");
    useApp.getState().setSettings({ musicVolume: 0.2, introSeen: true });
    await flushPersist();

    // simula um novo carregamento da página: estado em memória zerado, dados só no IndexedDB
    useApp.setState({ hydrated: false, decks: [], favorites: [], activeDeckId: null });
    await useApp.getState().hydrate();
    const s = useApp.getState();
    expect(s.decks).toHaveLength(1);
    expect(s.decks[0].name).toBe("Meu deck");
    expect(s.decks[0].main).toEqual([{ cardId: "vulto-ancestral", qty: 1 }]);
    expect(s.favorites).toEqual(["escriba-silencioso"]);
    expect(s.settings.musicVolume).toBe(0.2);
    expect(s.activeDeckId).toBe(deck.id);
  });

  it("renomeia, duplica e exclui decks", async () => {
    await useApp.getState().hydrate();
    const d = useApp.getState().createDeck("A");
    useApp.getState().renameDeck(d.id, "  B  ");
    expect(useApp.getState().decks[0].name).toBe("B");
    useApp.getState().renameDeck(d.id, "   ");
    expect(useApp.getState().decks[0].name).toBe("B");
    const copy = useApp.getState().duplicateDeck(d.id)!;
    expect(useApp.getState().decks).toHaveLength(2);
    expect(copy.id).not.toBe(d.id);
    useApp.getState().deleteDeck(copy.id);
    expect(useApp.getState().decks.map((x) => x.id)).toEqual([d.id]);
    expect(useApp.getState().activeDeckId).toBe(d.id);
  });

  it("persiste a recompensa de missão resgatada", async () => {
    await useApp.getState().hydrate();
    useApp.setState({ profile: { xp: 0, matches: [], claimedMissions: [], unlockedCards: [] } });
    expect(useApp.getState().claimMission("m-templo-1").ok).toBe(false);
    const r = useApp.getState().recordMatch({ id: "p1", at: 1, areaId: "templo", result: "win", turns: 4, playerDeck: "A", opponentDeck: "B" });
    expect(r.ok).toBe(true);
    expect(useApp.getState().claimMission("m-templo-1").ok).toBe(true);
    await flushPersist();
    const stored = await kvGet<{ claimedMissions: string[]; xp: number }>("profile");
    expect(stored?.claimedMissions).toContain("m-templo-1");
    expect(stored?.xp).toBe(270);
  });

  it("ignora dados corrompidos no armazenamento e volta ao padrão", async () => {
    const { kvSet } = await import("@/lib/storage");
    await kvSet("decks", [{ id: 1 }]);
    await kvSet("profile", { xp: "muito" });
    await kvSet("settings", { musicVolume: 99 });
    await useApp.getState().hydrate();
    expect(useApp.getState().decks).toEqual([]);
    expect(useApp.getState().profile.xp).toBe(0);
    expect(useApp.getState().settings.musicVolume).toBe(0.4);
  });

  it("resetAll apaga tudo do dispositivo", async () => {
    await useApp.getState().hydrate();
    useApp.getState().createDeck("X");
    await flushPersist();
    await useApp.getState().resetAll();
    expect(useApp.getState().decks).toEqual([]);
    expect(await kvGet("decks")).toEqual([]);
  });
});
