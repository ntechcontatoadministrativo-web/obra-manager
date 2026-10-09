"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { MIN_FOTOS } from "@/lib/diario";
import { adicionarFotoDiario, removerFotoDiario } from "../actions";

async function comprimir(arquivo: File): Promise<string> {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.7, out = c.toDataURL("image/jpeg", q);
  while (out.length * 0.75 > 230 * 1024 && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); } // cabe no limite do servidor
  return out;
}

export function Fotos({ obraId, data, turno, fotos, travado }: {
  obraId: string; data: string; turno: "MANHA" | "TARDE" | "INTEGRAL"; fotos: { id: string; url: string; legenda: string | null }[]; travado: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  async function enviar(arquivos: File[]) {
    setMsg(null);
    let feitas = 0;
    for (const [i, a] of arquivos.entries()) {
      setEnviando(`Enviando foto ${i + 1} de ${arquivos.length}…`);
      try {
        const r = await adicionarFotoDiario({ obraId, data, turno, foto: await comprimir(a) });
        if (!r.ok) { setMsg({ ok: false, texto: r.mensagem }); break; }
        feitas++;
      } catch { setMsg({ ok: false, texto: "Não consegui enviar. Verifique a internet e tente de novo." }); break; }
    }
    setEnviando(null);
    if (feitas) { setMsg((m) => m ?? { ok: true, texto: `${feitas} foto${feitas > 1 ? "s" : ""} anexada${feitas > 1 ? "s" : ""}.` }); router.refresh(); }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Fotos do dia</h2>
        <span className={`text-sm font-medium ${fotos.length >= MIN_FOTOS ? "text-ok" : "text-alerta"}`}>{fotos.length} anexada{fotos.length === 1 ? "" : "s"} (mínimo {MIN_FOTOS})</span>
      </div>
      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.legenda ?? "Foto do diário"} className="aspect-square w-full rounded border border-line object-cover" />
              {!travado && (
                <button type="button" aria-label="Remover foto" className="absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded bg-black/60 text-white hover:bg-perigo"
                  onClick={async () => { if (!confirm("Remover esta foto?")) return; const r = await removerFotoDiario({ obraId, fotoId: f.id }); setMsg({ ok: r.ok, texto: r.mensagem }); router.refresh(); }}>
                  <Trash2 size={18} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!travado && (
        <>
          <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const a = [...(e.target.files ?? [])]; e.target.value = ""; if (a.length) void enviar(a); }} />
          <Button variante="contorno" disabled={!!enviando} onClick={() => ref.current?.click()}><Camera size={18} aria-hidden /> {enviando ?? "Tirar ou escolher fotos"}</Button>
        </>
      )}
      {msg && <p role="status" className={`text-sm font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
    </Card>
  );
}
