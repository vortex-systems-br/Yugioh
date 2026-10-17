import { create } from "zustand";
import { z } from "zod";
import { kvClear, kvGet, kvSet } from "@/lib/storage";
import { DeckSchema, DEFAULT_FORMAT_ID, newDeck, type Deck } from "@/domain/decks/rules";
import { claimMission, emptyProfile, ProfileSchema, recordMatch, type MatchRecord, type Profile, type Result } from "@/domain/progression/progression";

export const SettingsSchema = z.object({
  introSeen: z.boolean().default(false),
  motion: z.enum(["auto", "full", "reduced", "off"]).default("auto"),
  quality: z.enum(["auto", "high", "low"]).default("auto"),
  musicOn: z.boolean().default(false),
  sfxOn: z.boolean().default(true),
  musicVolume: z.number().min(0).max(1).default(0.4),
  sfxVolume: z.number().min(0).max(1).default(0.7),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const defaultSettings = (): Settings => SettingsSchema.parse({});

interface AppState {
  hydrated: boolean;
  settings: Settings;
  favorites: string[];
  decks: Deck[];
  activeDeckId: string | null;
  profile: Profile;
  savedAt: number | null;

  hydrate: () => Promise<void>;
  setSettings: (patch: Partial<Settings>) => void;
  toggleFavorite: (cardId: string) => void;
  createDeck: (name: string, formatId?: string) => Deck;
  updateDeck: (id: string, fn: (d: Deck) => Deck) => void;
  renameDeck: (id: string, name: string) => void;
  duplicateDeck: (id: string) => Deck | null;
  deleteDeck: (id: string) => void;
  addImportedDeck: (deck: Deck) => void;
  setActiveDeck: (id: string | null) => void;
  recordMatch: (rec: MatchRecord) => Result<Profile>;
  claimMission: (id: string) => Result<Profile>;
  resetAll: () => Promise<void>;
}

const KEYS = ["settings", "favorites", "decks", "activeDeckId", "profile"] as const;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistArmed = false;

async function persistNow() {
  const s = useApp.getState();
  if (!s.hydrated) return;
  await Promise.all([
    kvSet("settings", s.settings), kvSet("favorites", s.favorites), kvSet("decks", s.decks),
    kvSet("activeDeckId", s.activeDeckId), kvSet("profile", s.profile),
  ]);
  useApp.setState({ savedAt: Date.now() });
}

/** Grava imediatamente o que está pendente (usado em testes e antes de sair da página). */
export async function flushPersist() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  await persistNow();
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { persistTimer = null; void persistNow(); }, 250);
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  settings: defaultSettings(),
  favorites: [],
  decks: [],
  activeDeckId: null,
  profile: emptyProfile(),
  savedAt: null,

  async hydrate() {
    if (get().hydrated) return;
    const [settings, favorites, decks, activeDeckId, profile] = await Promise.all(KEYS.map((k) => kvGet<unknown>(k)));
    const parsedDecks = z.array(DeckSchema).safeParse(decks);
    const parsedProfile = ProfileSchema.safeParse(profile);
    const favs = z.array(z.string()).safeParse(favorites);
    const deckList = parsedDecks.success ? parsedDecks.data : [];
    const active = typeof activeDeckId === "string" && deckList.some((d) => d.id === activeDeckId) ? activeDeckId : deckList[0]?.id ?? null;
    set({
      hydrated: true,
      settings: SettingsSchema.catch(defaultSettings()).parse(settings ?? {}),
      favorites: favs.success ? favs.data : [],
      decks: deckList,
      activeDeckId: active,
      profile: parsedProfile.success ? parsedProfile.data : emptyProfile(),
    });
    if (!persistArmed) {
      persistArmed = true;
      useApp.subscribe((state, prev) => {
        if (!state.hydrated) return;
        if (KEYS.some((k) => state[k] !== prev[k])) schedulePersist();
      });
    }
  },

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  toggleFavorite: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),

  createDeck(name, formatId = DEFAULT_FORMAT_ID) {
    const deck = newDeck(name, formatId);
    set((s) => ({ decks: [...s.decks, deck], activeDeckId: deck.id }));
    return deck;
  },
  updateDeck: (id, fn) => set((s) => ({ decks: s.decks.map((d) => (d.id === id ? { ...fn(d), id: d.id } : d)) })),
  renameDeck(id, name) {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    get().updateDeck(id, (d) => ({ ...d, name: clean, updatedAt: Date.now() }));
  },
  duplicateDeck(id) {
    const src = get().decks.find((d) => d.id === id);
    if (!src) return null;
    const copy = { ...newDeck(`${src.name} (cópia)`.slice(0, 40), src.formatId), main: src.main, extra: src.extra, side: src.side };
    set((s) => ({ decks: [...s.decks, copy], activeDeckId: copy.id }));
    return copy;
  },
  deleteDeck: (id) => set((s) => {
    const decks = s.decks.filter((d) => d.id !== id);
    return { decks, activeDeckId: s.activeDeckId === id ? decks[0]?.id ?? null : s.activeDeckId };
  }),
  addImportedDeck: (deck) => set((s) => ({ decks: [...s.decks, deck], activeDeckId: deck.id })),
  setActiveDeck: (id) => set({ activeDeckId: id }),

  recordMatch(rec) {
    const r = recordMatch(get().profile, rec);
    if (r.ok) set({ profile: r.value });
    return r;
  },
  claimMission(id) {
    const r = claimMission(get().profile, id);
    if (r.ok) set({ profile: r.value });
    return r;
  },
  async resetAll() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    await kvClear();
    set({ settings: { ...defaultSettings(), introSeen: true }, favorites: [], decks: [], activeDeckId: null, profile: emptyProfile() });
    await persistNow();
  },
}));
