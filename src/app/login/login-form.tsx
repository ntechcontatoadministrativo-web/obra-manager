"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Campo, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [pede2fa, setPede2fa] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      redirect: false,
      email: f.get("email"),
      senha: f.get("senha"),
      totp: f.get("totp") ?? "",
    });
    setCarregando(false);

    if (res?.ok) { router.replace("/dashboard"); router.refresh(); return; }
    if (res?.error === "2FA_REQUERIDO") { setPede2fa(true); return; }
    if (res?.error === "SERVICO_INDISPONIVEL") { setErro("O sistema está temporariamente indisponível. Aguarde alguns instantes e tente de novo."); return; }
    setErro(
      pede2fa
        ? "Código incorreto ou expirado. Digite o código que aparece agora no aplicativo."
        : res?.error && res.error !== "CredentialsSignin" ? res.error : "E-mail ou senha incorretos.",
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Campo label="E-mail">
        <Input name="email" type="email" autoComplete="username" required autoFocus readOnly={pede2fa} />
      </Campo>
      <Campo label="Senha">
        <Input name="senha" type="password" autoComplete="current-password" required readOnly={pede2fa} />
      </Campo>
      {pede2fa && (
        <Campo label="Código de 6 dígitos" dica="Abra o aplicativo autenticador e digite o código da Obra Manager.">
          <Input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
        </Campo>
      )}
      {erro && <p role="alert" className="rounded border border-perigo/30 bg-perigo/10 p-3 text-sm font-medium text-perigo">{erro}</p>}
      <Button type="submit" disabled={carregando} className="w-full">
        {carregando ? "Entrando…" : pede2fa ? "Confirmar código" : "Entrar"}
      </Button>
    </form>
  );
}
