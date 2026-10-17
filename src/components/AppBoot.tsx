"use client";

import { useEffect } from "react";
import { audio } from "@/lib/audio";
import { flushPersist, useApp } from "@/store/app-store";

function detectQuality(): "high" | "low" {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "low";
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return "low";
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return "low";
  return "high";
}

/** Hidrata o armazenamento local, aplica preferências ao documento e sincroniza o áudio. */
export function AppBoot() {
  const hydrate = useApp((s) => s.hydrate);
  const settings = useApp((s) => s.settings);
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const motion = settings.motion === "auto" ? (mq.matches ? "reduced" : "full") : settings.motion;
      document.documentElement.dataset.motion = motion;
      document.documentElement.dataset.quality = settings.quality === "auto" ? detectQuality() : settings.quality;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.motion, settings.quality]);

  useEffect(() => {
    if (!hydrated) return;
    audio.configure({ musicOn: settings.musicOn, sfxOn: settings.sfxOn, musicVolume: settings.musicVolume, sfxVolume: settings.sfxVolume });
  }, [hydrated, settings.musicOn, settings.sfxOn, settings.musicVolume, settings.sfxVolume]);

  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      if (audio.unlocked) for (const ev of ["pointerdown", "keydown"] as const) window.removeEventListener(ev, unlock);
    };
    for (const ev of ["pointerdown", "keydown"] as const) window.addEventListener(ev, unlock);
    const flush = () => { void flushPersist(); };
    window.addEventListener("pagehide", flush);
    const vis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      for (const ev of ["pointerdown", "keydown"] as const) window.removeEventListener(ev, unlock);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  return null;
}
