"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCard } from "@/domain/cards/data";
import type { Card, MonsterCard } from "@/domain/cards/schema";
import { chooseAction } from "@/domain/duel/ai";
import { applyAction, createDuel, effectiveAtk, getLegalActions, tributesRequired } from "@/domain/duel/engine";
import { RULES_SCOPE } from "@/domain/duel/scope";
import { STARTING_LP, ZONES, type DuelAction, type DuelEvent, type DuelState, type PlayerId, type Position } from "@/domain/duel/types";
import { MISSIONS, getArea } from "@/domain/progression/data";
import { levelForXp, matchFromDuel, missionProgress, XP_BY_RESULT } from "@/domain/progression/progression";
import { audio } from "@/lib/audio";
import { defaultTributes, sameSet, whyNotSummon } from "@/lib/arena-utils";
import { SUMMON_CINEMATIC_MS } from "@/lib/card-fx";
import { describeEvent } from "@/lib/duel-text";
import { useApp } from "@/store/app-store";
import { CardBack, HoloCard } from "./HoloCard";
import { CardFX, PlayCallout, type PlayInfo } from "./CardPlayFX";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Toast, useToast } from "./Toast";

export interface Session {
  seed: number;
  startedAt: number;
  areaId: string | null;
  playerDeckName: string;
  playerCards: string[];
  opponentName: string;
  opponentDeckName: string;
  opponentCards: string[];
}

type Sel = { kind: "hand"; uid: string } | { kind: "mon"; zone: number } | { kind: "foe"; zone: number } | { kind: "trap"; zone: number } | null;
type Mode =
  | { kind: "summon"; uid: string; position: Position; tributes: number[] }
  | { kind: "trap"; uid: string }
  | { kind: "spell"; uid: string }
  | { kind: "attack"; zone: number }
  | null;

type FxKind = "summon" | "hit" | "destroy" | "trap" | "spell" | "boost" | "attack";
interface ZoneFx { kind: FxKind; nonce: number; cardId?: string; scale: number }
interface Popup { id: number; player: PlayerId; text: string; tone: "dmg" | "heal" }

const FX_COLOR: Record<FxKind, string> = {
  summon: "radial-gradient(circle, rgb(120 180 255 / 0.95), rgb(57 123 255 / 0.5) 40%, transparent 70%)",
  hit: "radial-gradient(circle, rgb(255 255 255 / 0.95), rgb(255 90 110 / 0.6) 40%, transparent 70%)",
  destroy: "radial-gradient(circle, rgb(255 255 255 / 0.9), rgb(140 72 255 / 0.6) 40%, transparent 70%)",
  trap: "radial-gradient(circle, rgb(255 240 190 / 0.95), rgb(214 179 106 / 0.6) 40%, transparent 70%)",
  spell: "radial-gradient(circle, rgb(190 255 230 / 0.9), rgb(80 200 170 / 0.5) 40%, transparent 70%)",
  boost: "radial-gradient(circle, rgb(255 230 150 / 0.9), rgb(255 150 60 / 0.5) 40%, transparent 70%)",
  attack: "radial-gradient(circle, rgb(255 255 255 / 0.6), rgb(57 123 255 / 0.4) 40%, transparent 70%)",
};

const cardOf = (id: string) => getCard(id) as Card;
const monOf = (id: string) => getCard(id) as MonsterCard;

// Three.js só funciona no navegador, então o componente holográfico é
// carregado sem SSR (senão o build do Next.js quebra tentando renderizar no servidor).
const FittedHologram = dynamic(() => import("@/components/Hologram/FittedHologram"), { ssr: false });
const SummonPortalFX = dynamic(() => import("./SummonPortalFX"), { ssr: false });

// Monstros com modelo 3D, ou com este nível ou mais, ganham a cena cinematográfica ao serem invocados.
const CINEMATIC_MIN_LEVEL = 7;

// Cartas que têm modelo 3D holográfico próprio. Pra adicionar outro dragão/monstro
// no futuro, basta colocar o .glb em public/models/ e acrescentar uma linha aqui.
const HOLOGRAM_CARDS: Record<string, { modelPath: string; color: string }> = {
  "dragao-arcano-zefiro": { modelPath: "/models/Ashwing_Drake_Lite.glb", color: "#7fd4ff" },
};

