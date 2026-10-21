import Link from "next/link";
import { AssinaturaNtech } from "@/components/ntech";

// Mesma tela para "não existe" e "sem acesso" (ver obras/[id]/page.tsx).
export default function NaoEncontrado() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="faixa-obra mx-auto mb-6 h-3 w-32 rounded-sm" aria-hidden />
        <p className="font-display text-6xl font-semibold text-laranja">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço não existe ou você não tem acesso a ele.</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded bg-laranja px-5 text-sm font-semibold text-laranja-fg hover:brightness-110">Voltar ao painel</Link>
        <div className="mt-10"><AssinaturaNtech /></div>
      </div>
    </main>
  );
}
