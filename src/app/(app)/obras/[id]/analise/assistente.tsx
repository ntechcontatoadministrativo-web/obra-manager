"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, MessageSquare, Send } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { gerarResumo, perguntarAoAssistente } from "./assistente-actions";

type Mensagem = { papel: "usuario" | "assistente"; texto: string };

const SUGESTOES = [
  "Qual atividade está mais atrasada?",
  "Qual o custo previsto para a conclusão?",
  "Quais riscos estão em nível crítico?",
  "O que explica o desvio de custo?",
];

export function Assistente({ obraId, resumoInicial }: { obraId: string; resumoInicial: string[] }) {
  const [resumo, setResumo] = useState<string[]>(resumoInicial);
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [busy, start] = useTransition();
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest" }); }, [conversa]);

  function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || busy) return;
    const historico = conversa;
    setConversa((c) => [...c, { papel: "usuario", texto: limpa }]);
    setTexto("");
    start(async () => {
      const r = await perguntarAoAssistente({ obraId, pergunta: limpa, historico });
      setConversa((c) => [...c, { papel: "assistente", texto: r.texto }]);
      setAviso(r.ok && r.modeloAtivo === false
        ? "A conversa livre está desligada neste ambiente. O resumo acima continua valendo: ele vem dos números, não de um modelo."
        : null);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <FileText size={18} aria-hidden /> Resumo executivo
        </h2>
        <p className="mt-1 text-xs text-muted">
          Escrito a partir dos números da obra, sem modelo de linguagem no caminho —
          é o texto que pode ir para o cliente.
        </p>

        <div className="mt-3 flex-1 space-y-3 text-sm">
          {resumo.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variante="contorno" className="min-h-9" disabled={busy}
            onClick={() => start(async () => {
              const r = await gerarResumo({ obraId });
              if (r.ok && r.paragrafos) setResumo(r.paragrafos);
            })}
          >
            Atualizar
          </Button>
          <Button
            variante="fantasma" className="min-h-9"
            onClick={() => {
              navigator.clipboard?.writeText(resumo.join("\n\n")).catch(() => {
                // Sem permissão de área de transferência: o texto está na tela
                // e pode ser selecionado à mão.
              });
            }}
          >
            Copiar texto
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MessageSquare size={18} aria-hidden /> Perguntar sobre a obra
        </h2>
        <p className="mt-1 text-xs text-muted">
          Responde só com os dados desta obra. Não vê CPF, dado bancário nem nome de funcionário.
        </p>

        <div className="mt-3 max-h-80 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
          {conversa.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">Comece por uma destas:</p>
              <ul className="space-y-1.5">
                {SUGESTOES.map((s) => (
                  <li key={s}>
                    <button
                      type="button" onClick={() => enviar(s)} disabled={busy}
                      className="min-h-9 text-left text-sm text-laranja hover:underline disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            conversa.map((m, i) => (
              <div key={i} className={m.papel === "usuario" ? "text-right" : ""}>
                <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded px-3 py-2 text-sm ${
                  m.papel === "usuario" ? "bg-laranja/10 text-ink" : "bg-bg"}`}>
                  {m.texto}
                </div>
              </div>
            ))
          )}
          {busy && <p className="text-sm text-muted">Pensando…</p>}
          <div ref={fim} />
        </div>

        {aviso && (
          <p role="status" className="mt-3 rounded border border-amarelo/50 bg-amarelo/10 p-2 text-xs">
            {aviso}
          </p>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
        >
          <Input
            value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte sobre prazo, custo ou risco" maxLength={1000}
            aria-label="Pergunta sobre a obra" disabled={busy}
          />
          <Button type="submit" disabled={busy || !texto.trim()} aria-label="Enviar pergunta">
            <Send size={16} aria-hidden />
          </Button>
        </form>
      </Card>
    </div>
  );
}