function HologramOverlay({ cardId }: { cardId: string }) {
  const holo = HOLOGRAM_CARDS[cardId];
  if (!holo) return null;
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-[78%] z-20 flex justify-center"
      initial={{ opacity: 0, y: 14, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.6 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      aria-hidden="true"
    >
      <div className="h-32 w-32 sm:h-40 sm:w-40">
        <FittedHologram modelPath={holo.modelPath} color={holo.color} spin quality="mini" />
      </div>
    </motion.div>
  );
}

function motionScale(): number {
  const m = document.documentElement.dataset.motion;
  return m === "off" ? 0 : m === "reduced" ? 0.35 : 1;
}

export function DuelBoard({ session, onExit, onRematch }: { session: Session; onExit: () => void; onRematch: () => void }) {
  const [duel, setDuel] = useState<DuelState>(() =>
    createDuel({ playerDeck: session.playerCards, opponentDeck: session.opponentCards, seed: session.seed, first: session.seed % 2 === 0 ? "player" : "opponent" }),
  );
  const duelRef = useRef(duel);
  const [busy, setBusy] = useState(false);
  const [dispLp, setDispLp] = useState<Record<PlayerId, number>>({ player: STARTING_LP, opponent: STARTING_LP });
  const [zoneFx, setZoneFx] = useState<Record<string, ZoneFx>>({});
  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [played, setPlayed] = useState<PlayInfo | null>(null);
  const clearPlayed = useCallback(() => setPlayed(null), []);
  const [cinematic, setCinematic] = useState<{ id: number; cardId: string; modelPath?: string; color?: string } | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [sel, setSel] = useState<Sel>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [dialog, setDialog] = useState<null | "surrender" | "restart" | "result" | "rules">(null);
  const [outcome, setOutcome] = useState<{ xp: number; levelUp: number | null; missions: string[]; error: string | null } | null>(null);
  const { toast, show } = useToast();

  const queue = useRef<DuelEvent[]>([]);
  const running = useRef(false);
  const skip = useRef(false);
  const mounted = useRef(true);
  const nonce = useRef(0);
  const recorded = useRef(false);
  const logEnd = useRef<HTMLOListElement>(null);

  const recordMatch = useApp((s) => s.recordMatch);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Carrega e processa os modelos 3D e a cena de invocação assim que a arena abre,
  // para não travar (compilação, download, leitura do .glb) na hora da primeira invocação.
  useEffect(() => {
    void import("./SummonPortalFX");
    void import("@/components/Hologram/FittedHologram").then((m) => Object.values(HOLOGRAM_CARDS).forEach((h) => m.preloadHologram(h.modelPath)));
  }, []);

  const wait = (ms: number) => new Promise<void>((res) => {
    const scale = skip.current ? 0 : motionScale();
    if (scale === 0 || ms === 0) res();
    else window.setTimeout(res, ms * scale);
  });

  const fx = (key: string, kind: FxKind, cardId?: string) =>
    setZoneFx((z) => ({ ...z, [key]: { kind, nonce: ++nonce.current, cardId, scale: motionScale() } }));
  const sfx = audio.sfx.bind(audio);

  const playEvent = useCallback(async (e: DuelEvent) => {
    const text = describeEvent(e);
    if (e.kind === "turn_start") { setBanner(e.player === "player" ? "Seu turno" : "Turno do oponente"); await wait(550); setBanner(null); return; }
    switch (e.kind) {
      case "draw": if (!e.initial) { sfx("ui"); await wait(110); } break;
      case "summon": {
        const raw = "cardId" in e ? e.cardId : undefined;
        const cardId = typeof raw === "string" ? raw : duelRef.current.players[e.player].monsters[e.zone]?.cardId;
        const big = cardId ? cardOf(cardId) : null;
        const holo = cardId ? HOLOGRAM_CARDS[cardId] : undefined;
        const isCine = !!big && !!cardId && motionScale() === 1 && (!!holo || (big.kind === "monster" && big.level >= CINEMATIC_MIN_LEVEL));
        if (isCine && cardId) {
          setCinematic({ id: ++nonce.current, cardId, modelPath: holo?.modelPath, color: holo?.color });
          sfx("summon");
          await wait(SUMMON_CINEMATIC_MS);
          setCinematic(null);
        } else sfx("summon");
        fx(`${e.player}-m-${e.zone}`, "summon", cardId);
        if (cardId && !isCine) setPlayed({ id: ++nonce.current, player: e.player, cardId, label: "Invocação", scale: motionScale() });
        if (big && big.kind === "monster" && big.level >= 5 && motionScale() > 0) {
          await wait(300);
          setCamera({ x: 0, y: 7, scale: 1.02 });
          await wait(140);
          setCamera({ x: 0, y: 0, scale: 1 });
          await wait(240);
        } else await wait(480);
        break;
      }
      case "set_trap": fx(`${e.player}-st-${e.zone}`, "summon"); sfx("ui"); await wait(220); break;
      case "spell":
        setPlayed({ id: ++nonce.current, player: e.player, cardId: e.cardId, label: "Magia", scale: motionScale() });
        setBanner(`${e.player === "player" ? "Você ativou" : "O oponente ativou"} ${cardOf(e.cardId).name}`); sfx("spell"); await wait(650); setBanner(null); break;
      case "trap":
        setPlayed({ id: ++nonce.current, player: e.player, cardId: e.cardId, label: "Armadilha", scale: motionScale() });
        setBanner(`Armadilha: ${cardOf(e.cardId).name}`); fx(`${e.player}-st-${e.zone}`, "trap"); sfx("trap"); await wait(700); setBanner(null); break;
      case "position": fx(`${e.player}-m-${e.zone}`, "boost"); sfx("ui"); await wait(220); break;
      case "attack": {
        fx(`${e.player}-m-${e.attackerZone}`, "attack");
        if (motionScale() > 0) setCamera({ x: 0, y: e.player === "player" ? -10 : 10, scale: 1.035 });
        sfx("attack"); await wait(480); break;
      }
      case "attack_negated": setBanner("Ataque anulado"); await wait(380); setBanner(null); break;
      case "battle": {
        if (e.targetZone !== null) fx(`${e.player === "player" ? "opponent" : "player"}-m-${e.targetZone}`, "hit");
        sfx("hit"); await wait(360); break;
      }
      case "destroyed": fx(`${e.player}-m-${e.zone}`, "destroy"); await wait(320); break;
      case "atk_boost": fx(`${e.player}-m-${e.zone}`, "boost"); await wait(260); break;
      case "lp": {
        setDispLp((l) => ({ ...l, [e.player]: e.value }));
        setPopups((p) => [...p, { id: ++nonce.current, player: e.player, text: `${e.delta > 0 ? "+" : "−"}${Math.abs(e.delta)}`, tone: e.delta > 0 ? "heal" : "dmg" }]);
        if (e.delta > 0) sfx("heal");
        await wait(420); break;
      }
      case "duel_end": sfx(e.winner === "player" ? "win" : e.winner === "draw" ? "ui" : "lose"); await wait(300); break;
      default: if (text) await wait(60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registro da partida: só depois que o motor encerrou o duelo e as animações terminaram.
  const finalize = useCallback(() => {
    const duelNow = duelRef.current;
    if (duelNow.status !== "finished" || recorded.current) return;
    recorded.current = true;
    const profileBefore = useApp.getState().profile;
    const rec = matchFromDuel(duelNow, { id: `${session.seed}-${session.startedAt}`, areaId: session.areaId, playerDeck: session.playerDeckName, opponentDeck: session.opponentDeckName });
    const fail = (error: string) => { setOutcome({ xp: 0, levelUp: null, missions: [], error }); setDialog("result"); };
    if (!rec.ok) return fail(rec.error);
    const r = recordMatch(rec.value);
    if (!r.ok) return fail(r.error);
    const before = levelForXp(profileBefore.xp), after = levelForXp(r.value.xp);
    const done = MISSIONS.filter((m) => m.areaId === session.areaId && !r.value.claimedMissions.includes(m.id) && missionProgress(m, r.value).done).map((m) => m.title);
    setOutcome({ xp: XP_BY_RESULT[rec.value.result], levelUp: after > before ? after : null, missions: done, error: null });
    setDialog("result");
  }, [session, recordMatch]);

  const runQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    while (queue.current.length && mounted.current) {
      const e = queue.current.shift()!;
      await playEvent(e);
    }
    if (mounted.current) {
      setCamera({ x: 0, y: 0, scale: 1 });
      setPopups([]);
      setBusy(false);
      finalize();
    }
    running.current = false;
    skip.current = false;
  }, [playEvent, finalize]);

  const dispatch = useCallback((action: DuelAction): boolean => {
    const r = applyAction(duelRef.current, action);
    if (!r.ok) { show(r.error.message, "error"); audio.sfx("error"); return false; }
    duelRef.current = r.state;
    setDuel(r.state);
    queue.current.push(...r.events);
    void runQueue();
    setSel(null);
    setMode(null);
    return true;
  }, [runQueue, show]);

  // oponente automatizado: decide a partir do estado atual e usa o mesmo motor
  useEffect(() => {
    if (duel.status !== "playing" || duel.active !== "opponent" || busy) return;
    const t = window.setTimeout(() => {
      const state = duelRef.current;
      if (state.status !== "playing" || state.active !== "opponent") return;
      dispatch(chooseAction(state, "opponent"));
    }, 250 + motionScale() * 450);
    return () => window.clearTimeout(t);
  }, [duel, busy, dispatch]);

  useEffect(() => { logEnd.current?.scrollTo({ top: logEnd.current.scrollHeight }); }, [duel.log.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMode(null); setSel(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const me = duel.players.player;
  const foe = duel.players.opponent;
  const myTurn = duel.active === "player" && duel.status === "playing";
  const canAct = myTurn && !busy;
  const legal = useMemo(() => (canAct ? getLegalActions(duel, "player") : []), [duel, canAct]);

  /* ----------------------------- hints por modo ----------------------------- */
  const hints = useMemo(() => {
    const own = new Set<number>(), enemy = new Set<number>(), st = new Set<number>();
    if (!mode) return { own, enemy, st };
    for (const a of legal) {
      if (mode.kind === "summon" && a.type === "summon" && a.handUid === mode.uid && a.position === mode.position && sameSet(a.tributeZones, mode.tributes)) own.add(a.zone);
      if (mode.kind === "trap" && a.type === "set_trap" && a.handUid === mode.uid) st.add(a.zone);
      if (mode.kind === "spell" && a.type === "activate_spell" && a.handUid === mode.uid && a.targetZone !== undefined) {
        const card = me.hand.find((h) => h.uid === mode.uid);
        const eff = card ? (cardOf(card.cardId) as Extract<Card, { kind: "spell" }>).effect.type : "";
        (eff === "destroy_monster" ? enemy : own).add(a.targetZone);
      }
      if (mode.kind === "attack" && a.type === "attack" && a.attackerZone === mode.zone && a.targetZone !== null) enemy.add(a.targetZone);
    }
    return { own, enemy, st };
  }, [legal, mode, me.hand]);

  const needTribute = mode?.kind === "summon" ? tributesRequired(monOf(me.hand.find((h) => h.uid === mode.uid)?.cardId ?? "").level) : 0;

  /* ------------------------------- interações ------------------------------- */
  const startSummon = (uid: string, position: Position) => {
    const inst = me.hand.find((h) => h.uid === uid)!;
    const need = tributesRequired(monOf(inst.cardId).level);
    setMode({ kind: "summon", uid, position, tributes: defaultTributes(duel, "player", need) });
    audio.sfx("ui");
  };

  const onMonsterZone = (side: PlayerId, zone: number) => {
    const slot = duel.players[side].monsters[zone];
    if (side === "player") {
      if (mode?.kind === "summon") {
        if (hints.own.has(zone)) { dispatch({ type: "summon", player: "player", handUid: mode.uid, zone, position: mode.position, tributeZones: mode.tributes }); return; }
        if (needTribute > 0 && slot) {
          const has = mode.tributes.includes(zone);
          const next = has ? mode.tributes.filter((z) => z !== zone) : [...mode.tributes, zone].slice(-needTribute);
          setMode({ ...mode, tributes: next });
          return;
        }
        show("Essa zona não está disponível para a invocação.", "error");
        return;
      }
      if (mode?.kind === "spell" && hints.own.has(zone)) { dispatch({ type: "activate_spell", player: "player", handUid: mode.uid, targetZone: zone }); return; }
      if (slot) { setSel({ kind: "mon", zone }); setMode(null); audio.sfx("select"); }
      return;
    }
    if (mode?.kind === "attack" && hints.enemy.has(zone)) { dispatch({ type: "attack", player: "player", attackerZone: mode.zone, targetZone: zone }); return; }
    if (mode?.kind === "spell" && hints.enemy.has(zone)) { dispatch({ type: "activate_spell", player: "player", handUid: mode.uid, targetZone: zone }); return; }
    if (slot) { setSel({ kind: "foe", zone }); setMode(null); audio.sfx("select"); }
  };

  const onTrapZone = (side: PlayerId, zone: number) => {
    if (side !== "player") return;
    if (mode?.kind === "trap" && hints.st.has(zone)) { dispatch({ type: "set_trap", player: "player", handUid: mode.uid, zone }); return; }
    if (me.spellTraps[zone]) { setSel({ kind: "trap", zone }); setMode(null); }
  };

  const has = (pred: (a: DuelAction) => boolean) => legal.some(pred);
  const can = {
    battle: canAct && has((a) => a.type === "advance_phase"),
    end: canAct && has((a) => a.type === "end_turn"),
  };

  /* --------------------------------- painel --------------------------------- */
  const selCard: Card | null = sel
    ? sel.kind === "hand" ? (me.hand.find((h) => h.uid === sel.uid) ? cardOf(me.hand.find((h) => h.uid === sel.uid)!.cardId) : null)
      : sel.kind === "mon" ? (me.monsters[sel.zone] ? cardOf(me.monsters[sel.zone]!.cardId) : null)
      : sel.kind === "foe" ? (foe.monsters[sel.zone] ? cardOf(foe.monsters[sel.zone]!.cardId) : null)
      : (me.spellTraps[sel.zone] ? cardOf(me.spellTraps[sel.zone]!.cardId) : null)
    : null;

  const panelActions = () => {
    if (!sel || !selCard) return null;
    if (sel.kind === "hand") {
      if (selCard.kind === "monster") {
        const why = whyNotSummon(duel, selCard, "player");
        const ok = (pos: Position) => has((a) => a.type === "summon" && a.handUid === sel.uid && a.position === pos);
        return (<>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canAct || !ok("attack")} onClick={() => startSummon(sel.uid, "attack")}>Invocar em ataque</button>
          <button type="button" className="btn btn-sm" disabled={!canAct || !ok("defense")} onClick={() => startSummon(sel.uid, "defense")}>Invocar em defesa</button>
          {tributesRequired(selCard.level) > 0 && <p className="muted w-full text-xs">Exige {tributesRequired(selCard.level)} tributo{tributesRequired(selCard.level) > 1 ? "s" : ""}.</p>}
          {why && <p className="w-full text-xs text-gold">{why}</p>}
        </>);
      }
      if (selCard.kind === "trap") {
        const ok = has((a) => a.type === "set_trap" && a.handUid === sel.uid);
        return (<>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canAct || !ok} onClick={() => { setMode({ kind: "trap", uid: sel.uid }); audio.sfx("ui"); }}>Baixar armadilha</button>
          {!ok && <p className="w-full text-xs text-gold">{!myTurn ? "Aguarde o seu turno." : duel.phase !== "main" ? "Só na fase principal." : "Sem zona livre."}</p>}
        </>);
      }
      const needsTarget = selCard.effect.type === "destroy_monster" || selCard.effect.type === "boost_atk";
      const ok = has((a) => a.type === "activate_spell" && a.handUid === sel.uid);
      return (<>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canAct || !ok} onClick={() => { if (needsTarget) { setMode({ kind: "spell", uid: sel.uid }); audio.sfx("ui"); } else dispatch({ type: "activate_spell", player: "player", handUid: sel.uid }); }}>Ativar magia</button>
        {!ok && <p className="w-full text-xs text-gold">{!myTurn ? "Aguarde o seu turno." : duel.phase !== "main" ? "Só na fase principal." : selCard.effect.type === "destroy_monster" ? "O oponente não tem monstros." : selCard.effect.type === "boost_atk" ? "Você não tem monstros." : "Baralho sem cartas suficientes."}</p>}
      </>);
    }
    if (sel.kind === "mon") {
      const slot = me.monsters[sel.zone]!;
      const attacks = legal.filter((a) => a.type === "attack" && a.attackerZone === sel.zone);
      const direct = attacks.some((a) => a.type === "attack" && a.targetZone === null);
      const canPos = has((a) => a.type === "change_position" && a.zone === sel.zone);
      return (<>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canAct || attacks.length === 0} onClick={() => { if (direct) dispatch({ type: "attack", player: "player", attackerZone: sel.zone, targetZone: null }); else { setMode({ kind: "attack", zone: sel.zone }); audio.sfx("ui"); } }}>{direct ? "Atacar diretamente" : "Atacar"}</button>
        <button type="button" className="btn btn-sm" disabled={!canAct || !canPos} onClick={() => dispatch({ type: "change_position", player: "player", zone: sel.zone })}>Mudar para {slot.position === "attack" ? "defesa" : "ataque"}</button>
        {attacks.length === 0 && <p className="w-full text-xs text-gold">{!myTurn ? "Aguarde o seu turno." : duel.phase !== "battle" ? "Ataques só na fase de batalha." : duel.turn === 1 ? "O primeiro jogador não ataca no turno 1." : slot.hasAttacked ? "Este monstro já atacou." : slot.position !== "attack" ? "Só monstros em ataque podem atacar." : "Sem alvos."}</p>}
      </>);
    }
    return null;
  };

  const modeText = mode?.kind === "summon"
    ? needTribute > 0 ? `Escolha ${needTribute} tributo${needTribute > 1 ? "s" : ""} tocando nos seus monstros (${mode.tributes.length}/${needTribute}) e depois a zona destacada.` : "Toque numa zona de monstro destacada."
    : mode?.kind === "trap" ? "Toque numa zona de magia/armadilha destacada."
    : mode?.kind === "spell" ? "Escolha o alvo destacado."
    : mode?.kind === "attack" ? "Escolha o monstro do oponente a atacar." : null;

  const phaseNow = duel.phase;
  const resultText = duel.winner === "player" ? "Vitória" : duel.winner === "draw" ? "Empate" : "Derrota";
  const why = duel.endReason === "lp" ? "Pontos de vida zerados." : duel.endReason === "deck_out" ? "Baralho esgotado na compra." : duel.endReason === "surrender" ? "Rendição." : "";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl">{session.areaId ? getArea(session.areaId)?.name : "Duelo livre"}</h1>
          <p className="muted text-sm">Você ({session.playerDeckName}) contra {session.opponentName} ({session.opponentDeckName}). Semente {session.seed}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setDialog("rules")}><Icon name="info" size={16} /> Regras suportadas</button>
          {duel.status === "playing" ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDialog("surrender")}><Icon name="flag" size={16} /> Render-se</button> : <button type="button" className="btn btn-sm" onClick={() => setDialog("result")}>Ver resultado</button>}
          <button type="button" className="btn btn-sm" onClick={() => setDialog("restart")}>Reiniciar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <PhaseBar turn={duel.turn} myTurn={myTurn} finished={duel.status === "finished"} phase={phaseNow} busy={busy}
            onBattle={() => dispatch({ type: "advance_phase", player: "player" })} onEnd={() => dispatch({ type: "end_turn", player: "player" })} canBattle={can.battle} canEnd={can.end}
            onSkip={() => { skip.current = true; }} />

          <motion.div className="board-tilt relative mt-3 rounded-2xl border border-edge bg-[radial-gradient(ellipse_at_50%_50%,rgb(57_123_255/0.12),transparent_65%)] p-2 sm:p-3" animate={camera} transition={{ duration: 0.25 }}>
            <LpRow label={session.opponentName} lp={dispLp.opponent} tone="opp" popups={popups.filter((p) => p.player === "opponent")} deck={foe.deck.length} grave={foe.graveyard.length} />
            <div className="my-2 flex items-center gap-1" aria-label={`Mão do oponente: ${foe.hand.length} cartas`}>
              <span className="muted mr-2 text-xs">Mão</span>
              {foe.hand.slice(0, 10).map((h) => <CardBack key={h.uid} className="!w-6 sm:!w-8" />)}
            </div>

            <Row label="Zonas de magia e armadilha do oponente">
              {Array.from({ length: ZONES }, (_, z) => (
                <ZoneBtn key={z} kind="st" label={`Zona de armadilha ${z + 1} do oponente: ${foe.spellTraps[z] ? "carta virada para baixo" : "vazia"}`} fx={zoneFx[`opponent-st-${z}`]}>
                  {foe.spellTraps[z] && <CardBack />}
                </ZoneBtn>
              ))}
            </Row>
            <Row label="Zonas de monstro do oponente">
              {Array.from({ length: ZONES }, (_, z) => {
                const m = foe.monsters[z];
                const c = m ? monOf(m.cardId) : null;
                return (
                  <ZoneBtn key={z} kind="m" hint={hints.enemy.has(z)} selected={sel?.kind === "foe" && sel.zone === z} fx={zoneFx[`opponent-m-${z}`]} onClick={() => onMonsterZone("opponent", z)} disabled={!m && !hints.enemy.has(z)}
                    label={c ? `${c.name} do oponente, ${m!.position === "attack" ? "ataque" : "defesa"}, ATK ${effectiveAtk(m!, c)}, DEF ${c.def}. ${hints.enemy.has(z) ? "Alvo válido." : "Inspecionar."}` : `Zona de monstro ${z + 1} do oponente: vazia`} defense={m?.position === "defense"}>
                    {m && c && (
                      <>
                        <HoloCard card={c} compact tilt={false} />
                        <AnimatePresence>{<HologramOverlay cardId={c.id} />}</AnimatePresence>
                      </>
                    )}
                  </ZoneBtn>
                );
              })}
            </Row>

            <div className="my-2 grid place-items-center">
              <p className={`rounded-full border px-4 py-1 text-sm ${mode ? "border-gold text-gold" : "border-edge text-mute"}`} role="status" aria-live="polite">
                {modeText ?? (busy ? "Resolvendo ações…" : myTurn ? (duel.phase === "main" ? "Fase principal: sua vez de agir." : "Fase de batalha: escolha um atacante.") : duel.status === "finished" ? resultText : "Turno do oponente…")}
              </p>
            </div>

            <Row label="Zonas de monstro do jogador">
              {Array.from({ length: ZONES }, (_, z) => {
                const m = me.monsters[z];
                const c = m ? monOf(m.cardId) : null;
                return (
                  <ZoneBtn key={z} kind="m" hint={hints.own.has(z)} tribute={mode?.kind === "summon" && mode.tributes.includes(z)} selected={sel?.kind === "mon" && sel.zone === z} fx={zoneFx[`player-m-${z}`]}
                    onClick={() => onMonsterZone("player", z)} disabled={!m && !hints.own.has(z)} defense={m?.position === "defense"}
                    label={c ? `${c.name}, ${m!.position === "attack" ? "ataque" : "defesa"}, ATK ${effectiveAtk(m!, c)}, DEF ${c.def}${m!.hasAttacked ? ", já atacou" : ""}` : `Zona de monstro ${z + 1} sua: vazia${hints.own.has(z) ? ", destino válido" : ""}`}>
                    {m && c && (
                      <>
                        <HoloCard card={c} compact tilt={false} badge={m.atkBonus > 0 ? <span className="rounded bg-gold px-1 text-[10px] font-bold text-black">+{m.atkBonus}</span> : undefined} />
                        <AnimatePresence>{<HologramOverlay cardId={c.id} />}</AnimatePresence>
                      </>
                    )}
                  </ZoneBtn>
                );
              })}
            </Row>
            <Row label="Zonas de magia e armadilha do jogador">
              {Array.from({ length: ZONES }, (_, z) => {
                const t = me.spellTraps[z];
                return (
                  <ZoneBtn key={z} kind="st" hint={hints.st.has(z)} selected={sel?.kind === "trap" && sel.zone === z} fx={zoneFx[`player-st-${z}`]} onClick={() => onTrapZone("player", z)} disabled={!t && !hints.st.has(z)}
                    label={t ? `Armadilha baixada: ${cardOf(t.cardId).name}` : `Zona de armadilha ${z + 1} sua: vazia${hints.st.has(z) ? ", destino válido" : ""}`}>
                    {t && <div className="opacity-80"><HoloCard card={cardOf(t.cardId)} compact tilt={false} /></div>}
                  </ZoneBtn>
                );
              })}
            </Row>
            <LpRow label="Você" lp={dispLp.player} tone="me" popups={popups.filter((p) => p.player === "player")} deck={me.deck.length} grave={me.graveyard.length} />

            <AnimatePresence>{played && <PlayCallout key={played.id} play={played} onDone={clearPlayed} />}</AnimatePresence>

            <AnimatePresence>
              {banner && (
                <motion.div key={banner} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center" aria-hidden="true">
                  <span className="font-display inline-block rounded-xl border border-gold/60 bg-abyss/90 px-6 py-3 text-xl shadow-2xl">{banner}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <section aria-label="Sua mão" className="mt-3">
            <h2 className="muted mb-2 text-sm">Sua mão ({me.hand.length})</h2>
            <div className="hand-grid">
              {me.hand.map((h) => {
                const c = cardOf(h.cardId);
                const selected = sel?.kind === "hand" && sel.uid === h.uid;
                const label = `${c.name}${c.kind === "monster" ? `, nível ${c.level}, ATK ${c.atk}, DEF ${c.def}` : c.kind === "spell" ? ", magia" : ", armadilha"}`;
                return (
                  <button key={h.uid} type="button" aria-pressed={selected} aria-label={`${label}. Selecionar`} className={`rounded-[6%] transition ${selected ? "-translate-y-2 ring-2 ring-blue" : ""}`} onClick={() => { setSel({ kind: "hand", uid: h.uid }); setMode(null); audio.sfx("select"); }}>
                    <HoloCard card={c} compact />
                  </button>
                );
              })}
              {me.hand.length === 0 && <p className="muted col-span-full text-sm">Sem cartas na mão.</p>}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section aria-label="Carta selecionada" className="panel p-3">
            <h2 className="mb-2 text-base">Carta selecionada</h2>
            {selCard ? (
              <div className="grid grid-cols-[96px_1fr] gap-3">
                <HoloCard card={selCard} staticHolo />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{selCard.name}</p>
                  <p className="muted text-xs">{selCard.kind === "monster" ? `Nível ${selCard.level}, ATK ${selCard.atk}, DEF ${selCard.def}` : selCard.kind === "spell" ? "Magia" : "Armadilha"}</p>
                  <p className="mt-1 text-xs leading-relaxed">{selCard.text}</p>
                </div>
                <div className="col-span-2 flex flex-wrap gap-2">{panelActions()}</div>
              </div>
            ) : <p className="muted text-sm">Toque numa carta da mão ou do campo para ver detalhes e as ações permitidas.</p>}
            {mode && <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setMode(null)}>Cancelar ação (Esc)</button>}
          </section>

          <section aria-label="Histórico de ações" className="panel p-3">
            <h2 className="mb-2 flex items-center gap-2 text-base"><Icon name="history" size={18} /> Histórico</h2>
            <ol ref={logEnd} className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
              {duel.log.map((e) => ({ e, t: describeEvent(e) })).filter((x) => x.t).map(({ e, t }) => <li key={e.seq} className={e.kind === "turn_start" ? "mt-2 font-semibold text-gold" : "muted"}>{t}</li>)}
            </ol>
          </section>
        </aside>
      </div>

      <Modal open={dialog === "surrender"} title="Render-se?" onClose={() => setDialog(null)}>
        <p className="muted mb-5 text-sm">Você perde o duelo e recebe só uma fração da experiência.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setDialog(null)}>Continuar duelando</button><button type="button" className="btn btn-danger" onClick={() => { setDialog(null); dispatch({ type: "surrender", player: "player" }); }}>Render-se</button></div>
      </Modal>
      <Modal open={dialog === "restart"} title="Reiniciar o duelo?" onClose={() => setDialog(null)}>
        <p className="muted mb-5 text-sm">{duel.status === "playing" ? "O duelo atual será descartado sem registro. Um novo duelo começa com outra semente." : "Um novo duelo começa com os mesmos baralhos e outra semente."}</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setDialog(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => { setDialog(null); onRematch(); }}>Reiniciar</button></div>
      </Modal>
      <Modal open={dialog === "rules"} title="Escopo das regras suportadas" onClose={() => setDialog(null)} size="lg">
        <h3 className="mb-1 text-base">Implementado</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">{RULES_SCOPE.supported.map((r) => <li key={r}>{r}</li>)}</ul>
        <h3 className="mb-1 text-base">Ainda não implementado</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{RULES_SCOPE.unsupported.map((r) => <li key={r}>{r}</li>)}</ul>
      </Modal>
      <Modal open={dialog === "result"} title={outcome?.error ? "Duelo encerrado" : resultText} onClose={() => setDialog(null)}>
        <p className="muted mb-3 text-sm">{why}</p>
        {outcome?.error ? <p className="mb-3 rounded-lg border border-danger/50 bg-[#2a1118] p-3 text-sm text-[#ffd3d9]">O resultado não foi registrado: {outcome.error}</p> : outcome && (
          <ul className="mb-4 grid gap-1 text-sm">
            <li>Experiência recebida: <strong>+{outcome.xp}</strong></li>
            {outcome.levelUp && <li className="text-gold">Você subiu para o nível {outcome.levelUp}.</li>}
            {outcome.missions.map((m) => <li key={m} className="text-ok">Missão concluída: {m}. Resgate a recompensa no Mundo.</li>)}
          </ul>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/world" className="btn">Ir ao Mundo</Link>
          <button type="button" className="btn" onClick={onExit}>Trocar baralho ou área</button>
          <button type="button" className="btn btn-primary" onClick={() => { setDialog(null); onRematch(); }}>Jogar de novo</button>
        </div>
      </Modal>
      <AnimatePresence>
        {cinematic && <SummonPortalFX key={cinematic.id} cardId={cinematic.cardId} modelPath={cinematic.modelPath} color={cinematic.color} />}
      </AnimatePresence>
      <Toast toast={toast} />
    </div>
  );
}

function PhaseBar({ turn, myTurn, finished, phase, busy, canBattle, canEnd, onBattle, onEnd, onSkip }: { turn: number; myTurn: boolean; finished: boolean; phase: "main" | "battle"; busy: boolean; canBattle: boolean; canEnd: boolean; onBattle: () => void; onEnd: () => void; onSkip: () => void }) {
  const pills = [{ k: "draw", l: "Compra" }, { k: "main", l: "Principal" }, { k: "battle", l: "Batalha" }, { k: "end", l: "Final" }];
  return (
    <div className="panel flex flex-wrap items-center gap-2 p-2 sm:p-3">
      <p className="mr-2 text-sm"><span className="font-semibold">Turno {turn}</span> <span className="muted">{finished ? "encerrado" : myTurn ? "sua vez" : "vez do oponente"}</span></p>
      <ol className="flex gap-1" aria-label="Fases do turno">
        {pills.map((p) => <li key={p.k} aria-current={!finished && myTurn && p.k === phase ? "step" : undefined} className={`rounded-full border px-2.5 py-1 text-xs ${!finished && myTurn && p.k === phase ? "border-gold bg-gold/15 text-gold" : "border-edge text-mute"}`}>{p.l}</li>)}
      </ol>
      <div className="ml-auto flex gap-2">
        {busy && <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}><Icon name="skip" size={16} /> Pular animações</button>}
        <button type="button" className="btn btn-sm" disabled={!canBattle} onClick={onBattle}>Ir para a batalha</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!canEnd} onClick={onEnd}>Encerrar turno</button>
      </div>
    </div>
  );
}

