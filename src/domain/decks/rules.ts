import { z } from "zod";
import { getCard, isExtraDeckCard } from "../cards/data";
import type { Card } from "../cards/schema";

export type DeckZone = "main" | "extra" | "side";
export const ZONE_LABEL: Record<DeckZone, string> = { main: "Main Deck", extra: "Extra Deck", side: "Side Deck" };

export interface DeckFormat {
  id: string;
  name: string;
  description: string;
  main: { min: number; max: number };
  extra: { max: number };
  side: { max: number };
  maxCopies: number;
  /** cardId -> cópias permitidas (0 = proibida). Específica deste formato; formatos nunca compartilham listas. */
  banlist: Record<string, number>;
}

export const FORMATS: DeckFormat[] = [
  {
    id: "curto", name: "Duelo Curto", description: "Main de 20 a 30 cartas, até 3 cópias por carta, sem lista de restrições.",
    main: { min: 20, max: 30 }, extra: { max: 5 }, side: { max: 5 }, maxCopies: 3, banlist: {},
  },
  {
    id: "padrao", name: "Duelo Padrão", description: "Main de 40 a 60 cartas, Extra e Side de até 15, com lista de restrições própria.",
    main: { min: 40, max: 60 }, extra: { max: 15 }, side: { max: 15 }, maxCopies: 3,
    banlist: { "imperador-dragao-aurora": 0, "fenda-destruidora": 1, "conhecimento-proibido": 2 },
  },
];

export const getFormat = (id: string): DeckFormat | undefined => FORMATS.find((f) => f.id === id);
export const DEFAULT_FORMAT_ID = "curto";

