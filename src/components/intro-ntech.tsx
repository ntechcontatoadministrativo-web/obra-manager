"use client";
import { useEffect, useState } from "react";
import { NtechMarca } from "./ntech";

/**
 * Abertura "NTECH apresenta" exibida ao abrir o sistema.
 *
 * Aparece uma vez por sessão do navegador (sessionStorage); `?intro` na URL
 * força a exibição, útil para repetir numa apresentação. O script do
 * layout esconde a abertura antes da primeira pintura quando ela já foi
 * vista, então não há piscada. A animação inteira é CSS e termina sozinha
 * mesmo se o JavaScript falhar; aqui só se trata o "pular" e a remoção.
 */
const DURACAO_MS = 3900;

export function IntroNtech() {
  const [visivel, setVisivel] = useState(true);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains("sem-intro")) { setVisivel(false); return; }
    try { sessionStorage.setItem("intro-ntech", "1"); } catch {}
    const fim = setTimeout(() => setVisivel(false), DURACAO_MS);
    const pular = () => { setSaindo(true); setTimeout(() => setVisivel(false), 350); };
    window.addEventListener("keydown", pular, { once: true });
    return () => { clearTimeout(fim); window.removeEventListener("keydown", pular); };
  }, []);

  if (!visivel) return null;
  return (
    <div id="intro-ntech" role="presentation" onClick={() => { setSaindo(true); setTimeout(() => setVisivel(false), 350); }}
      className={saindo ? "intro-saindo" : undefined}>
      <div className="intro-grade" aria-hidden />
      <div className="relative flex flex-col items-center text-center">
        <div className="intro-marca"><NtechMarca className="h-24 w-24 md:h-28 md:w-28" /></div>
        <p className="intro-nome font-display text-5xl font-bold text-white md:text-6xl">NTECH</p>
        <div className="intro-linha" aria-hidden />
        <p className="intro-apresenta mt-5 font-mono text-xs uppercase tracking-[0.4em] text-white/60">apresenta</p>
        <div className="intro-produto mt-6">
          <div className="faixa-obra mx-auto mb-4 h-2 w-40 rounded-sm" aria-hidden />
          <p className="font-display text-3xl font-semibold text-white md:text-4xl">Obra Manager</p>
          <p className="mt-2 text-sm text-white/60">O canteiro inteiro na palma da mão.</p>
        </div>
      </div>
      <p className="intro-pular absolute bottom-6 text-xs text-white/40">toque ou pressione uma tecla para pular</p>
    </div>
  );
}
