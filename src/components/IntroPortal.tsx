"use client";

import { useEffect, useRef } from "react";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import { Portal } from "./Portal";

/** Abertura opcional: sempre ignorável, sem barra de progresso inventada e estática com movimento reduzido. */
export function IntroPortal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const setSettings = useApp((s) => s.setSettings);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const done = (enter: boolean) => {
    setSettings({ introSeen: true });
    if (enter) { audio.unlock(); audio.sfx("summon"); }
    onClose();
  };

  return (
    <dialog ref={ref} aria-label="Abertura de Shadow Realm" className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-abyss p-0 text-frost" onCancel={(e) => { e.preventDefault(); done(false); }}>
      <div className="relative grid h-full w-full place-items-center overflow-hidden">
        <div className="intro-scene absolute inset-0 grid place-items-center">
          <Portal intro className="h-[min(92vw,78dvh)] w-[min(92vw,78dvh)]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
          <h1 className="intro-logo text-5xl font-bold tracking-wide sm:text-7xl" style={{ textShadow: "0 0 30px rgb(140 72 255 / 0.8)" }}>Shadow Realm</h1>
          <div className="intro-actions flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-gold min-w-44" onClick={() => done(true)}>Entrar no portal</button>
            <button type="button" className="btn min-w-44" onClick={() => done(false)}>Explorar direto</button>
          </div>
        </div>
        <button type="button" className="btn btn-ghost absolute right-3 top-3" style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }} onClick={() => done(false)}>Pular abertura</button>
      </div>
    </dialog>
  );
}
