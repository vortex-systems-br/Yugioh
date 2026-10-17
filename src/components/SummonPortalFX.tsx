"use client";

import { motion } from "framer-motion";
import { getCard } from "@/domain/cards/data";
import type { Card } from "@/domain/cards/schema";
import { SUMMON_CINEMATIC_MS, themeForCard } from "@/lib/card-fx";
import FittedHologram from "./Hologram/FittedHologram";
import { HoloCard } from "./HoloCard";

/**
 * <SummonPortalFX /> — cena cinematográfica de invocação (SUMMON_CINEMATIC_MS, ~3,2 s).
 *
 *  0,0 s  barras de cinema entram, as bordas escurecem, clarão de abertura
 *  0,5 s  o portal abre; raios e anéis giram
 *  0,6 s  o monstro materializa (holograma 3D, ou a própria carta girando)
 *  1,4 s  o nome aparece em destaque
 *  2,8 s  clarão final, e logo depois a carta cai na zona (CardFX, no tabuleiro)
 *
 * Não bloqueia cliques (pointer-events-none) e o meio da tela continua visível.
 * Para ficar leve, usa só transform e opacity: sem blur, sem blend mode, sem máscara.
 */

export interface SummonPortalFXProps {
  cardId: string;
  modelPath?: string;
  color?: string;
}

const T = SUMMON_CINEMATIC_MS / 1000;
const CELL = "col-start-1 row-start-1";
const LAYER = { willChange: "transform, opacity" } as const;

export default function SummonPortalFX({ cardId, modelPath, color }: SummonPortalFXProps) {
  const card = getCard(cardId) as Card | undefined;
  if (!card) return null;
  const c = color ?? themeForCard(card).color;
  const sub = card.kind === "monster" ? `Nível ${card.level} · ATK ${card.atk} / DEF ${card.def}` : card.kind === "spell" ? "Magia" : "Armadilha";

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      aria-hidden="true"
    >
      {/* escurece só as bordas: o tabuleiro continua aparecendo no meio */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgb(4 6 16 / 0.2), rgb(4 6 16 / 0.82) 85%)" }} />

      {/* barras de cinema */}
      <motion.div className="absolute inset-x-0 top-0 bg-black" style={{ height: "9vh", ...LAYER }} initial={{ y: "-100%" }} animate={{ y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} />
      <motion.div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: "9vh", ...LAYER }} initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} />

      {/* palco central: todas as camadas ocupam a mesma célula */}
      <div className="absolute inset-0 grid place-items-center">
        {/* raios de luz: o degradê radial por cima apaga as pontas dos raios (sem máscara) */}
        <motion.div
          className={`${CELL} h-[130vmin] w-[130vmin] rounded-full`}
          style={{
            ...LAYER,
            background: `radial-gradient(circle, transparent 8%, rgb(4 6 16 / 0.45) 38%, rgb(4 6 16 / 0.9) 62%), repeating-conic-gradient(from 0deg, ${c}66 0deg 4deg, transparent 4deg 14deg)`,
          }}
          initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: [0, 0.85, 0.7, 0], scale: [0.4, 1, 1.05, 1.1], rotate: 90 }}
          transition={{ duration: T, times: [0, 0.2, 0.8, 1], ease: "easeOut" }}
        />
        {/* brilho de fundo */}
        <motion.div
          className={`${CELL} h-[64vmin] w-[64vmin] rounded-full`}
          style={{ ...LAYER, background: `radial-gradient(circle, ${c}88, ${c}22 50%, transparent 70%)` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.9, 0.6, 0.9, 0], scale: [0.5, 1.05, 0.95, 1.05, 1.2] }}
          transition={{ duration: T, times: [0, 0.2, 0.5, 0.85, 1], ease: "easeOut" }}
        />
        {/* anéis do portal */}
        <motion.div
          className={`${CELL} h-[66vmin] w-[66vmin] rounded-full`}
          style={{ ...LAYER, border: `2px solid ${c}`, boxShadow: `0 0 60px 6px ${c}66, inset 0 0 60px 6px ${c}33` }}
          initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
          animate={{ opacity: [0, 1, 0.85, 0.85, 0], scale: [0.5, 1.06, 1, 1, 1.15], rotate: 220 }}
          transition={{ duration: T, times: [0, 0.2, 0.4, 0.85, 1], ease: "easeOut" }}
        />
        <motion.div
          className={`${CELL} h-[48vmin] w-[48vmin] rounded-full`}
          style={{ ...LAYER, border: `2px dashed ${c}` }}
          initial={{ opacity: 0, scale: 0.7, rotate: 0 }}
          animate={{ opacity: [0, 0.7, 0.7, 0], scale: 1, rotate: -260 }}
          transition={{ duration: T, times: [0, 0.2, 0.85, 1], ease: "linear" }}
        />

        {/* o monstro: holograma 3D ou a própria carta girando */}
        {modelPath ? (
          <motion.div
            className={`${CELL} h-[64vmin] w-[64vmin]`}
            style={LAYER}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.04, 1.08] }}
            transition={{ delay: 0.5, duration: T - 0.5, times: [0, 0.2, 0.85, 1], ease: "easeOut" }}
          >
            <FittedHologram modelPath={modelPath} color={c} intro spin quality="full" />
          </motion.div>
        ) : (
          <motion.div
            className={`${CELL} w-[min(30vmin,240px)]`}
            style={{ ...LAYER, transformPerspective: 900 }}
            initial={{ opacity: 0, rotateY: 180, scale: 0.6, y: 40 }}
            animate={{ opacity: [0, 1, 1, 0], rotateY: [180, 0, 0, 0], scale: [0.6, 1, 1.05, 1.1], y: [40, 0, 0, 0] }}
            transition={{ delay: 0.5, duration: T - 0.5, times: [0, 0.3, 0.85, 1], ease: "easeOut" }}
          >
            <span className="absolute -inset-6 rounded-3xl" style={{ background: `radial-gradient(circle, ${c}99, transparent 70%)` }} />
            <HoloCard card={card} tilt={false} />
          </motion.div>
        )}
      </div>

      {/* clarão de abertura e clarão final (sem blend mode: só opacidade) */}
      <motion.div
        className="absolute inset-0"
        style={{ background: c, ...LAYER }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0, 0, 0.5, 0] }}
        transition={{ duration: T, times: [0, 0.07, 0.2, 0.86, 0.91, 1] }}
      />

      {/* nome e atributos */}
      <motion.div
        className="absolute inset-x-0 bottom-[14vh] px-4 text-center"
        style={LAYER}
        initial={{ opacity: 0, y: 16, scale: 1.12 }}
        animate={{ opacity: [0, 1, 1, 0], y: [16, 0, 0, -8], scale: [1.12, 1, 1, 1] }}
        transition={{ delay: 1.4, duration: T - 1.4, times: [0, 0.25, 0.85, 1], ease: "easeOut" }}
      >
        <p className="font-display text-2xl uppercase tracking-[0.2em] text-white sm:text-5xl" style={{ textShadow: `0 0 24px ${c}, 0 0 48px ${c}` }}>
          {card.name}
        </p>
        <p className="mt-2 text-sm sm:text-base" style={{ color: c }}>{sub}</p>
      </motion.div>
    </motion.div>
  );
}
