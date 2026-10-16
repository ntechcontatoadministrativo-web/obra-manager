"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { importarParaObra } from "./importar-actions";

export function ImportarCronograma({ obraId, temEtapas }: { obraId: string; temEtapas: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string; avisos?: string[] } | null>(null);
  const [busy, start] = useTransition();

  async function enviar(arquivo: File) {
    if (temEtapas && !confirm(
      "A importação substitui o cronograma inteiro desta obra: etapas, dependências e baselines são apagadas. Continuar?",
    )) return;

    const conteudo = await arquivo.text();
    start(async () => {
      const r = await importarParaObra({ obraId, conteudo, nomeArquivo: arquivo.name });
      setMsg({ ok: r.ok, texto: r.mensagem, avisos: r.avisos });
      if (r.ok) router.refresh();
      if (entrada.current) entrada.current.value = "";
    });
  }

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Upload size={18} aria-hidden /> Importar cronograma
      </h2>

      <p className="mt-2 text-sm text-muted">
        Aceita <strong className="text-ink">XML do MS Project</strong> e{" "}
        <strong className="text-ink">XER do Primavera P6</strong>.
      </p>
      <p className="mt-1 text-xs text-muted">
        O .mpp é binário e fechado — não existe leitor confiável dele fora da
        Microsoft. No MS Project: Arquivo → Salvar como → XML. No P6: exportar
        como XER.
      </p>

      <input
        ref={entrada} type="file" accept=".xml,.xer,.XML,.XER" className="sr-only"
        id={`importar-${obraId}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }}
      />
      <div className="mt-3">
        <Button variante="contorno" disabled={busy} onClick={() => entrada.current?.click()}>
          {busy ? "Importando…" : "Escolher arquivo"}
        </Button>
      </div>

      {temEtapas && (
        <p className="mt-2 text-xs text-alerta">
          Esta obra já tem cronograma. A importação substitui tudo, inclusive as baselines.
        </p>
      )}

      {msg && (
        <div className={`mt-3 rounded border p-3 text-sm ${
          msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>
          <p role="status" className="font-medium">{msg.texto}</p>
          {msg.avisos && msg.avisos.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs opacity-90">
              {msg.avisos.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
