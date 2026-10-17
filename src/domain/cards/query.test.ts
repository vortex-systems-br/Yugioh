import { describe, expect, it } from "vitest";
import { CARDS } from "./data";
import { emptyFilters, filterCards } from "./query";

const none = new Set<string>();

describe("busca e filtros combináveis", () => {
  it("busca por nome sem diferenciar acentos nem caixa", () => {
    const r = filterCards(CARDS, { ...emptyFilters(), query: "LAMINA" }, none);
    expect(r.map((c) => c.id)).toContain("lamina-sem-reflexo");
  });

  it("combina tipo, atributo, nível e raridade (E entre filtros, OU dentro de cada um)", () => {
    const f = { ...emptyFilters(), kinds: ["monster" as const], attributes: ["shadow" as const], levelMin: 4, levelMax: 6, rarities: ["rare" as const, "super_rare" as const] };
    const r = filterCards(CARDS, f, none);
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) {
      expect(c.kind).toBe("monster");
      if (c.kind === "monster") { expect(c.attribute).toBe("shadow"); expect(c.level).toBeGreaterThanOrEqual(4); expect(c.level).toBeLessThanOrEqual(6); }
      expect(["rare", "super_rare"]).toContain(c.rarity);
    }
  });

  it("filtros de atributo e nível excluem magias e armadilhas", () => {
    const r = filterCards(CARDS, { ...emptyFilters(), levelMin: 1 }, none);
    expect(r.every((c) => c.kind === "monster")).toBe(true);
  });

  it("filtra por favoritas e devolve vazio quando nada casa", () => {
    expect(filterCards(CARDS, { ...emptyFilters(), favoritesOnly: true }, none)).toEqual([]);
    expect(filterCards(CARDS, { ...emptyFilters(), favoritesOnly: true }, new Set(["vulto-ancestral"])).map((c) => c.id)).toEqual(["vulto-ancestral"]);
    expect(filterCards(CARDS, { ...emptyFilters(), query: "zzzzzz" }, none)).toEqual([]);
  });

  it("ordena por ataque nas duas direções e mantém cartas sem ATK no fim", () => {
    const asc = filterCards(CARDS, { ...emptyFilters(), sort: "atk", dir: "asc" }, none);
    const desc = filterCards(CARDS, { ...emptyFilters(), sort: "atk", dir: "desc" }, none);
    const monsters = (l: typeof asc) => l.filter((c) => c.kind === "monster");
    const atks = (l: typeof asc) => monsters(l).map((c) => (c.kind === "monster" ? c.atk : 0));
    expect(atks(asc)).toEqual([...atks(asc)].sort((a, b) => a - b));
    expect(atks(desc)).toEqual([...atks(desc)].sort((a, b) => b - a));
    for (const l of [asc, desc]) {
      const firstNonMonster = l.findIndex((c) => c.kind !== "monster");
      expect(l.slice(firstNonMonster).every((c) => c.kind !== "monster")).toBe(true);
    }
  });
});
