"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Campo, Input } from "@/components/ui";
import { fecharMedicao } from "./actions";

export function FecharMedicaoForm({ obraId, de, ate, hoje }: { obraId: string; de: string; ate: string; hoje: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [busy, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      if (!confirm("Fechar a medição registra o andamento de cada etapa neste momento e não pode ser desfeito. Continuar?")) return;
      start(async () => {
        const r = await fecharMedicao({ obraId, de: f.get("de"), ate: f.get("ate") });
        setMsg({ ok: r.ok, texto: r.mensagem });
        if (r.ok && r.numero) router.push(`/obras/${obraId}/medicoes/${r.numero}`);
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Início do período"><Input type="date" name="de" required defaultValue={de} max={hoje} /></Campo>
        <Campo label="Fim do período"><Input type="date" name="ate" required defaultValue={ate} max={hoje} /></Campo>
      </div>
      <p className="text-sm text-muted">Antes de fechar, atualize o andamento das etapas na tela de cronograma: a medição usa o que estiver lá agora.</p>
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Fechando…" : "Fechar medição"}</Button>
    </form>
  );
}
