"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { answerLocal, tipFor } from "@/domain/guide/guide";
import { Icon } from "./Icon";

type Mood = "idle" | "thinking" | "speaking";
interface Msg { from: "guide" | "you"; text: string }

const SUGGESTIONS = ["Como funcionam os tributos?", "Quais regras existem?", "Formatos de baralho", "Como ganho recompensas?"];

function Orb({ mood, size = 44 }: { mood: Mood; size?: number }) {
  return (
    <span className="guide-orb inline-grid place-items-center" data-state={mood} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <defs><radialGradient id="gorb" cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#b48cff" /><stop offset="1" stopColor="#2c1a66" /></radialGradient></defs>
        <circle cx="24" cy="24" r="21" fill="url(#gorb)" stroke="#d6b36a" strokeWidth="1.5" />
        <g className="guide-ring" fill="none" stroke="#d6b36a" strokeWidth="1" opacity=".7"><circle cx="24" cy="24" r="17" strokeDasharray="4 5" /></g>
        <g className="guide-eye"><ellipse cx="24" cy="24" rx="9" ry="5.5" fill="#f2f4ff" /><circle cx="24" cy="24" r="3.4" fill="#397bff" /><circle cx="25" cy="23" r="1.1" fill="#fff" /></g>
      </svg>
    </span>
  );
}

/** Guia original. Responde com dados e textos predefinidos do próprio app; não usa modelo de IA. */
export function Guide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, mood]);

  const ask = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setMsgs((m) => [...m, { from: "you", text: query }]);
    setText("");
    setMood("thinking");
    const t1 = window.setTimeout(() => {
      const a = answerLocal(query);
      setMsgs((m) => [...m, { from: "guide", text: a.text }]);
      setMood("speaking");
      const t2 = window.setTimeout(() => setMood("idle"), 1400);
      timers.current.push(t2);
    }, 450);
    timers.current.push(t1);
  };

  return (
    <div className="pointer-events-none fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 md:bottom-4">
      {open && (
        <section aria-label="Guia" className="panel pointer-events-auto flex max-h-[min(70dvh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden bg-surface shadow-2xl">
          <header className="flex items-center gap-3 border-b border-edge p-3">
            <Orb mood={mood} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base leading-tight">Lúmen, o guia</h2>
              <p className="muted text-xs">Respostas locais predefinidas. Não é um modelo de IA.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar guia"><Icon name="close" /></button>
          </header>
          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm" aria-live="polite">
            <p className="rounded-xl bg-surface-2 p-3"><span className="font-semibold">Dica desta tela. </span>{tipFor(pathname)}</p>
            {msgs.map((m, i) => (
              <p key={i} className={`whitespace-pre-line rounded-xl p-3 ${m.from === "you" ? "ml-8 bg-blue/20" : "mr-4 bg-surface-2"}`}>{m.text}</p>
            ))}
            {mood === "thinking" && <p className="muted text-xs">Consultando os dados do app…</p>}
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
            )}
          </div>
          <form className="flex gap-2 border-t border-edge p-3" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <label className="sr-only" htmlFor="guide-q">Pergunte sobre regras, cartas ou missões</label>
            <input id="guide-q" className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pergunte sobre regras ou cartas" autoComplete="off" maxLength={200} />
            <button type="submit" className="btn btn-primary" aria-label="Enviar pergunta"><Icon name="send" size={18} /></button>
          </form>
        </section>
      )}
      <button type="button" className="pointer-events-auto rounded-full border border-edge bg-surface p-1 shadow-xl transition hover:border-gold" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Fechar guia" : "Abrir guia Lúmen"}>
        <Orb mood={open ? mood : "idle"} size={46} />
      </button>
    </div>
  );
}
