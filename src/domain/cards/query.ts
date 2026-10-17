import type { Attribute, Card, Category, Rarity } from "./schema";

export type SortKey = "name" | "atk" | "def" | "level" | "rarity";
export interface CardFilters {
  query: string;
  kinds: Card["kind"][];
  attributes: Attribute[];
  rarities: Rarity[];
  categories: Category[];
  levelMin: number | null;
  levelMax: number | null;
  favoritesOnly: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
}

export const emptyFilters = (): CardFilters => ({
  query: "", kinds: [], attributes: [], rarities: [], categories: [], levelMin: null, levelMax: null, favoritesOnly: false, sort: "name", dir: "asc",
});

export const RARITY_ORDER: Rarity[] = ["common", "rare", "super_rare", "ultra_rare", "secret_rare", "mythic_demo"];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Cartas sem o campo (magias e armadilhas em ATK/DEF/nível) ficam sempre no fim, em qualquer direção. */
const numeric = (c: Card, key: "atk" | "def" | "level"): number | null => (c.kind === "monster" ? c[key] : null);

export function filterCards(cards: readonly Card[], f: CardFilters, favorites: ReadonlySet<string>): Card[] {
  const q = norm(f.query.trim());
  const out = cards.filter((c) => {
    if (q && !norm(c.name).includes(q) && !norm(c.text).includes(q)) return false;
    if (f.kinds.length && !f.kinds.includes(c.kind)) return false;
    if (f.rarities.length && !f.rarities.includes(c.rarity)) return false;
    if (f.categories.length && !f.categories.includes(c.category)) return false;
    if (f.attributes.length && !(c.kind === "monster" && f.attributes.includes(c.attribute))) return false;
    if (f.levelMin !== null || f.levelMax !== null) {
      if (c.kind !== "monster") return false;
      if (f.levelMin !== null && c.level < f.levelMin) return false;
      if (f.levelMax !== null && c.level > f.levelMax) return false;
    }
    if (f.favoritesOnly && !favorites.has(c.id)) return false;
    return true;
  });
  const sign = f.dir === "asc" ? 1 : -1;
  return out.sort((a, b) => {
    let r = 0;
    if (f.sort === "name") r = a.name.localeCompare(b.name, "pt-BR") * sign;
    else if (f.sort === "rarity") r = (RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)) * sign;
    else {
      const x = numeric(a, f.sort), y = numeric(b, f.sort);
      if (x === null && y === null) r = 0;
      else if (x === null) return 1;
      else if (y === null) return -1;
      else r = (x - y) * sign;
    }
    return r || a.name.localeCompare(b.name, "pt-BR");
  });
}

export const hasActiveFilters = (f: CardFilters): boolean =>
  !!f.query.trim() || f.kinds.length > 0 || f.attributes.length > 0 || f.rarities.length > 0 || f.categories.length > 0 || f.levelMin !== null || f.levelMax !== null || f.favoritesOnly;
