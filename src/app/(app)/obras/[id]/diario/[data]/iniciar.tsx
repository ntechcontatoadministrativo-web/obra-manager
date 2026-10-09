"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { iniciarDiario } from "../actions";

export function IniciarDiario({ obraId, data, turno }: { obraId: string; data: string; turno: "MANHA" | "TARDE" | "INTEGRAL" }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3">
      <Button disabled={busy} onClick={() => start(async () => { const r = await iniciarDiario({ obraId, data, turno }); if (r.ok) router.refresh(); else setMsg(r.mensagem); })}>
        {busy ? "Abrindo (buscando tempo e equipe)…" : "Abrir o diário deste dia"}
      </Button>
      {msg && <p role="alert" className="text-sm font-medium text-perigo">{msg}</p>}
    </div>
  );
}
