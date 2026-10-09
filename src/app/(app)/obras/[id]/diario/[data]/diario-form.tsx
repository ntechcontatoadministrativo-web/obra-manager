"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudSun, Plus, Trash2, Users, Circle } from "lucide-react";
import { Button, Campo, Card, Input, Select, Textarea } from "@/components/ui";
import { pendenciasConclusao, MIN_RESUMO } from "@/lib/diario";
import { buscarClima, concluirDiario, efetivoDoPonto, salvarDiario } from "../actions";

type Clima = "ENSOLARADO" | "NUBLADO" | "CHUVOSO" | "TEMPESTADE";
type Impacto = "SEM_IMPACTO" | "PRODUCAO_REDUZIDA" | "PARALISACAO_PARCIAL" | "PARALISACAO_TOTAL";
export interface Inicial {
  clima: Clima; temperaturaC: number | null; impactoClima: Impacto; obsClima: string; descricao: string; observacoes: string;
  efetivo: { funcao: string; quantidade: number; terceiro: boolean; empresa: string }[];
  atividades: { etapaId: string; descricao: string; quantidade: number | null; unidade: string }[];
  equipamentos: { nome: string; horas: number }[];
  visitas: { nome: string; tipo: string }[];
}
export interface EtapaOpcao { id: string; nome: string; unidade: string; emAndamento: boolean }

const CLIMAS: [Clima, string][] = [["ENSOLARADO", "☀️ Ensolarado"], ["NUBLADO", "☁️ Nublado"], ["CHUVOSO", "🌧️ Chuvoso"], ["TEMPESTADE", "⛈️ Tempestade"]];
const IMPACTOS: [Impacto, string][] = [["SEM_IMPACTO", "Sem impacto"], ["PRODUCAO_REDUZIDA", "Produção reduzida"], ["PARALISACAO_PARCIAL", "Paralisação parcial"], ["PARALISACAO_TOTAL", "Paralisação total"]];
const num = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() === "" || Number.isNaN(n) ? null : n; };

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div><h2 className="font-display text-xl font-semibold">{titulo}</h2>{dica && <p className="text-sm text-muted">{dica}</p>}</div>
      {children}
    </Card>
  );
}
const Remover = ({ onClick, travado }: { onClick: () => void; travado: boolean }) =>
  <button type="button" onClick={onClick} disabled={travado} aria-label="Remover linha" className="flex min-h-11 min-w-11 items-center justify-center rounded text-perigo hover:bg-perigo/10 disabled:opacity-40"><Trash2 size={18} aria-hidden /></button>;

