import type { MetadataRoute } from "next";

/**
 * Servido em /manifest.webmanifest — esse caminho precisa continuar liberado
 * no matcher do middleware, senão o navegador recebe o redirecionamento de
 * login e o botão "instalar aplicativo" não aparece.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obra Manager",
    short_name: "Obras",
    description: "Ponto, diário de obra, etapas e medições em campo.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#26282B",
    theme_color: "#26282B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // TODO (campo): service worker com fila offline para o ponto. Obra sem
    // sinal é a regra, não a exceção — enquanto não existir, a marcação
    // depende de conexão no momento do toque.
  };
}
