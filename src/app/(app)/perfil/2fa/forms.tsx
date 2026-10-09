"use client";
import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Button, Campo, Input } from "@/components/ui";
import { ativar2fa, iniciar2fa } from "./actions";

export function IniciarBotao() {
  const [pendente, start] = useTransition();
  return <Button disabled={pendente} onClick={() => start(async () => { await iniciar2fa(); })}>{pendente ? "Gerando…" : "Gerar QR code"}</Button>;
}

export function ConfirmarForm() {
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);
  const [pendente, start] = useTransition();

  if (feito) {
    return (
      <div className="space-y-3">
        <p role="status" className="font-medium text-ok">Verificação em duas etapas ativada.</p>
        <p className="text-sm text-muted">Por segurança, entre de novo. O login passará a pedir o código.</p>
        <Button onClick={() => signOut({ callbackUrl: "/login" })}>Sair e entrar de novo</Button>
      </div>
    );
  }
  return (
    <form className="space-y-3" noValidate onSubmit={(e) => {
      e.preventDefault();
      const codigo = String(new FormData(e.currentTarget).get("codigo") ?? "").trim();
      start(async () => { const r = await ativar2fa(codigo); if (r.ok) setFeito(true); else setErro(r.erro ?? "Erro."); });
    }}>
      <Campo label="Código de 6 dígitos" erro={erro}>
        <Input name="codigo" inputMode="numeric" maxLength={6} autoComplete="one-time-code" required />
      </Campo>
      <Button type="submit" disabled={pendente}>{pendente ? "Conferindo…" : "Ativar"}</Button>
    </form>
  );
}
