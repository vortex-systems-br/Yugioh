export interface Area {
  id: string;
  name: string;
  tagline: string;
  description: string;
  hue: number;
  requires: { level?: number; claimedMissions?: string[] };
  opponent: { name: string; deckId: string };
}

export const AREAS: Area[] = [
  {
    id: "templo", name: "Templo das Sombras", hue: 265,
    tagline: "Onde todo duelista começa.",
    description: "Corredores de pedra, velas que não queimam e sentinelas que testam quem ousa entrar.",
    requires: {}, opponent: { name: "Vigia do Templo", deckId: "starter-sombras" },
  },
  {
    id: "biblioteca", name: "Biblioteca Proibida", hue: 48,
    tagline: "Cada estante guarda uma estratégia.",
    description: "Arquivistas defendem volumes que nunca deveriam ser abertos e jogam devagar, com paciência.",
    requires: { level: 2 }, opponent: { name: "Arquivista-Chefe", deckId: "starter-biblioteca" },
  },
  {
    id: "arena", name: "Arena dos Dragões", hue: 12,
    tagline: "Ataque rápido, sem pedir licença.",
    description: "Um anel de basalto sob céu em tempestade. Os dragões aqui preferem terminar o duelo cedo.",
    requires: { level: 3 }, opponent: { name: "Domadora de Cinzas", deckId: "starter-dragoes" },
  },
  {
    id: "ruinas", name: "Ruínas Dimensionais", hue: 190,
    tagline: "O que sobrou entre dois mundos.",
    description: "Fragmentos flutuam onde o portal rachou. Quem vence aqui leva consigo algo que não existe lá fora.",
    requires: { level: 4, claimedMissions: ["m-biblioteca-1"] }, opponent: { name: "Eco do Intervalo", deckId: "starter-ruinas" },
  },
];

export interface Mission {
  id: string;
  areaId: string;
  title: string;
  description: string;
  objective: { type: "win_matches"; count: number };
  reward: { xp: number; cardId?: string };
}

export const MISSIONS: Mission[] = [
  { id: "m-templo-1", areaId: "templo", title: "Primeira vigília", description: "Vença 1 duelo no Templo das Sombras.", objective: { type: "win_matches", count: 1 }, reward: { xp: 150 } },
  { id: "m-templo-2", areaId: "templo", title: "Soleira conquistada", description: "Vença 3 duelos no Templo das Sombras.", objective: { type: "win_matches", count: 3 }, reward: { xp: 250 } },
  { id: "m-biblioteca-1", areaId: "biblioteca", title: "Página em branco", description: "Vença 1 duelo na Biblioteca Proibida.", objective: { type: "win_matches", count: 1 }, reward: { xp: 200 } },
  { id: "m-arena-1", areaId: "arena", title: "Voo de cinza", description: "Vença 2 duelos na Arena dos Dragões.", objective: { type: "win_matches", count: 2 }, reward: { xp: 300 } },
  { id: "m-ruinas-selo", areaId: "ruinas", title: "Selo do Intervalo", description: "Vença 1 duelo nas Ruínas Dimensionais e receba uma carta fictícia exclusiva.", objective: { type: "win_matches", count: 1 }, reward: { xp: 400, cardId: "arconte-do-intervalo" } },
];

export const getArea = (id: string) => AREAS.find((a) => a.id === id);
export const getMission = (id: string) => MISSIONS.find((m) => m.id === id);
