"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { getCard } from "@/domain/cards/data";
import type { Card } from "@/domain/cards/schema";
import type { PlayerId } from "@/domain/duel/types";
import { powerForCard, themeForCard, type FxTheme } from "@/lib/card-fx";
import { CardArt } from "./CardArt";
import { HoloCard } from "./HoloCard";

/** Pseudoaleatório determinístico: o mesmo resultado no servidor e no cliente. */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FILL = "absolute inset-0 flex items-center justify-center";
const STAR = "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)";
const SLAM = 0.85; // duração da queda da carta (s)
const IMPACT = SLAM * 0.35; // momento em que a carta bate na zona (s)

/* -------------------------------------------------------------------------- */
/*  Camadas do efeito (todas desenhadas em volta da zona, sem capturar cliques) */
/* -------------------------------------------------------------------------- */

/** A carta "cai" de cima, grande, e encaixa na zona. */
function Slam({ card, theme }: { card: Card; theme: FxTheme }) {
  return (
    <motion.span
      className="absolute inset-0 z-20 block"
      style={{ willChange: "transform, opacity" }}
      initial={{ opacity: 0, scale: 2.4, y: -90, rotate: -10 }}
      animate={{ opacity: [0, 1, 1, 1, 0], scale: [2.4, 1, 1.08, 1, 1], y: [-90, 0, 0, 0, 0], rotate: [-10, 0, 0, 0, 0] }}
      transition={{ duration: SLAM, times: [0, 0.35, 0.45, 0.6, 1], ease: "easeIn" }}
    >
      <span className="absolute -inset-3 rounded-xl" style={{ background: `radial-gradient(circle, ${theme.color}88, transparent 70%)` }} />
      <HoloCard card={card} compact tilt={false} />
    </motion.span>
  );
}

/** Raios de luz girando, bem maiores que a zona. */
function Rays({ theme, power }: { theme: FxTheme; power: number }) {
  const size = 320 + power * 120;
  const mask = "radial-gradient(circle, #000 12%, transparent 66%)";
  return (
    <span className={FILL}>
      <motion.span
        className="block shrink-0 rounded-full"
        style={{
          width: `${size}%`,
          height: `${size}%`,
          background: `repeating-conic-gradient(from 0deg, ${theme.color}77 0deg 5deg, transparent 5deg 16deg)`,
          maskImage: mask,
          WebkitMaskImage: mask,
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.3, 1, 1.15], rotate: 50 }}
        transition={{ duration: 1.2, delay: IMPACT - 0.05, times: [0, 0.2, 1], ease: "easeOut" }}
      />
    </span>
  );
}

function Flash({ theme, t0 }: { theme: FxTheme; t0: number }) {
  return (
    <span className={FILL}>
      <motion.span
        className="block shrink-0 rounded-full"
        style={{ width: "100%", height: "100%", background: `radial-gradient(circle, ${theme.core}, ${theme.color}aa 35%, transparent 70%)` }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.3, 2.4] }}
        transition={{ duration: 0.65, delay: t0, times: [0, 0.2, 1], ease: "easeOut" }}
      />
    </span>
  );
}

function Ring({ theme, delay, size, width = 3 }: { theme: FxTheme; delay: number; size: number; width?: number }) {
  return (
    <span className={FILL}>
      <motion.span
        className="block shrink-0 rounded-full"
        style={{ width: `${size * 100}%`, height: `${size * 100}%`, border: `${width}px solid ${theme.color}`, boxShadow: `0 0 22px ${theme.color}, inset 0 0 18px ${theme.color}` }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 0.7, 1] }}
        transition={{ duration: 0.8, delay, times: [0, 0.15, 1], ease: "easeOut" }}
      />
    </span>
  );
}

function Pillar({ theme, power }: { theme: FxTheme; power: number }) {
  return (
    <span className="absolute inset-0 flex items-end justify-center">
      <motion.span
        className="block shrink-0 origin-bottom"
        style={{
          width: "60%",
          height: `${240 + power * 100}%`,
          background: `linear-gradient(to top, ${theme.color}, ${theme.core}99 50%, transparent)`,
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 0.95, 0], scaleY: [0, 1, 1] }}
        transition={{ duration: 0.8, delay: IMPACT - 0.05, times: [0, 0.25, 1], ease: "easeOut" }}
      />
    </span>
  );
}

/* ----------------------------- assinaturas por atributo ----------------------------- */

