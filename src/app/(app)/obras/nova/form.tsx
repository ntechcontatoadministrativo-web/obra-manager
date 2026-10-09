"use client";
import { useState, useTransition } from "react";
import { Button, Campo, Input, Select, Textarea } from "@/components/ui";
import { criarObra } from "../actions";

export function NovaObraForm() {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState("");
  const [pendente, start] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await criarObra(dados); // em caso de sucesso, o servidor redireciona para a obra
      if (r && !r.ok) { setErros(r.erros); setGeral(r.geral ?? (Object.keys(r.erros).length ? "Corrija os campos destacados." : "")); }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <Campo label="Nome da obra" erro={erros.nome}><Input name="nome" required /></Campo>
      <Campo label="Endereço completo" erro={erros.endereco}><Input name="endereco" required /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Cliente" erro={erros.clienteNome}><Input name="clienteNome" required /></Campo>
        <Campo label="Engenheiro responsável (opcional)" erro={erros.engenheiroNome}><Input name="engenheiroNome" /></Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Data de início" erro={erros.dataInicio}><Input name="dataInicio" type="date" required /></Campo>
        <Campo label="Previsão de término" erro={erros.previsaoTermino}><Input name="previsaoTermino" type="date" required /></Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Valor do contrato (R$)" erro={erros.valorContrato} dica="Ex.: 1.800.000,00"><Input name="valorContrato" inputMode="decimal" required /></Campo>
        <Campo label="Área construída (m², opcional)" erro={erros.areaConstruidaM2}><Input name="areaConstruidaM2" inputMode="decimal" /></Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Latitude (opcional)" erro={erros.latitude} dica="Necessária para validar o ponto por GPS. Ex.: -1,4558"><Input name="latitude" inputMode="decimal" /></Campo>
        <Campo label="Longitude (opcional)" erro={erros.longitude} dica="No Google Maps, clique com o botão direito no local da obra para copiar."><Input name="longitude" inputMode="decimal" /></Campo>
      </div>
      <Campo label="Situação" erro={erros.status}>
        <Select name="status" defaultValue="EM_PLANEJAMENTO">
          <option value="EM_PLANEJAMENTO">Em planejamento</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="PARALISADA">Paralisada</option>
          <option value="CONCLUIDA">Concluída</option>
        </Select>
      </Campo>
      <Campo label="Descrição e escopo (opcional)" erro={erros.descricao}><Textarea name="descricao" /></Campo>

      {geral && <p role="alert" className="rounded border border-perigo/30 bg-perigo/10 p-3 text-sm font-medium text-perigo">{geral}</p>}
      <Button type="submit" disabled={pendente}>{pendente ? "Salvando…" : "Cadastrar obra"}</Button>
    </form>
  );
}
