import { describe, expect, it } from "vitest";
import { CARDS, getCard, slug } from "../cards/data";
import { STARTER_DECKS, starterCardIds } from "./starters";
import { addCard, copiesOf, newDeck, removeCard, validateDeck, whyCannotAdd, type Deck } from "./rules";
import { exportDeck, parseDeckImport } from "./io";
import { isCardUnlocked, emptyProfile } from "../progression/progression";

const fromIds = (ids: string[], formatId = "curto"): Deck => {
  let d = newDeck("T", formatId, "id");
  for (const id of ids) d = addCard(d, id, getCard(id)!.kind === "monster" && (getCard(id) as { monsterType: string }).monsterType === "ascended" ? "extra" : "main");
  return d;
};

describe("catálogo", () => {
  it("tem ids únicos, todos validados pelo Zod, todos fictícios e com as cinco raridades oficiais", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    expect(CARDS.every((c) => c.source === "demo")).toBe(true);
    for (const r of ["common", "rare", "super_rare", "ultra_rare", "secret_rare", "mythic_demo"]) expect(CARDS.some((c) => c.rarity === r)).toBe(true);
  });
  it("slug remove acentos", () => expect(slug("Lâmina Sem Reflexo")).toBe("lamina-sem-reflexo"));
});

describe("baralhos iniciais", () => {
  it.each(STARTER_DECKS)("$name tem cartas existentes e é válido no formato Duelo Curto", (s) => {
    const ids = starterCardIds(s.id);
    expect(ids.every((id) => getCard(id))).toBe(true);
    const deck = fromIds(ids);
    const report = validateDeck(deck, { isUnlocked: (c) => isCardUnlocked(c, emptyProfile()) });
    expect(report.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.counts.main).toBe(30);
  });
});

describe("validação por formato", () => {
  const many = (names: string[], n: number) => names.flatMap((x) => Array<string>(n).fill(slug(x)));

  it("rejeita Main pequeno e grande demais", () => {
    expect(validateDeck(fromIds(many(["Vulto Ancestral"], 3))).valid).toBe(false);
    const big = fromIds(starterCardIds("starter-sombras")).main.length;
    expect(big).toBeGreaterThan(0);
    const over = addCard(fromIds(starterCardIds("starter-sombras")), "escriba-silencioso", "main");
    expect(validateDeck(over).issues.some((i) => i.code === "zone_size")).toBe(true);
  });

  it("rejeita mais cópias do que o formato permite, somando Main, Extra e Side", () => {
    let d = fromIds(starterCardIds("starter-sombras"));
    d = removeCard(d, "chuva-de-fagulhas", "main");
    d = addCard(addCard(addCard(addCard(d, "vulto-ancestral", "side"), "vulto-ancestral", "side"), "vulto-ancestral", "side"), "vulto-ancestral", "side");
    const r = validateDeck(d);
    expect(r.issues.some((i) => i.code === "copies" && i.cardId === "vulto-ancestral")).toBe(true);
    expect(copiesOf(d, "vulto-ancestral")).toBeGreaterThan(3);
  });

  it("aplica a lista de restrições só no formato que a define", () => {
    const cards = [...many(["Imperador Dragão Aurora"], 1)];
    const filler = starterCardIds("starter-dragoes").filter((id) => id !== "wyrm-das-cinzas-vivas").slice(0, 29);
    const curto = validateDeck(fromIds([...filler, ...cards], "curto"));
    expect(curto.issues.some((i) => i.code === "banned")).toBe(false);
    const padrao = validateDeck(fromIds([...filler, ...cards], "padrao"));
    expect(padrao.issues.some((i) => i.code === "banned")).toBe(true);
    expect(whyCannotAdd(newDeck("x", "padrao"), getCard("imperador-dragao-aurora")!, "main")).toMatch(/proibida/);
    expect(whyCannotAdd(newDeck("x", "curto"), getCard("imperador-dragao-aurora")!, "main")).toBeNull();
  });

  it("respeita zona correta: ascendidos só no Extra; comuns não entram no Extra", () => {
    const asc = getCard("dragao-ascendido-vortice")!;
    expect(whyCannotAdd(newDeck("x", "curto"), asc, "main")).toMatch(/Extra/);
    expect(whyCannotAdd(newDeck("x", "curto"), asc, "extra")).toBeNull();
    expect(whyCannotAdd(newDeck("x", "curto"), getCard("vulto-ancestral")!, "extra")).toMatch(/ascendidas/);
    const wrong = { ...newDeck("x", "curto"), main: [{ cardId: asc.id, qty: 1 }] };
    expect(validateDeck(wrong).issues.some((i) => i.code === "wrong_zone")).toBe(true);
  });

  it("impede cartas bloqueadas até a recompensa ser resgatada", () => {
    const mythic = getCard("arconte-do-intervalo")!;
    const locked = { isUnlocked: (c: typeof mythic) => isCardUnlocked(c, emptyProfile()) };
    const open = { isUnlocked: (c: typeof mythic) => isCardUnlocked(c, { ...emptyProfile(), unlockedCards: [mythic.id] }) };
    expect(whyCannotAdd(newDeck("x", "curto"), mythic, "main", locked)).toMatch(/bloqueada/);
    expect(whyCannotAdd(newDeck("x", "curto"), mythic, "main", open)).toBeNull();
  });

  it("formato desconhecido invalida o baralho", () => {
    expect(validateDeck({ ...newDeck("x", "curto"), formatId: "inexistente" }).valid).toBe(false);
  });
});

describe("importação e exportação", () => {
  it("faz ida e volta sem perder cartas", () => {
    const deck = fromIds(starterCardIds("starter-biblioteca"));
    const r = parseDeckImport(exportDeck(deck));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.deck.main).toEqual(deck.main);
      expect(r.deck.name).toBe(deck.name);
      expect(r.deck.id).not.toBe(deck.id);
    }
  });
  it("rejeita JSON inválido, esquema errado, carta ou formato desconhecidos", () => {
    expect(parseDeckImport("{nao é json").ok).toBe(false);
    expect(parseDeckImport(JSON.stringify({ foo: 1 })).ok).toBe(false);
    const base = { schema: "shadow-realm.deck", version: 1, name: "X", format: "curto", main: [{ cardId: "carta-fantasma", qty: 1 }], extra: [], side: [] };
    const a = parseDeckImport(JSON.stringify(base));
    expect(!a.ok && a.errors.join(" ")).toMatch(/desconhecida/);
    const b = parseDeckImport(JSON.stringify({ ...base, format: "xyz", main: [] }));
    expect(!b.ok && b.errors.join(" ")).toMatch(/Formato/);
    expect(parseDeckImport(JSON.stringify({ ...base, main: [{ cardId: "vulto-ancestral", qty: 0 }] })).ok).toBe(false);
  });
});
