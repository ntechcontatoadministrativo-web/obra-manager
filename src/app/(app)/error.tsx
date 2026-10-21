"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

// Falha ao montar uma página do sistema: mensagem clara em vez da tela padrão do Next.
export default function ErroPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg space-y-4 p-6 text-center">
      <div className="faixa-obra mx-auto h-2 w-24 rounded-sm" aria-hidden />
      <h1 className="font-display text-2xl font-semibold">Não foi possível carregar esta tela</h1>
      <p className="text-sm text-muted">Pode ter sido uma instabilidade de conexão. Tente de novo; se continuar, volte ao painel.</p>
      {error.digest && <p className="font-mono text-xs text-muted">código: {error.digest}</p>}
      <div className="flex justify-center gap-3">
        <Button onClick={reset}><RotateCw size={16} aria-hidden /> Tentar de novo</Button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded border border-line bg-card px-4 text-sm font-semibold hover:bg-bg">Ir para o painel</Link>
      </div>
    </Card>
  );
}
