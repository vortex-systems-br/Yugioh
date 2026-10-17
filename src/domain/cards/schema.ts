import { z } from "zod";

export const RARITIES = ["common", "rare", "super_rare", "ultra_rare", "secret_rare", "mythic_demo"] as const;
export const ATTRIBUTES = ["shadow", "light", "storm", "flame", "tide", "earth"] as const;
export const CATEGORIES = ["Sombras", "Biblioteca", "Dragões", "Ruínas"] as const;
export const MOTIFS = ["dragon", "eye", "tome", "blade", "rune", "beast", "orb", "tower", "wing", "shard"] as const;

export const RarityLabel: Record<(typeof RARITIES)[number], string> = {
  common: "Common",
  rare: "Rare",
  super_rare: "Super Rare",
  ultra_rare: "Ultra Rare",
  secret_rare: "Secret Rare",
  mythic_demo: "Mythic (fictícia da demo)",
};

export const AttributeLabel: Record<(typeof ATTRIBUTES)[number], string> = {
  shadow: "Sombra",
  light: "Luz",
  storm: "Tempestade",
  flame: "Chama",
  tide: "Maré",
  earth: "Terra",
};

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(48),
  rarity: z.enum(RARITIES),
  category: z.enum(CATEGORIES),
  text: z.string().min(4).max(240),
  art: z.object({ hue: z.number().min(0).max(360), motif: z.enum(MOTIFS) }),
  /** Todas as cartas deste projeto são fictícias e originais. */
  source: z.literal("demo"),
  unlock: z.object({ missionId: z.string() }).optional(),
};

export const MonsterSchema = z.object({
  ...base,
  kind: z.literal("monster"),
  monsterType: z.enum(["normal", "ascended"]),
  attribute: z.enum(ATTRIBUTES),
  level: z.number().int().min(1).max(12),
  atk: z.number().int().min(0).max(5000),
  def: z.number().int().min(0).max(5000),
});

export const SpellEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gain_lp"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("deal_damage"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("draw"), amount: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal("destroy_monster") }),
  z.object({ type: z.literal("boost_atk"), amount: z.number().int().positive() }),
]);

export const TrapEffectSchema = z.object({ type: z.enum(["negate_attack", "destroy_attacker"]) });

export const SpellSchema = z.object({ ...base, kind: z.literal("spell"), effect: SpellEffectSchema });
export const TrapSchema = z.object({ ...base, kind: z.literal("trap"), effect: TrapEffectSchema });

export const CardSchema = z.discriminatedUnion("kind", [MonsterSchema, SpellSchema, TrapSchema]);

export type Rarity = (typeof RARITIES)[number];
export type Attribute = (typeof ATTRIBUTES)[number];
export type Category = (typeof CATEGORIES)[number];
export type MonsterCard = z.infer<typeof MonsterSchema>;
export type SpellCard = z.infer<typeof SpellSchema>;
export type TrapCard = z.infer<typeof TrapSchema>;
export type SpellEffect = z.infer<typeof SpellEffectSchema>;
export type TrapEffect = z.infer<typeof TrapEffectSchema>;
export type Card = z.infer<typeof CardSchema>;
