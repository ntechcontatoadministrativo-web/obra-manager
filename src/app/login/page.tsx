import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { AssinaturaNtech } from "@/components/ntech";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1fr_minmax(380px,460px)]">
      <section className="relative hidden bg-asfalto text-white md:block">
        <div className="faixa-obra absolute inset-x-0 top-0 h-5" aria-hidden />
        <div className="flex h-full flex-col justify-end p-12">
          <AssinaturaNtech className="mb-auto text-white" />
          <h1 className="font-display text-5xl font-semibold leading-tight">
            O canteiro inteiro<br />na palma da mão.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Ponto com foto e GPS, diário de obra, cronograma, medições, análise de custo e prazo e riscos de todas as obras em um só lugar.
          </p>
          <Link href="/apresentacao" className="mt-8 inline-flex w-fit items-center gap-2 rounded border border-white/20 px-4 py-2.5 text-sm font-semibold hover:border-amarelo hover:text-amarelo">
            Conheça todas as funções →
          </Link>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 md:px-12">
        <div className="faixa-obra mb-8 h-3 rounded-sm md:hidden" aria-hidden />
        <h2 className="font-display text-3xl font-semibold">Entrar</h2>
        <p className="mb-8 mt-1 text-sm text-muted">Use o e-mail e a senha que o administrador criou para você.</p>
        <LoginForm />
        <div className="mt-10 flex items-center justify-between gap-4 text-ink">
          <AssinaturaNtech />
          <Link href="/apresentacao" className="text-xs font-semibold text-laranja hover:underline md:hidden">Conheça o sistema</Link>
        </div>
      </section>
    </main>
  );
}
