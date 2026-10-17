"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCard } from "@/domain/cards/data";
import { AREAS } from "@/domain/progression/data";
import { levelForXp } from "@/domain/progression/progression";
import { useApp } from "@/store/app-store";
import { HoloCard } from "./HoloCard";
import { IntroPortal } from "./IntroPortal";
import { Portal } from "./Portal";

const SHOWCASE = ["colosso-do-eclipse", "imperador-dragao-aurora", "oraculo-das-estantes"];

export function HomeView() {
  const hydrated = useApp((s) => s.hydrated);
  const introSeen = useApp((s) => s.settings.introSeen);
  const profile = useApp((s) => s.profile);
  const [introClosed, setIntroClosed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const showIntro = hydrated && !introSeen && !introClosed;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const m = document.documentElement.dataset.motion;
      if (m === "off" || m === "reduced") return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  const cards = SHOWCASE.map((id) => getCard(id)!);
  const level = levelForXp(profile.xp);

  return (
    <>
      <IntroPortal open={showIntro} onClose={() => setIntroClosed(true)} />
      <div className="grid grid-cols-1 items-center gap-8 pb-10 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-8">
        <div className="order-2 lg:order-1">
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">Atravesse o portal. O duelo já começou.</h1>
          <p className="muted mt-5 max-w-xl text-lg leading-relaxed">Inspecione cartas holográficas, monte e salve baralhos e entre em uma arena onde cada ataque segue as regras do motor de jogo.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/arena" className="btn btn-gold min-h-12 px-6 text-base">ENTRAR NO DUELO</Link>
            <Link href="/library" className="btn min-h-12 px-6 text-base">EXPLORAR CARTAS</Link>
          </div>
          {hydrated && (
            <p className="muted mt-5 text-sm">
              {profile.matches.length === 0 ? "Seu primeiro duelo espera no Templo das Sombras." : `Nível ${level} com ${profile.matches.length} duelo${profile.matches.length > 1 ? "s" : ""} registrado${profile.matches.length > 1 ? "s" : ""}.`}
            </p>
          )}
        </div>

        <div ref={stage} className="relative order-1 mx-auto aspect-square w-full max-w-[300px] sm:max-w-[560px] lg:order-2" style={{ ["--px" as string]: 0, ["--py" as string]: 0 }}>
          <div className="absolute inset-0" style={{ transform: "translate(calc(var(--px) * -14px), calc(var(--py) * -14px))", transition: "transform 0.2s ease-out" }}>
            <Portal className="h-full w-full" />
          </div>
          <div className="ambient absolute left-1/2 top-1/2 w-[34%] -translate-x-1/2 -translate-y-1/2" style={{ transform: "translate(calc(-50% + var(--px) * 18px), calc(-50% + var(--py) * 18px))", transition: "transform 0.2s ease-out" }}>
            <HoloCard card={cards[0]} staticHolo />
          </div>
          <div className="absolute left-[2%] top-[58%] hidden w-[22%] -rotate-12 sm:block" style={{ transform: "rotate(-12deg) translate(calc(var(--px) * 26px), calc(var(--py) * 26px))" }}><HoloCard card={cards[2]} /></div>
          <div className="absolute right-[2%] top-[56%] hidden w-[22%] rotate-12 sm:block" style={{ transform: "rotate(12deg) translate(calc(var(--px) * 26px), calc(var(--py) * 26px))" }}><HoloCard card={cards[1]} /></div>
        </div>
      </div>

      <section aria-labelledby="mundo" className="mt-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="mundo" className="text-2xl sm:text-3xl">Quatro lugares, quatro estilos de duelo</h2>
          <Link href="/world" className="btn btn-ghost btn-sm shrink-0">Ver o mapa</Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((a) => (
            <li key={a.id}>
              <Link href={`/world?area=${a.id}`} className="panel block h-full p-4 transition hover:border-gold/60" style={{ background: `linear-gradient(160deg, hsl(${a.hue} 60% 18% / 0.55), transparent 70%)` }}>
                <h3 className="text-lg">{a.name}</h3>
                <p className="muted mt-1 text-sm">{a.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed">{a.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted mt-10 max-w-3xl text-xs leading-relaxed">Shadow Realm é um projeto independente. Todas as cartas, personagens, áreas e ilustrações são fictícios e originais, criados para esta demonstração. Não é um produto oficial nem tem afiliação com Yu-Gi-Oh! ou seus detentores de direitos.</p>
    </>
  );
}
