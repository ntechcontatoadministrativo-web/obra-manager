import { withAuth } from "next-auth/middleware";

/**
 * Protege todas as rotas (exceto login, assets e galeria pública).
 *
 * O 2FA é opcional: quem ativa passa a ter o código pedido no login, e
 * quem não ativa entra só com e-mail e senha. Não há redirecionamento
 * forçado para /perfil/2fa.
 */
export default withAuth(
  { callbacks: { authorized: ({ token }) => !!token } },
);

export const config = {
  // Atenção: o manifesto gerado por app/manifest.ts é servido em
  // /manifest.webmanifest (não .json). Se ele cair no matcher, o navegador
  // recebe o redirecionamento de login e o PWA não oferece a instalação.
  matcher: ["/((?!login|galeria-publica|api/auth|_next|favicon.ico|manifest.webmanifest|icons).*)"],
};
