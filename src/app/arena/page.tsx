import type { Metadata } from "next";
import { Suspense } from "react";
import { ArenaView } from "@/components/ArenaView";

export const metadata: Metadata = { title: "Arena de duelos" };

export default function ArenaPage() {
  return (
    <Suspense fallback={<p className="muted p-6" role="status">Carregando a arena…</p>}>
      <ArenaView />
    </Suspense>
  );
}
