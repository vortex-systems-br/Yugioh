"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AttributeLabel, RarityLabel, type Card } from "@/domain/cards/schema";
import { HoloCard } from "./HoloCard";
import { Icon } from "./Icon";

/** Inspeção ampliada em <dialog> nativo: foco preso, Esc fecha e funciona por toque, mouse e teclado. */
export function CardInspector({ card, onClose, actions, locked }: { card: Card | null; onClose: () => void; actions?: ReactNode; locked?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (card && !d.open) { d.showModal(); }
    if (!card && d.open) d.close();
  }, [card]);

  const close = () => { setFlipped(false); onClose(); };

  return (
    <dialog ref={ref} className="sheet" aria-label={card ? `Inspeção de ${card.name}` : "Inspeção de carta"} onClose={close} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      {card && (
        <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,340px)_1fr]">
          <div className="mx-auto w-full max-w-[320px]">
            <HoloCard card={card} flipped={flipped} staticHolo locked={locked} />
            <button type="button" className="btn btn-sm mt-4 w-full" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
              <Icon name="flip" size={16} /> {flipped ? "Ver frente" : "Virar carta"}
            </button>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl leading-tight">{card.name}</h2>
                <p className="muted mt-1 text-sm">{RarityLabel[card.rarity]} — {card.category}</p>
              </div>
              <button type="button" className="icon-btn -mr-2 -mt-2" onClick={() => ref.current?.close()} aria-label="Fechar inspeção"><Icon name="close" /></button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Tipo" value={card.kind === "monster" ? (card.monsterType === "ascended" ? "Monstro ascendido" : "Monstro") : card.kind === "spell" ? "Magia" : "Armadilha"} />
              {card.kind === "monster" && (<>
                <Info label="Atributo" value={AttributeLabel[card.attribute]} />
                <Info label="Nível" value={String(card.level)} />
                <Info label="ATK" value={String(card.atk)} />
                <Info label="DEF" value={String(card.def)} />
                <Info label="Deck" value={card.monsterType === "ascended" ? "Extra Deck" : "Main Deck"} />
              </>)}
            </dl>
            <p className="rounded-xl border border-edge bg-abyss/60 p-4 leading-relaxed">{card.text}</p>
            <p className="muted text-xs">Carta fictícia e original desta demonstração. Não é um produto oficial nem afiliado a Yu-Gi-Oh!.</p>
            {locked && <p className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">Recompensa de missão: conclua e resgate a missão correspondente no Mundo para usar esta carta.</p>}
            {actions && <div className="mt-auto flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
      )}
    </dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (<div><dt className="muted text-xs">{label}</dt><dd className="font-semibold">{value}</dd></div>);
}
