"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, PackageCheck, Plus, Send, Trash2, X } from "lucide-react";
import { Badge, Button, Campo, Card, Input, Select, Textarea } from "@/components/ui";
import { ROTULO_COMPRA, type CompraStatus } from "@/lib/compras";
import { brl, parseNumeroBR } from "@/lib/utils";
import { aprovarSolicitacao, cancelarSolicitacao, confirmarEntrega, criarSolicitacao, emitirOrdem, marcarEnviada, reprovarSolicitacao } from "./actions";

export type CompraCartao = {
  id: string; status: CompraStatus; urgencia: "URGENTE" | "NORMAL" | "PLANEJADA"; justificativa: string;
  etapaNome: string | null; solicitante: string; criadoEm: string; valorEstimado: number; motivoReprovacao: string | null;
  itens: { nome: string; unidade: string; quantidade: number; preco: number | null; alertaPreco: string | null }[];
  ordem: { numero: string; fornecedor: string; valorTotal: number; prazoPagamentoDias: number; paga: boolean } | null;
  podeAprovar: boolean; acimaDoLimite: boolean; podeCancelar: boolean;
};

type Msg = { ok: boolean; texto: string } | null;
type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const URGENCIA = { URGENTE: { r: "Urgente", tom: "perigo" }, NORMAL: { r: "Normal", tom: "neutro" }, PLANEJADA: { r: "Planejada", tom: "neutro" } } as const;
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// ------------------------------------------------------------ nova solicitação --

type ItemForm = { nome: string; unidade: string; quantidade: string; preco: string };
const ITEM_VAZIO: ItemForm = { nome: "", unidade: "un", quantidade: "", preco: "" };

