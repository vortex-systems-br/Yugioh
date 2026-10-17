import { expect, test } from "@playwright/test";
import { readKv, seedKv } from "./helpers";

test.use({ contextOptions: { reducedMotion: "reduce" } });

const noHorizontalScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const expectNoOverflow = async (page: import("@playwright/test").Page, where: string) =>
  expect(await noHorizontalScroll(page), `rolagem horizontal involuntária em ${where}`).toBe(true);

test("abertura é ignorável e a navegação leva a todas as telas", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Abertura de Shadow Realm" })).toBeVisible();
  await page.getByRole("button", { name: "Pular abertura" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Atravesse o portal/ })).toBeVisible();

  const nav = isMobile ? page.getByRole("navigation", { name: "Navegação inferior" }) : page.getByRole("navigation", { name: "Principal" });
  for (const [label, heading] of [["Arena", "Arena de duelos"], ["Biblioteca", "Biblioteca"], ["Deck Builder", "Deck Builder"], ["Mundo", "Mundo e missões"]] as const) {
    await nav.getByRole("link", { name: isMobile && label === "Deck Builder" ? "Decks" : label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  }
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await page.getByRole("link", { name: "Shadow Realm, página inicial" }).click();
  await page.getByRole("link", { name: "EXPLORAR CARTAS" }).click();
  await expect(page).toHaveURL(/\/library/);
});

test("abertura não reaparece depois de ignorada", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar direto" }).click();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /Atravesse o portal/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Abertura de Shadow Realm" })).toBeHidden();
});

