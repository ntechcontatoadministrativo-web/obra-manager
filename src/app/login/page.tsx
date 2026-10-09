import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1fr_minmax(380px,460px)]">
      <section className="relative hidden bg-asfalto text-white md:block">
        <div className="faixa-obra absolute inset-x-0 top-0 h-5" aria-hidden />
        <div className="flex h-full flex-col justify-end p-12">
          <h1 className="font-display text-5xl font-semibold leading-tight">
            O canteiro inteiro<br />na palma da mão.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Ponto com foto, diário de obra, etapas, compras e custos de todas as obras em um só lugar.
          </p>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 md:px-12">
        <div className="faixa-obra mb-8 h-3 rounded-sm md:hidden" aria-hidden />
        <h2 className="font-display text-3xl font-semibold">Entrar</h2>
        <p className="mb-8 mt-1 text-sm text-muted">Use o e-mail e a senha que o administrador criou para você.</p>
        <LoginForm />
      </section>
    </main>
  );
}
