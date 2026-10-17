"use client";

import { memo, useRef, type ReactNode } from "react";
import { AttributeLabel, RarityLabel, type Card } from "@/domain/cards/schema";
import { CardArt } from "./CardArt";
import { Icon } from "./Icon";

const ATTR_COLOR: Record<string, string> = { shadow: "#b99aff", light: "#ffe9a0", storm: "#8fc6ff", flame: "#ff9f7a", tide: "#7fe3e0", earth: "#c7b08a" };

export function cardAriaLabel(card: Card): string {
  const base = `${card.name}, ${RarityLabel[card.rarity]}`;
  if (card.kind === "monster") return `${base}, monstro nível ${card.level}, ATK ${card.atk}, DEF ${card.def}`;
  return `${base}, ${card.kind === "spell" ? "magia" : "armadilha"}`;
}

export interface HoloCardProps {
  card: Card;
  compact?: boolean;
  flipped?: boolean;
  /** Inclinação e brilho seguem o ponteiro (mouse, toque ou caneta). */
  tilt?: boolean;
  /** Brilho holográfico visível sem interação (ex.: inspeção ampliada). */
  staticHolo?: boolean;
  locked?: boolean;
  faceDown?: boolean;
  badge?: ReactNode;
  className?: string;
}

export const HoloCard = memo(function HoloCard({ card, compact, flipped, tilt = true, staticHolo, locked, faceDown, badge, className }: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !tilt) return;
    const motion = document.documentElement.dataset.motion;
    if (motion === "off" || motion === "reduced") return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--rx", `${((0.5 - y) * 18).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 22).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.dataset.active = "true";
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    delete el.dataset.active;
  };

  const monster = card.kind === "monster" ? card : null;
  const ascended = monster?.monsterType === "ascended";
  const typeLine = monster ? `${AttributeLabel[monster.attribute]} — Monstro${ascended ? " ascendido" : ""}` : card.kind === "spell" ? "Magia normal" : "Armadilha";
  const attrBg = monster ? ATTR_COLOR[monster.attribute] : card.kind === "spell" ? "#7fe3c8" : "#ff9fcf";
  const attrLetter = monster ? AttributeLabel[monster.attribute][0] : card.kind === "spell" ? "M" : "A";

  return (
    <div
      ref={ref}
      className={`card3d ${className ?? ""}`}
      data-compact={compact ? "true" : undefined}
      data-flipped={flipped || faceDown ? "true" : undefined}
      data-static={staticHolo ? "true" : undefined}
      data-rarity={card.rarity}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerCancel={leave}
    >
      <div className="card3d-body">
        <div className="card3d-flip">
          <div className="card-face card-front" data-rarity={card.rarity} data-kind={card.kind} data-ascended={ascended ? "true" : undefined}>
            <div className="card-inner">
              <div className="card-name">
                <span style={{ fontSize: card.name.length > 22 ? "4.9cqw" : card.name.length > 17 ? "5.8cqw" : undefined }}>{card.name}</span>
                <span className="card-attr" style={{ ["--attr" as string]: attrBg }} aria-hidden="true">{attrLetter}</span>
              </div>
              <div className="card-level" aria-hidden="true">{monster && Array.from({ length: monster.level }, (_, i) => <i key={i} />)}</div>
              <div className="card-art"><CardArt art={card.art} label={`Ilustração de ${card.name}`} /></div>
              <div className="card-type">{typeLine}</div>
              <div className="card-text">{card.text}</div>
              {monster ? (
                <div className="card-stats"><span>ATK <b>{monster.atk}</b></span><span>DEF <b>{monster.def}</b></span></div>
              ) : <div className="card-stats" aria-hidden="true">&nbsp;</div>}
            </div>
            <div className="holo" /><div className="card-glare" />
            {locked && (
              <div className="absolute inset-0 grid place-items-center bg-black/65 text-center" style={{ fontSize: "5cqw" }}>
                <div className="grid place-items-center gap-1 text-frost"><Icon name="lock" size={28} /><span>Bloqueada</span></div>
              </div>
            )}
          </div>
          <div className="card-face card-back" aria-hidden="true">
            <svg viewBox="0 0 60 60" width="55%" fill="none" stroke="#d6b36a" strokeWidth="1.2">
              <circle cx="30" cy="30" r="24" /><circle cx="30" cy="30" r="15" opacity=".6" />
              <path d="M30 6V54M6 30H54M13 13 47 47M47 13 13 47" opacity=".5" />
              <circle cx="30" cy="30" r="4" fill="#8c48ff" stroke="none" />
            </svg>
          </div>
        </div>
      </div>
      {badge && <div className="pointer-events-none absolute -right-1 -top-1 z-10">{badge}</div>}
    </div>
  );
});

/** Verso de carta sem nenhum dado da carta no DOM (usado para informação oculta do oponente). */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={`card3d ${className ?? ""}`} aria-hidden="true">
      <div className="card3d-body"><div className="card3d-flip"><div className="card-face card-back" style={{ transform: "none" }}>
        <svg viewBox="0 0 60 60" width="55%" fill="none" stroke="#d6b36a" strokeWidth="1.2"><circle cx="30" cy="30" r="24" /><circle cx="30" cy="30" r="15" opacity=".6" /><path d="M30 6V54M6 30H54" opacity=".5" /><circle cx="30" cy="30" r="4" fill="#8c48ff" stroke="none" /></svg>
      </div></div></div>
    </div>
  );
}