test("biblioteca: busca, filtros combinados, estado vazio e favoritos persistentes", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("status").filter({ hasText: /Mostrando 24 de 46/ })).toBeVisible();

  await page.getByLabel("Buscar carta por nome ou texto").fill("lamina");
  await expect(page.getByText("Mostrando 1 de 1 carta.")).toBeVisible();
  await page.getByLabel("Buscar carta por nome ou texto").fill("");

  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByRole("button", { name: "Monstro", exact: true }).click();
  await page.getByRole("button", { name: "Sombra", exact: true }).click();
  await page.getByLabel("Nível mínimo").selectOption("7");
  await expect(page.getByText(/Mostrando 3 de 3 cartas\./)).toBeVisible();
  await page.getByRole("button", { name: "Secret Rare", exact: true }).click();
  await expect(page.getByText("Mostrando 1 de 1 carta.")).toBeVisible();

  await page.getByLabel("Buscar carta por nome ou texto").fill("zzzzzz");
  await expect(page.getByText("Nada por aqui com esses filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: /Mostrando 24 de 46/ })).toBeVisible();

  const fav = page.getByRole("button", { name: "Favoritar Arquivista Errante" });
  await fav.scrollIntoViewIfNeeded();
  await fav.click();
  await expect(page.getByRole("button", { name: "Remover Arquivista Errante dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole("button", { name: "Remover Arquivista Errante dos favoritos" })).toHaveAttribute("aria-pressed", "true");
});

test("biblioteca: inspeção abre em tela ampliada, vira a carta e fecha com Esc", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: /Arquivista Errante.*Inspecionar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Inspeção de Arquivista Errante" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Virar carta" }).click();
  await expect(dialog.getByRole("button", { name: "Ver frente" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("deck builder: criar, validar, editar, duplicar, renomear, excluir e persistir", async ({ page }) => {
  await page.goto("/deck-builder");
  await expect(page.getByText("Você ainda não tem baralhos.")).toBeVisible();
  await page.getByRole("button", { name: "Criar meu primeiro baralho" }).click();
  const dlg = page.getByRole("dialog", { name: "Novo baralho" });
  await dlg.getByLabel("Nome").fill("Teste Sombras");
  await dlg.getByLabel("Começar de").selectOption({ label: "Sentinelas de Sombra (30 cartas)" });
  await dlg.getByRole("button", { name: "Criar baralho" }).click();
  await expect(page.getByRole("heading", { name: "Baralho válido" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Main Deck/ })).toContainText("30/30");
  await expectNoOverflow(page, "deck builder com baralho");

  // limite do Main Deck impede a 31ª carta
  await page.getByRole("button", { name: "Adicionar Escriba Silencioso" }).click();
  await expect(page.getByText("Main Deck cheio (30).")).toBeVisible();

  // formato com regras próprias: o mesmo baralho vira inválido no Duelo Padrão
  await page.getByLabel("Formato").selectOption("padrao");
  await expect(page.getByRole("heading", { name: "Baralho com problemas" })).toBeVisible();
  await expect(page.getByText(/Main Deck com 30 cartas: o mínimo é 40/)).toBeVisible();
  await page.getByLabel("Formato").selectOption("curto");
  await expect(page.getByRole("heading", { name: "Baralho válido" })).toBeVisible();

  // quantidade
  await page.getByRole("button", { name: "Remover uma cópia" }).first().click();
  await expect(page.getByRole("tab", { name: /Main Deck/ })).toContainText("29/30");
  await expect(page.getByRole("heading", { name: "Baralho válido" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Duelar com este baralho" })).toBeVisible();

  // renomear e duplicar
  await page.getByRole("button", { name: "Renomear" }).click();
  await page.getByRole("dialog", { name: "Renomear baralho" }).getByLabel("Novo nome").fill("Sombras v2");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByLabel("Baralho", { exact: true })).toContainText("Sombras v2 (cópia)");

  // persistência após atualizar a página
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByLabel("Baralho", { exact: true })).toContainText("Sombras v2");
  await expect(page.getByLabel("Baralho", { exact: true }).locator("option")).toHaveCount(2);

  // exclusão com confirmação
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir baralho?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByLabel("Baralho", { exact: true }).locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "Excluir baralho" }).click();
  await expect(page.getByLabel("Baralho", { exact: true }).locator("option")).toHaveCount(1);
});

test("deck builder: importação rejeita dados inválidos e aceita um baralho exportado", async ({ page }) => {
  await page.goto("/deck-builder");
  await page.getByRole("button", { name: "Importar" }).click();
  const dlg = page.getByRole("dialog", { name: "Importar baralho" });
  await dlg.getByLabel("JSON do baralho").fill("{ isso não é json");
  await dlg.getByRole("button", { name: "Importar" }).click();
  await expect(dlg.getByRole("alert")).toContainText("JSON válido");
  const payload = { schema: "shadow-realm.deck", version: 1, name: "Importado", format: "curto", main: [{ cardId: "vulto-ancestral", qty: 3 }], extra: [], side: [] };
  await dlg.getByLabel("JSON do baralho").fill(JSON.stringify(payload));
  await dlg.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByLabel("Baralho", { exact: true })).toContainText("Importado");
  await expect(page.getByRole("heading", { name: "Baralho com problemas" })).toBeVisible();
});

test("arena: jogadas legais, jogadas bloqueadas, turno do oponente, rendição e registro persistido", async ({ page }) => {
  await page.goto("/arena?seed=4");
  await page.getByRole("button", { name: "Iniciar duelo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Duelo livre" })).toBeVisible();
  await expect(page.getByText("Semente 4.")).toBeVisible();
  await expect(page.getByText("Turno 1", { exact: false }).first()).toBeVisible();

  // invocação válida
  await page.getByRole("button", { name: /Sentinela do Crepúsculo.*Selecionar/ }).click();
  await page.getByRole("button", { name: "Invocar em ataque" }).click();
  await page.getByRole("button", { name: /Zona de monstro 3 sua: vazia, destino válido/ }).click();
  await expect(page.getByRole("button", { name: /^Sentinela do Crepúsculo, ataque, ATK 1200/ })).toBeVisible();
  await expectNoOverflow(page, "arena");

  // segunda invocação normal é bloqueada pelo motor e a interface explica
  await page.getByRole("button", { name: /Vulto Ancestral.*Selecionar/ }).click();
  await expect(page.getByRole("button", { name: "Invocar em ataque" })).toBeDisabled();
  await expect(page.getByText("Você já fez a invocação normal deste turno.")).toBeVisible();

  // monstro de nível 7 exige tributos
  await page.getByRole("button", { name: /Colosso do Eclipse.*Selecionar/ }).click();
  await expect(page.getByRole("button", { name: "Invocar em ataque" })).toBeDisabled();

  // ataque no turno 1 não existe
  await expect(page.getByRole("button", { name: "Ir para a batalha" })).toBeDisabled();

  // armadilha e magia
  await page.getByRole("button", { name: /Véu Espelhado.*Selecionar/ }).click();
  await page.getByRole("button", { name: "Baixar armadilha" }).click();
  await page.getByRole("button", { name: /Zona de armadilha 1 sua: vazia, destino válido/ }).click();
  await expect(page.getByRole("button", { name: "Armadilha baixada: Véu Espelhado" })).toBeVisible();
  await page.getByRole("button", { name: /Cura do Santuário.*Selecionar/ }).click();
  await page.getByRole("button", { name: "Ativar magia" }).click();
  await expect(page.getByLabel("9000 pontos de vida")).toBeVisible({ timeout: 10_000 });

  // turno do oponente joga sozinho e devolve a vez
  await page.getByRole("button", { name: "Encerrar turno" }).click();
  await expect(page.getByText(/Turno 3.*sua vez/)).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("list").filter({ hasText: "Turno 2: vez do oponente." })).toBeVisible();

  // rendição com confirmação, resultado e persistência do registro
  await page.getByRole("button", { name: "Render-se" }).click();
  await page.getByRole("dialog", { name: "Render-se?" }).getByRole("button", { name: "Render-se" }).click();
  const result = page.getByRole("dialog", { name: "Derrota" });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result).toContainText("+10");
  await page.waitForTimeout(800);
  const profile = await readKv<{ xp: number; matches: { result: string }[] }>(page, "profile");
  expect(profile?.matches).toHaveLength(1);
  expect(profile?.matches[0].result).toBe("surrender");
  await page.goto("/profile");
  await expect(page.getByText("Rendição contra")).toBeVisible();
  await expectNoOverflow(page, "perfil");
});

