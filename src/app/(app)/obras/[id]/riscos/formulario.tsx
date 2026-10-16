"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { Badge, Button, Campo, Card, Select, Textarea } from "@/components/ui";
import { faixa, nivel, ROTULO_FAIXA, TOM_FAIXA } from "@/lib/risco";
import { encerrarRisco, recalcularAutomaticos, salvarRisco } from "./actions";

export type RiscoLinha = {
  id: string; codigo: string; descricao: string;
  categoria: string; situacao: "IDENTIFICADO" | "EM_MITIGACAO" | "MATERIALIZADO" | "ENCERRADO";
  probabilidade: number; impacto: number;
  automatico: boolean; planoMitigacao: string | null;
  etapaNome: string | null;
};

const CATEGORIAS: [string, string][] = [
  ["PRAZO", "Prazo"], ["CUSTO", "Custo"], ["QUALIDADE", "Qualidade"], ["SEGURANCA", "Segurança"],
  ["CLIMA", "Clima"], ["SUPRIMENTOS", "Suprimentos"], ["REGULATORIO", "Regulatório"], ["MAO_DE_OBRA", "Mão de obra"],
];
const SITUACOES: [string, string][] = [
  ["IDENTIFICADO", "Identificado"], ["EM_MITIGACAO", "Em mitigação"],
  ["MATERIALIZADO", "Materializado"], ["ENCERRADO", "Encerrado"],
];
const ESCALA = ["1 — Muito baixo", "2 — Baixo", "3 — Médio", "4 — Alto", "5 — Muito alto"];

type Msg = { ok: boolean; texto: string } | null;

export function PainelRiscos({ obraId, riscos, etapas, podeCriar, podeEditar }: {
  obraId: string;
  riscos: RiscoLinha[];
  etapas: { id: string; nome: string }[];
  podeCriar: boolean;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<RiscoLinha | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [busy, start] = useTransition();

  const fechar = () => { setEditando(null); setAbrindo(false); setErros({}); };
  const emFoco = editando ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {podeCriar && (
          <Button onClick={() => { setEditando(null); setAbrindo((a) => !a); setErros({}); }}>
            <Plus size={16} aria-hidden /> {abrindo && !editando ? "Cancelar" : "Novo risco"}
          </Button>
        )}
        {podeCriar && (
          <Button
            variante="contorno" disabled={busy}
            onClick={() => start(async () => {
              const r = await recalcularAutomaticos({ obraId });
              setMsg({ ok: r.ok, texto: r.mensagem });
              if (r.ok) router.refresh();
            })}
          >
            <Bot size={16} aria-hidden /> {busy ? "Verificando…" : "Rodar regras automáticas"}
          </Button>
        )}
      </div>

      {msg && (
        <p role="status" className={`rounded border p-3 text-sm font-medium ${
          msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>
          {msg.texto}
        </p>
      )}

      {(abrindo || editando) && (
        <Card className="p-4">
          <h3 className="font-display text-lg font-semibold">
            {editando ? `Editar ${editando.codigo}` : "Novo risco"}
          </h3>
          {editando?.automatico && (
            <p className="mt-2 rounded border border-amarelo/50 bg-amarelo/10 p-2 text-xs">
              Este risco é mantido por regra automática. Ao salvar, ele passa a ser seu:
              a regra deixa de atualizá-lo.
            </p>
          )}
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await salvarRisco({
                  obraId, riscoId: editando?.id,
                  descricao: f.get("descricao"), categoria: f.get("categoria"),
                  probabilidade: f.get("probabilidade"), impacto: f.get("impacto"),
                  situacao: f.get("situacao"), planoMitigacao: f.get("planoMitigacao"),
                  etapaId: f.get("etapaId") || undefined,
                });
                setMsg({ ok: r.ok, texto: r.mensagem });
                setErros(r.erros ?? {});
                if (r.ok) { fechar(); router.refresh(); }
              });
            }}
          >
            <Campo label="Descrição" erro={erros.descricao}>
              <Textarea name="descricao" required rows={2} maxLength={500} defaultValue={emFoco?.descricao ?? ""} />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Categoria" erro={erros.categoria}>
                <Select name="categoria" defaultValue={emFoco?.categoria ?? "PRAZO"}>
                  {CATEGORIAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </Select>
              </Campo>
              <Campo label="Situação">
                <Select name="situacao" defaultValue={emFoco?.situacao ?? "IDENTIFICADO"}>
                  {SITUACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </Select>
              </Campo>
              <Campo label="Probabilidade" erro={erros.probabilidade}>
                <Select name="probabilidade" defaultValue={String(emFoco?.probabilidade ?? 3)}>
                  {ESCALA.map((r, i) => <option key={i} value={i + 1}>{r}</option>)}
                </Select>
              </Campo>
              <Campo label="Impacto" erro={erros.impacto}>
                <Select name="impacto" defaultValue={String(emFoco?.impacto ?? 3)}>
                  {ESCALA.map((r, i) => <option key={i} value={i + 1}>{r}</option>)}
                </Select>
              </Campo>
            </div>

            <Campo label="Etapa afetada (opcional)" dica="Deixe em branco se o risco for da obra inteira.">
              <Select name="etapaId" defaultValue="">
                <option value="">Obra inteira</option>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Select>
            </Campo>

            <Campo label="Plano de mitigação (opcional)">
              <Textarea name="planoMitigacao" rows={2} maxLength={1000} defaultValue={emFoco?.planoMitigacao ?? ""} />
            </Campo>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variante="contorno" onClick={fechar}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {riscos.length === 0 ? (
        <p className="rounded-md border border-line bg-card p-6 text-sm text-muted">
          Nenhum risco cadastrado. Obra sem risco mapeado não é obra sem risco —
          é risco sem dono.
        </p>
      ) : (
        <ul className="space-y-2">
          {riscos.map((r) => {
            const n = nivel(r);
            const f = faixa(n);
            const encerrado = r.situacao === "ENCERRADO";
            return (
              <li key={r.id} className={`rounded-md border border-line bg-card p-3 ${encerrado ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold tabular-nums">{r.codigo}</span>
                  <Badge tom={TOM_FAIXA[f]}>{ROTULO_FAIXA[f]} · {n}</Badge>
                  {r.automatico && <Badge tom="info">Automático</Badge>}
                  {encerrado && <Badge tom="neutro">Encerrado</Badge>}
                  {r.etapaNome && <span className="text-xs text-muted">{r.etapaNome}</span>}
                </div>
                <p className="mt-1.5 text-sm">{r.descricao}</p>
                {r.planoMitigacao && (
                  <p className="mt-1 text-xs text-muted"><strong>Mitigação:</strong> {r.planoMitigacao}</p>
                )}
                {podeEditar && !encerrado && (
                  <div className="mt-2 flex gap-2">
                    <Button variante="fantasma" className="min-h-9 px-2 text-xs"
                      onClick={() => { setEditando(r); setAbrindo(true); setErros({}); }}>
                      Editar
                    </Button>
                    <Button
                      variante="fantasma" className="min-h-9 px-2 text-xs" disabled={busy}
                      onClick={() => start(async () => {
                        const res = await encerrarRisco({ obraId, riscoId: r.id });
                        setMsg({ ok: res.ok, texto: res.mensagem });
                        if (res.ok) router.refresh();
                      })}
                    >
                      Encerrar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
