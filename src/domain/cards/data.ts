import { CardSchema, type Card, type Attribute, type Category, type Rarity, type SpellEffect, type TrapEffect } from "./schema";

export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Motif = "dragon" | "eye" | "tome" | "blade" | "rune" | "beast" | "orb" | "tower" | "wing" | "shard";

const mon = (
  name: string, category: Category, attribute: Attribute, level: number, atk: number, def: number,
  rarity: Rarity, motif: Motif, hue: number, text: string,
  extra: { ascended?: boolean; unlock?: string } = {},
) => ({
  id: slug(name), name, rarity, category, text, source: "demo" as const, kind: "monster" as const,
  monsterType: extra.ascended ? ("ascended" as const) : ("normal" as const),
  attribute, level, atk, def, art: { hue, motif },
  ...(extra.unlock ? { unlock: { missionId: extra.unlock } } : {}),
});

const spell = (name: string, category: Category, rarity: Rarity, motif: Motif, hue: number, text: string, effect: SpellEffect) => ({
  id: slug(name), name, rarity, category, text, source: "demo" as const, kind: "spell" as const, effect, art: { hue, motif },
});

const trap = (name: string, category: Category, rarity: Rarity, motif: Motif, hue: number, text: string, effect: TrapEffect) => ({
  id: slug(name), name, rarity, category, text, source: "demo" as const, kind: "trap" as const, effect, art: { hue, motif },
});

