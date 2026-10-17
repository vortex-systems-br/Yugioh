import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cinzel/wght.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "./globals.css";
import { AppBoot } from "@/components/AppBoot";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: { default: "Shadow Realm", template: "%s | Shadow Realm" },
  description: "Experiência de duelos de cartas com cartas holográficas, Deck Builder e arena jogável. Projeto independente e fictício, sem afiliação a Yu-Gi-Oh!.",
};

export const viewport: Viewport = { themeColor: "#080910", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-motion="auto" data-quality="high">
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
        <AppBoot />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