export const DeckEntrySchema = z.object({ cardId: z.string(), qty: z.number().int().min(1).max(99) });
export const DeckSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  formatId: z.string(),
  main: z.array(DeckEntrySchema),
  extra: z.array(DeckEntrySchema),
  side: z.array(DeckEntrySchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type DeckEntry = z.infer<typeof DeckEntrySchema>;
export type Deck = z.infer<typeof DeckSchema>;

export interface DeckIssue {
  severity: "error" | "warning";
  code: "unknown_format" | "unknown_card" | "locked_card" | "zone_size" | "wrong_zone" | "copies" | "banned" | "limited" | "duplicate_entry";
  message: string;
  cardId?: string;
}
export interface DeckReport { valid: boolean; issues: DeckIssue[]; counts: Record<DeckZone, number> }
export interface DeckContext { isUnlocked?: (card: Card) => boolean }

export const ZONES_LIST: DeckZone[] = ["main", "extra", "side"];
export const zoneCount = (deck: Deck, zone: DeckZone): number => deck[zone].reduce((n, e) => n + e.qty, 0);
export const copiesOf = (deck: Deck, cardId: string): number =>
  ZONES_LIST.reduce((n, z) => n + (deck[z].find((e) => e.cardId === cardId)?.qty ?? 0), 0);

export function allowedCopies(format: DeckFormat, cardId: string): number {
  const lim = format.banlist[cardId];
  return lim === undefined ? format.maxCopies : Math.min(lim, format.maxCopies);
}

export function validateDeck(deck: Deck, ctx: DeckContext = {}): DeckReport {
  const counts = { main: zoneCount(deck, "main"), extra: zoneCount(deck, "extra"), side: zoneCount(deck, "side") };
  const issues: DeckIssue[] = [];
  const format = getFormat(deck.formatId);
  if (!format) {
    issues.push({ severity: "error", code: "unknown_format", message: `Formato desconhecido: ${deck.formatId}.` });
    return { valid: false, issues, counts };
  }

  if (counts.main < format.main.min) issues.push({ severity: "error", code: "zone_size", message: `Main Deck com ${counts.main} cartas: o mínimo é ${format.main.min}.` });
  if (counts.main > format.main.max) issues.push({ severity: "error", code: "zone_size", message: `Main Deck com ${counts.main} cartas: o máximo é ${format.main.max}.` });
  if (counts.extra > format.extra.max) issues.push({ severity: "error", code: "zone_size", message: `Extra Deck com ${counts.extra} cartas: o máximo é ${format.extra.max}.` });
  if (counts.side > format.side.max) issues.push({ severity: "error", code: "zone_size", message: `Side Deck com ${counts.side} cartas: o máximo é ${format.side.max}.` });

  const seen = new Set<string>();
  for (const zone of ZONES_LIST) {
    const inZone = new Set<string>();
    for (const e of deck[zone]) {
      const card = getCard(e.cardId);
      if (inZone.has(e.cardId)) issues.push({ severity: "error", code: "duplicate_entry", message: `Entrada repetida de ${card?.name ?? e.cardId} no ${ZONE_LABEL[zone]}.`, cardId: e.cardId });
      inZone.add(e.cardId);
      if (!card) { issues.push({ severity: "error", code: "unknown_card", message: `Carta desconhecida: ${e.cardId}.`, cardId: e.cardId }); continue; }
      if (ctx.isUnlocked && !ctx.isUnlocked(card)) issues.push({ severity: "error", code: "locked_card", message: `${card.name} está bloqueada: conclua a missão de recompensa para usá-la.`, cardId: e.cardId });
      const extra = isExtraDeckCard(card);
      if (zone === "extra" && !extra) issues.push({ severity: "error", code: "wrong_zone", message: `${card.name} não pode ficar no Extra Deck.`, cardId: e.cardId });
      if (zone === "main" && extra) issues.push({ severity: "error", code: "wrong_zone", message: `${card.name} só pode ficar no Extra Deck ou no Side Deck.`, cardId: e.cardId });
      if (seen.has(e.cardId)) continue;
      seen.add(e.cardId);
      const total = copiesOf(deck, e.cardId);
      const limit = allowedCopies(format, e.cardId);
      if (limit === 0) issues.push({ severity: "error", code: "banned", message: `${card.name} é proibida no formato ${format.name}.`, cardId: e.cardId });
      else if (total > limit) issues.push({ severity: "error", code: format.banlist[e.cardId] !== undefined ? "limited" : "copies", message: `${card.name}: ${total} cópias, mas o formato ${format.name} permite ${limit}.`, cardId: e.cardId });
    }
  }
  return { valid: !issues.some((i) => i.severity === "error"), issues, counts };
}

export function defaultZoneFor(card: Card): DeckZone {
  return isExtraDeckCard(card) ? "extra" : "main";
}

/** Motivo pelo qual a carta não pode ser adicionada agora, ou null. */
export function whyCannotAdd(deck: Deck, card: Card, zone: DeckZone, ctx: DeckContext = {}): string | null {
  const format = getFormat(deck.formatId);
  if (!format) return "Formato desconhecido.";
  if (ctx.isUnlocked && !ctx.isUnlocked(card)) return `${card.name} está bloqueada (recompensa de missão).`;
  const extra = isExtraDeckCard(card);
  if (zone === "extra" && !extra) return "Só cartas ascendidas entram no Extra Deck.";
  if (zone === "main" && extra) return "Cartas ascendidas ficam no Extra Deck.";
  const limit = allowedCopies(format, card.id);
  if (limit === 0) return `${card.name} é proibida neste formato.`;
  if (copiesOf(deck, card.id) >= limit) return `Limite de ${limit} cópia${limit > 1 ? "s" : ""} atingido.`;
  const cap = zone === "main" ? format.main.max : zone === "extra" ? format.extra.max : format.side.max;
  if (zoneCount(deck, zone) >= cap) return `${ZONE_LABEL[zone]} cheio (${cap}).`;
  return null;
}

export function addCard(deck: Deck, cardId: string, zone: DeckZone): Deck {
  const list = deck[zone];
  const has = list.find((e) => e.cardId === cardId);
  const next = has ? list.map((e) => (e.cardId === cardId ? { ...e, qty: e.qty + 1 } : e)) : [...list, { cardId, qty: 1 }];
  return { ...deck, [zone]: next, updatedAt: Date.now() };
}

export function removeCard(deck: Deck, cardId: string, zone: DeckZone): Deck {
  const next = deck[zone].flatMap((e) => (e.cardId !== cardId ? [e] : e.qty > 1 ? [{ ...e, qty: e.qty - 1 }] : []));
  return { ...deck, [zone]: next, updatedAt: Date.now() };
}

export function moveCard(deck: Deck, cardId: string, from: DeckZone, to: DeckZone): Deck {
  return addCard(removeCard(deck, cardId, from), cardId, to);
}

export function newDeck(name: string, formatId: string, id: string = crypto.randomUUID()): Deck {
  const now = Date.now();
  return { id, name: name.trim() || "Novo baralho", formatId, main: [], extra: [], side: [], createdAt: now, updatedAt: now };
}

export const flattenZone = (deck: Deck, zone: DeckZone): string[] => deck[zone].flatMap((e) => Array<string>(e.qty).fill(e.cardId));

/** Um baralho só entra na Arena se for válido; o duelo usa apenas o Main Deck. */
export function isPlayable(deck: Deck, ctx: DeckContext = {}): boolean {
  return validateDeck(deck, ctx).valid;
}