const RAW = [
  // Sombras
  mon("Sentinela do Crepúsculo", "Sombras", "shadow", 3, 1200, 1000, "common", "blade", 262, "Vigia as soleiras entre o dia e a noite."),
  mon("Vulto Ancestral", "Sombras", "shadow", 4, 1600, 1100, "common", "eye", 270, "Um eco que ainda lembra como atacar."),
  mon("Lâmina Sem Reflexo", "Sombras", "shadow", 4, 1800, 900, "rare", "blade", 280, "Seu fio não aparece em nenhum espelho."),
  mon("Guardião da Soleira", "Sombras", "earth", 4, 1000, 2000, "common", "tower", 40, "Não ataca. Só não deixa ninguém passar."),
  mon("Cavaleiro de Cinza", "Sombras", "shadow", 5, 2100, 1600, "rare", "beast", 255, "Marcha sobre brasas apagadas."),
  mon("Rainha da Noite Quebrada", "Sombras", "shadow", 6, 2300, 1800, "super_rare", "wing", 285, "Reina sobre o que restou da meia-noite."),
  mon("Colosso do Eclipse", "Sombras", "shadow", 7, 2700, 2200, "ultra_rare", "orb", 250, "Cobre o céu quando se levanta."),
  mon("Senhor do Véu Negro", "Sombras", "shadow", 8, 3000, 2400, "secret_rare", "eye", 275, "Quem vê seu rosto esquece o próprio nome."),
  // Biblioteca
  mon("Escriba Silencioso", "Biblioteca", "light", 2, 700, 1500, "common", "tome", 48, "Copia cada página sem fazer um ruído."),
  mon("Arquivista Errante", "Biblioteca", "light", 3, 1100, 1400, "common", "tome", 52, "Procura o volume que ainda não foi escrito."),
  mon("Bibliotecária Cega", "Biblioteca", "tide", 4, 1500, 1700, "rare", "eye", 205, "Lê com as pontas dos dedos e nunca se engana."),
  mon("Golem de Pergaminho", "Biblioteca", "earth", 4, 1400, 1800, "common", "shard", 36, "Costurado com mapas que ninguém mais usa."),
  mon("Oráculo das Estantes", "Biblioteca", "light", 5, 1900, 2100, "super_rare", "orb", 50, "Responde antes de ouvir a pergunta."),
  mon("Guardião do Índice Proibido", "Biblioteca", "light", 6, 2200, 2300, "rare", "tower", 44, "Conhece todos os títulos que foram apagados."),
  mon("Sábio da Última Página", "Biblioteca", "light", 7, 2500, 2600, "ultra_rare", "tome", 46, "Sabe como a história termina e prefere calar."),
  // Dragões
  mon("Filhote de Brasa", "Dragões", "flame", 2, 800, 600, "common", "dragon", 18, "Ainda tropeça nas próprias asas."),
  mon("Dracoleto Cinzento", "Dragões", "storm", 3, 1300, 900, "common", "wing", 215, "Voa rente às nuvens carregadas."),
  mon("Serpe da Tempestade", "Dragões", "storm", 4, 1700, 1200, "common", "dragon", 222, "Cada escama guarda um relâmpago pequeno."),
  mon("Wyvern de Cobre", "Dragões", "storm", 4, 1900, 1000, "rare", "wing", 28, "Mergulha primeiro e pergunta depois."),
  mon("Dragão de Basalto", "Dragões", "flame", 5, 2200, 1500, "rare", "dragon", 12, "Dorme sobre vulcões e acorda faminto."),
  mon("Dragão Arcano Zéfiro", "Dragões", "storm", 6, 2400, 1700, "super_rare", "dragon", 232, "Seu sopro desenha runas no vento."),
  mon("Wyrm das Cinzas Vivas", "Dragões", "flame", 7, 2600, 2000, "ultra_rare", "dragon", 8, "Renasce em cada fogueira que abandonam."),
  mon("Imperador Dragão Aurora", "Dragões", "light", 8, 3100, 2500, "secret_rare", "dragon", 42, "A primeira luz do dia é a sombra dele."),
  // Ruínas
  mon("Fragmento Errante", "Ruínas", "earth", 2, 600, 1800, "common", "shard", 150, "Um pedaço de tudo que já foi inteiro."),
  mon("Sentinela Rachada", "Ruínas", "earth", 3, 1000, 1900, "common", "tower", 160, "Racha, mas não cai."),
  mon("Espectro de Maré Presa", "Ruínas", "tide", 4, 1500, 1500, "common", "eye", 190, "Preso entre duas marés que nunca chegam."),
  mon("Gárgula Dimensional", "Ruínas", "earth", 5, 2000, 1800, "rare", "beast", 170, "Pousa em portais que já fecharam."),
  mon("Titã de Pedra Partida", "Ruínas", "earth", 7, 2600, 2300, "rare", "shard", 155, "Reúne os próprios pedaços ao andar."),
  mon("Arconte do Intervalo", "Ruínas", "light", 9, 3400, 3000, "mythic_demo", "orb", 190, "Habita o instante entre dois golpes. Carta fictícia de recompensa.", { unlock: "m-ruinas-selo" }),
  // Extra Deck (ascendidos)
  mon("Dragão Ascendido Vórtice", "Dragões", "storm", 8, 3000, 2200, "ultra_rare", "dragon", 238, "Forma ascendida; só pode ficar no Extra Deck.", { ascended: true }),
  mon("Colosso Ascendido do Véu", "Sombras", "shadow", 8, 2900, 2600, "super_rare", "orb", 268, "Forma ascendida; só pode ficar no Extra Deck.", { ascended: true }),
  mon("Ascendida Livro-Mundo", "Biblioteca", "light", 7, 2400, 2800, "rare", "tome", 54, "Forma ascendida; só pode ficar no Extra Deck.", { ascended: true }),
  mon("Fênix Ascendida das Ruínas", "Ruínas", "flame", 6, 2300, 1900, "rare", "wing", 20, "Forma ascendida; só pode ficar no Extra Deck.", { ascended: true }),
  // Magias
  spell("Cura do Santuário", "Biblioteca", "common", "orb", 140, "Recupere 1000 pontos de vida.", { type: "gain_lp", amount: 1000 }),
  spell("Bênção da Estante", "Biblioteca", "rare", "tome", 55, "Recupere 2000 pontos de vida.", { type: "gain_lp", amount: 2000 }),
  spell("Chuva de Fagulhas", "Dragões", "common", "shard", 15, "Cause 600 de dano ao oponente.", { type: "deal_damage", amount: 600 }),
  spell("Raio de Decreto", "Dragões", "ultra_rare", "blade", 225, "Cause 1200 de dano ao oponente.", { type: "deal_damage", amount: 1200 }),
  spell("Conhecimento Proibido", "Biblioteca", "rare", "eye", 262, "Compre 2 cartas.", { type: "draw", amount: 2 }),
  spell("Folha Solta", "Biblioteca", "common", "tome", 50, "Compre 1 carta.", { type: "draw", amount: 1 }),
  spell("Fenda Destruidora", "Ruínas", "super_rare", "rune", 280, "Destrua 1 monstro do oponente.", { type: "destroy_monster" }),
  spell("Runa de Fúria", "Sombras", "common", "rune", 5, "Um monstro seu ganha 700 de ATK até o fim do turno.", { type: "boost_atk", amount: 700 }),
  // Armadilhas
  trap("Véu Espelhado", "Sombras", "common", "eye", 258, "Quando o oponente declara um ataque: negue o ataque.", { type: "negate_attack" }),
  trap("Muro de Lamentos", "Ruínas", "rare", "tower", 165, "Quando o oponente declara um ataque: negue o ataque.", { type: "negate_attack" }),
  trap("Ilusão Rachada", "Biblioteca", "common", "shard", 210, "Quando o oponente declara um ataque: negue o ataque.", { type: "negate_attack" }),
  trap("Armadilha de Cinzas", "Dragões", "rare", "rune", 10, "Quando o oponente declara um ataque: destrua o monstro atacante.", { type: "destroy_attacker" }),
  trap("Sentença do Vazio", "Sombras", "super_rare", "orb", 272, "Quando o oponente declara um ataque: destrua o monstro atacante.", { type: "destroy_attacker" }),
];

export const CARDS: readonly Card[] = (() => {
  const parsed = RAW.map((c) => CardSchema.parse(c));
  const ids = new Set<string>();
  for (const c of parsed) {
    if (ids.has(c.id)) throw new Error(`Carta duplicada no catálogo: ${c.id}`);
    ids.add(c.id);
  }
  return parsed;
})();

const BY_ID: ReadonlyMap<string, Card> = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return BY_ID.get(id);
}

export function requireCard(id: string): Card {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Carta desconhecida: ${id}`);
  return c;
}

export function isExtraDeckCard(card: Card): boolean {
  return card.kind === "monster" && card.monsterType === "ascended";
}
