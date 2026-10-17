/** Escopo declarado das regras: o que o motor implementa e o que ainda não implementa. */
export const RULES_SCOPE = {
  supported: [
    "Preparação: 8000 PV, mão inicial de 5 cartas, baralho embaralhado por semente reproduzível.",
    "O primeiro jogador não compra no primeiro turno e não pode atacar nele.",
    "Fases: compra (automática), principal, batalha e final.",
    "Uma invocação normal por turno; nível 5–6 exige 1 tributo e nível 7 ou mais exige 2.",
    "Monstros em posição de ataque ou defesa (sempre viradas para cima) e mudança de posição uma vez por turno.",
    "Ataques contra monstros ou diretos, com cálculo de dano de batalha por ATK e DEF.",
    "Magias normais ativadas da mão: curar, causar dano, comprar, destruir monstro e aumentar ATK até o fim do turno.",
    "Armadilhas baixadas viradas para baixo: ativam sozinhas na declaração de ataque do oponente, a partir do turno seguinte ao baixar.",
    "Vitória por PV zerados, baralho vazio na compra ou rendição.",
  ],
  unsupported: [
    "Extra Deck no duelo (as cartas ascendidas existem só no Deck Builder).",
    "Monstros com efeito, correntes, velocidade de magia e janela de resposta do jogador.",
    "Monstros baixados virados para baixo e invocação por virada.",
    "Magias contínuas, de equipamento e de campo; limite de cartas na mão.",
  ],
} as const;