export function DiarioForm({ obraId, data, turno, inicial, etapas, fotos, travado, podeReabrir }: {
  obraId: string; data: string; turno: "MANHA" | "TARDE" | "INTEGRAL"; inicial: Inicial; etapas: EtapaOpcao[]; fotos: number; travado: boolean; podeReabrir?: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [busy, start] = useTransition();
  const set = <K extends keyof Inicial>(k: K, v: Inicial[K]) => setF((s) => ({ ...s, [k]: v }));
  const mudaLinha = <K extends "efetivo" | "atividades" | "equipamentos" | "visitas">(k: K, i: number, parte: Partial<Inicial[K][number]>) =>
    setF((s) => ({ ...s, [k]: (s[k] as Inicial[K]).map((l, j) => (j === i ? { ...l, ...parte } : l)) }));
  const tira = (k: "efetivo" | "atividades" | "equipamentos" | "visitas", i: number) => setF((s) => ({ ...s, [k]: s[k].filter((_, j) => j !== i) }));

  const pendencias = pendenciasConclusao({
    descricao: f.descricao, temperaturaC: f.temperaturaC, impactoClima: f.impactoClima, obsClima: f.obsClima,
    pessoas: f.efetivo.reduce((s, e) => s + (e.quantidade || 0), 0), atividades: f.atividades.length, fotos,
  });
  const base = { obraId, data, turno };

  const salvar = async () => salvarDiario({ ...base, ...f });
  function aoSalvar() { setMsg(null); start(async () => { const r = await salvar(); setMsg({ ok: r.ok, texto: r.mensagem }); if (r.ok) router.refresh(); }); }
  function aoConcluir() {
    if (!confirm("Ao concluir, o diário é assinado com o seu nome e a hora de agora, e fica bloqueado para edição. Continuar?")) return;
    setMsg(null);
    start(async () => {
      const s = await salvar();
      if (!s.ok) return setMsg({ ok: false, texto: s.mensagem });
      const r = await concluirDiario(base);
      setMsg({ ok: r.ok, texto: r.mensagem }); router.refresh();
    });
  }
  function puxarClima() {
    setMsg(null);
    start(async () => {
      const r = await buscarClima({ obraId, data });
      if (!r.ok || !r.tempo) return setMsg({ ok: false, texto: r.mensagem });
      setF((s) => ({ ...s, clima: r.tempo!.clima, temperaturaC: r.tempo!.temperaturaC, impactoClima: r.tempo!.impacto, obsClima: r.tempo!.impacto !== "SEM_IMPACTO" ? r.tempo!.nota : s.obsClima }));
      setMsg({ ok: true, texto: `Tempo preenchido. ${r.mensagem} Confira e ajuste se precisar.` });
    });
  }
  function puxarEquipe() {
    setMsg(null);
    start(async () => {
      const r = await efetivoDoPonto({ obraId, data });
      if (!r.ok || !r.linhas) return setMsg({ ok: false, texto: r.mensagem });
      set("efetivo", r.linhas); setMsg({ ok: true, texto: r.mensagem });
    });
  }
  function addEtapasEmAndamento() {
    const jaTem = new Set(f.atividades.map((a) => a.etapaId));
    const novas = etapas.filter((e) => e.emAndamento && !jaTem.has(e.id)).map((e) => ({ etapaId: e.id, descricao: "", quantidade: null, unidade: e.unidade }));
    if (novas.length === 0) return setMsg({ ok: false, texto: "Nenhuma etapa em andamento para adicionar." });
    set("atividades", [...f.atividades, ...novas]);
  }

  const T = travado || busy;
  return (
    <div className="space-y-5">
      <Secao titulo="Tempo e situação do dia" dica="Preenchido pela previsão do local da obra. Confira e ajuste: quem vê a obra é você.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label="Tempo"><Select value={f.clima} disabled={T} onChange={(e) => set("clima", e.target.value as Clima)}>{CLIMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Select></Campo>
          <Campo label="Temperatura (°C)"><Input inputMode="numeric" disabled={T} value={f.temperaturaC ?? ""} onChange={(e) => { const n = num(e.target.value); set("temperaturaC", n === null ? null : Math.round(n)); }} /></Campo>
          <Campo label="Efeito na obra"><Select value={f.impactoClima} disabled={T} onChange={(e) => set("impactoClima", e.target.value as Impacto)}>{IMPACTOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Select></Campo>
        </div>
        {f.impactoClima !== "SEM_IMPACTO" && <Campo label="Explique como o tempo afetou a obra"><Textarea disabled={T} value={f.obsClima} onChange={(e) => set("obsClima", e.target.value)} className="min-h-20" /></Campo>}
        {!travado && <Button variante="contorno" onClick={puxarClima} disabled={busy}><CloudSun size={18} aria-hidden /> Buscar o tempo do dia</Button>}
      </Secao>

      <Secao titulo="Equipe que trabalhou" dica="Vem do controle de ponto. Ajuste se alguém não bateu ponto.">
        {f.efetivo.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_88px_auto] items-end gap-2 sm:grid-cols-[1.4fr_90px_1fr_auto]">
            <Campo label={i === 0 ? "Função" : ""}><Input disabled={T} value={l.funcao} onChange={(e) => mudaLinha("efetivo", i, { funcao: e.target.value })} /></Campo>
            <Campo label={i === 0 ? "Qtd." : ""}><Input inputMode="numeric" disabled={T} value={l.quantidade} onChange={(e) => mudaLinha("efetivo", i, { quantidade: Math.max(0, Math.round(num(e.target.value) ?? 0)) })} /></Campo>
            <div className="hidden sm:block"><Campo label={i === 0 ? "Empresa (se terceirizado)" : ""}><Input disabled={T} value={l.empresa} onChange={(e) => mudaLinha("efetivo", i, { empresa: e.target.value, terceiro: e.target.value.trim() !== "" })} /></Campo></div>
            <Remover onClick={() => tira("efetivo", i)} travado={T} />
          </div>
        ))}
        {!travado && (
          <div className="flex flex-wrap gap-2">
            <Button variante="contorno" disabled={busy} onClick={() => set("efetivo", [...f.efetivo, { funcao: "", quantidade: 1, terceiro: false, empresa: "" }])}><Plus size={18} aria-hidden /> Adicionar função</Button>
            <Button variante="contorno" disabled={busy} onClick={puxarEquipe}><Users size={18} aria-hidden /> Preencher pelo ponto</Button>
          </div>
        )}
        <p className="text-sm text-muted">Total: <strong className="text-ink">{f.efetivo.reduce((s, e) => s + (e.quantidade || 0), 0)}</strong> pessoas</p>
      </Secao>

      <Secao titulo="Atividades executadas" dica="O que foi feito hoje, em qual etapa e quanto.">
        {f.atividades.map((a, i) => (
          <div key={i} className="space-y-2 rounded border border-line p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Campo label="Etapa"><Select disabled={T} value={a.etapaId} onChange={(e) => mudaLinha("atividades", i, { etapaId: e.target.value, unidade: etapas.find((x) => x.id === e.target.value)?.unidade ?? a.unidade })}>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Campo></div>
              <Remover onClick={() => tira("atividades", i)} travado={T} />
            </div>
            <Campo label="O que foi feito"><Input disabled={T} value={a.descricao} onChange={(e) => mudaLinha("atividades", i, { descricao: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Quantidade"><Input inputMode="decimal" disabled={T} value={a.quantidade ?? ""} onChange={(e) => mudaLinha("atividades", i, { quantidade: num(e.target.value) })} /></Campo>
              <Campo label="Unidade"><Input disabled={T} value={a.unidade} placeholder="m², m, un…" onChange={(e) => mudaLinha("atividades", i, { unidade: e.target.value })} /></Campo>
            </div>
          </div>
        ))}
        {!travado && etapas.length === 0 && <p className="text-sm text-muted">Cadastre as etapas da obra para registrar atividades. Por enquanto a obra não tem etapas.</p>}
        {!travado && etapas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variante="contorno" disabled={busy} onClick={() => set("atividades", [...f.atividades, { etapaId: etapas[0].id, descricao: "", quantidade: null, unidade: etapas[0].unidade }])}><Plus size={18} aria-hidden /> Adicionar atividade</Button>
            <Button variante="contorno" disabled={busy} onClick={addEtapasEmAndamento}>Adicionar etapas em andamento</Button>
          </div>
        )}
      </Secao>

      <Secao titulo="Equipamentos usados (opcional)">
        {f.equipamentos.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_96px_auto] items-end gap-2">
            <Campo label={i === 0 ? "Equipamento" : ""}><Input disabled={T} value={e.nome} placeholder="Betoneira, vibrador…" onChange={(x) => mudaLinha("equipamentos", i, { nome: x.target.value })} /></Campo>
            <Campo label={i === 0 ? "Horas" : ""}><Input inputMode="decimal" disabled={T} value={e.horas} onChange={(x) => mudaLinha("equipamentos", i, { horas: Math.min(24, num(x.target.value) ?? 0) })} /></Campo>
            <Remover onClick={() => tira("equipamentos", i)} travado={T} />
          </div>
        ))}
        {!travado && <Button variante="contorno" disabled={busy} onClick={() => set("equipamentos", [...f.equipamentos, { nome: "", horas: 8 }])}><Plus size={18} aria-hidden /> Adicionar equipamento</Button>}
      </Secao>

      <Secao titulo="Visitas recebidas (opcional)">
        {f.visitas.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Campo label={i === 0 ? "Nome" : ""}><Input disabled={T} value={v.nome} onChange={(x) => mudaLinha("visitas", i, { nome: x.target.value })} /></Campo>
            <Campo label={i === 0 ? "Quem é" : ""}><Input disabled={T} value={v.tipo} placeholder="Cliente, fiscal…" onChange={(x) => mudaLinha("visitas", i, { tipo: x.target.value })} /></Campo>
            <Remover onClick={() => tira("visitas", i)} travado={T} />
          </div>
        ))}
        {!travado && <Button variante="contorno" disabled={busy} onClick={() => set("visitas", [...f.visitas, { nome: "", tipo: "" }])}><Plus size={18} aria-hidden /> Adicionar visita</Button>}
      </Secao>

      <Secao titulo="Resumo do dia">
        <Campo label="O que aconteceu hoje" dica={`Pelo menos ${MIN_RESUMO} letras. Escreva como se fosse contar para quem não estava na obra.`}><Textarea disabled={T} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} className="min-h-32" /></Campo>
        <Campo label="Intercorrências e observações (opcional)"><Textarea disabled={T} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></Campo>
      </Secao>

      {!travado && (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-xl font-semibold">Para concluir o diário</h2>
          <ul className="space-y-1.5 text-sm">
            {pendencias.length === 0
              ? <li className="flex items-center gap-2 font-medium text-ok"><CheckCircle2 size={18} aria-hidden /> Tudo preenchido. Pode concluir.</li>
              : pendencias.map((p) => <li key={p} className="flex items-start gap-2"><Circle size={16} className="mt-0.5 shrink-0 text-alerta" aria-hidden /> {p}</li>)}
          </ul>
          <p className="text-xs text-muted">As fotos contam assim que são anexadas (seção abaixo). O resto vale com o que está na tela.</p>
          <div className="flex flex-wrap gap-3">
            <Button variante="contorno" onClick={aoSalvar} disabled={busy}>{busy ? "Aguarde…" : "Salvar rascunho"}</Button>
            <Button onClick={aoConcluir} disabled={busy || pendencias.length > 0}>Concluir e assinar</Button>
          </div>
        </Card>
      )}
      {travado && podeReabrir && <ReabrirBotao obraId={obraId} data={data} turno={turno} />}
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
    </div>
  );
}

function ReabrirBotao({ obraId, data, turno }: { obraId: string; data: string; turno: "MANHA" | "TARDE" | "INTEGRAL" }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button variante="contorno" disabled={busy} onClick={() => {
      if (!confirm("Reabrir remove a assinatura e libera a edição. Continuar?")) return;
      start(async () => { const { reabrirDiario } = await import("../actions"); await reabrirDiario({ obraId, data, turno }); router.refresh(); });
    }}>Reabrir para edição</Button>
  );
}
