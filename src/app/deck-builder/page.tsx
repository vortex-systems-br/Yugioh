import type { Metadata } from "next";
import { DeckBuilderView } from "@/components/DeckBuilderView";

export const metadata: Metadata = { title: "Deck Builder" };

export default function DeckBuilderPage() {
  return <DeckBuilderView />;
}
