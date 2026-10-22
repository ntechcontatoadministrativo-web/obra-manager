"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Campo, Card, Input } from "@/components/ui";
import { salvarFornecedor } from "./actions";

type F = {
  id: string; nome: string; cnpj: string | null; contato: string | null; telefone: string | null;
  email: string | null; pixChave: string | null; prazoEntregaDias: number | null; ordens: number;
};
type Form = { id?: string; nome: string; cnpj: string; contato: string; telefone: string; email: string; pixChave: string; prazoEntregaDias: string };
const VAZIO: Form = { nome: "", cnpj: "", contato: "", telefone: "", email: "", pixChave: "", prazoEntregaDias: "" };

export function Fornecedores({ fornecedores, podeCriar, podeEditar }: { fornecedores: F[]; podeCriar: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [form, setForm] = useState<Form | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value });

  function salvar() {
    if (!form) return;
    setErros({});
    start(async () => {
      const r = await salvarFornecedor({ ...form, prazoEntregaDias: form.prazoEntregaDias ? Number(form.prazoEntregaDias) : null });
      setMsg({ ok: r.ok, texto: r.mensagem });
      if (!r.ok) { setErros(r.erros ?? {}); return; }
      setForm(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
      {podeCriar && !form && <Button onClick={() => { setForm({ ...VAZIO }); setMsg(null); }}><Plus size={18} aria-hidden /> Novo fornecedor</Button>}

      {form && (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-xl font-semibold">{form.id ? "Editar fornecedor" : "Novo fornecedor"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Nome" erro={erros.nome}><Input value={form.nome} onChange={set("nome")} /></Campo>
            <Campo label="CNPJ" erro={erros.cnpj}><Input value={form.cnpj} onChange={set("cnpj")} /></Campo>
            <Campo label="Chave PIX" erro={erros.pixChave} dica="CNPJ, e-mail, telefone (+55DDDNÚMERO) ou chave aleatória."><Input value={form.pixChave} onChange={set("pixChave")} /></Campo>
            <Campo label="Prazo de entrega (dias)" erro={erros.prazoEntregaDias}><Input inputMode="numeric" value={form.prazoEntregaDias} onChange={set("prazoEntregaDias")} /></Campo>
            <Campo label="Contato" erro={erros.contato}><Input value={form.contato} onChange={set("contato")} /></Campo>
            <Campo label="Telefone" erro={erros.telefone}><Input value={form.telefone} onChange={set("telefone")} /></Campo>
            <Campo label="E-mail" erro={erros.email}><Input type="email" value={form.email} onChange={set("email")} /></Campo>
          </div>
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={pend}>{pend ? "Salvando…" : "Salvar"}</Button>
            <Button variante="contorno" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {fornecedores.length === 0
        ? <Card className="p-5 text-sm text-muted">Nenhum fornecedor cadastrado.</Card>
        : (
          <Card className="divide-y divide-line">
            {fornecedores.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-xs text-muted">{[f.cnpj, f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
                </div>
                <p className="min-w-0 text-xs">{f.pixChave ? <>PIX: <span className="break-all font-medium">{f.pixChave}</span></> : <span className="text-alerta">Sem chave PIX</span>}</p>
                <span className="text-xs text-muted">{f.ordens} ordem(ns)</span>
                {podeEditar && (
                  <Button variante="fantasma" className="min-h-9 px-2" aria-label={`Editar ${f.nome}`}
                    onClick={() => { setMsg(null); setForm({ id: f.id, nome: f.nome, cnpj: f.cnpj ?? "", contato: f.contato ?? "", telefone: f.telefone ?? "", email: f.email ?? "", pixChave: f.pixChave ?? "", prazoEntregaDias: f.prazoEntregaDias?.toString() ?? "" }); }}>
                    <Pencil size={16} aria-hidden />
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
    </div>
  );
}
