import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IntroNtech } from "@/components/intro-ntech";

export const metadata: Metadata = {
  title: { default: "Obra Manager", template: "%s · Obra Manager" },
  description: "Gestão de obras da NTECH: ponto com foto e GPS, diário de obra, cronograma, medições, análise de valor agregado e riscos.",
  applicationName: "Obra Manager",
  authors: [{ name: "NTECH", url: "https://ntech.dev.br" }],
};
export const viewport: Viewport = { themeColor: "#26282B", width: "device-width", initialScale: 1 };

// Aplica o tema salvo antes da primeira pintura (evita piscar claro→escuro).
// Também esconde a abertura NTECH se ela já foi vista nesta sessão (?intro força).
const temaInicial = `try{var t=localStorage.getItem("tema");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}try{if(sessionStorage.getItem("intro-ntech")&&!/[?&]intro\\b/.test(location.search))document.documentElement.classList.add("sem-intro")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: temaInicial }} /></head>
      <body>
        <IntroNtech />
        {children}
      </body>
    </html>
  );
}
