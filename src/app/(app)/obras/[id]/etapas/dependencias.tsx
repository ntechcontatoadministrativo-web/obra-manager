"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { Badge, Button, Campo, Card, Input, Select } from "@/components/ui";
import { criarDependencia, removerDependencia } from "./actions";

export type LinhaDep = {
  id: string;
  predecessoraId: string; predecessoraNome: string;
  sucessoraId: string; sucessoraNome: string;
  tipo: "TI" | "II" | "TT" | "IT";
  folgaDias: number;
};

const TIPOS: [LinhaDep["tipo"], string, string][] = [
  ["TI", "Término → Início", "a sucessora começa depois que a predecessora termina"],
  ["II", "Início → Início", "as duas começam juntas"],
  ["TT", "Término → Término", "as duas terminam juntas"],
  ["IT", "Início → Término", "a sucessora termina quando a predecessora começa"],
];

export function Dependencias({ obraId, etapas, deps, podeEditar, avisoCiclo }: {
  obraId: string;
  etapas: { id: string; nome: string }[];
  deps: LinhaDep[];
  podeEditar: boolean;
  avisoCiclo: string | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [busy, start] = useTransition();

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Link2 size={18} aria-hidden /> Dependências
      </h2>
      <p className="mt-2 text-sm text-muted">
        Ligar as etapas é o que faz o caminho crítico existir. Sem ligação, toda
        etapa parece independente e o atraso de uma não aparece no prazo final.
      </p>

      {avisoCiclo && (
        <p role="alert" className="mt-3 rounded border border-perigo/30 bg-perigo/10 p-3 text-sm font-medium text-perigo">
          {avisoCiclo}
        </p>
      )}

      {podeEditar && etapas.length >= 2 && (
        <form
          className="mt-4 grid gap-3 rounded border border-line bg-bg p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const form = e.currentTarget;
            start(async () => {
              const r = await criarDependencia({
                obraId,
                predecessoraId: f.get("predecessoraId"),
                sucessoraId: f.get("sucessoraId"),
                tipo: f.get("tipo"),
                folgaDias: f.get("folgaDias"),
              });
              setMsg({ ok: r.ok, texto: r.mensagem });
              if (r.ok) { form.reset(); router.refresh(); }
            });
          }}
        >
          <Campo label="Primeiro acontece">
            <Select name="predecessoraId" required defaultValue="">
              <option value="" disabled>Escolha a etapa</option>
              {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </Campo>
          <Campo label="Depois acontece">
            <Select name="sucessoraId" required defaultValue="">
              <option value="" disabled>Escolha a etapa</option>
              {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </Campo>
          <Campo label="Tipo de ligação">
            <Select name="tipo" defaultValue="TI">
              {TIPOS.map(([v, r, d]) => <option key={v} value={v} title={d}>{r}</option>)}
            </Select>
          </Campo>
          <Campo label="Folga em dias" dica="Positiva espera (cura do concreto); negativa sobrepõe.">
            <Input name="folgaDias" type="number" step="1" defaultValue="0" />
          </Campo>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Ligando…" : "Ligar etapas"}</Button>
          </div>
        </form>
      )}

      {msg && (
        <p role="status" className={`mt-3 rounded border p-3 text-sm font-medium ${
          msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>
          {msg.texto}
        </p>
      )}

      {deps.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhuma ligação cadastrada.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {deps.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <strong>{d.predecessoraNome}</strong>
                <span className="mx-1.5 text-muted">→</span>
                <strong>{d.sucessoraNome}</strong>
              </span>
              <Badge tom="neutro">{TIPOS.find((t) => t[0] === d.tipo)?.[1] ?? d.tipo}</Badge>
              {d.folgaDias !== 0 && (
                <Badge tom={d.folgaDias > 0 ? "alerta" : "info"}>
                  {d.folgaDias > 0 ? `+${d.folgaDias}` : d.folgaDias} dia{Math.abs(d.folgaDias) === 1 ? "" : "s"}
                </Badge>
              )}
              {podeEditar && (
                <Button
                  variante="fantasma" className="min-h-9 px-2" disabled={busy}
                  aria-label={`Remover ligação entre ${d.predecessoraNome} e ${d.sucessoraNome}`}
                  onClick={() => start(async () => {
                    const r = await removerDependencia({ obraId, dependenciaId: d.id });
                    setMsg({ ok: r.ok, texto: r.mensagem });
                    if (r.ok) router.refresh();
                  })}
                >
                  <Trash2 size={15} aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
