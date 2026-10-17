import type { Metadata } from "next";
import { Suspense } from "react";
import { WorldView } from "@/components/WorldView";

export const metadata: Metadata = { title: "Mundo e missões" };

export default function WorldPage() {
  return (
    <Suspense fallback={<p className="muted p-6" role="status">Carregando o mapa…</p>}>
      <WorldView />
    </Suspense>
  );
}
