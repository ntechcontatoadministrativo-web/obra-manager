"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Barcode, Check, FileText, Paperclip, PackageCheck, Plus, QrCode, Send, Trash2, X } from "lucide-react";
import { Badge, Button, Campo, Card, Input, Select, Textarea } from "@/components/ui";
import { LIMITE_ANEXOS, MAX_ANEXO_BYTES, ROTULO_COMPRA, type CategoriaAnexo, type CompraStatus, type MeioPagamento } from "@/lib/compras";
import { formatarLinha } from "@/lib/boleto";
import { brl, parseNumeroBR } from "@/lib/utils";
import {
  anexarArquivo, aprovarSolicitacao, cancelarSolicitacao, confirmarEntrega, criarSolicitacao, definirPagamento, emitirOrdem,
  marcarEnviada, removerAnexo, reprovarSolicitacao,
} from "./actions";

export type CompraCartao = {
  id: string; status: CompraStatus; urgencia: "URGENTE" | "NORMAL" | "PLANEJADA"; justificativa: string;
  etapaNome: string | null; solicitante: string; criadoEm: string; valorEstimado: number; motivoReprovacao: string | null;
  itens: { nome: string; unidade: string; quantidade: number; preco: number | null; alertaPreco: string | null }[];
  ordem: { numero: string; fornecedor: string; valorTotal: number; prazoPagamentoDias: number; paga: boolean } | null;
  anexos: { id: string; categoria: CategoriaAnexo; nome: string; tipo: string; tamanho: number; podeRemover: boolean }[];
  pagamento: { meio: MeioPagamento | null; pix: string | null; linhaDigitavel: string | null };
  podeAnexar: boolean; podeMudarPagamento: boolean;
  podeAprovar: boolean; acimaDoLimite: boolean; podeCancelar: boolean;
};

type Msg = { ok: boolean; texto: string } | null;
type Res = { ok: boolean; mensagem: string; erros?: Record<string, string>; id?: string };
const URGENCIA = { URGENTE: { r: "Urgente", tom: "perigo" }, NORMAL: { r: "Normal", tom: "neutro" }, PLANEJADA: { r: "Planejada", tom: "neutro" } } as const;
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const ACEITA = "application/pdf,image/jpeg,image/png,image/webp";
const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

// ------------------------------------------------------------------ anexos --

