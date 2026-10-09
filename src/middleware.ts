import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Protege todas as rotas (exceto login, assets e galeria pública).
 * Super Admin sem 2FA configurado só acessa /perfil/2fa.
 */
export default withAuth(
  function middleware(req) {
    const t = req.nextauth.token;
    if (t?.precisa2fa && !req.nextUrl.pathname.startsWith("/perfil/2fa")) {
      return NextResponse.redirect(new URL("/perfil/2fa", req.url));
    }
  },
  { callbacks: { authorized: ({ token }) => !!token } },
);

export const config = {
  // Atenção: o manifesto gerado por app/manifest.ts é servido em
  // /manifest.webmanifest (não .json). Se ele cair no matcher, o navegador
  // recebe o redirecionamento de login e o PWA não oferece a instalação.
  matcher: ["/((?!login|galeria-publica|api/auth|_next|favicon.ico|manifest.webmanifest|icons).*)"],
};
