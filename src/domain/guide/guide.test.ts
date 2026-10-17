import { describe, expect, it } from "vitest";
import { answerLocal, findCards, tipFor } from "./guide";

describe("assistente local", () => {
  it("descreve cartas a partir dos dados reais, sem inventar", () => {
    const a = answerLocal("O que faz a Lâmina Sem Reflexo?");
    expect(a.text).toContain("ATK 1800");
    expect(a.origin).toBe("local");
    expect(findCards("fenda destruidora")[0]?.id).toBe("fenda-destruidora");
  });
  it("explica tributos e declara o escopo das regras", () => {
    expect(answerLocal("como funciona tributo?").text).toMatch(/nível 7/);
    expect(answerLocal("quais regras são suportadas?").text).toMatch(/Ainda não implementado/);
  });
  it("declara incerteza quando não tem dados", () => {
    expect(answerLocal("qual é o efeito oficial da carta do Dragão Branco de Olhos Azuis?").text).toMatch(/não tenho dados suficientes/i);
    expect(answerLocal("xyzzy").text).toMatch(/não tenho dados suficientes/i);
  });
  it("tem dica para cada rota principal", () => {
    for (const r of ["/", "/library", "/deck-builder", "/arena", "/world", "/profile", "/settings"]) expect(tipFor(r).length).toBeGreaterThan(10);
  });
});
