/**
 * Risco: matriz probabilidade × impacto, exposição da obra e as regras
 * que mantêm alguns riscos sozinhos.
 *
 * A matriz é 5×5, como manda o PMBOK e como pede a especificação. O
 * produto dos dois eixos (1 a 25) dá o nível; as faixas abaixo são a
 * convenção usual e ficam num lugar só para virarem configuração da
 * empresa depois.
 */

export type Faixa = "baixo" | "moderado" | "alto" | "critico";

export type RiscoBase = {
  probabilidade: number; // 1 a 5
  impacto: number;       // 1 a 5
  situacao?: "IDENTIFICADO" | "EM_MITIGACAO" | "MATERIALIZADO" | "ENCERRADO";
};

const limitar = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

/** Produto dos dois eixos, de 1 a 25. */
export function nivel(r: RiscoBase): number {
  return limitar(r.probabilidade) * limitar(r.impacto);
}

export function faixa(n: number): Faixa {
  if (n >= 15) return "critico";
  if (n >= 10) return "alto";
  if (n >= 5) return "moderado";
  return "baixo";
}

export const ROTULO_FAIXA: Record<Faixa, string> = {
  baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico",
};

/** Tom do Badge/célula, no vocabulário de cores que o projeto já usa. */
export const TOM_FAIXA: Record<Faixa, "neutro" | "ok" | "alerta" | "perigo"> = {
  baixo: "ok", moderado: "neutro", alto: "alerta", critico: "perigo",
};

/** Risco que ainda pesa. Encerrado sai da conta; materializado continua. */
export function estaAtivo(r: RiscoBase): boolean {
  return r.situacao !== "ENCERRADO";
}

/**
 * Exposição da obra, de 0 a 100.
 *
 * Fórmula: 60% o pior risco e 40% a média dos ativos, cada um na escala
 * de 0 a 25. A escolha é deliberada — somar tudo faria dez riscos banais
 * pesarem como um crítico, e usar só o pior esconderia acúmulo. Com esse
 * par, um crítico sozinho já leva o índice para perto do topo, e muitos
 * moderados sobem sem saturar.
 */
export function exposicaoDaObra(riscos: RiscoBase[]): number {
  const ativos = riscos.filter(estaAtivo);
  if (!ativos.length) return 0;
  const niveis = ativos.map(nivel);
  const pior = Math.max(...niveis);
  const media = niveis.reduce((s, n) => s + n, 0) / niveis.length;
  return Math.round(100 * (0.6 * (pior / 25) + 0.4 * (media / 25)));
}

/** Contagem por faixa, para o resumo acima da matriz. */
export function contarPorFaixa(riscos: RiscoBase[]): Record<Faixa, number> {
  const fora: Record<Faixa, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
  for (const r of riscos.filter(estaAtivo)) fora[faixa(nivel(r))]++;
  return fora;
}

/** Monta a grade 5×5 com a contagem em cada célula, para a matriz visual. */
export function grade(riscos: RiscoBase[]): { probabilidade: number; impacto: number; quantidade: number; faixa: Faixa }[] {
  const celulas: { probabilidade: number; impacto: number; quantidade: number; faixa: Faixa }[] = [];
  const ativos = riscos.filter(estaAtivo);
  // Probabilidade desce de 5 para 1: na matriz clássica o canto superior
  // direito é o pior, e é lá que o olho vai primeiro.
  for (let p = 5; p >= 1; p--) {
    for (let i = 1; i <= 5; i++) {
      const n = p * i;
      celulas.push({
        probabilidade: p, impacto: i, faixa: faixa(n),
        quantidade: ativos.filter((r) => limitar(r.probabilidade) === p && limitar(r.impacto) === i).length,
      });
    }
  }
  return celulas;
}

// ------------------------------------------------- regras automáticas -

export type Sugestao = {
  codigoRegra: string;
  descricao: string;
  categoria: "PRAZO" | "CUSTO" | "CLIMA";
  probabilidade: number;
  impacto: number;
};

