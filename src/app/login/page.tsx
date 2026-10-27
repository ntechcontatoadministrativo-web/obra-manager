import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ClipboardList, HardHat, LineChart } from "lucide-react";
import { LoginForm } from "./login-form";
import { AssinaturaNtech } from "@/components/ntech";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1fr_minmax(380px,460px)]">
      <section className="malha-prancheta relative hidden overflow-hidden bg-asfalto text-white md:block">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-laranja/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-amarelo/10 blur-3xl" aria-hidden />
        <div className="faixa-obra absolute inset-x-0 top-0 h-5" aria-hidden />
        <div className="relative flex h-full flex-col justify-end p-12">
          <AssinaturaNtech className="mb-auto text-white" />
          <h1 className="font-display text-5xl font-semibold leading-tight">
            O canteiro inteiro<br />na palma da mão.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Ponto com foto e GPS, diário de obra, cronograma, medições, análise de custo e prazo e riscos de todas as obras em um só lugar.
          </p>
          <ul className="mt-8 flex max-w-lg flex-wrap gap-2 text-sm">
            {[
              { icone: Camera, txt: "Ponto com foto" },
              { icone: ClipboardList, txt: "Diário de obra" },
              { icone: HardHat, txt: "Cronograma" },
              { icone: LineChart, txt: "Curva S" },
            ].map(({ icone: Icone, txt }) => (
              <li key={txt} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 backdrop-blur">
                <Icone size={14} className="text-amarelo" aria-hidden /> {txt}
              </li>
            ))}
          </ul>
          <Link href="/apresentacao" className="mt-8 inline-flex w-fit items-center gap-2 rounded border border-white/20 px-4 py-2.5 text-sm font-semibold hover:border-amarelo hover:text-amarelo">
            Conheça todas as funções →
          </Link>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 md:px-12">
        <div className="faixa-obra mb-8 h-3 rounded-sm md:hidden" aria-hidden />
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-laranja text-white shadow-lg shadow-laranja/30" aria-hidden>
          <HardHat size={26} />
        </span>
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
