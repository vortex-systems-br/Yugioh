import { slug } from "../cards/data";

export interface StarterDeck {
  id: string;
  name: string;
  description: string;
  cards: [string, number][];
}

const expand = (list: [string, number][]): string[] => list.flatMap(([n, q]) => Array<string>(q).fill(slug(n)));

export const STARTER_DECKS: StarterDeck[] = [
  {
    id: "starter-sombras",
    name: "Sentinelas de Sombra",
    description: "Monstros fortes e armadilhas que punem ataques apressados.",
    cards: [
      ["Sentinela do Crepúsculo", 3], ["Vulto Ancestral", 3], ["Lâmina Sem Reflexo", 3], ["Guardião da Soleira", 2],
      ["Cavaleiro de Cinza", 3], ["Rainha da Noite Quebrada", 2], ["Colosso do Eclipse", 2], ["Cura do Santuário", 2],
      ["Runa de Fúria", 2], ["Fenda Destruidora", 1], ["Véu Espelhado", 2], ["Armadilha de Cinzas", 2],
      ["Chuva de Fagulhas", 1], ["Folha Solta", 2],
    ],
  },
  {
    id: "starter-biblioteca",
    name: "Arquivistas",
    description: "Defesa sólida, compra de cartas e recuperação de pontos de vida.",
    cards: [
      ["Escriba Silencioso", 3], ["Arquivista Errante", 3], ["Bibliotecária Cega", 3], ["Golem de Pergaminho", 3],
      ["Oráculo das Estantes", 3], ["Guardião do Índice Proibido", 2], ["Sábio da Última Página", 2],
      ["Conhecimento Proibido", 2], ["Bênção da Estante", 2], ["Folha Solta", 2], ["Cura do Santuário", 1],
      ["Muro de Lamentos", 2], ["Ilusão Rachada", 2],
    ],
  },
  {
    id: "starter-dragoes",
    name: "Dragões Arcanos",
    description: "Ataque direto e dano de magia para fechar o duelo cedo.",
    cards: [
      ["Filhote de Brasa", 3], ["Dracoleto Cinzento", 3], ["Serpe da Tempestade", 3], ["Wyvern de Cobre", 3],
      ["Dragão de Basalto", 3], ["Dragão Arcano Zéfiro", 2], ["Wyrm das Cinzas Vivas", 2], ["Runa de Fúria", 3],
      ["Chuva de Fagulhas", 2], ["Raio de Decreto", 1], ["Fenda Destruidora", 1], ["Armadilha de Cinzas", 1],
      ["Sentença do Vazio", 1], ["Véu Espelhado", 2],
    ],
  },
  {
    id: "starter-ruinas",
    name: "Fragmentos",
    description: "Monstros resistentes e armadilhas que quebram o ritmo do oponente.",
    cards: [
      ["Fragmento Errante", 3], ["Sentinela Rachada", 3], ["Espectro de Maré Presa", 3], ["Guardião da Soleira", 2],
      ["Gárgula Dimensional", 3], ["Titã de Pedra Partida", 2], ["Golem de Pergaminho", 2], ["Colosso do Eclipse", 1],
      ["Runa de Fúria", 2], ["Raio de Decreto", 1], ["Fenda Destruidora", 1], ["Cura do Santuário", 2],
      ["Muro de Lamentos", 2], ["Sentença do Vazio", 1], ["Chuva de Fagulhas", 1], ["Ilusão Rachada", 1],
    ],
  },
];

export const starterCardIds = (id: string): string[] => {
  const d = STARTER_DECKS.find((s) => s.id === id);
  if (!d) throw new Error(`Baralho inicial desconhecido: ${id}`);
  return expand(d.cards);
};