export function NovaSolicitacao({ obraId, etapas }: { obraId: string; etapas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }]);
  const [justificativa, setJustificativa] = useState("");
  const [urgencia, setUrgencia] = useState("NORMAL");
  const [etapaId, setEtapaId] = useState("");

  const total = itens.reduce((s, i) => {
    const q = parseNumeroBR(i.quantidade), p = parseNumeroBR(i.preco);
    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);
  const setItem = (n: number, k: keyof ItemForm, v: string) => setItens((l) => l.map((i, j) => (j === n ? { ...i, [k]: v } : i)));

  if (!aberto) return <Button onClick={() => { setAberto(true); setMsg(null); }}><Plus size={18} aria-hidden /> Nova solicitação de compra</Button>;

  function enviar() {
    setErros({}); setMsg(null);
    start(async () => {
      const r = await criarSolicitacao({
        obraId, urgencia, justificativa, etapaId: etapaId || undefined,
        itens: itens.filter((i) => i.nome.trim()).map((i) => ({
          nome: i.nome, unidade: i.unidade, quantidade: parseNumeroBR(i.quantidade) || 0,
          preco: i.preco.trim() ? parseNumeroBR(i.preco) : undefined,
        })),
      });
      if (!r.ok) { setErros(r.erros ?? {}); setMsg({ ok: false, texto: r.mensagem }); return; }
      setItens([{ ...ITEM_VAZIO }]); setJustificativa(""); setEtapaId(""); setUrgencia("NORMAL"); setAberto(false);
      setMsg({ ok: true, texto: r.mensagem });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start justify-between">
        <h2 className="font-display text-xl font-semibold">Nova solicitação de compra</h2>
        <button onClick={() => setAberto(false)} aria-label="Fechar" className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-bg"><X size={18} aria-hidden /></button>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Itens</legend>
        {itens.map((i, n) => (
          <div key={n} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_90px_110px_130px_44px] sm:items-end">
            <div className="col-span-2 sm:col-span-1">
              <Campo label={`Material ${n + 1}`} erro={erros[`itens.${n}.nome`]}><Input value={i.nome} onChange={(e) => setItem(n, "nome", e.target.value)} placeholder="Ex.: Cimento CP-II 50kg" /></Campo>
            </div>
            <Campo label="Unidade" erro={erros[`itens.${n}.unidade`]}><Input value={i.unidade} onChange={(e) => setItem(n, "unidade", e.target.value)} /></Campo>
            <Campo label="Quantidade" erro={erros[`itens.${n}.quantidade`]}><Input inputMode="decimal" value={i.quantidade} onChange={(e) => setItem(n, "quantidade", e.target.value)} /></Campo>
            <Campo label="Preço unit. (R$)"><Input inputMode="decimal" value={i.preco} onChange={(e) => setItem(n, "preco", e.target.value)} placeholder="opcional" /></Campo>
            <Button variante="fantasma" className="px-2" aria-label={`Remover item ${n + 1}`} disabled={itens.length === 1}
              onClick={() => setItens((l) => l.filter((_, j) => j !== n))}><Trash2 size={16} aria-hidden /></Button>
          </div>
        ))}
        <Button variante="contorno" onClick={() => setItens((l) => [...l, { ...ITEM_VAZIO }])}><Plus size={16} aria-hidden /> Adicionar item</Button>
        {erros.itens && <p role="alert" className="text-xs font-medium text-perigo">{erros.itens}</p>}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Para que é a compra?" erro={erros.justificativa}><Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} className="min-h-16" /></Campo>
        <div className="space-y-4">
          <Campo label="Urgência"><Select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}><option value="URGENTE">Urgente</option><option value="NORMAL">Normal</option><option value="PLANEJADA">Planejada</option></Select></Campo>
          {etapas.length > 0 && (
            <Campo label="Etapa (centro de custo)"><Select value={etapaId} onChange={(e) => setEtapaId(e.target.value)}><option value="">Sem etapa</option>{etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Campo>
          )}
        </div>
      </div>

      <p className="text-sm">Total estimado: <strong className="tabular-nums">{brl(total)}</strong></p>
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
      <div className="flex gap-2">
        <Button onClick={enviar} disabled={pend}>{pend ? "Enviando…" : "Enviar para aprovação"}</Button>
        <Button variante="contorno" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------- lista --

export function ListaCompras({ obraId, compras, fornecedores, podeEmitir, podeCriarFornecedor, podeReceber }: {
  obraId: string; compras: CompraCartao[]; fornecedores: { id: string; nome: string; pixChave: string | null }[];
  podeEmitir: boolean; podeCriarFornecedor: boolean; podeReceber: boolean;
}) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [abertoOrdem, setAbertoOrdem] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const rodar = (fn: () => Promise<Res>, depois?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, texto: r.mensagem });
      if (r.ok) { depois?.(); router.refresh(); }
    });

  return (
    <div className="space-y-3">
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
      {compras.map((c) => {
        const st = ROTULO_COMPRA[c.status];
        return (
          <Card key={c.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{c.justificativa}</p>
                <p className="text-xs text-muted">
                  {c.solicitante} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short" }).format(new Date(c.criadoEm))}
                  {c.etapaNome && ` · ${c.etapaNome}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.urgencia !== "NORMAL" && <Badge tom={URGENCIA[c.urgencia].tom}>{URGENCIA[c.urgencia].r}</Badge>}
                <Badge tom={st.tom}>{st.rotulo}</Badge>
              </div>
            </div>

            <ul className="space-y-1 text-sm">
              {c.itens.map((i, n) => (
                <li key={n}>
                  {qtd(i.quantidade)} {i.unidade} · {i.nome}
                  {i.preco != null && <span className="text-muted"> · {brl(i.preco)}/{i.unidade}</span>}
                  {i.alertaPreco && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-alerta"><AlertTriangle size={14} aria-hidden /> {i.alertaPreco}</span>}
                </li>
              ))}
            </ul>
            <p className="text-sm">Estimado: <strong className="tabular-nums">{brl(c.valorEstimado)}</strong>{c.acimaDoLimite && c.status.startsWith("AGUARDANDO") && <span className="text-muted"> · acima do limite, precisa do dono</span>}</p>
            {c.ordem && (
              <p className="rounded bg-bg p-2 text-sm">
                <strong>{c.ordem.numero}</strong> · {c.ordem.fornecedor} · <span className="tabular-nums">{brl(c.ordem.valorTotal)}</span> · pagamento em {c.ordem.prazoPagamentoDias} dia(s)
                {c.status === "ENTREGUE" && <> · {c.ordem.paga ? <span className="font-medium text-ok">paga</span> : <Link href="/pagamentos" className="font-medium text-laranja hover:underline">conta em Pagamentos</Link>}</>}
              </p>
            )}
            {c.motivoReprovacao && <p className="text-sm text-perigo">Motivo da reprovação: {c.motivoReprovacao}</p>}

            <div className="flex flex-wrap gap-2">
              {c.podeAprovar && (
                <>
                  <Button className="min-h-9 px-3" disabled={pend} onClick={() => rodar(() => aprovarSolicitacao({ obraId, id: c.id }))}><Check size={16} aria-hidden /> Aprovar</Button>
                  <Button variante="contorno" className="min-h-9 px-3" disabled={pend} onClick={() => { setReprovando(c.id); setMotivo(""); }}>Reprovar</Button>
                </>
              )}
              {c.status === "APROVADA" && podeEmitir && abertoOrdem !== c.id && (
                <Button className="min-h-9 px-3" onClick={() => setAbertoOrdem(c.id)}>Emitir ordem de compra</Button>
              )}
              {c.status === "PO_EMITIDA" && podeEmitir && (
                <Button variante="contorno" className="min-h-9 px-3" disabled={pend} onClick={() => rodar(() => marcarEnviada({ obraId, id: c.id }))}><Send size={16} aria-hidden /> Enviada ao fornecedor</Button>
              )}
              {(c.status === "PO_EMITIDA" || c.status === "ENVIADA_FORNECEDOR") && podeReceber && (
                <Button className="min-h-9 px-3" disabled={pend}
                  onClick={() => { if (confirm("Confirmar que o material chegou na obra? A conta do fornecedor vai para Pagamentos.")) rodar(() => confirmarEntrega({ obraId, id: c.id })); }}>
                  <PackageCheck size={16} aria-hidden /> Material entregue
                </Button>
              )}
              {c.podeCancelar && (
                <Button variante="fantasma" className="min-h-9 px-3 text-perigo" disabled={pend}
                  onClick={() => { if (confirm("Cancelar esta solicitação?")) rodar(() => cancelarSolicitacao({ obraId, id: c.id })); }}>Cancelar</Button>
              )}
            </div>

            {reprovando === c.id && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-60 flex-1"><Campo label="Motivo da reprovação"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Campo></div>
                <Button variante="perigo" disabled={pend || motivo.trim().length < 3} onClick={() => rodar(() => reprovarSolicitacao({ obraId, id: c.id, motivo }), () => setReprovando(null))}>Reprovar</Button>
                <Button variante="contorno" onClick={() => setReprovando(null)}>Voltar</Button>
              </div>
            )}

            {abertoOrdem === c.id && (
              <FormOrdem obraId={obraId} compra={c} fornecedores={fornecedores} podeCriarFornecedor={podeCriarFornecedor}
                onFim={(r) => { setMsg({ ok: r.ok, texto: r.mensagem }); if (r.ok) { setAbertoOrdem(null); router.refresh(); } }} onCancelar={() => setAbertoOrdem(null)} />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function FormOrdem({ obraId, compra, fornecedores, podeCriarFornecedor, onFim, onCancelar }: {
  obraId: string; compra: CompraCartao; fornecedores: { id: string; nome: string; pixChave: string | null }[];
  podeCriarFornecedor: boolean; onFim: (r: Res) => void; onCancelar: () => void;
}) {
  const [pend, start] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [fornecedorId, setFornecedorId] = useState(fornecedores[0]?.id ?? (podeCriarFornecedor ? "novo" : ""));
  const [novo, setNovo] = useState({ nome: "", cnpj: "", telefone: "", pixChave: "" });
  const [valor, setValor] = useState(compra.valorEstimado > 0 ? compra.valorEstimado.toFixed(2).replace(".", ",") : "");
  const [prazo, setPrazo] = useState("30");
  const escolhido = fornecedores.find((f) => f.id === fornecedorId);

  function emitir() {
    setErros({});
    start(async () => {
      const r = await emitirOrdem({
        obraId, id: compra.id,
        fornecedorId: fornecedorId !== "novo" ? fornecedorId || undefined : undefined,
        novoFornecedor: fornecedorId === "novo" ? { nome: novo.nome, cnpj: novo.cnpj || undefined, telefone: novo.telefone || undefined, pixChave: novo.pixChave || undefined } : undefined,
        valorTotal: parseNumeroBR(valor) || 0, prazoPagamentoDias: Number(prazo) || 0,
      });
      if (!r.ok) setErros(r.erros ?? {});
      onFim(r);
    });
  }

  return (
    <div className="space-y-4 rounded border border-line p-4">
      <h3 className="font-semibold">Ordem de compra</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Campo label="Fornecedor" erro={erros.fornecedorId}>
          <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            {podeCriarFornecedor && <option value="novo">+ Cadastrar novo fornecedor</option>}
          </Select>
        </Campo>
        <Campo label="Valor fechado (R$)" erro={erros.valorTotal}><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo label="Pagar em quantos dias após a entrega?" erro={erros.prazoPagamentoDias}><Input inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo>
      </div>
      {escolhido && <p className="text-xs text-muted">{escolhido.pixChave ? `PIX do fornecedor: ${escolhido.pixChave}` : "Este fornecedor não tem chave PIX cadastrada. Dá para incluir em Fornecedores."}</p>}
      {fornecedorId === "novo" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Campo label="Nome" erro={erros["novoFornecedor.nome"]}><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
          <Campo label="CNPJ"><Input value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} /></Campo>
          <Campo label="Telefone"><Input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} /></Campo>
          <Campo label="Chave PIX"><Input value={novo.pixChave} onChange={(e) => setNovo({ ...novo, pixChave: e.target.value })} /></Campo>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={emitir} disabled={pend}>{pend ? "Emitindo…" : "Emitir ordem"}</Button>
        <Button variante="contorno" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}
