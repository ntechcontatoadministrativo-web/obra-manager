"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, Mic, MicOff, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { copiar } from "@/app/(app)/pagamentos/contas";
import { comandoDeVoz, type RespostaVoz } from "@/app/(app)/voz/actions";

/**
 * Botão de voz, presente em todas as telas.
 *
 * O reconhecimento de fala é o do navegador (Chrome e Edge no computador,
 * Chrome no Android, Safari no iPhone). O áudio vai para o serviço de voz
 * do navegador; ao sistema chega só o texto. Onde não houver suporte, a
 * mesma caixa aceita o comando digitado.
 */

type Reconhecedor = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

function criarReconhecedor(): Reconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

function falar(texto: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto.replace(/R\$\s?/g, ""));
  u.lang = "pt-BR";
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt-br"));
  if (voz) u.voice = voz;
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

const ERROS: Record<string, string> = {
  "not-allowed": "O microfone foi bloqueado. Libere o microfone para este site nas configurações do navegador.",
  "service-not-allowed": "O microfone foi bloqueado. Libere o microfone para este site nas configurações do navegador.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale.",
  "audio-capture": "Nenhum microfone encontrado.",
  network: "O reconhecimento de voz precisa de internet.",
};

export function AssistenteVoz() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [suporte, setSuporte] = useState(true);
  const [parcial, setParcial] = useState("");
  const [digitado, setDigitado] = useState("");
  const [ouvido, setOuvido] = useState("");
  const [pensando, setPensando] = useState(false);
  const [resposta, setResposta] = useState<RespostaVoz | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [lista, setLista] = useState<string[]>([]);
  const rec = useRef<Reconhecedor | null>(null);

  useEffect(() => {
    setSuporte(!!criarReconhecedor());
    // As vozes do navegador carregam depois; pedir uma vez já deixa a lista pronta.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => rec.current?.abort();
  }, []);

  async function executar(texto: string) {
    const t = texto.trim();
    if (!t) return;
    setOuvido(t); setPensando(true); setCopiado(false); setParcial("");
    const r = await comandoDeVoz({ texto: t, lista });
    setPensando(false);
    setResposta(r);
    if (r.lista) setLista(r.lista);
    falar(r.fala);
    if (r.copiar) setCopiado(await copiar(r.copiar.texto));
    if (r.navegar) router.push(r.navegar);
  }

  function ouvir() {
    if (ouvindo) { rec.current?.stop(); return; }
    const r = criarReconhecedor();
    if (!r) { setSuporte(false); return; }
    window.speechSynthesis?.cancel();
    r.lang = "pt-BR";
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    r.onresult = (e) => {
      let texto = "";
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = texto;
      }
      setParcial(texto);
    };
    r.onerror = (e) => { if (e.error !== "aborted") setResposta({ fala: ERROS[e.error] ?? "Não consegui ouvir. Tente de novo." }); };
    r.onend = () => { setOuvindo(false); if (final) executar(final); };
    rec.current = r;
    setResposta(null); setParcial(""); setOuvindo(true);
    r.start();
  }

  return (
    <>
      <button
        onClick={() => { setAberto(true); if (!aberto && suporte) ouvir(); }}
        aria-label="Comando de voz"
        className={cn(
          "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-laranja text-laranja-fg shadow-lg transition hover:brightness-110 md:bottom-6 md:right-6 print:hidden",
          aberto && "hidden",
        )}>
        <Mic size={24} aria-hidden />
      </button>

      {aberto && (
        <section aria-label="Comando de voz" className="fixed inset-x-3 bottom-20 z-40 max-h-[70vh] overflow-y-auto rounded-md border border-line bg-card shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[26rem] print:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <p className="font-display font-semibold">Comando de voz</p>
            <button onClick={() => { rec.current?.abort(); window.speechSynthesis?.cancel(); setAberto(false); }} aria-label="Fechar" className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-bg"><X size={18} aria-hidden /></button>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <button onClick={ouvir} disabled={!suporte || pensando} aria-pressed={ouvindo}
                aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
                className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition disabled:opacity-40",
                  ouvindo ? "animate-pulse border-perigo bg-perigo text-white" : "border-laranja text-laranja hover:bg-laranja/10")}>
                {suporte ? <Mic size={22} aria-hidden /> : <MicOff size={22} aria-hidden />}
              </button>
              <p className="text-sm text-muted" aria-live="polite">
                {!suporte ? "Este navegador não reconhece voz. Digite o comando." : ouvindo ? (parcial || "Ouvindo… fale agora.") : pensando ? "Procurando…" : "Toque no microfone e fale."}
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); executar(digitado); setDigitado(""); }} className="flex gap-2">
              <input value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder="Ou digite: o que falta pagar?" aria-label="Comando"
                className="min-h-11 flex-1 rounded border border-line bg-card px-3 text-sm" />
              <button type="submit" aria-label="Enviar comando" className="flex min-h-11 min-w-11 items-center justify-center rounded bg-laranja text-laranja-fg"><Send size={16} aria-hidden /></button>
            </form>

            {ouvido && <p className="text-xs text-muted">Você disse: “{ouvido}”</p>}

            {resposta && (
              <div className="space-y-3" aria-live="polite">
                <p className="text-sm">{resposta.fala}</p>
                {resposta.copiar && (
                  <button onClick={async () => setCopiado(await copiar(resposta.copiar!.texto))}
                    className="inline-flex min-h-11 items-center gap-2 rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg">
                    {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copiado ? "Copiado" : resposta.copiar.rotulo}
                  </button>
                )}
                {resposta.cartoes && resposta.cartoes.length > 0 && (
                  <ul className="divide-y divide-line rounded border border-line">
                    {resposta.cartoes.map((c) => {
                      const corpo = (
                        <>
                          <span className="flex items-baseline justify-between gap-2"><span className="font-medium">{c.titulo}</span>{c.valor && <span className="tabular-nums">{c.valor}</span>}</span>
                          {c.detalhe && <span className="block text-xs text-muted">{c.detalhe}</span>}
                        </>
                      );
                      return <li key={c.id}>{c.href ? <Link href={c.href} className="block p-2.5 text-sm hover:bg-bg">{corpo}</Link> : <span className="block p-2.5 text-sm">{corpo}</span>}</li>;
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
