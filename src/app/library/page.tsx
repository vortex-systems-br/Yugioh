import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const metadata: Metadata = { title: "Biblioteca de cartas" };

export default function LibraryPage() {
  return <LibraryView />;
}
