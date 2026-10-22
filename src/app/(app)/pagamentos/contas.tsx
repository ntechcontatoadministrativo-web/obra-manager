"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, FileUp, Plus, QrCode, Trash2, Undo2, X } from "lucide-react";
import { Badge, Button, Campo, Card, Input, Select, Textarea } from "@/components/ui";
import { ROTULO_SITUACAO, situacao } from "@/lib/pagamentos";
import { formatarLinha } from "@/lib/boleto";
import { brl, dataBR, parseNumeroBR } from "@/lib/utils";
import { desfazerPagamento, excluirConta, lerDocumento, marcarPaga, salvarConta } from "./actions";

export type ContaLinha = {
  id: string; obraId: string; obraNome: string; descricao: string; favorecido: string; valor: number;
  vencimento: string | null; origem: string | null; documentoNome: string | null; ordemNumero: string | null;
  linhaDigitavel: string | null; pixChave: string | null; pix: string | null;
  podePagar: boolean; podeExcluir: boolean;
};

type Msg = { ok: boolean; texto: string } | null;

/** Copia para a área de transferência; em navegador antigo, cai no método do textarea. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

const ORIGEM: Record<string, string> = { MANUAL: "Manual", DOCUMENTO: "Lida de documento", COMPRA: "Compra" };

export function ListaContas({ contas, hoje }: { contas: ContaLinha[]; hoje: string }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [pix, setPix] = useState<ContaLinha | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const rodar = (fn: () => Promise<{ ok: boolean; mensagem: string }>) =>
    start(async () => { const r = await fn(); setMsg({ ok: r.ok, texto: r.mensagem }); if (r.ok) router.refresh(); });

  async function copiarCom(id: string, texto: string) {
    if (await copiar(texto)) { setCopiado(id); setTimeout(() => setCopiado((c) => (c === id ? null : c)), 2500); }
  }

  if (contas.length === 0) return <Card className="p-5 text-sm text-muted">Nada em aberto aqui.</Card>;

  return (
    <div className="space-y-3">
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
      <Card className="divide-y divide-line">
        {contas.map((c, i) => {
          const s = ROTULO_SITUACAO[situacao(c.vencimento, null, hoje)];
          return (
            <div key={c.id} className="grid gap-3 p-4 md:grid-cols-[2.5rem_minmax(0,1fr)_150px_170px] md:items-center">
              <span className="hidden font-display text-lg font-semibold text-muted md:block" aria-hidden>{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold">{c.favorecido || "Sem favorecido"}</p>
                <p className="truncate text-sm text-muted">{c.descricao}</p>
                <p className="text-xs text-muted">
                  {c.obraNome}
                  {c.ordemNumero && ` · ${c.ordemNumero}`}
                  {c.origem && ` · ${ORIGEM[c.origem] ?? c.origem}`}
                  {c.documentoNome && ` (${c.documentoNome})`}
                </p>
              </div>
              <div className="md:text-right">
                <p className="font-display text-lg font-semibold tabular-nums">{brl(c.valor)}</p>
                <p className="text-xs text-muted">{c.vencimento ? `vence ${dataBR(c.vencimento)}` : "sem vencimento"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Badge tom={s.tom}>{s.rotulo}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-3 md:col-start-2">
                {c.pix && (
                  <>
                    <Button variante="contorno" className="min-h-9 px-3" onClick={() => copiarCom(c.id + "pix", c.pix!)}>
                      {copiado === c.id + "pix" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                      {copiado === c.id + "pix" ? "PIX copiado" : "Copiar PIX"}
                    </Button>
                    <Button variante="contorno" className="min-h-9 px-3" onClick={() => setPix(c)}><QrCode size={16} aria-hidden /> QR code</Button>
                  </>
                )}
                {c.linhaDigitavel && (
                  <Button variante="contorno" className="min-h-9 px-3" onClick={() => copiarCom(c.id + "bol", c.linhaDigitavel!)}>
                    {copiado === c.id + "bol" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                    {copiado === c.id + "bol" ? "Linha copiada" : "Copiar boleto"}
                  </Button>
                )}
                {!c.pix && !c.linhaDigitavel && <span className="self-center text-xs text-muted">Sem PIX nem boleto cadastrado.</span>}
                <span className="flex-1" />
                {c.podePagar && <Button className="min-h-9 px-3" disabled={pend} onClick={() => rodar(() => marcarPaga({ id: c.id }))}><Check size={16} aria-hidden /> Marcar como paga</Button>}
                {c.podeExcluir && (
                  <Button variante="fantasma" className="min-h-9 px-3 text-perigo" disabled={pend} aria-label={`Excluir conta de ${c.favorecido}`}
                    onClick={() => { if (confirm(`Excluir a conta de ${c.favorecido} (${brl(c.valor)})?`)) rodar(() => excluirConta({ id: c.id })); }}>
                    <Trash2 size={16} aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>
      {pix && <PixDialogo conta={pix} onFechar={() => setPix(null)} />}
    </div>
  );
}

export function PixDialogo({ conta, onFechar }: { conta: Pick<ContaLinha, "favorecido" | "valor" | "pix" | "pixChave" | "linhaDigitavel">; onFechar: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
    if (conta.pix) QRCode.toDataURL(conta.pix, { margin: 1, width: 260 }).then(setQr).catch(() => setQr(null));
  }, [conta.pix]);

  return (
    <dialog ref={ref} onClose={onFechar} className="w-[min(92vw,26rem)] rounded-md border border-line bg-card p-0 text-ink backdrop:bg-black/60">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">PIX para {conta.favorecido}</h3>
            <p className="font-display text-2xl font-semibold tabular-nums">{brl(conta.valor)}</p>
          </div>
          <button onClick={() => ref.current?.close()} aria-label="Fechar" className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-bg"><X size={18} aria-hidden /></button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code do PIX" className="mx-auto rounded border border-line bg-white p-2" width={260} height={260} />}
        <p className="text-sm text-muted">Aponte a câmera do aplicativo do banco para o QR code, ou copie o código e use “Pix copia e cola”.</p>
        {conta.pixChave && <p className="text-sm">Chave: <span className="break-all font-medium">{conta.pixChave}</span></p>}
        {conta.pix && <p className="break-all rounded bg-bg p-2 font-mono text-xs">{conta.pix}</p>}
        {conta.linhaDigitavel && <p className="text-sm">Boleto: <span className="break-all font-mono text-xs">{formatarLinha(conta.linhaDigitavel)}</span></p>}
        {conta.pix && (
          <Button className="w-full" onClick={async () => { if (await copiar(conta.pix!)) setCopiado(true); }}>
            {copiado ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copiado ? "Copiado" : "Copiar código PIX"}
          </Button>
        )}
      </div>
    </dialog>
  );
}

export function PagasRecentes({ contas }: { contas: { id: string; descricao: string; favorecido: string; valor: number; pagamento: string; obraNome: string; podeDesfazer: boolean }[] }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  return (
    <Card className="divide-y divide-line">
      {contas.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{c.favorecido || c.descricao}</p>
            <p className="truncate text-xs text-muted">{c.descricao} · {c.obraNome}</p>
          </div>
          <span className="tabular-nums">{brl(c.valor)}</span>
          <Badge tom="ok">Paga em {dataBR(c.pagamento)}</Badge>
          {c.podeDesfazer && (
            <Button variante="fantasma" className="min-h-9 px-2" disabled={pend} title="Desfazer pagamento" aria-label={`Desfazer pagamento de ${c.favorecido}`}
              onClick={() => start(async () => { const r = await desfazerPagamento({ id: c.id }); if (r.ok) router.refresh(); })}>
              <Undo2 size={16} aria-hidden />
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------- nova conta --

const TIPOS: [string, string][] = [
  ["MATERIAL", "Material"], ["MAO_DE_OBRA", "Mão de obra"], ["EQUIPAMENTO", "Equipamento"],
  ["SERVICO", "Serviço"], ["TAXA", "Taxa"], ["OUTROS", "Outros"],
];

type Form = {
  obraId: string; descricao: string; favorecido: string; tipo: string; valor: string; vencimento: string;
  pixChave: string; pixCopiaECola: string; linhaDigitavel: string;
};

/** Lê QR (PIX) e código de barras (boleto) da foto com o leitor nativo do navegador, se houver. */
async function codigosDaImagem(arquivo: File): Promise<string> {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(i: ImageBitmapSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (!BD) return "";
  try {
    const imagem = await createImageBitmap(arquivo);
    const achados = await new BD({ formats: ["qr_code", "itf", "code_128"] }).detect(imagem);
    return achados.map((a) => a.rawValue).join("\n");
  } catch {
    return "";
  }
}

export function NovaConta({ obras, obraInicial }: { obras: { id: string; nome: string }[]; obraInicial: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pend, start] = useTransition();
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState<{ nome: string; achados: string[]; aviso: string | null } | null>(null);
  const [colar, setColar] = useState("");
  const vazio: Form = { obraId: obraInicial ?? (obras.length === 1 ? obras[0].id : ""), descricao: "", favorecido: "", tipo: "MATERIAL", valor: "", vencimento: "", pixChave: "", pixCopiaECola: "", linhaDigitavel: "" };
  const [f, setF] = useState<Form>(vazio);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (obras.length === 0) return null;
  if (!aberto) return <Button onClick={() => setAberto(true)}><Plus size={18} aria-hidden /> Nova conta a pagar</Button>;

  async function ler(arquivo: File | null) {
    setLendo(true); setMsg(null);
    const fd = new FormData();
    if (arquivo) {
      fd.set("arquivo", arquivo);
      if (arquivo.type.startsWith("image/")) fd.set("codigos", await codigosDaImagem(arquivo));
    }
    fd.set("texto", colar);
    const r = await lerDocumento(fd);
    setLendo(false);
    if (!r.ok) { setMsg({ ok: false, texto: r.mensagem }); return; }
    const d = r.dados;
    setF((x) => ({
      ...x,
      valor: d.valor != null ? d.valor.toFixed(2).replace(".", ",") : x.valor,
      vencimento: d.vencimento ?? x.vencimento,
      favorecido: d.favorecido ?? x.favorecido,
      descricao: x.descricao || (arquivo ? `Documento ${arquivo.name}`.slice(0, 200) : x.descricao),
      pixChave: d.pixChave ?? x.pixChave,
      pixCopiaECola: d.pixCopiaECola ?? x.pixCopiaECola,
      linhaDigitavel: d.linhaDigitavel ?? x.linhaDigitavel,
    }));
    setDoc({ nome: arquivo?.name ?? "texto colado", achados: d.achados, aviso: r.aviso });
  }

  function salvar() {
    setErros({}); setMsg(null);
    const valor = parseNumeroBR(f.valor);
    start(async () => {
      const r = await salvarConta({
        ...f, valor: Number.isFinite(valor) ? valor : 0,
        pixChave: f.pixChave || undefined, pixCopiaECola: f.pixCopiaECola || undefined, linhaDigitavel: f.linhaDigitavel || undefined,
        origem: doc ? "DOCUMENTO" : "MANUAL", documentoNome: doc?.nome,
      });
      if (!r.ok) { setErros(r.erros ?? {}); setMsg({ ok: false, texto: r.mensagem }); return; }
      setMsg({ ok: true, texto: r.mensagem });
      setF(vazio); setDoc(null); setColar(""); setAberto(false);
      router.refresh();
    });
  }

  return (
    <Card className="w-full space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Nova conta a pagar</h2>
        <button onClick={() => setAberto(false)} aria-label="Fechar" className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-bg"><X size={18} aria-hidden /></button>
      </div>

      <div className="space-y-3 rounded border border-dashed border-line p-4">
        <p className="font-medium">Ler de um documento <span className="font-normal text-muted">(opcional)</span></p>
        <p className="text-sm text-muted">Boleto, nota fiscal ou orçamento em PDF, ou a foto dele. O sistema acha valor, vencimento, favorecido, PIX e linha do boleto; você confere antes de salvar.</p>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:bg-bg">
          <FileUp size={18} aria-hidden /> {lendo ? "Lendo…" : "Escolher PDF ou foto"}
          <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={lendo}
            onChange={(e) => { const a = e.target.files?.[0] ?? null; e.target.value = ""; if (a) ler(a); }} />
        </label>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-laranja">Ou colar o texto / código do documento</summary>
          <div className="mt-2 space-y-2">
            <Textarea value={colar} onChange={(e) => setColar(e.target.value)} placeholder="Cole aqui a linha digitável, o PIX copia e cola ou o texto da nota" />
            <Button variante="contorno" disabled={lendo || !colar.trim()} onClick={() => ler(null)}>Ler texto</Button>
          </div>
        </details>
        {doc && (
          <div role="status" className="rounded bg-bg p-3 text-sm">
            <p className="font-medium">Lido de {doc.nome}:</p>
            {doc.achados.length ? <p className="text-muted">{doc.achados.join(" · ")}</p> : <p className="text-muted">Nada reconhecido automaticamente.</p>}
            {doc.aviso && <p className="mt-1 font-medium text-alerta">{doc.aviso}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Obra" erro={erros.obraId}>
          <Select value={f.obraId} onChange={set("obraId")}>
            <option value="">Escolha…</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Tipo" erro={erros.tipo}>
          <Select value={f.tipo} onChange={set("tipo")}>{TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Select>
        </Campo>
        <Campo label="Favorecido (quem recebe)" erro={erros.favorecido}><Input value={f.favorecido} onChange={set("favorecido")} /></Campo>
        <Campo label="Descrição" erro={erros.descricao}><Input value={f.descricao} onChange={set("descricao")} placeholder="Ex.: 200 sacos de cimento" /></Campo>
        <Campo label="Valor (R$)" erro={erros.valor}><Input inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="0,00" /></Campo>
        <Campo label="Vencimento" erro={erros.vencimento}><Input type="date" value={f.vencimento} onChange={set("vencimento")} /></Campo>
        <Campo label="Chave PIX" erro={erros.pixChave} dica="CNPJ, e-mail, telefone (+55…) ou chave aleatória. O código com o valor é gerado sozinho.">
          <Input value={f.pixChave} onChange={set("pixChave")} />
        </Campo>
        <Campo label="Linha digitável do boleto" erro={erros.linhaDigitavel}><Input inputMode="numeric" value={f.linhaDigitavel} onChange={set("linhaDigitavel")} /></Campo>
        <div className="md:col-span-2">
          <Campo label="PIX copia e cola" erro={erros.pixCopiaECola} dica="Preenchido quando o documento já traz o código.">
            <Textarea value={f.pixCopiaECola} onChange={set("pixCopiaECola")} className="min-h-16 font-mono text-xs" />
          </Campo>
        </div>
      </div>

      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={pend || lendo}>{pend ? "Salvando…" : "Salvar conta"}</Button>
        <Button variante="contorno" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}
