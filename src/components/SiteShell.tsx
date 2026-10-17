"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { audio } from "@/lib/audio";
import { useApp } from "@/store/app-store";
import dynamic from "next/dynamic";
import { Icon, type IconName } from "./Icon";

// O guia só é necessário no navegador e depois da primeira interação: fica fora do JS inicial.
const Guide = dynamic(() => import("./Guide").then((m) => m.Guide), { ssr: false });

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/arena", label: "Arena", icon: "swords" },
  { href: "/library", label: "Biblioteca", icon: "cards" },
  { href: "/deck-builder", label: "Deck Builder", icon: "deck" },
  { href: "/world", label: "Mundo", icon: "map" },
];
const SECONDARY: { href: string; label: string; icon: IconName }[] = [
  { href: "/profile", label: "Perfil", icon: "user" },
  { href: "/settings", label: "Configurações", icon: "settings" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { musicOn, sfxOn } = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const soundOn = musicOn || sfxOn;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-edge/70 bg-abyss/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <Link href="/" className="font-display flex items-center gap-2 text-lg font-bold tracking-wide" aria-label="Shadow Realm, página inicial">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="#d6b36a" strokeWidth="1.6" /><circle cx="16" cy="16" r="7" fill="none" stroke="#8c48ff" strokeWidth="1.6" /><circle cx="16" cy="16" r="2.4" fill="#397bff" /></svg>
            <span className="hidden sm:inline">Shadow Realm</span>
          </Link>
          <nav aria-label="Principal" className="ml-4 hidden items-center gap-1 md:flex">
            {MAIN.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(pathname, l.href) ? "bg-white/10 text-frost" : "text-mute hover:text-frost"}`}>{l.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center">
            <button type="button" className="icon-btn" aria-pressed={soundOn} aria-label={soundOn ? "Silenciar música e efeitos" : "Ativar som"} onClick={() => { audio.unlock(); setSettings(soundOn ? { musicOn: false, sfxOn: false } : { sfxOn: true, musicOn: true }); }}>
              <Icon name={soundOn ? "volume" : "mute"} />
            </button>
            {SECONDARY.map((l) => (
              <Link key={l.href} href={l.href} className="icon-btn" aria-label={l.label} aria-current={isActive(pathname, l.href) ? "page" : undefined} style={isActive(pathname, l.href) ? { color: "var(--color-gold)" } : undefined}>
                <Icon name={l.icon} />
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-3 pb-28 pt-4 sm:px-5 md:pb-10" tabIndex={-1}>{children}</main>

      <nav aria-label="Navegação inferior" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-abyss/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MAIN.map((l) => {
            const on = isActive(pathname, l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={on ? "page" : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-gold" : "text-mute"}`}>
                  <Icon name={l.icon} size={22} />
                  <span>{l.label === "Deck Builder" ? "Decks" : l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Guide />
    </>
  );
}