test("arena: duelo em área bloqueada é recusado e mostra o motivo", async ({ page }) => {
  await page.goto("/arena?area=ruinas");
  await expect(page.getByRole("radio", { name: /Ruínas Dimensionais/ })).toBeDisabled();
  await expect(page.getByText(/Bloqueada: Nível 4/).first()).toBeVisible();
});

test("mundo: missão concluída é resgatada uma vez e a recompensa persiste", async ({ page }) => {
  await page.goto("/world");
  await expect(page.getByRole("heading", { level: 1, name: "Mundo e missões" })).toBeVisible();
  const claim = page.getByRole("button", { name: "Objetivo incompleto" }).first();
  await expect(claim).toBeDisabled();

  await seedKv(page, "profile", { xp: 120, matches: [{ id: "seed-1", at: 1, areaId: "templo", result: "win", turns: 5, playerDeck: "A", opponentDeck: "B" }], claimedMissions: [], unlockedCards: [] });
  await page.reload();
  await expectNoOverflow(page, "mundo");
  await page.getByRole("button", { name: "Resgatar recompensa" }).first().click();
  await expect(page.getByText("Resgatada").first()).toBeVisible();
  await page.waitForTimeout(800);
  const stored = await readKv<{ xp: number; claimedMissions: string[] }>(page, "profile");
  expect(stored?.claimedMissions).toEqual(["m-templo-1"]);
  expect(stored?.xp).toBe(270);
  await page.reload();
  await expect(page.getByText("Resgatada").first()).toBeVisible();
  await expect(page.getByText(/Nível 2/).first()).toBeVisible();
  await page.getByRole("button", { name: "Biblioteca Proibida" }).click();
  await expect(page.getByRole("link", { name: "Duelar nesta área" })).toBeVisible();
});

test("configurações: controles de áudio independentes persistem", async ({ page }) => {
  await page.goto("/settings");
  const music = page.getByRole("switch", { name: "Música ambiente" });
  const sfx = page.getByRole("switch", { name: "Efeitos sonoros" });
  await expect(music).toHaveAttribute("aria-checked", "false");
  await music.click();
  await expect(music).toHaveAttribute("aria-checked", "true");
  await expect(sfx).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Volume da música").fill("20");
  await page.getByLabel("Animações").selectOption("off");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe("off");
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Música ambiente" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Volume da música")).toHaveValue("20");
  await expect(page.getByLabel("Animações")).toHaveValue("off");
});

test("guia local responde com dados do app e declara incerteza", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Abrir guia Lúmen" }).click();
  await expect(page.getByText("Não é um modelo de IA.")).toBeVisible();
  await page.getByLabel("Pergunte sobre regras, cartas ou missões").fill("Fale da carta Lâmina Sem Reflexo");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.getByText(/ATK 1800/)).toBeVisible();
  await page.getByLabel("Pergunte sobre regras, cartas ou missões").fill("qual o efeito oficial do Mago Negro?");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.getByText(/não tenho dados suficientes/i)).toBeVisible();
});
