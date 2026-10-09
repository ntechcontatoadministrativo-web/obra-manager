"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { EXIGE_FOTO, ROTULO_ACAO, type AcaoPonto } from "@/lib/ponto";
import { registrarPonto } from "./actions";

export interface FuncionarioPonto { id: string; nome: string; funcao: string; acoes: AcaoPonto[] }

/** Reduz a foto para ~640px JPEG (≈40–80 KB) antes de enviar: rápido no 4G e barato de guardar. */
async function comprimir(arquivo: File): Promise<string> {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 640 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.65);
}

function localizar(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function Registrar({ obraId, funcionarios }: { obraId: string; funcionarios: FuncionarioPonto[] }) {
  const router = useRouter();
  const [funcId, setFuncId] = useState(funcionarios[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const pendente = useRef<AcaoPonto | null>(null);
  const atual = funcionarios.find((f) => f.id === funcId);

  async function enviar(acao: AcaoPonto, arquivo?: File) {
    setEnviando(true); setMsg(null);
    try {
      let foto: string | undefined, lat: number | undefined, lng: number | undefined;
      if (arquivo) {
        foto = await comprimir(arquivo);
        const pos = await localizar();
        if (pos) { lat = pos.lat; lng = pos.lng; }
      }
      const r = await registrarPonto({ obraId, funcionarioId: funcId, acao, foto, lat, lng });
      setMsg({ ok: r.ok, texto: r.mensagem });
      if (r.ok) router.refresh();
    } catch {
      setMsg({ ok: false, texto: "Não consegui enviar. Verifique a internet e tente de novo." });
    } finally { setEnviando(false); }
  }

  function clicar(acao: AcaoPonto) {
    if (EXIGE_FOTO[acao]) { pendente.current = acao; arquivoRef.current?.click(); }
    else void enviar(acao);
  }

  if (funcionarios.length === 0)
    return <Card className="p-5 text-sm text-muted">Cadastre um funcionário abaixo para começar a registrar o ponto.</Card>;

  return (
    <Card className="space-y-4 p-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Funcionário</span>
        <Select value={funcId} onChange={(e) => { setFuncId(e.target.value); setMsg(null); }}>
          {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome} — {f.funcao}</option>)}
        </Select>
      </label>

      {/* Câmera nativa do celular (selfie). No computador abre o seletor de arquivos. */}
      <input ref={arquivoRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && pendente.current) void enviar(pendente.current, f); }} />

      {atual && atual.acoes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {atual.acoes.map((a) => (
            <Button key={a} onClick={() => clicar(a)} disabled={enviando} variante={a === "ENTRADA" || a === "SAIDA" ? "primario" : "contorno"} className="min-h-14 text-base">
              {EXIGE_FOTO[a] && <Camera size={20} aria-hidden />} {enviando ? "Enviando…" : ROTULO_ACAO[a]}
            </Button>
          ))}
        </div>
      ) : (
        <p className="rounded border border-ok/30 bg-ok/10 p-3 text-sm font-medium text-ok">Todas as batidas de hoje já foram registradas para este funcionário.</p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={14} aria-hidden /> Entrada e saída pedem foto e a localização do celular.</p>
      {msg && <p role="status" className={`rounded border p-3 text-sm font-medium ${msg.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-perigo/30 bg-perigo/10 text-perigo"}`}>{msg.texto}</p>}
    </Card>
  );
}
