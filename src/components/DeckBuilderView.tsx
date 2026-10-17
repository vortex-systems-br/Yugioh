"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CARDS, getCard, slug } from "@/domain/cards/data";
import { emptyFilters, filterCards } from "@/domain/cards/query";
import type { Card } from "@/domain/cards/schema";
import { FORMATS, ZONES_LIST, ZONE_LABEL, addCard, copiesOf, defaultZoneFor, getFormat, moveCard, removeCard, validateDeck, whyCannotAdd, type Deck, type DeckZone } from "@/domain/decks/rules";
import { exportDeck, parseDeckImport } from "@/domain/decks/io";
import { STARTER_DECKS } from "@/domain/decks/starters";
import { isCardUnlocked } from "@/domain/progression/progression";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import { CardInspector } from "./CardInspector";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Toast, useToast } from "./Toast";

type Dialog = null | "new" | "rename" | "delete" | "import";

export function DeckBuilderView() {
  const { hydrated, decks, activeDeckId, profile } = useApp();
  const createDeck = useApp((s) => s.createDeck);
  const updateDeck = useApp((s) => s.updateDeck);
  const renameDeck = useApp((s) => s.renameDeck);
  const duplicateDeck = useApp((s) => s.duplicateDeck);
  const deleteDeck = useApp((s) => s.deleteDeck);
  const setActiveDeck = useApp((s) => s.setActiveDeck);
  const addImportedDeck = useApp((s) => s.addImportedDeck);
  const savedAt = useApp((s) => s.savedAt);
  const { toast, show } = useToast();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [zone, setZone] = useState<DeckZone>("main");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Card["kind"] | "all">("all");
  const [inspectId, setInspectId] = useState<string | null>(null);

  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const ctx = useMemo(() => ({ isUnlocked: (c: Card) => isCardUnlocked(c, profile) }), [profile]);
  const report = useMemo(() => (deck ? validateDeck(deck, ctx) : null), [deck, ctx]);
  const format = deck ? getFormat(deck.formatId) : undefined;
  const pool = useMemo(() => filterCards(CARDS, { ...emptyFilters(), query, kinds: kind === "all" ? [] : [kind] }, new Set()), [query, kind]);

  const tryAdd = (card: Card, target?: DeckZone) => {
    if (!deck) { show("Crie um baralho para começar.", "error"); return; }
    const z = target ?? (zone === "side" ? "side" : defaultZoneFor(card));
    const why = whyCannotAdd(deck, card, z, ctx);
    if (why) { show(why, "error"); audio.sfx("error"); return; }
    updateDeck(deck.id, (d) => addCard(d, card.id, z));
    audio.sfx("select");
  };

  const download = () => {
    if (!deck) return;
    const blob = new Blob([exportDeck(deck)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(deck.name) || "baralho"}.shadow-realm.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    if (!deck) return;
    try { await navigator.clipboard.writeText(exportDeck(deck)); show("Baralho copiado como JSON."); } catch { show("Não foi possível copiar. Use Baixar JSON.", "error"); }
  };

  if (!hydrated) return <p className="muted p-6" role="status">Carregando seus baralhos…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Deck Builder</h1>
          <p className="muted mt-1 text-sm" role="status">{savedAt ? `Salvo neste dispositivo às ${new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` : "As alterações são salvas automaticamente neste dispositivo."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setDialog("new")}><Icon name="plus" size={18} /> Novo baralho</button>
          <button type="button" className="btn" onClick={() => setDialog("import")}><Icon name="upload" size={18} /> Importar</button>
        </div>
      </div>

      {decks.length === 0 || !deck ? (
        <div className="panel grid place-items-center gap-4 p-10 text-center">
          <p className="text-xl">Você ainda não tem baralhos.</p>
          <p className="muted max-w-md text-sm">Comece do zero ou a partir de um baralho inicial pronto para o Duelo Curto.</p>
          <button type="button" className="btn btn-primary" onClick={() => setDialog("new")}>Criar meu primeiro baralho</button>
        </div>
      ) : (
        <>
          <div className="panel mb-4 flex flex-wrap items-end gap-3 p-3 sm:p-4">
            <div className="min-w-48 flex-1">
              <label htmlFor="deck-sel" className="muted mb-1 block text-xs">Baralho</label>
              <select id="deck-sel" className="field" value={deck.id} onChange={(e) => setActiveDeck(e.target.value)}>{decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </div>
            <div className="w-full sm:w-52">
              <label htmlFor="fmt" className="muted mb-1 block text-xs">Formato</label>
              <select id="fmt" className="field" value={deck.formatId} onChange={(e) => updateDeck(deck.id, (d) => ({ ...d, formatId: e.target.value, updatedAt: Date.now() }))}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" className="btn btn-sm" onClick={() => setDialog("rename")}><Icon name="edit" size={16} /> Renomear</button>
              <button type="button" className="btn btn-sm" onClick={() => { const c = duplicateDeck(deck.id); if (c) show(`Criado “${c.name}”.`); }}><Icon name="copy" size={16} /> Duplicar</button>
              <button type="button" className="btn btn-sm" onClick={download}><Icon name="download" size={16} /> Baixar JSON</button>
              <button type="button" className="btn btn-sm" onClick={copy}><Icon name="copy" size={16} /> Copiar JSON</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setDialog("delete")}><Icon name="trash" size={16} /> Excluir</button>
            </div>
            {format && <p className="muted w-full text-xs">{format.description}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label="Cartas disponíveis" className="panel flex min-h-0 min-w-0 flex-col p-3">
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <label htmlFor="pool-q" className="sr-only">Buscar cartas para adicionar</label>
                  <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <input id="pool-q" type="search" className="field pl-10" placeholder="Buscar cartas" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="flex gap-1.5" role="group" aria-label="Tipo de carta">
                  {([["all", "Todas"], ["monster", "Monstros"], ["spell", "Magias"], ["trap", "Armadilhas"]] as const).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
                </div>
              </div>
              <ul className="grid max-h-[60dvh] gap-1.5 overflow-y-auto pr-1">
                {pool.length === 0 && <li className="muted p-6 text-center text-sm">Nenhuma carta encontrada.</li>}
                {pool.map((c) => {
                  const n = copiesOf(deck, c.id);
                  const locked = !isCardUnlocked(c, profile);
                  return (
                    <li key={c.id} className="flex items-center gap-2 rounded-lg border border-edge bg-surface p-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setInspectId(c.id)} aria-label={`Inspecionar ${c.name}`}>
                        <span className="block truncate font-medium">{c.name}{locked && <Icon name="lock" size={14} className="ml-1 inline text-gold" />}</span>
                        <span className="muted block truncate text-xs">{c.kind === "monster" ? `Nível ${c.level}, ATK ${c.atk}, DEF ${c.def}${c.monsterType === "ascended" ? " (Extra Deck)" : ""}` : c.kind === "spell" ? "Magia" : "Armadilha"}</span>
                      </button>
                      {n > 0 && <span className="rounded-full bg-blue/25 px-2 py-0.5 text-xs">×{n}</span>}
                      <button type="button" className="icon-btn" aria-label={`Adicionar ${c.name}`} onClick={() => tryAdd(c)}><Icon name="plus" /></button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-label="Cartas do baralho" className="panel flex min-h-0 min-w-0 flex-col p-3">
              <div role="tablist" aria-label="Zonas do baralho" className="mb-3 grid grid-cols-3 gap-1.5">
                {ZONES_LIST.map((z) => {
                  const total = report?.counts[z] ?? 0;
                  const max = format ? (z === "main" ? format.main.max : z === "extra" ? format.extra.max : format.side.max) : 0;
                  return (
                    <button key={z} type="button" role="tab" id={`tab-${z}`} aria-selected={zone === z} aria-controls="painel-zona" className={`rounded-lg border px-2 py-2 text-sm ${zone === z ? "border-blue bg-blue/15" : "border-edge text-mute"}`} onClick={() => setZone(z)}>
                      <span className="block font-semibold">{ZONE_LABEL[z]}</span>
                      <span className="text-xs">{total}/{max}{z === "main" && format ? ` (mín. ${format.main.min})` : ""}</span>
                    </button>
                  );
                })}
              </div>
              <div id="painel-zona" role="tabpanel" aria-labelledby={`tab-${zone}`}>
                <ul className="grid max-h-[40dvh] gap-1.5 overflow-y-auto pr-1">
                  {deck[zone].length === 0 && <li className="muted p-6 text-center text-sm">Nenhuma carta em {ZONE_LABEL[zone]}. Adicione pela lista ao lado.</li>}
                  {deck[zone].map((e) => {
                    const c = getCard(e.cardId);
                    return (
                      <li key={e.cardId} className="flex items-center gap-2 rounded-lg border border-edge bg-surface p-2">
                        <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => c && setInspectId(c.id)}>{c?.name ?? `Carta desconhecida (${e.cardId})`}</button>
                        {c && zone !== "extra" && !(zone === "main" && defaultZoneFor(c) === "extra") && (
                          <button type="button" className="btn btn-sm" onClick={() => { const to = zone === "main" ? "side" : "main"; const why = whyCannotAdd(removeCard(deck, c.id, zone), c, to, ctx); if (why) { show(why, "error"); return; } updateDeck(deck.id, (d) => moveCard(d, c.id, zone, to)); }}aria-label={`Mover ${c.name} para ${zone === "main" ? "Side" : "Main"} Deck`}>{zone === "main" ? "Side" : "Main"}</button>
                        )}
                        <div className="flex items-center" role="group" aria-label={`Quantidade de ${c?.name ?? e.cardId}`}>
                          <button type="button" className="icon-btn !h-9 !w-9" aria-label="Remover uma cópia" onClick={() => updateDeck(deck.id, (d) => removeCard(d, e.cardId, zone))}><Icon name="minus" size={18} /></button>
                          <span className="w-6 text-center font-semibold" aria-live="polite">{e.qty}</span>
                          <button type="button" className="icon-btn !h-9 !w-9" aria-label="Adicionar uma cópia" onClick={() => c && tryAdd(c, zone)}><Icon name="plus" size={18} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-4 border-t border-edge pt-3" aria-label="Validação do baralho">
                <h2 className="mb-2 text-base">{report?.valid ? "Baralho válido" : "Baralho com problemas"}</h2>
                {report && report.issues.length === 0 && <p className="text-sm text-ok">Todas as regras do formato {format?.name} foram atendidas.</p>}
                <ul className="grid gap-1 text-sm">
                  {report?.issues.map((i, idx) => <li key={idx} className={i.severity === "error" ? "text-[#ffb3bd]" : "text-gold"}>{i.message}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report?.valid ? <Link href={`/arena?deck=${deck.id}`} className="btn btn-gold btn-sm">Duelar com este baralho</Link> : <span className="muted text-xs">Só baralhos válidos podem entrar na Arena.</span>}
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      <NewDeckDialog open={dialog === "new"} onClose={() => setDialog(null)} onCreate={(name, formatId, base) => {
        const d = createDeck(name, formatId);
        if (base) {
          const starter = STARTER_DECKS.find((s) => s.id === base)!;
          updateDeck(d.id, (x) => ({ ...x, main: starter.cards.map(([n, q]) => ({ cardId: slug(n), qty: q })) }));
        }
        setDialog(null);
        show(`Baralho “${name}” criado.`);
      }} />
      <RenameDialog key={`${deck?.id}-${dialog === "rename"}`} open={dialog === "rename"} initial={deck?.name ?? ""} onClose={() => setDialog(null)} onSave={(n) => { if (deck) renameDeck(deck.id, n); setDialog(null); show("Baralho renomeado."); }} />
      <Modal open={dialog === "delete"} title="Excluir baralho?" onClose={() => setDialog(null)}>
        <p className="muted mb-5 text-sm">“{deck?.name}” será removido deste dispositivo. Essa ação não pode ser desfeita; exporte o JSON antes se quiser guardar uma cópia.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setDialog(null)}>Cancelar</button><button type="button" className="btn btn-danger" onClick={() => { if (deck) deleteDeck(deck.id); setDialog(null); show("Baralho excluído."); }}>Excluir baralho</button></div>
      </Modal>
      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} onImport={(d) => { addImportedDeck(d); setDialog(null); show(`Baralho “${d.name}” importado.`); }} />
      <CardInspector card={inspectId ? getCard(inspectId) ?? null : null} locked={inspectId ? !isCardUnlocked(getCard(inspectId)!, profile) : false} onClose={() => setInspectId(null)}
        actions={inspectId && getCard(inspectId) ? <button type="button" className="btn btn-primary" onClick={() => tryAdd(getCard(inspectId)!)}><Icon name="plus" size={18} /> Adicionar ao baralho</button> : undefined} />
      <Toast toast={toast} />
    </div>
  );
}

function NewDeckDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, formatId: string, base: string | null) => void }) {
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState("curto");
  const [base, setBase] = useState("");
  return (
    <Modal open={open} title="Novo baralho" onClose={onClose}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onCreate(name.trim() || "Novo baralho", formatId, base || null); setName(""); setBase(""); }}>
        <div><label htmlFor="nd-name" className="muted mb-1 block text-xs">Nome</label><input id="nd-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Dragões de ataque rápido" autoFocus /></div>
        <div><label htmlFor="nd-fmt" className="muted mb-1 block text-xs">Formato</label><select id="nd-fmt" className="field" value={formatId} onChange={(e) => setFormatId(e.target.value)}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><label htmlFor="nd-base" className="muted mb-1 block text-xs">Começar de</label>
          <select id="nd-base" className="field" value={base} onChange={(e) => setBase(e.target.value)}><option value="">Baralho vazio</option>{STARTER_DECKS.map((s) => <option key={s.id} value={s.id}>{s.name} (30 cartas)</option>)}</select>
          {base && formatId !== "curto" && <p className="mt-1 text-xs text-gold">Os baralhos iniciais têm 30 cartas e só são válidos no Duelo Curto.</p>}
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Criar baralho</button></div>
      </form>
    </Modal>
  );
}

function RenameDialog({ open, initial, onClose, onSave }: { open: boolean; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <Modal open={open} title="Renomear baralho" onClose={onClose}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name); }}>
        <div><label htmlFor="rn" className="muted mb-1 block text-xs">Novo nome</label><input id="rn" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus onFocus={(e) => e.target.select()} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={!name.trim()}>Salvar nome</button></div>
      </form>
    </Modal>
  );
}

function ImportDialog({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (d: Deck) => void }) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const run = (src: string) => {
    const r = parseDeckImport(src);
    if (r.ok) { setErrors([]); setText(""); onImport(r.deck); } else setErrors(r.errors);
  };
  return (
    <Modal open={open} title="Importar baralho" onClose={onClose} size="lg">
      <div className="grid gap-3">
        <p className="muted text-sm">Cole o JSON exportado pelo Deck Builder ou escolha um arquivo .json.</p>
        <label htmlFor="imp" className="sr-only">JSON do baralho</label>
        <textarea id="imp" className="field min-h-40 py-3 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"schema":"shadow-realm.deck","version":1, ...}' />
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Escolher arquivo JSON" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); run(t); } e.target.value = ""; }} />
        {errors.length > 0 && <ul className="rounded-lg border border-danger/50 bg-[#2a1118] p-3 text-sm text-[#ffd3d9]" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={() => file.current?.click()}>Escolher arquivo</button>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => run(text)}>Importar</button>
        </div>
      </div>
    </Modal>
  );
}

