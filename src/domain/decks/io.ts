import { z } from "zod";
import { getCard } from "../cards/data";
import { DeckEntrySchema, getFormat, newDeck, type Deck } from "./rules";

const ExportSchema = z.object({
  schema: z.literal("shadow-realm.deck"),
  version: z.literal(1),
  name: z.string().trim().min(1).max(40),
  format: z.string(),
  main: z.array(DeckEntrySchema),
  extra: z.array(DeckEntrySchema),
  side: z.array(DeckEntrySchema),
});

export function exportDeck(deck: Deck): string {
  const payload: z.infer<typeof ExportSchema> = {
    schema: "shadow-realm.deck", version: 1, name: deck.name, format: deck.formatId,
    main: deck.main, extra: deck.extra, side: deck.side,
  };
  return JSON.stringify(payload, null, 2);
}

export type ImportResult = { ok: true; deck: Deck } | { ok: false; errors: string[] };

export function parseDeckImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["O arquivo não é um JSON válido."] };
  }
  const parsed = ExportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "arquivo"}: ${i.message}`) };
  }
  const d = parsed.data;
  const errors: string[] = [];
  if (!getFormat(d.format)) errors.push(`Formato desconhecido: ${d.format}.`);
  for (const e of [...d.main, ...d.extra, ...d.side]) if (!getCard(e.cardId)) errors.push(`Carta desconhecida: ${e.cardId}.`);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  const deck = newDeck(d.name, d.format);
  return { ok: true, deck: { ...deck, main: d.main, extra: d.extra, side: d.side } };
}
