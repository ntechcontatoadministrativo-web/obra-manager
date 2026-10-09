import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Obra Manager", template: "%s · Obra Manager" },
  description: "Gestão de obras: ponto, diário, etapas, compras e financeiro.",
};
export const viewport: Viewport = { themeColor: "#26282B", width: "device-width", initialScale: 1 };

// Aplica o tema salvo antes da primeira pintura (evita piscar claro→escuro).
const temaInicial = `try{var t=localStorage.getItem("tema");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: temaInicial }} /></head>
      <body>{children}</body>
    </html>
  );
}