/** Foto de celular passa do limite: reduz para JPEG até caber. PDF vai como está. */
async function prepararArquivo(a: File): Promise<File> {
  if (!a.type.startsWith("image/") || a.size <= MAX_ANEXO_BYTES) return a;
  const img = await createImageBitmap(a);
  const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.8, blob: Blob | null = null;
  do { blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", q)); q -= 0.1; } while (blob && blob.size > MAX_ANEXO_BYTES * 0.95 && q > 0.3);
  return blob ? new File([blob], a.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : a;
}

/** Envia um arquivo por vez (cada um cabe no limite da Server Action). Para no primeiro erro. */
async function enviarArquivos(obraId: string, id: string, categoria: CategoriaAnexo, arquivos: File[]): Promise<Res | null> {
  for (const a of arquivos) {
    const f = new FormData();
    f.set("obraId", obraId); f.set("id", id); f.set("categoria", categoria); f.set("arquivo", await prepararArquivo(a));
    const r = await anexarArquivo(f).catch(() => ({ ok: false, mensagem: "Não consegui enviar. Verifique a internet e tente de novo." }));
    if (!r.ok) return r;
  }
  return null;
}

/** Botão que abre o seletor de arquivos. */
function EscolherArquivo({ rotulo, multiplo, disabled, onEscolher }: { rotulo: string; multiplo?: boolean; disabled?: boolean; onEscolher: (a: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={ACEITA} multiple={multiplo} className="sr-only" tabIndex={-1}
        onChange={(e) => { const a = [...(e.target.files ?? [])]; e.target.value = ""; if (a.length) onEscolher(a); }} />
      <Button variante="contorno" className="min-h-9 px-3" disabled={disabled} onClick={() => ref.current?.click()}><Paperclip size={16} aria-hidden /> {rotulo}</Button>
    </>
  );
}

// ------------------------------------------------------- forma de pagamento --

type PagForm = { meio: "" | MeioPagamento; pix: string; linha: string };

function CamposPagamento({ f, set, erros, boleto }: {
  f: PagForm; set: (f: PagForm) => void; erros: Record<string, string>; boleto?: React.ReactNode;
}) {
  const opcao = (v: PagForm["meio"], rotulo: string, icone: React.ReactNode) => (
    <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-sm font-medium ${f.meio === v ? "border-laranja bg-laranja/10" : "border-line hover:bg-bg"}`}>
      <input type="radio" name="meioPagamento" className="sr-only" checked={f.meio === v} onChange={() => set({ ...f, meio: v })} />{icone}{rotulo}
    </label>
  );
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Como o fornecedor quer receber?</legend>
      <div className="flex flex-wrap gap-2">
        {opcao("PIX", "PIX", <QrCode size={16} aria-hidden />)}
        {opcao("BOLETO", "Boleto", <Barcode size={16} aria-hidden />)}
        {opcao("", "Definir depois", null)}
      </div>
      {f.meio === "PIX" && (
        <Campo label="Chave PIX ou código copia e cola" erro={erros.pagamentoPix} dica="CNPJ, e-mail, telefone (+55…), chave aleatória ou o código inteiro que o fornecedor mandou.">
          <Textarea value={f.pix} onChange={(e) => set({ ...f, pix: e.target.value })} className="min-h-16 font-mono text-xs" />
        </Campo>
      )}
      {f.meio === "BOLETO" && (
        <div className="space-y-3">
          {boleto}
          <Campo label="Linha digitável (opcional)" erro={erros.pagamentoLinhaDigitavel} dica="Se o boleto for PDF, a linha é lida do arquivo.">
            <Input inputMode="numeric" value={f.linha} onChange={(e) => set({ ...f, linha: e.target.value })} />
          </Campo>
        </div>
      )}
    </fieldset>
  );
}

const pagParaEnvio = (f: PagForm) => ({
  meioPagamento: f.meio || undefined,
  pagamentoPix: f.meio === "PIX" ? f.pix.trim() || undefined : undefined,
  pagamentoLinhaDigitavel: f.meio === "BOLETO" ? f.linha.trim() || undefined : undefined,
});

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
  const [pedidos, setPedidos] = useState<File[]>([]);
  const [boleto, setBoleto] = useState<File | null>(null);
  const [pag, setPag] = useState<PagForm>({ meio: "", pix: "", linha: "" });

  const total = itens.reduce((s, i) => {
    const q = parseNumeroBR(i.quantidade), p = parseNumeroBR(i.preco);
    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);
  const setItem = (n: number, k: keyof ItemForm, v: string) => setItens((l) => l.map((i, j) => (j === n ? { ...i, [k]: v } : i)));

  if (!aberto) return (
    <div className="space-y-2">
      <Button onClick={() => { setAberto(true); setMsg(null); }}><Plus size={18} aria-hidden /> Nova solicitação de compra</Button>
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
    </div>
  );

  function enviar() {
    setErros({}); setMsg(null);
    start(async () => {
      const r = await criarSolicitacao({
        obraId, urgencia, justificativa, etapaId: etapaId || undefined,
        itens: itens.filter((i) => i.nome.trim()).map((i) => ({
          nome: i.nome, unidade: i.unidade, quantidade: parseNumeroBR(i.quantidade) || 0,
          preco: i.preco.trim() ? parseNumeroBR(i.preco) : undefined,
        })),
        ...pagParaEnvio(pag),
      });
      if (!r.ok) { setErros(r.erros ?? {}); setMsg({ ok: false, texto: r.mensagem }); return; }
      // A solicitação já existe; os arquivos sobem depois, um por vez.
      const falha = (pedidos.length ? await enviarArquivos(obraId, r.id!, "PEDIDO", pedidos) : null)
        ?? (boleto && pag.meio === "BOLETO" ? await enviarArquivos(obraId, r.id!, "BOLETO", [boleto]) : null);
      setItens([{ ...ITEM_VAZIO }]); setJustificativa(""); setEtapaId(""); setUrgencia("NORMAL"); setAberto(false);
      setPedidos([]); setBoleto(null); setPag({ meio: "", pix: "", linha: "" });
      setMsg(falha ? { ok: false, texto: `Solicitação enviada, mas um arquivo não subiu: ${falha.mensagem} Anexe de novo no cartão da compra.` } : { ok: true, texto: r.mensagem });
      router.refresh();
    });
  }

  const addPedidos = (a: File[]) => {
    const livres = LIMITE_ANEXOS.PEDIDO - pedidos.length;
    setPedidos((l) => [...l, ...a.slice(0, livres)]);
    setMsg(a.length > livres ? { ok: false, texto: `Até ${LIMITE_ANEXOS.PEDIDO} pedidos por solicitação. Os excedentes ficaram de fora.` } : null);
  };

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

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Pedidos de compra anexados ({pedidos.length}/{LIMITE_ANEXOS.PEDIDO})</legend>
        <p className="text-xs text-muted">Pedido do fornecedor, orçamento ou cotação. PDF ou foto, até 1,5 MB cada (fotos grandes são reduzidas).</p>
        {pedidos.length > 0 && (
          <ul className="space-y-1 text-sm">
            {pedidos.map((a, n) => (
              <li key={n} className="flex items-center gap-2">
                <FileText size={16} aria-hidden className="shrink-0 text-muted" /><span className="min-w-0 truncate">{a.name}</span><span className="text-xs text-muted">{kb(a.size)}</span>
                <button type="button" aria-label={`Tirar ${a.name}`} className="flex min-h-9 min-w-9 items-center justify-center rounded hover:bg-bg" onClick={() => setPedidos((l) => l.filter((_, j) => j !== n))}><X size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        {pedidos.length < LIMITE_ANEXOS.PEDIDO && <EscolherArquivo rotulo="Anexar pedido" multiplo onEscolher={addPedidos} />}
      </fieldset>

      <CamposPagamento f={pag} set={setPag} erros={erros} boleto={
        boleto
          ? <p className="flex items-center gap-2 text-sm"><Barcode size={16} aria-hidden className="text-muted" /><span className="min-w-0 truncate">{boleto.name}</span>
              <button type="button" aria-label="Tirar boleto" className="flex min-h-9 min-w-9 items-center justify-center rounded hover:bg-bg" onClick={() => setBoleto(null)}><X size={16} aria-hidden /></button></p>
          : <EscolherArquivo rotulo="Anexar boleto" onEscolher={(a) => setBoleto(a[0])} />
      } />

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
            <AnexosEPagamento obraId={obraId} compra={c} onMsg={setMsg} />

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

function AnexosEPagamento({ obraId, compra: c, onMsg }: { obraId: string; compra: CompraCartao; onMsg: (m: Msg) => void }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pag, setPag] = useState<PagForm>({ meio: c.pagamento.meio ?? "", pix: c.pagamento.pix ?? "", linha: c.pagamento.linhaDigitavel ?? "" });
  const pedidos = c.anexos.filter((a) => a.categoria === "PEDIDO");
  const boleto = c.anexos.find((a) => a.categoria === "BOLETO");
  const url = (id: string) => `/obras/${obraId}/compras/anexos/${id}`;

  const rodar = (fn: () => Promise<Res | null>, depois?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r) onMsg({ ok: r.ok, texto: r.mensagem });
      if (!r || r.ok) { depois?.(); router.refresh(); }
    });
  const anexar = (categoria: CategoriaAnexo, a: File[]) => {
    const livres = LIMITE_ANEXOS[categoria] - c.anexos.filter((x) => x.categoria === categoria).length;
    rodar(async () => (await enviarArquivos(obraId, c.id, categoria, a.slice(0, livres)))
      ?? { ok: true, mensagem: a.length > livres ? `Anexado. Limite de ${LIMITE_ANEXOS[categoria]}: os excedentes ficaram de fora.` : "Anexado." });
  };
  const remover = (a: CompraCartao["anexos"][number]) => {
    if (confirm(`Remover ${a.nome}?`)) rodar(() => removerAnexo({ obraId, anexoId: a.id }));
  };
  const linhaAnexo = (a: CompraCartao["anexos"][number], icone: React.ReactNode) => (
    <li key={a.id} className="flex items-center gap-2">
      {icone}
      <a href={url(a.id)} target="_blank" rel="noopener" className="min-w-0 truncate font-medium text-laranja hover:underline">{a.nome}</a>
      <span className="text-xs text-muted">{kb(a.tamanho)}</span>
      {a.podeRemover && <button type="button" aria-label={`Remover ${a.nome}`} disabled={pend} className="flex min-h-9 min-w-9 items-center justify-center rounded text-perigo hover:bg-bg" onClick={() => remover(a)}><Trash2 size={16} aria-hidden /></button>}
    </li>
  );

  const { meio, pix, linhaDigitavel } = c.pagamento;
  return (
    <div className="space-y-3 rounded border border-line p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Pedidos de compra ({pedidos.length}/{LIMITE_ANEXOS.PEDIDO})</p>
        {pedidos.length > 0
          ? <ul className="space-y-1 text-sm">{pedidos.map((a) => linhaAnexo(a, <FileText size={16} aria-hidden className="shrink-0 text-muted" />))}</ul>
          : <p className="text-xs text-muted">Nenhum pedido anexado.</p>}
        {c.podeAnexar && pedidos.length < LIMITE_ANEXOS.PEDIDO && <EscolherArquivo rotulo={pend ? "Enviando…" : "Anexar pedido"} multiplo disabled={pend} onEscolher={(a) => anexar("PEDIDO", a)} />}
      </div>

      <div className="space-y-1 border-t border-line pt-3">
        <p className="text-sm font-medium">Pagamento</p>
        {!editando && (
          <>
            {meio === "PIX" && <p className="flex items-start gap-2 text-sm"><QrCode size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" /><span>PIX: <span className="break-all font-mono text-xs">{pix}</span></span></p>}
            {meio === "BOLETO" && (
              <>
                <p className="flex items-center gap-2 text-sm"><Barcode size={16} aria-hidden className="shrink-0 text-muted" />Boleto{linhaDigitavel && <span className="break-all font-mono text-xs">{formatarLinha(linhaDigitavel)}</span>}</p>
                {boleto
                  ? <ul className="text-sm">{linhaAnexo(boleto, <FileText size={16} aria-hidden className="shrink-0 text-muted" />)}</ul>
                  : c.podeAnexar && <EscolherArquivo rotulo={pend ? "Enviando…" : "Anexar boleto"} disabled={pend} onEscolher={(a) => anexar("BOLETO", a)} />}
              </>
            )}
            {!meio && <p className="text-xs text-muted">Ainda não definido. Na entrega, a conta usa o PIX do cadastro do fornecedor.</p>}
            {c.podeMudarPagamento && <Button variante="fantasma" className="min-h-9 px-3" onClick={() => { setEditando(true); setErros({}); }}>{meio ? "Mudar forma de pagamento" : "Definir forma de pagamento"}</Button>}
          </>
        )}
        {editando && (
          <div className="space-y-3">
            <CamposPagamento f={pag} set={setPag} erros={erros} boleto={!boleto && <p className="text-xs text-muted">Depois de salvar, anexe o arquivo do boleto aqui.</p>} />
            <div className="flex gap-2">
              <Button className="min-h-9 px-3" disabled={pend} onClick={() => start(async () => {
                const r = await definirPagamento({ obraId, id: c.id, ...pagParaEnvio(pag) });
                setErros(r.erros ?? {}); onMsg({ ok: r.ok, texto: r.mensagem });
                if (r.ok) { setEditando(false); router.refresh(); }
              })}>Salvar</Button>
              <Button variante="contorno" className="min-h-9 px-3" onClick={() => setEditando(false)}>Voltar</Button>
            </div>
          </div>
        )}
      </div>
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
