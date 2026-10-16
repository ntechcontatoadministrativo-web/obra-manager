"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Flag } from "lucide-react";
import { Badge, Button, Campo, Card, Input, Textarea } from "@/components/ui";
import { ativarBaseline, criarBaseline, fecharSemanaAction } from "./actions";

type Linha = { id: string; numero: number; nome: string; ativa: boolean; criadoEm: string; qtdEtapas: number };
type Msg = { ok: boolean; texto: string } | null;

function Aviso({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`rounded border p-3 text-sm font-medium ${
      msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>
      {msg.texto}
    </p>
  );
}

export function Baselines({ obraId, linhas, podeEditar }: {
  obraId: string; linhas: Linha[]; podeEditar: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [abrindo, setAbrindo] = useState(false);
  const [busy, start] = useTransition();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Flag size={18} aria-hidden /> Baselines
        </h2>
        {podeEditar && (
          <Button variante="contorno" className="ml-auto min-h-9" onClick={() => setAbrindo((a) => !a)}>
            {abrindo ? "Cancelar" : "Congelar cronograma atual"}
          </Button>
        )}
      </div>

      <p className="mt-2 text-sm text-muted">
        A baseline é a régua do prazo e do valor planejado. Sem ela, remanejar uma
        etapa apaga o atraso junto com a data antiga.
      </p>

      {abrindo && (
        <form
          className="mt-4 space-y-3 rounded border border-line bg-bg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await criarBaseline({
                obraId, nome: f.get("nome"), observacao: f.get("observacao"),
              });
              setMsg({ ok: r.ok, texto: r.mensagem });
              setErros(r.erros ?? {});
              if (r.ok) { setAbrindo(false); router.refresh(); }
            });
          }}
        >
          <Campo label="Nome da revisão" erro={erros.nome} dica="Ex.: Contratual, Revisão 2 — aditivo de chuva">
            <Input name="nome" required maxLength={80} autoFocus />
          </Campo>
          <Campo label="Observação (opcional)">
            <Textarea name="observacao" maxLength={500} rows={2} />
          </Campo>
          <p className="text-xs text-muted">
            Congela datas e orçamento das etapas folha como estão agora, e passa a
            ser a baseline ativa. A anterior continua guardada.
          </p>
          <Button type="submit" disabled={busy}>{busy ? "Congelando…" : "Congelar"}</Button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        <Aviso msg={msg} />

        {linhas.length === 0 ? (
          <p className="rounded border border-amarelo/50 bg-amarelo/10 p-3 text-sm">
            Nenhuma baseline congelada. Os indicadores estão usando as datas atuais
            das etapas, então o desvio de prazo aparece sempre zerado.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {linhas.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{l.numero}. {l.nome}</span>
                {l.ativa && <Badge tom="ok">Ativa</Badge>}
                <span className="text-xs text-muted">
                  {l.qtdEtapas} etapas · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Belem" }).format(new Date(l.criadoEm))}
                </span>
                {podeEditar && !l.ativa && (
                  <Button
                    variante="fantasma" className="ml-auto min-h-9 px-2 text-xs" disabled={busy}
                    onClick={() => start(async () => {
                      const r = await ativarBaseline({ obraId, baselineId: l.id });
                      setMsg({ ok: r.ok, texto: r.mensagem });
                      if (r.ok) router.refresh();
                    })}
                  >
                    Usar esta
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function FecharSemana({ obraId, ultimoFechamento }: { obraId: string; ultimoFechamento: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, start] = useTransition();

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <CalendarCheck size={18} aria-hidden /> Fechamento semanal
      </h2>
      <p className="mt-2 text-sm text-muted">
        Grava os indicadores da semana. É o que dá histórico à curva S — sem
        fechamento, o gráfico mostra só a situação de hoje.
      </p>
      <p className="mt-2 text-sm">
        Último fechamento:{" "}
        <strong className="tabular-nums">
          {ultimoFechamento
            ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(ultimoFechamento))
            : "nenhum"}
        </strong>
      </p>

      <div className="mt-3 space-y-2">
        <Aviso msg={msg} />
        <Button
          disabled={busy}
          onClick={() => start(async () => {
            const r = await fecharSemanaAction({ obraId });
            setMsg({ ok: r.ok, texto: r.mensagem });
            if (r.ok) router.refresh();
          })}
        >
          {busy ? "Fechando…" : "Fechar a semana atual"}
        </Button>
        <p className="text-xs text-muted">
          Refazer a mesma semana sobrescreve o registro — útil quando entra despesa atrasada.
        </p>
      </div>
    </Card>
  );
}
