"use client";

import { useState } from "react";
import { audio } from "@/lib/audio";
import { useApp, type Settings } from "@/store/app-store";
import { Modal } from "./Modal";
import { Toast, useToast } from "./Toast";

function Switch({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0"><span className="block font-medium">{label}</span>{hint && <span className="muted block text-sm">{hint}</span>}</label>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="relative h-7 w-12 shrink-0 rounded-full border border-edge transition" style={{ background: checked ? "#397bff" : "#1a1d2e" }}>
        <span className="absolute top-0.5 size-5 rounded-full bg-frost transition-all" style={{ left: checked ? "calc(100% - 1.5rem)" : "0.125rem" }} />
        <span className="sr-only">{checked ? "Ligado" : "Desligado"}</span>
      </button>
    </div>
  );
}

function Slider({ id, label, value, onChange, disabled }: { id: string; label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="py-3">
      <div className="mb-1 flex justify-between text-sm"><label htmlFor={id} className="font-medium">{label}</label><span className="muted tabular-nums">{Math.round(value * 100)}%</span></div>
      <input id={id} type="range" min={0} max={100} step={5} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / 100)} className="h-11 w-full accent-[#397bff]" />
    </div>
  );
}

export function SettingsView() {
  const hydrated = useApp((s) => s.hydrated);
  const s = useApp((st) => st.settings);
  const setSettings = useApp((st) => st.setSettings);
  const resetAll = useApp((st) => st.resetAll);
  const [confirm, setConfirm] = useState(false);
  const { toast, show } = useToast();
  if (!hydrated) return <p className="muted p-6" role="status">Carregando configurações…</p>;

  const set = (p: Partial<Settings>) => { audio.unlock(); setSettings(p); };

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div><h1 className="text-3xl sm:text-4xl">Configurações</h1><p className="muted mt-1 text-sm">Tudo é salvo neste dispositivo.</p></div>

      <section className="panel px-4 py-2" aria-labelledby="h-audio">
        <h2 id="h-audio" className="pt-3 text-xl">Áudio</h2>
        <p className="muted pb-1 text-sm">Música e efeitos são sintetizados no navegador e só tocam depois de uma interação sua.</p>
        <div className="divide-y divide-edge">
          <div><Switch id="music" label="Música ambiente" checked={s.musicOn} onChange={(v) => set({ musicOn: v })} /><Slider id="mvol" label="Volume da música" value={s.musicVolume} disabled={!s.musicOn} onChange={(v) => set({ musicVolume: v })} /></div>
          <div><Switch id="sfx" label="Efeitos sonoros" checked={s.sfxOn} onChange={(v) => { set({ sfxOn: v }); if (v) window.setTimeout(() => audio.sfx("select"), 60); }} /><Slider id="svol" label="Volume dos efeitos" value={s.sfxVolume} disabled={!s.sfxOn} onChange={(v) => set({ sfxVolume: v })} />
            <button type="button" className="btn btn-sm mb-3" disabled={!s.sfxOn} onClick={() => { audio.unlock(); audio.sfx("summon"); }}>Testar efeito</button></div>
        </div>
      </section>

      <section className="panel px-4 py-4" aria-labelledby="h-visual">
        <h2 id="h-visual" className="text-xl">Movimento e qualidade visual</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="motion" className="muted mb-1 block text-xs">Animações</label>
            <select id="motion" className="field" value={s.motion} onChange={(e) => set({ motion: e.target.value as Settings["motion"] })}>
              <option value="auto">Automático (segue o sistema)</option><option value="full">Completas</option><option value="reduced">Reduzidas</option><option value="off">Desligadas</option>
            </select></div>
          <div><label htmlFor="quality" className="muted mb-1 block text-xs">Qualidade dos efeitos de carta</label>
            <select id="quality" className="field" value={s.quality} onChange={(e) => set({ quality: e.target.value as Settings["quality"] })}>
              <option value="auto">Automática (pelo dispositivo)</option><option value="high">Alta</option><option value="low">Econômica (sem brilho holográfico)</option>
            </select></div>
        </div>
        <button type="button" className="btn mt-4" onClick={() => { setSettings({ introSeen: false }); show("A abertura aparece na próxima visita à tela inicial."); }}>Rever a abertura</button>
      </section>

      <section className="panel px-4 py-4" aria-labelledby="h-about">
        <h2 id="h-about" className="text-xl">Sobre esta demonstração</h2>
        <ul className="muted mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Cartas, personagens, áreas e ilustrações são originais e fictícios. Não é um produto oficial nem afiliado a Yu-Gi-Oh!.</li>
          <li>O progresso fica no IndexedDB deste navegador e não é validado por servidor; ele não serve para competição.</li>
          <li>O guia Lúmen usa respostas predefinidas a partir dos dados do app, sem modelo de IA.</li>
        </ul>
      </section>

      <section className="panel border-danger/30 px-4 py-4" aria-labelledby="h-danger">
        <h2 id="h-danger" className="text-xl">Dados do dispositivo</h2>
        <p className="muted mt-1 text-sm">Apaga baralhos, favoritos, progresso e preferências.</p>
        <button type="button" className="btn btn-danger mt-3" onClick={() => setConfirm(true)}>Apagar todos os dados</button>
      </section>

      <Modal open={confirm} title="Apagar todos os dados?" onClose={() => setConfirm(false)}>
        <p className="muted mb-5 text-sm">Baralhos, favoritos, nível, missões e recompensas serão removidos deste dispositivo. Não dá para desfazer.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setConfirm(false)}>Cancelar</button><button type="button" className="btn btn-danger" onClick={async () => { await resetAll(); setConfirm(false); show("Dados apagados."); }}>Apagar tudo</button></div>
      </Modal>
      <Toast toast={toast} />
    </div>
  );
}