/** Tempestade: um raio que cai do alto até a zona. */
function Lightning({ theme }: { theme: FxTheme }) {
  const d = "M34 0 L22 70 L38 74 L18 150 L34 154 L26 260";
  return (
    <span className="absolute inset-x-0 bottom-[40%] flex justify-center">
      <svg width="60" height="260" viewBox="0 0 60 260" fill="none" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${theme.color})`, overflow: "visible" }}>
        <motion.path d={d} stroke={theme.color} strokeWidth="9" opacity="0.7" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 0.8, 0] }} transition={{ duration: 0.45, delay: IMPACT - 0.15, times: [0, 0.5, 1] }} />
        <motion.path d={d} stroke={theme.core} strokeWidth="3" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1, 1], opacity: [0, 1, 0.3, 0] }} transition={{ duration: 0.5, delay: IMPACT - 0.15, times: [0, 0.4, 0.6, 1] }} />
      </svg>
    </span>
  );
}

/** Sombra: um redemoinho escuro girando no chão. */
function Vortex({ theme }: { theme: FxTheme }) {
  const mask = "radial-gradient(circle, transparent 28%, #000 46%, transparent 72%)";
  return (
    <span className={FILL}>
      <motion.span
        className="block shrink-0 rounded-full"
        style={{
          width: "240%",
          height: "240%",
          background: `conic-gradient(from 0deg, transparent, ${theme.color}dd, transparent 55%, ${theme.color}99, transparent)`,
          maskImage: mask,
          WebkitMaskImage: mask,
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1, 1.25], rotate: 240 }}
        transition={{ duration: 1, delay: IMPACT - 0.1, times: [0, 0.3, 1], ease: "easeOut" }}
      />
    </span>
  );
}

/** Terra: rachaduras saindo do centro. */
function Cracks({ theme }: { theme: FxTheme }) {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="absolute left-1/2 top-1/2 block h-0 w-[85%]" style={{ transform: `rotate(${(i * 360) / 7 + rnd(i, 9) * 20}deg)`, transformOrigin: "0 50%" }}>
          <motion.span
            className="block h-[3px] w-full origin-left"
            style={{ background: `linear-gradient(90deg, ${theme.core}, ${theme.color}, transparent)`, boxShadow: `0 0 8px ${theme.color}` }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.8, delay: IMPACT, times: [0, 0.3, 1], ease: "easeOut" }}
          />
        </span>
      ))}
    </>
  );
}

function Signature({ theme }: { theme: FxTheme }) {
  switch (theme.motif) {
    case "bolts": return <Lightning theme={theme} />;
    case "smoke": return <Vortex theme={theme} />;
    case "shards": return <Cracks theme={theme} />;
    case "ripples": return <><Ring theme={theme} delay={IMPACT + 0.3} size={3.1} width={2} /><Ring theme={theme} delay={IMPACT + 0.4} size={3.6} width={1} /></>;
    default: return null;
  }
}

/* ------------------------------------ partículas ------------------------------------ */

function Particles({ theme, count, power, t0 }: { theme: FxTheme; count: number; power: number; t0: number }) {
  const reach = 1 + power * 0.7;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = rnd(i, 1) * Math.PI * 2;
        const radius = (36 + rnd(i, 2) * 40) * reach;
        const delay = t0 + rnd(i, 3) * 0.2;
        const dur = 0.7 + rnd(i, 4) * 0.6;
        const size = 4 + rnd(i, 5) * 6;
        const drift = rnd(i, 6) - 0.5;
        const lift = rnd(i, 7);

        switch (theme.motif) {
          case "embers":
            return (
              <span key={i} className={FILL}>
                <motion.span className="block rounded-full" style={{ width: size, height: size, background: theme.core, boxShadow: `0 0 8px 3px ${theme.color}` }}
                  initial={{ x: drift * 40, y: 10, opacity: 0 }}
                  animate={{ x: drift * 100, y: -(50 + lift * 70 * reach), opacity: [0, 1, 0] }}
                  transition={{ duration: dur + 0.2, delay, ease: "easeOut" }} />
              </span>
            );
          case "smoke":
            return (
              <span key={i} className={FILL}>
                <motion.span className="block rounded-full" style={{ width: size * 6, height: size * 6, background: `radial-gradient(circle, ${theme.color}aa, transparent 70%)` }}
                  initial={{ x: drift * 30, y: 12, opacity: 0, scale: 0.5 }}
                  animate={{ x: drift * 80, y: -(40 + lift * 50), opacity: [0, 0.85, 0], scale: 1.8 }}
                  transition={{ duration: dur + 0.5, delay, ease: "easeOut" }} />
              </span>
            );
          case "sparkles":
            return (
              <span key={i} className={FILL}>
                <motion.span className="block" style={{ width: size * 3, height: size * 3, background: theme.core, clipPath: STAR }}
                  initial={{ x: drift * 120, y: -70 - lift * 30, opacity: 0, rotate: 0, scale: 0.4 }}
                  animate={{ y: 24, opacity: [0, 1, 0], rotate: 140, scale: 1 }}
                  transition={{ duration: dur + 0.3, delay, ease: "easeOut" }} />
              </span>
            );
          case "bolts":
            return (
              <span key={i} className={FILL} style={{ transform: `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)` }}>
                <motion.span className="block" style={{ width: 3, height: 22 + lift * 22, background: `linear-gradient(${theme.core}, ${theme.color})`, boxShadow: `0 0 10px ${theme.color}` }}
                  initial={{ y: -12, scaleY: 0, opacity: 0 }}
                  animate={{ y: -(34 + lift * 30), scaleY: [0, 1, 0.7], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.5, delay, ease: "easeOut" }} />
              </span>
            );
          case "ripples":
            return (
              <span key={i} className={FILL}>
                <motion.span className="block rounded-full" style={{ width: size * 2.2, height: size * 2.2, border: `2px solid ${theme.core}`, background: `${theme.color}33` }}
                  initial={{ x: drift * 90, y: 16, opacity: 0, scale: 0.5 }}
                  animate={{ y: -(30 + lift * 60), opacity: [0, 1, 0], scale: 1 }}
                  transition={{ duration: dur + 0.2, delay, ease: "easeOut" }} />
              </span>
            );
          case "shards":
            return (
              <span key={i} className={FILL}>
                <motion.span className="block" style={{ width: size * 2, height: size * 2, background: `linear-gradient(135deg, ${theme.core}, ${theme.color})`, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
                  initial={{ x: 0, y: 6, opacity: 1, rotate: 0 }}
                  animate={{ x: Math.cos(angle) * radius, y: [6, -(30 + lift * 40), 34], opacity: [1, 1, 0], rotate: drift * 480 }}
                  transition={{ duration: dur, delay, ease: "easeOut" }} />
              </span>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/**
 * Efeito de invocação desenhado a partir da zona do monstro.
 * Não captura cliques (pointer-events-none) e dura cerca de 1,2 s.
 * `scale` vem de motionScale(): 1 = normal, ~0.35 = movimento reduzido (efeito simples).
 */
export function CardFX({ cardId, scale }: { cardId: string; scale: number }) {
  const card = getCard(cardId) as Card | undefined;
  if (!card || scale <= 0) return null;
  const theme = themeForCard(card);
  const power = powerForCard(card);
  const reduced = scale < 1;
  const t0 = reduced ? 0 : IMPACT;
  const count = Math.round((7 + power * 10) * (reduced ? 0.4 : 1));

  return (
    <span className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {!reduced && <Rays theme={theme} power={power} />}
      {!reduced && <Slam card={card} theme={theme} />}
      <Flash theme={theme} t0={t0} />
      <Ring theme={theme} delay={t0} size={1.3} />
      {!reduced && <Ring theme={theme} delay={t0 + 0.1} size={2} />}
      {!reduced && <Ring theme={theme} delay={t0 + 0.2} size={2.8} width={2} />}
      {!reduced && <Pillar theme={theme} power={power} />}
      {!reduced && <Signature theme={theme} />}
      <Particles theme={theme} count={count} power={power} t0={t0} />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Faixa com o nome da carta: cruza o tabuleiro por ~1,7 s, sem bloquear nada  */
/* -------------------------------------------------------------------------- */

export interface PlayInfo {
  id: number;
  player: PlayerId;
  cardId: string;
  label: string; // "Invocação", "Magia", "Armadilha"
  scale: number;
}

export function PlayCallout({ play, onDone }: { play: PlayInfo; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1700 * Math.max(play.scale, 0.4));
    return () => window.clearTimeout(t);
  }, [play, onDone]);

  const card = getCard(play.cardId) as Card | undefined;
  if (!card || play.scale <= 0) return null;
  const theme = themeForCard(card);
  const fromLeft = play.player === "opponent"; // oponente entra pela esquerda, você pela direita
  const dir = fromLeft ? -1 : 1;
  const sub = card.kind === "monster" ? `${play.label} · ATK ${card.atk} / DEF ${card.def}` : play.label;
  const dark = "rgb(4 6 16 / 0.88)";

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-1/2 z-30"
      initial={{ opacity: 0, x: dir * 160, y: "-50%" }}
      animate={{ opacity: 1, x: 0, y: "-50%" }}
      exit={{ opacity: 0, x: dir * -60, y: "-50%" }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      aria-hidden="true"
    >
      <div
        className={`relative flex items-center gap-3 px-3 sm:px-6 ${fromLeft ? "" : "flex-row-reverse"}`}
        style={{
          height: 60,
          background: `linear-gradient(${fromLeft ? 90 : 270}deg, ${theme.color}66, ${dark} 35%, ${dark} 65%, transparent)`,
          borderTop: `1px solid ${theme.color}`,
          borderBottom: `1px solid ${theme.color}66`,
        }}
      >
        <span className="relative -my-6 block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl border-2" style={{ borderColor: theme.color, boxShadow: `0 0 20px ${theme.color}` }}>
          <CardArt art={card.art} label={`Ilustração de ${card.name}`} />
        </span>
        <div className={`min-w-0 ${fromLeft ? "text-left" : "text-right"}`}>
          <p className="font-display truncate text-lg leading-tight sm:text-2xl">{card.name}</p>
          <p className="text-xs" style={{ color: theme.color }}>{sub}</p>
        </div>
      </div>
    </motion.div>
  );
}
