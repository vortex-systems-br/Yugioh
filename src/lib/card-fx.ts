import type { Card } from "@/domain/cards/schema";

/**
 * Tema visual dos efeitos de jogar uma carta.
 * Cada atributo (e magia/armadilha) tem uma cor e um "motivo" de partículas.
 * Para dar um efeito único a uma carta específica, use CARD_FX_OVERRIDE.
 */
export type FxMotif = "embers" | "smoke" | "sparkles" | "bolts" | "ripples" | "shards";

export interface FxTheme {
  color: string; // cor principal do brilho
  core: string; // cor do centro (mais clara)
  motif: FxMotif;
}

const BY_ATTRIBUTE: Record<string, FxTheme> = {
  flame: { color: "#ff7a45", core: "#fff0c9", motif: "embers" },
  shadow: { color: "#a77dff", core: "#e9ddff", motif: "smoke" },
  light: { color: "#ffe08a", core: "#ffffff", motif: "sparkles" },
  storm: { color: "#6fb4ff", core: "#eaf5ff", motif: "bolts" },
  tide: { color: "#4fd6d0", core: "#e0fffd", motif: "ripples" },
  earth: { color: "#c9a56b", core: "#fff3dc", motif: "shards" },
};

const SPELL: FxTheme = { color: "#5fe0bd", core: "#eafff8", motif: "sparkles" };
const TRAP: FxTheme = { color: "#ff7fbf", core: "#ffe9f4", motif: "bolts" };

/** Exemplo: "dragao-arcano-zefiro": { color: "#7fd4ff", motif: "bolts" } */
export const CARD_FX_OVERRIDE: Record<string, Partial<FxTheme>> = {};

export function themeForCard(card: Card): FxTheme {
  const base = card.kind === "monster" ? (BY_ATTRIBUTE[card.attribute] ?? SPELL) : card.kind === "spell" ? SPELL : TRAP;
  return { ...base, ...CARD_FX_OVERRIDE[card.id] };
}

/** 0.2 a 1: monstros de nível alto ganham um efeito maior (mais partículas e coluna de luz mais alta). */
export function powerForCard(card: Card): number {
  return card.kind === "monster" ? Math.min(1, Math.max(0.2, card.level / 8)) : 0.5;
}
export const SUMMON_CINEMATIC_MS = 3200;
