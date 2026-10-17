"use client";

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { CARDS, getCard } from "@/domain/cards/data";
import { emptyFilters, filterCards, hasActiveFilters, type CardFilters, type SortKey } from "@/domain/cards/query";
import { ATTRIBUTES, AttributeLabel, CATEGORIES, RARITIES, RarityLabel, type Card } from "@/domain/cards/schema";
import { copiesOf, defaultZoneFor, addCard, whyCannotAdd } from "@/domain/decks/rules";
import { isCardUnlocked } from "@/domain/progression/progression";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import { CardInspector } from "./CardInspector";
import { HoloCard, cardAriaLabel } from "./HoloCard";
import { Icon } from "./Icon";
import { Toast, useToast } from "./Toast";

const PAGE = 24;
const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nome" }, { key: "atk", label: "Ataque" }, { key: "def", label: "Defesa" }, { key: "level", label: "Nível" }, { key: "rarity", label: "Raridade" },
];
const KINDS: { key: Card["kind"]; label: string }[] = [{ key: "monster", label: "Monstro" }, { key: "spell", label: "Magia" }, { key: "trap", label: "Armadilha" }];

function toggle<T>(list: T[], v: T): T[] { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

export function LibraryView() {
  const [filters, setFilters] = useState<CardFilters>(emptyFilters());
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const { toast, show } = useToast();

  const favorites = useApp((s) => s.favorites);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const profile = useApp((s) => s.profile);
  const decks = useApp((s) => s.decks);
  const activeDeckId = useApp((s) => s.activeDeckId);
  const updateDeck = useApp((s) => s.updateDeck);
  const hydrated = useApp((s) => s.hydrated);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const deferredFilters = useDeferredValue(filters);
  const results = useMemo(() => filterCards(CARDS, deferredFilters, favSet), [deferredFilters, favSet]);
  const visible = results.slice(0, limit);
  const active = hasActiveFilters(filters);
  const ctx = useMemo(() => ({ isUnlocked: (c: Card) => isCardUnlocked(c, profile) }), [profile]);

  const patch = (p: Partial<CardFilters>) => { setFilters((f) => ({ ...f, ...p })); setLimit(PAGE); };
  const inspect = inspectId ? getCard(inspectId) ?? null : null;

  const add = useCallback((card: Card) => {
    if (!deck) { show("Crie ou selecione um baralho no Deck Builder para adicionar cartas.", "error"); return; }
    const zone = defaultZoneFor(card);
    const why = whyCannotAdd(deck, card, zone, ctx);
    if (why) { show(why, "error"); audio.sfx("error"); return; }
    updateDeck(deck.id, (d) => addCard(d, card.id, zone));
    audio.sfx("select");
    show(`${card.name} entrou em “${deck.name}”.`);
  }, [deck, ctx, updateDeck, show]);

  const fav = useCallback((card: Card) => { toggleFavorite(card.id); audio.sfx("ui"); }, [toggleFavorite]);
  const openCard = useCallback((id: string) => { setInspectId(id); audio.sfx("select"); }, []);
  const inDeck = (card: Card) => (deck ? copiesOf(deck, card.id) : 0);
  const isFav = (card: Card) => favSet.has(card.id);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Biblioteca</h1>
          <p className="muted mt-1 text-sm">{CARDS.length} cartas fictícias e originais. {deck ? `Baralho ativo: ${deck.name}.` : hydrated ? "Nenhum baralho ativo." : ""}</p>
        </div>
      </div>

      <div className="panel mb-4 grid gap-3 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <label htmlFor="busca" className="sr-only">Buscar carta por nome ou texto</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input id="busca" type="search" className="field pl-10" placeholder="Buscar por nome ou texto" value={filters.query} onChange={(e) => patch({ query: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <label htmlFor="ordem" className="sr-only">Ordenar por</label>
            <select id="ordem" className="field min-w-32" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortKey })}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>Ordenar: {s.label}</option>)}
            </select>
            <button type="button" className="btn px-3" onClick={() => patch({ dir: filters.dir === "asc" ? "desc" : "asc" })} aria-label={`Direção: ${filters.dir === "asc" ? "crescente" : "decrescente"}. Alternar`}>
              {filters.dir === "asc" ? "A→Z" : "Z→A"}
            </button>
          </div>
          <div className="flex gap-1" role="group" aria-label="Modo de visualização">
            <button type="button" className="icon-btn" aria-pressed={view === "grid"} aria-label="Grade" onClick={() => setView("grid")}><Icon name="grid" /></button>
            <button type="button" className="icon-btn" aria-pressed={view === "list"} aria-label="Lista" onClick={() => setView("list")}><Icon name="list" /></button>
          </div>
          <button type="button" className="btn" aria-expanded={showFilters} aria-controls="painel-filtros" onClick={() => setShowFilters((v) => !v)}>Filtros{active ? " (ativos)" : ""}</button>
        </div>

        {showFilters && (
          <div id="painel-filtros" className="grid gap-4 border-t border-edge pt-4 md:grid-cols-2">
            <ChipGroup label="Tipo" items={KINDS.map((k) => ({ key: k.key, label: k.label }))} selected={filters.kinds} onToggle={(k) => patch({ kinds: toggle(filters.kinds, k) })} />
            <ChipGroup label="Atributo" items={ATTRIBUTES.map((a) => ({ key: a, label: AttributeLabel[a] }))} selected={filters.attributes} onToggle={(k) => patch({ attributes: toggle(filters.attributes, k) })} />
            <ChipGroup label="Raridade" items={RARITIES.map((r) => ({ key: r, label: RarityLabel[r].replace(" (fictícia da demo)", "") }))} selected={filters.rarities} onToggle={(k) => patch({ rarities: toggle(filters.rarities, k) })} />
            <ChipGroup label="Categoria" items={CATEGORIES.map((c) => ({ key: c, label: c }))} selected={filters.categories} onToggle={(k) => patch({ categories: toggle(filters.categories, k) })} />
            <div className="flex flex-wrap items-end gap-3">
              <div><label htmlFor="nmin" className="muted mb-1 block text-xs">Nível mínimo</label>
                <select id="nmin" className="field w-28" value={filters.levelMin ?? ""} onChange={(e) => patch({ levelMin: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Qualquer</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select></div>
              <div><label htmlFor="nmax" className="muted mb-1 block text-xs">Nível máximo</label>
                <select id="nmax" className="field w-28" value={filters.levelMax ?? ""} onChange={(e) => patch({ levelMax: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Qualquer</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select></div>
              <button type="button" className="chip" aria-pressed={filters.favoritesOnly} onClick={() => patch({ favoritesOnly: !filters.favoritesOnly })}>Só favoritas</button>
            </div>
            <div className="flex items-end md:justify-end"><button type="button" className="btn btn-sm" onClick={() => { setFilters(emptyFilters()); setLimit(PAGE); }} disabled={!active}>Limpar filtros</button></div>
          </div>
        )}
      </div>

      <p className="muted mb-3 text-sm" role="status" aria-live="polite">{results.length === 0 ? "Nenhuma carta encontrada." : `Mostrando ${visible.length} de ${results.length} carta${results.length > 1 ? "s" : ""}.`}</p>

      {results.length === 0 ? (
        <div className="panel grid place-items-center gap-3 p-10 text-center">
          <p className="text-lg">Nada por aqui com esses filtros.</p>
          <p className="muted max-w-md text-sm">{filters.favoritesOnly && favorites.length === 0 ? "Você ainda não favoritou nenhuma carta. Use a estrela em qualquer carta." : "Tente outro nome ou remova algum filtro."}</p>
          <button type="button" className="btn btn-primary" onClick={() => { setFilters(emptyFilters()); setLimit(PAGE); }}>Limpar filtros</button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((c) => <GridTile key={c.id} card={c} locked={!isCardUnlocked(c, profile)} count={inDeck(c)} fav={isFav(c)} onOpen={openCard} onFav={fav} onAdd={add} />)}
        </ul>
      ) : (
        <ul className="grid gap-2">
          {visible.map((c) => <ListRow key={c.id} card={c} locked={!isCardUnlocked(c, profile)} count={inDeck(c)} fav={isFav(c)} onOpen={openCard} onFav={fav} onAdd={add} />)}
        </ul>
      )}

      {visible.length < results.length && (
        <div className="mt-6 grid place-items-center"><button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>Carregar mais ({results.length - visible.length})</button></div>
      )}

      <CardInspector
        card={inspect}
        locked={inspect ? !isCardUnlocked(inspect, profile) : false}
        onClose={() => setInspectId(null)}
        actions={inspect && (<>
          <button type="button" className="btn" aria-pressed={isFav(inspect)} onClick={() => fav(inspect)}><Icon name="star" size={18} filled={isFav(inspect)} /> {isFav(inspect) ? "Favorita" : "Favoritar"}</button>
          <button type="button" className="btn btn-primary" onClick={() => add(inspect)}><Icon name="plus" size={18} /> Adicionar ao baralho</button>
        </>)}
      />
      <Toast toast={toast} />
    </div>
  );
}

function ChipGroup<T extends string>({ label, items, selected, onToggle }: { label: string; items: { key: T; label: string }[]; selected: T[]; onToggle: (k: T) => void }) {
  return (
    <fieldset>
      <legend className="muted mb-2 text-xs">{label}</legend>
      <div className="flex flex-wrap gap-2">{items.map((i) => <button key={i.key} type="button" className="chip" aria-pressed={selected.includes(i.key)} onClick={() => onToggle(i.key)}>{i.label}</button>)}</div>
    </fieldset>
  );
}

interface TileProps { card: Card; locked: boolean; count: number; fav: boolean; onOpen: (id: string) => void; onFav: (c: Card) => void; onAdd: (c: Card) => void }

const GridTile = memo(function GridTile({ card: c, locked, count: n, fav, onOpen, onFav, onAdd }: TileProps) {
  return (
    <li className="flex flex-col gap-2">
      <button type="button" className="rounded-[5%] text-left" aria-label={`${cardAriaLabel(c)}. Inspecionar`} onClick={() => onOpen(c.id)}>
        <HoloCard card={c} locked={locked} badge={n > 0 ? <span className="rounded-full bg-blue px-2 py-0.5 text-xs font-bold shadow">×{n}</span> : undefined} />
      </button>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-sm">{c.name}</span>
        <span className="flex shrink-0">
          <button type="button" className="icon-btn !h-9 !w-9" aria-pressed={fav} aria-label={fav ? `Remover ${c.name} dos favoritos` : `Favoritar ${c.name}`} onClick={() => onFav(c)}><Icon name="star" size={18} filled={fav} /></button>
          <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Adicionar ${c.name} ao baralho`} onClick={() => onAdd(c)}><Icon name="plus" size={18} /></button>
        </span>
      </div>
    </li>
  );
});

const ListRow = memo(function ListRow({ card: c, locked, count: n, fav, onOpen, onFav, onAdd }: TileProps) {
  return (
    <li className="panel flex items-center gap-3 p-2 pr-1">
      <button type="button" className="w-14 shrink-0" aria-label={`${cardAriaLabel(c)}. Inspecionar`} onClick={() => onOpen(c.id)}><HoloCard card={c} compact locked={locked} tilt={false} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.name}{n > 0 && <span className="ml-2 rounded-full bg-blue px-2 py-0.5 text-xs">×{n} no baralho</span>}</p>
        <p className="muted truncate text-sm">{RarityLabel[c.rarity].replace(" (fictícia da demo)", "")} — {c.category} — {c.kind === "monster" ? `Nível ${c.level}, ATK ${c.atk}, DEF ${c.def}` : c.kind === "spell" ? "Magia" : "Armadilha"}</p>
      </div>
      <button type="button" className="icon-btn" aria-pressed={fav} aria-label={fav ? `Remover ${c.name} dos favoritos` : `Favoritar ${c.name}`} onClick={() => onFav(c)}><Icon name="star" filled={fav} /></button>
      <button type="button" className="icon-btn" aria-label={`Adicionar ${c.name} ao baralho`} onClick={() => onAdd(c)}><Icon name="plus" /></button>
    </li>
  );
});
