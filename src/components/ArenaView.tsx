"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Card } from "@/domain/cards/schema";
import { flattenZone, validateDeck } from "@/domain/decks/rules";
import { STARTER_DECKS, starterCardIds } from "@/domain/decks/starters";
import { AREAS } from "@/domain/progression/data";
import { areaStatus, canEnterArea, isCardUnlocked } from "@/domain/progression/progression";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import { DuelBoard, type Session } from "./DuelBoard";

interface DeckChoice { id: string; name: string; description: string; cards: string[]; disabledReason: string | null }

export function ArenaView() {
  const params = useSearchParams();
  const hydrated = useApp((s) => s.hydrated);
  const decks = useApp((s) => s.decks);
  const profile = useApp((s) => s.profile);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [areaId, setAreaId] = useState<string>(() => params.get("area") ?? "free");
  const [freeOpp, setFreeOpp] = useState(STARTER_DECKS[3].id);
  const [deckId, setDeckId] = useState<string>(() => params.get("deck") ?? STARTER_DECKS[0].id);

  const choices: DeckChoice[] = useMemo(() => {
    const ctx = { isUnlocked: (c: Card) => isCardUnlocked(c, profile) };
    const starters = STARTER_DECKS.map((s) => ({ id: s.id, name: `${s.name} (inicial)`, description: s.description, cards: starterCardIds(s.id), disabledReason: null }));
    const mine = decks.map((d) => {
      const r = validateDeck(d, ctx);
      const first = r.issues.find((i) => i.severity === "error");
      return { id: d.id, name: d.name, description: `${r.counts.main} cartas no Main Deck`, cards: flattenZone(d, "main"), disabledReason: r.valid ? null : first?.message ?? "Baralho inválido." };
    });
    return [...starters, ...mine];
  }, [decks, profile]);

  if (!hydrated) return <p className="muted p-6" role="status">Carregando a arena…</p>;

  const start = (seedOverride?: number) => {
    const choice = choices.find((c) => c.id === deckId);
    if (!choice || choice.disabledReason) { setError(choice?.disabledReason ?? "Escolha um baralho válido."); return; }
    let oppDeckId = freeOpp, oppName = "Duelista Rival";
    let area: string | null = null;
    if (areaId !== "free") {
      const gate = canEnterArea(areaId, profile);
      if (!gate.ok) { setError(gate.error); return; }
      oppDeckId = gate.value.opponent.deckId; oppName = gate.value.opponent.name; area = gate.value.id;
    }
    const opp = STARTER_DECKS.find((s) => s.id === oppDeckId)!;
    setError(null);
    audio.unlock();
    const fromUrl = Number(params.get("seed"));
    const seed = seedOverride ?? (Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 2 ** 31));
    setSession({ seed, startedAt: Date.now(), areaId: area, playerDeckName: choice.name, playerCards: choice.cards, opponentName: oppName, opponentDeckName: opp.name, opponentCards: starterCardIds(opp.id) });
  };

  if (session) return <DuelBoard key={`${session.seed}-${session.startedAt}`} session={session} onExit={() => setSession(null)} onRematch={() => start(Math.floor(Math.random() * 2 ** 31))} />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl sm:text-4xl">Arena de duelos</h1>
      <p className="muted mt-1 text-sm">Escolha onde duelar e com qual baralho. Vitórias em uma área contam para as missões dela.</p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-lg">Onde duelar</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice name="area" id="free" checked={areaId === "free"} onChange={() => setAreaId("free")} title="Duelo livre" body="Sem missões; você escolhe o baralho do rival." />
          {AREAS.map((a) => {
            const st = areaStatus(a, profile);
            return <Choice key={a.id} name="area" id={a.id} checked={areaId === a.id} onChange={() => setAreaId(a.id)} disabled={!st.unlocked} title={a.name} body={st.unlocked ? `Rival: ${a.opponent.name}.` : `Bloqueada: ${st.missing.join("; ")}.`} />;
          })}
        </div>
        {areaId === "free" && (
          <div className="mt-3 max-w-xs"><label htmlFor="opp" className="muted mb-1 block text-xs">Baralho do rival</label>
            <select id="opp" className="field" value={freeOpp} onChange={(e) => setFreeOpp(e.target.value)}>{STARTER_DECKS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        )}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-2 text-lg">Seu baralho</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((c) => <Choice key={c.id} name="deck" id={c.id} checked={deckId === c.id} onChange={() => setDeckId(c.id)} disabled={!!c.disabledReason} title={c.name} body={c.disabledReason ? `Inválido: ${c.disabledReason}` : c.description} />)}
        </div>
        <p className="muted mt-2 text-xs">Seus baralhos precisam estar válidos no Deck Builder. O duelo usa apenas o Main Deck. <Link href="/deck-builder" className="underline">Abrir o Deck Builder</Link></p>
      </fieldset>

      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/50 bg-[#2a1118] p-3 text-sm text-[#ffd3d9]">{error}</p>}
      <div className="mt-6"><button type="button" className="btn btn-gold min-h-12 px-8 text-base" onClick={() => start()}>Iniciar duelo</button></div>
    </div>
  );
}

function Choice({ name, id, checked, onChange, disabled, title, body }: { name: string; id: string; checked: boolean; onChange: () => void; disabled?: boolean; title: string; body: string }) {
  return (
    <label className={`panel flex cursor-pointer items-start gap-3 p-3 transition ${checked ? "!border-blue bg-blue/10" : ""} ${disabled ? "cursor-not-allowed opacity-55" : "hover:border-[#4a5078]"}`}>
      <input type="radio" name={name} value={id} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 size-4 accent-[#397bff]" />
      <span className="min-w-0"><span className="block font-semibold">{title}</span><span className="muted block text-sm">{body}</span></span>
    </label>
  );
}
