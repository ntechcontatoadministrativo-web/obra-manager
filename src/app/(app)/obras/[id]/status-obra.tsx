"use client";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { alterarStatusObra } from "../actions";

export function StatusObra({ obraId, atual, podeArquivar }: { obraId: string; atual: string; podeArquivar: boolean }) {
  const [valor, setValor] = useState(atual);
  const [msg, setMsg] = useState("");
  const [pendente, start] = useTransition();

  function mudar(novo: string) {
    if (novo === "ARQUIVADA" && !confirm("Arquivar esta obra? Ela deixa de aparecer como ativa.")) return;
    const anterior = valor;
    setValor(novo); setMsg("");
    start(async () => {
      const r = await alterarStatusObra(obraId, novo);
      if (r.ok) setMsg("Situação atualizada.");
      else { setValor(anterior); setMsg(r.erro ?? "Não foi possível atualizar."); }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-muted" htmlFor="status-obra">Alterar situação</label>
      <Select id="status-obra" value={valor} disabled={pendente} onChange={(e) => mudar(e.target.value)} className="w-auto">
        <option value="EM_PLANEJAMENTO">Em planejamento</option>
        <option value="EM_ANDAMENTO">Em andamento</option>
        <option value="PARALISADA">Paralisada</option>
        <option value="CONCLUIDA">Concluída</option>
        {podeArquivar && <option value="ARQUIVADA">Arquivada</option>}
      </Select>
      <span role="status" className="text-sm text-muted">{msg}</span>
    </div>
  );
}
