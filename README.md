# Shadow Realm

Experiência web de duelos de cartas: abertura cinematográfica, biblioteca de cartas holográficas, Deck Builder, arena jogável com oponente automatizado, mundo com missões e progressão persistida.

> Projeto independente. Todas as cartas, personagens, áreas, ilustrações (SVG gerados por código) e sons (sintetizados com Web Audio) são originais e fictícios. **Não é um produto oficial nem tem afiliação com Yu-Gi-Oh!.** Os dados ficam isolados em `src/domain/cards/data.ts` e podem ser trocados por material licenciado.

## Executar

Requer Node 22+.

```bash
npm install
npm run dev          # desenvolvimento em http://localhost:3000
npm run build && npm start   # produção
```

Não há variáveis de ambiente obrigatórias nem serviços pagos. As fontes (Cinzel e Hanken Grotesk) vêm de pacotes npm `@fontsource`, sem requisições ao Google Fonts.

## Testes

```bash
npm test             # Vitest: motor, IA, decks, progressão, guia, persistência (IndexedDB)
npm run typecheck    # TypeScript strict
npm run lint
npm run build && npm run e2e   # Playwright (Chromium) em desktop e Pixel 7
```

O Playwright usa o Chromium já instalado (`PLAYWRIGHT_BROWSERS_PATH`); em outra máquina rode `npx playwright install chromium` e use a versão do `@playwright/test` do `package.json`.

## Arquitetura

```
src/domain/            regras puras, sem React nem DOM (testáveis isoladamente)
  cards/               schema Zod, catálogo (46 cartas), busca e filtros
  duel/                engine.ts (estado, validação, eventos), ai.ts (oponente), scope.ts (escopo das regras)
  decks/               formatos, validação, import/export, baralhos iniciais
  progression/         áreas, missões, XP, recompensas, desbloqueios
  guide/               assistente local (respostas predefinidas)
src/store/             estado global (Zustand) persistido em IndexedDB
src/lib/               armazenamento IndexedDB, áudio Web Audio, texto do histórico
src/components, src/app/   interface (Next.js App Router)
e2e/                   testes Playwright
```

Decisões principais:

- **Motor separado da interface.** `applyAction(state, action)` valida, rejeita jogadas inválidas com um código de erro e devolve novo estado mais a lista de eventos. A interface só chama o motor; animações, sons e histórico são derivados desses eventos. O baralho embaralha uma única vez por semente (reproduzível); depois o motor é determinístico.
- **IA local.** `chooseAction` escolhe sempre dentro de `getLegalActions`, então não gera jogada inválida. Sem modelo de linguagem.
- **Formatos separados.** Cada formato (`curto`, `padrao`) tem limites e lista de restrições próprios; nada é compartilhado.
- **Sem WebGL.** O efeito 3D usa CSS 3D, SVG e Framer Motion. Three.js não foi adicionado porque não agregava valor; por isso não há dependência de WebGL a falhar.

## Escopo das regras do duelo

Implementado: 8000 PV, mão de 5, compra automática, fases principal/batalha/final, uma invocação normal por turno com tributos (nível 5–6: 1; nível 7+: 2), posição de ataque/defesa, ataques diretos e contra monstros com dano de batalha, magias normais (curar, dano, comprar, destruir monstro, +ATK até o fim do turno), armadilhas que ativam sozinhas na declaração de ataque, vitória por PV, baralho vazio ou rendição.

Não implementado: Extra Deck no duelo, monstros com efeito, correntes e janela de resposta, monstros baixados virados para baixo, magias contínuas/de equipamento/de campo, limite de mão. A tela da Arena mostra essa lista em "Regras suportadas".

## Dados e segurança

- Persistência local em IndexedDB (decks, favoritos, preferências, progresso), validada com Zod ao carregar; dados inválidos caem nos padrões.
- **O progresso não é confiável para competição.** Vive no navegador, sem conta nem servidor. A regra de resultado/recompensa (`recordMatch`, `claimMission`, `canEnterArea`) está em módulo puro, pronta para ser executada no servidor numa versão multiusuário. Isso ainda não existe.
- Não há integração com modelo de linguagem. O guia Lúmen usa respostas predefinidas e diz isso na interface.

## Limitações conhecidas

- Core Web Vitals: medidos em laboratório (veja o resumo da entrega); LCP da home e da arena ficou acima de 2,5 s no Lighthouse móvel com estrangulamento simulado.
- Áudio sintetizado nunca foi ouvido em teste automatizado: só os controles e a persistência são verificados.
- Testado apenas em Chromium (emulação de Pixel 7); Safari e Firefox não foram testados.
- Mapa do Mundo e arte das cartas são simples (SVG procedural), sem ilustração final.