function LpRow({ label, lp, tone, popups, deck, grave }: { label: string; lp: number; tone: "me" | "opp"; popups: Popup[]; deck: number; grave: number }) {
  return (
    <div className="relative my-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="muted text-xs">Baralho {deck} · Cemitério {grave}</span>
        <span className="font-display text-lg tabular-nums" aria-label={`${lp} pontos de vida`}>{lp} PV</span>
      </div>
      <div className="lp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STARTING_LP} aria-valuenow={Math.min(lp, STARTING_LP)} aria-label={`Pontos de vida de ${label}`}>
        <div className="lp-fill" style={{ width: `${Math.min(100, (lp / STARTING_LP) * 100)}%`, background: tone === "me" ? "linear-gradient(90deg,#397bff,#6fa0ff)" : "linear-gradient(90deg,#8c48ff,#c08cff)" }} />
      </div>
      <AnimatePresence>
        {popups.map((p) => (
          <motion.span key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: -18 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className={`pointer-events-none absolute right-2 top-0 text-xl font-bold ${p.tone === "dmg" ? "text-danger" : "text-ok"}`} aria-hidden="true">{p.text}</motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label} className="mx-auto my-1.5 grid max-w-[500px] grid-cols-5 gap-1.5 sm:gap-2">{children}</div>;
}

function ZoneBtn({ kind, label, hint, selected, tribute, fx, onClick, disabled, defense, children }: { kind: "m" | "st"; label: string; hint?: boolean; selected?: boolean; tribute?: boolean; fx?: ZoneFx; onClick?: () => void; disabled?: boolean; defense?: boolean; children?: React.ReactNode }) {
  return (
    <button type="button" className={`zone ${defense ? "zone-pos-def" : ""}`} data-kind={kind} data-hint={hint ? "true" : undefined} data-selected={selected ? "true" : undefined} data-tribute={tribute ? "true" : undefined} aria-label={label} onClick={onClick} disabled={disabled || !onClick}>
      {children}
      <AnimatePresence>
        {fx && fx.scale > 0 && (fx.kind === "summon" && fx.cardId
          ? <CardFX key={fx.nonce} cardId={fx.cardId} scale={fx.scale} />
          : <motion.span key={fx.nonce} className="fx-burst z-10" style={{ background: FX_COLOR[fx.kind] }} initial={{ opacity: 0.95, scale: 0.3 }} animate={{ opacity: 0, scale: 1.5 }} transition={{ duration: 0.55 }} aria-hidden="true" />)}
      </AnimatePresence>
    </button>
  );
}
