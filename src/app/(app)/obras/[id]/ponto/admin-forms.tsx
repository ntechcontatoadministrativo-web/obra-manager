"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button, Campo, Input, Select } from "@/components/ui";
import { cadastrarFuncionario, definirLocalObra } from "./actions";

export function NovoFuncionario({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [terceiro, setTerceiro] = useState("nao");
  const [pendente, start] = useTransition();

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const dados = Object.fromEntries(new FormData(form)) as Record<string, string>;
      start(async () => {
        const r = await cadastrarFuncionario(obraId, dados);
        setErros(r.erros); setMsg(r.ok ? "Funcionário cadastrado." : r.mensagem ?? "");
        if (r.ok) { form.reset(); setTerceiro("nao"); router.refresh(); }
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" erro={erros.nome}><Input name="nome" required /></Campo>
        <Campo label="CPF" erro={erros.cpf} dica="Fica guardado criptografado."><Input name="cpf" inputMode="numeric" required /></Campo>
        <Campo label="Função" erro={erros.funcao}><Input name="funcao" placeholder="Pedreiro, servente…" required /></Campo>
        <Campo label="Vínculo" erro={erros.vinculo}>
          <Select name="vinculo" defaultValue="CLT">
            <option value="CLT">CLT</option><option value="MEI">MEI</option><option value="DIARISTA">Diarista</option><option value="EMPREITADA">Empreitada</option>
          </Select>
        </Campo>
        <Campo label="Telefone (opcional)"><Input name="telefone" inputMode="tel" /></Campo>
        <Campo label="É de empresa terceirizada?">
          <Select name="terceiro" value={terceiro} onChange={(e) => setTerceiro(e.target.value)}><option value="nao">Não, é nosso</option><option value="sim">Sim, terceirizado</option></Select>
        </Campo>
      </div>
      {terceiro === "sim" && <Campo label="Nome da empresa terceirizada"><Input name="empresaTerceira" /></Campo>}
      {msg && <p role="status" className={`text-sm font-medium ${msg === "Funcionário cadastrado." ? "text-ok" : "text-perigo"}`}>{msg}</p>}
      <Button type="submit" disabled={pendente}>{pendente ? "Salvando…" : "Cadastrar funcionário"}</Button>
    </form>
  );
}

export function LocalObra({ obraId, temLocal }: { obraId: string; temLocal: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function usarMinhaPosicao() {
    setMsg(""); setBusy(true);
    if (!navigator.geolocation) { setBusy(false); return setMsg("Este aparelho não tem GPS."); }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const r = await definirLocalObra(obraId, p.coords.latitude, p.coords.longitude);
        setMsg(r.mensagem); setBusy(false); if (r.ok) router.refresh();
      },
      () => { setMsg("Não consegui ler a localização. Permita o acesso ao local no navegador."); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {temLocal ? "A obra já tem localização. O ponto só vale perto dela." : "A obra ainda não tem localização, então o ponto não confere a distância."}{" "}
        Estando <strong>no canteiro</strong>, toque no botão para marcar este ponto como o centro da obra.
      </p>
      <Button variante="contorno" onClick={usarMinhaPosicao} disabled={busy}><MapPin size={18} aria-hidden /> {busy ? "Lendo GPS…" : "Usar minha localização como a da obra"}</Button>
      {msg && <p role="status" className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
