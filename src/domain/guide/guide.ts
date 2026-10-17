import { CARDS } from "../cards/data";
import { AttributeLabel, RarityLabel, type Card } from "../cards/schema";
import { RULES_SCOPE } from "../duel/scope";
import { FORMATS } from "../decks/rules";
import { AREAS, MISSIONS } from "../progression/data";

/** Assistente local: respostas predefinidas a partir dos dados da aplicação. Não usa modelo de IA. */
export interface GuideAnswer {
  text: string;
  origin: "local";
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function describeCard(c: Card): string {
  const head = `${c.name} — ${RarityLabel[c.rarity]}, categoria ${c.category}.`;
  if (c.kind === "monster") {
    const kind = c.monsterType === "ascended" ? "monstro ascendido (Extra Deck)" : "monstro";
    return `${head} É um ${kind} de atributo ${AttributeLabel[c.attribute]}, nível ${c.level}, ATK ${c.atk} e DEF ${c.def}. ${c.text}`;
  }
  return `${head} ${c.kind === "spell" ? "Magia" : "Armadilha"}: ${c.text}`;
}

const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

/** Casa cartas pelo nome completo, por todas as palavras do nome ou por uma palavra que só existe em uma carta. */
export function findCards(query: string): Card[] {
  const q = norm(query);
  const exact = CARDS.filter((c) => q.includes(norm(c.name)));
  if (exact.length) return exact.slice(0, 3);
  const qWords = new Set(words(query));
  if (qWords.size === 0) return [];
  const freq = new Map<string, number>();
  for (const c of CARDS) for (const w of new Set(words(c.name))) freq.set(w, (freq.get(w) ?? 0) + 1);
  return CARDS.filter((c) => {
    const ws = words(c.name);
    if (ws.length > 0 && ws.every((w) => qWords.has(w))) return true;
    return ws.some((w) => qWords.has(w) && w.length >= 6 && freq.get(w) === 1);
  }).slice(0, 3);
}

export function answerLocal(query: string): GuideAnswer {
  const q = norm(query);
  const reply = (text: string): GuideAnswer => ({ text, origin: "local" });

  const cards = findCards(query);
  if (cards.length) {
    const note = /oficial|konami|yu-?gi-?oh/.test(q) ? "Atenção: estas são cartas fictícias da demonstração, não cartas oficiais.\n\n" : "";
    return reply(note + cards.map(describeCard).join("\n\n"));
  }

  if (/tribut|invoc|sacrific/.test(q))
    return reply("Cada turno permite uma invocação normal. Monstros de nível 4 ou menos entram sem tributo; nível 5 e 6 pedem 1 tributo; nível 7 ou mais pedem 2. Tributos são monstros seus em campo e vão para o cemitério.");
  if (/regra|escopo|suporta|funciona|como jogar|jogar/.test(q))
    return reply(`Regras que o duelo implementa hoje:\n• ${RULES_SCOPE.supported.join("\n• ")}\n\nAinda não implementado:\n• ${RULES_SCOPE.unsupported.join("\n• ")}`);
  if (/ataq|batalha|dano/.test(q))
    return reply("Na fase de batalha, um monstro em ataque declara um alvo. Contra outro monstro em ataque, vence o maior ATK e a diferença vira dano ao perdedor; empate destrói os dois. Contra um monstro em defesa, compara-se ATK e DEF: se o ATK for menor, quem atacou recebe a diferença. Sem monstros do outro lado, o ataque é direto.");
  if (/armadilha|trap/.test(q))
    return reply("Armadilhas são baixadas viradas para baixo e ativam sozinhas quando o oponente declara um ataque, a partir do turno seguinte ao baixar. Nesta versão não há janela para responder com correntes.");
  if (/formato|deck|baralho|copia|proibid/.test(q))
    return reply(FORMATS.map((f) => `${f.name}: Main ${f.main.min}–${f.main.max}, Extra até ${f.extra.max}, Side até ${f.side.max}, ${f.maxCopies} cópias por carta${Object.keys(f.banlist).length ? ", com lista de restrições" : ""}.`).join("\n"));
  if (/raridade|rare|secret|ultra|common/.test(q))
    return reply("Raridades: Common, Rare, Super Rare, Ultra Rare e Secret Rare, mais a Mythic, que é fictícia desta demonstração e só aparece como recompensa de missão.");
  if (/missao|missoes|area|mapa|nivel|xp|recompensa/.test(q))
    return reply(`Áreas: ${AREAS.map((a) => a.name).join(", ")}. Há ${MISSIONS.length} missões; vença duelos na área da missão e resgate a recompensa na tela Mundo. O nível sobe com experiência e destrava novas áreas.`);

  return reply("Não tenho dados suficientes para responder isso com segurança. Posso explicar as regras do duelo, tributos, ataques, armadilhas, formatos de baralho, raridades, missões, ou descrever uma carta pelo nome.");
}

export function tipFor(pathname: string): string {
  if (pathname === "/") return "Comece pelo Templo das Sombras: vença um duelo para subir de nível e destravar outras áreas.";
  if (pathname.startsWith("/library")) return "Toque numa carta para inspecionar. Use a estrela para favoritar e o botão Adicionar para levá-la ao baralho ativo.";
  if (pathname.startsWith("/deck-builder")) return "O formato define os limites. Problemas aparecem no painel de validação; só baralhos válidos entram na Arena.";
  if (pathname.startsWith("/arena")) return "Selecione uma carta da mão ou do campo para ver as ações permitidas. Zonas destacadas mostram onde você pode agir.";
  if (pathname.startsWith("/world")) return "Cada área tem requisitos próprios. Vitórias contam para as missões da área onde o duelo aconteceu.";
  if (pathname.startsWith("/profile")) return "Seu progresso fica salvo neste dispositivo. Ele não é validado por servidor.";
  if (pathname.startsWith("/settings")) return "Música e efeitos têm volumes independentes. As preferências ficam salvas.";
  return "Pergunte sobre regras, cartas, formatos ou missões.";
}