/**
 * Chuva prevista com etapa sensível em andamento (concretagem, cobertura,
 * pintura externa). Em Belém chove quase todo dia na quadra chuvosa, então
 * o gatilho é volume, não ocorrência.
 */
export function regraClima(chuvaPrevistaMm: number, etapasSensiveis: string[]): Sugestao | null {
  if (!etapasSensiveis.length || chuvaPrevistaMm < 10) return null;
  const probabilidade = chuvaPrevistaMm >= 40 ? 5 : chuvaPrevistaMm >= 20 ? 4 : 3;
  return {
    codigoRegra: "CLIMA_CHUVA",
    categoria: "CLIMA",
    descricao: `Chuva prevista de ${Math.round(chuvaPrevistaMm)} mm com ${etapasSensiveis.join(", ")} em andamento.`,
    probabilidade,
    impacto: 3,
  };
}

/** CPI abaixo do aceitável vira risco de custo, com nível pelo tamanho do desvio. */
export function regraCusto(cpi: number | null): Sugestao | null {
  if (cpi === null || cpi >= 0.9) return null;
  const probabilidade = cpi < 0.75 ? 5 : cpi < 0.85 ? 4 : 3;
  return {
    codigoRegra: "CUSTO_CPI",
    categoria: "CUSTO",
    descricao: `Desempenho de custo em ${cpi.toFixed(2)}: cada R$ 1,00 gasto entregou R$ ${cpi.toFixed(2)} de obra.`,
    probabilidade,
    impacto: cpi < 0.8 ? 5 : 4,
  };
}

/** Etapa do caminho crítico atrasada empurra o fim da obra por definição. */
export function regraPrazo(etapasCriticasAtrasadas: { nome: string; diasAtraso: number }[]): Sugestao | null {
  if (!etapasCriticasAtrasadas.length) return null;
  const pior = Math.max(...etapasCriticasAtrasadas.map((e) => e.diasAtraso));
  const probabilidade = 5; // já aconteceu: o atraso é certo, resta o impacto
  const impacto = pior >= 30 ? 5 : pior >= 15 ? 4 : pior >= 7 ? 3 : 2;
  return {
    codigoRegra: "PRAZO_CRITICA",
    categoria: "PRAZO",
    descricao:
      etapasCriticasAtrasadas.length === 1
        ? `"${etapasCriticasAtrasadas[0].nome}" está no caminho crítico e atrasou ${pior} dia${pior === 1 ? "" : "s"}.`
        : `${etapasCriticasAtrasadas.length} etapas do caminho crítico atrasadas; a pior em ${pior} dias.`,
    probabilidade,
    impacto,
  };
}

/**
 * Junta as sugestões das regras. Quem já existe como risco automático é
 * atualizado; o que a pessoa editou à mão (automatico = false) fica como
 * está — a regra não sobrescreve decisão de gente.
 */
export function conciliarAutomaticos(
  sugestoes: Sugestao[],
  existentes: { codigo: string; origemRegra: string | null; automatico: boolean }[],
): { criar: Sugestao[]; atualizar: { codigo: string; sugestao: Sugestao }[]; encerrar: string[] } {
  const porRegra = new Map(existentes.filter((e) => e.origemRegra).map((e) => [e.origemRegra!, e]));
  const criar: Sugestao[] = [];
  const atualizar: { codigo: string; sugestao: Sugestao }[] = [];

  for (const s of sugestoes) {
    const existente = porRegra.get(s.codigoRegra);
    if (!existente) criar.push(s);
    else if (existente.automatico) atualizar.push({ codigo: existente.codigo, sugestao: s });
    // existente.automatico === false: alguém assumiu o risco à mão; não toca.
  }

  // Regra que parou de disparar e cujo risco ainda é automático: encerra.
  const ativas = new Set(sugestoes.map((s) => s.codigoRegra));
  const encerrar = existentes
    .filter((e) => e.origemRegra && e.automatico && !ativas.has(e.origemRegra))
    .map((e) => e.codigo);

  return { criar, atualizar, encerrar };
}
