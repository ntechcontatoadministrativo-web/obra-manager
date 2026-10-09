"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Campo, Input, Select } from "@/components/ui";
import { atualizarPercentual, criarEtapa, criarEtapasPadrao, editarEtapa, excluirEtapa } from "./actions";

export interface FormEtapa {
  id?: string; nome: string; paiId: string; inicioPrevisto: string; fimPrevisto: string; valorOrcado: string; criterioMedicao: string;
  quantidadePrevista: string; responsavelId: string; paralisada: boolean;
}

export function EtapaForm({ obraId, inicial, pais, responsaveis, ehPai }: {
  obraId: string; inicial: FormEtapa; pais: { id: string; rotulo: string }[]; responsaveis: { id: string; nome: string }[]; ehPai: boolean;
}) {
  const router = useRouter();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [busy, start] = useTransition();
  const editando = !!inicial.id;

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      setMsg(null); setErros({});
      start(async () => {
        const r = editando ? await editarEtapa(obraId, inicial.id!, dados) : await criarEtapa(obraId, dados);
        setErros(r.erros ?? {}); setMsg({ ok: r.ok, texto: r.mensagem });
        if (r.ok) { router.replace(`/obras/${obraId}/etapas`); router.refresh(); }
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome da etapa" erro={erros.nome}><Input name="nome" required defaultValue={inicial.nome} placeholder="Fundação, Alvenaria…" /></Campo>
        <Campo label="Fica dentro de (opcional)" erro={erros.paiId} dica="Escolha uma etapa para criar uma sub-etapa.">
          <Select name="paiId" defaultValue={inicial.paiId}><option value="">— é uma etapa principal —</option>{pais.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}</Select>
        </Campo>
        <Campo label="Início previsto" erro={erros.inicioPrevisto}><Input type="date" name="inicioPrevisto" required defaultValue={inicial.inicioPrevisto} readOnly={ehPai} /></Campo>
        <Campo label="Fim previsto" erro={erros.fimPrevisto}><Input type="date" name="fimPrevisto" required defaultValue={inicial.fimPrevisto} readOnly={ehPai} /></Campo>
        <Campo label="Valor orçado (R$)" erro={erros.valorOrcado} dica={ehPai ? "Soma das sub-etapas (calculado)." : "Ex.: 180.000,00"}><Input name="valorOrcado" inputMode="decimal" defaultValue={inicial.valorOrcado} readOnly={ehPai} /></Campo>
        <Campo label="Responsável (opcional)" erro={erros.responsavelId}>
          <Select name="responsavelId" defaultValue={inicial.responsavelId}><option value="">— ninguém —</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</Select>
        </Campo>
        <Campo label="Medida da etapa (opcional)" dica="Ex.: m², m, un, ponto"><Input name="criterioMedicao" defaultValue={inicial.criterioMedicao} maxLength={20} /></Campo>
        <Campo label="Quantidade prevista (opcional)" erro={erros.quantidadePrevista}><Input name="quantidadePrevista" inputMode="decimal" defaultValue={inicial.quantidadePrevista} /></Campo>
      </div>
      {ehPai
        ? <p className="rounded border border-line bg-bg p-3 text-sm text-muted">Esta etapa tem sub-etapas: datas, valor e andamento são calculados a partir delas.</p>
        : <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="paralisada" value="sim" defaultChecked={inicial.paralisada} className="h-5 w-5" /> Etapa paralisada</label>}
      {!editando && <p className="text-xs text-muted">Se a etapa-pai já tinha valores próprios, eles passam a ser a soma das sub-etapas.</p>}
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>{busy ? "Salvando…" : editando ? "Salvar etapa" : "Criar etapa"}</Button>
        <Button type="button" variante="contorno" onClick={() => router.replace(`/obras/${obraId}/etapas`)}>Cancelar</Button>
        {editando && (
          <Button type="button" variante="perigo" disabled={busy} onClick={() => {
            if (!confirm("Apagar esta etapa? Essa ação não pode ser desfeita.")) return;
            start(async () => { const r = await excluirEtapa(obraId, inicial.id!); setMsg({ ok: r.ok, texto: r.mensagem }); if (r.ok) { router.replace(`/obras/${obraId}/etapas`); router.refresh(); } });
          }}>Apagar</Button>
        )}
      </div>
    </form>
  );
}

/** Informar o andamento (0 a 100) de uma etapa, direto na lista. */
export function Andamento({ obraId, etapaId, valor }: { obraId: string; etapaId: string; valor: number }) {
  const router = useRouter();
  const [v, setV] = useState(String(valor).replace(".", ","));
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const n = Number(v.replace(",", "."));
  const valido = v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`pct-${etapaId}`}>Andamento em porcentagem</label>
      <Input id={`pct-${etapaId}`} inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); setMsg(""); }} className="w-20 text-right" aria-invalid={!valido} />
      <span className="text-sm text-muted">%</span>
      <Button variante="contorno" className="min-h-11 px-3" disabled={busy || !valido || n === valor}
        onClick={() => start(async () => { const r = await atualizarPercentual({ obraId, etapaId, percentual: n }); setMsg(r.ok ? "Salvo" : r.mensagem); if (r.ok) router.refresh(); })}>
        {busy ? "…" : "Atualizar"}
      </Button>
      {msg && <span role="status" className={`text-xs ${msg === "Salvo" ? "text-ok" : "text-perigo"}`}>{msg}</span>}
    </div>
  );
}

export function EtapasPadraoBotao({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button disabled={busy} onClick={() => start(async () => { const r = await criarEtapasPadrao(obraId); setMsg(r.mensagem); if (r.ok) router.refresh(); })}>{busy ? "Criando…" : "Criar etapas típicas de obra"}</Button>
      {msg && <p role="status" className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
