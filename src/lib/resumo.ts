/**
 * Resumo executivo determinístico.
 *
 * É o texto que vai para o cliente, montado a partir dos números — sem
 * modelo de linguagem no caminho. A razão é simples: este parágrafo
 * circula fora da empresa, e um número inventado aqui custa contrato. O
 * assistente conversacional usa estes mesmos fatos, mas quem escreve o
 * relatório é esta função.
 */

export type FatosDoProjeto = {
  obra: string;
  cliente: string;
  status: string;
  /** Datas em ISO curta (AAAA-MM-DD). */
  inicio: string;
  previsaoTermino: string;
  terminoCalculado: string | null;
  desvioPrazoDias: number | null;

  orcamento: number;
  custoReal: number;
  valorAgregado: number;
  estimativaFinal: number | null;
  sobraOuEstouro: number | null;

  cpi: number | null;
  spi: number | null;
  avancoFisicoPct: number;

  temBaseline: boolean;
  etapasCriticasAtrasadas: { nome: string; diasAtraso: number }[];
  riscosCriticos: { codigo: string; descricao: string }[];
  exposicaoRisco: number;
  diariosPendentes: number;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBR = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Parágrafos do resumo, na ordem em que um diretor quer ler. */
export function resumoExecutivo(f: FatosDoProjeto): string[] {
  const paragrafos: string[] = [];

  // 1. Onde a obra está.
  const abertura = [
    `A obra ${f.obra}, do cliente ${f.cliente}, está com ${f.avancoFisicoPct.toFixed(0)}% de avanço físico`,
    `orçamento de ${brl(f.orcamento)}`,
    `e ${brl(f.custoReal)} já gastos`,
  ].join(", ");
  paragrafos.push(abertura + ".");

  // 2. Prazo.
  if (f.desvioPrazoDias === null) {
    paragrafos.push(
      `O prazo previsto é ${dataBR(f.previsaoTermino)}. Ainda não há cronograma em rede ` +
      `suficiente para projetar o término pelas dependências.`,
    );
  } else if (f.desvioPrazoDias > 0) {
    paragrafos.push(
      `O término projetado é ${dataBR(f.terminoCalculado!)}, ${plural(f.desvioPrazoDias, "dia", "dias")} ` +
      `além da previsão de ${dataBR(f.previsaoTermino)}.` +
      (f.etapasCriticasAtrasadas.length
        ? ` O atraso vem de ${f.etapasCriticasAtrasadas.map((e) => `${e.nome} (${plural(e.diasAtraso, "dia", "dias")})`).join(", ")}.`
        : ""),
    );
  } else if (f.desvioPrazoDias < 0) {
    paragrafos.push(
      `O término projetado é ${dataBR(f.terminoCalculado!)}, ` +
      `${plural(Math.abs(f.desvioPrazoDias), "dia", "dias")} antes da previsão.`,
    );
  } else {
    paragrafos.push(`O término projetado coincide com a previsão de ${dataBR(f.previsaoTermino)}.`);
  }

  // 3. Custo.
  if (f.cpi === null) {
    paragrafos.push("Ainda não há despesa lançada, então não existe desempenho de custo a comparar.");
  } else {
    const parte = `O desempenho de custo está em ${f.cpi.toFixed(2).replace(".", ",")}: ` +
      `cada R$ 1,00 gasto entregou R$ ${f.cpi.toFixed(2).replace(".", ",")} de obra.`;
    const projecao = f.estimativaFinal === null ? "" :
      f.sobraOuEstouro !== null && f.sobraOuEstouro < 0
        ? ` Mantido esse ritmo, o custo final chega a ${brl(f.estimativaFinal)}, ` +
          `um estouro de ${brl(Math.abs(f.sobraOuEstouro))}.`
        : f.sobraOuEstouro !== null && f.sobraOuEstouro > 0
          ? ` Mantido esse ritmo, a obra fecha em ${brl(f.estimativaFinal)}, ` +
            `${brl(f.sobraOuEstouro)} abaixo do orçamento.`
          : ` Mantido esse ritmo, a obra fecha no orçamento.`;
    paragrafos.push(parte + projecao);
  }

  // 4. Risco, só quando há o que dizer.
  if (f.riscosCriticos.length) {
    paragrafos.push(
      `Há ${plural(f.riscosCriticos.length, "risco crítico", "riscos críticos")} em aberto: ` +
      f.riscosCriticos.map((r) => `${r.codigo} (${r.descricao})`).join("; ") + ".",
    );
  } else if (f.exposicaoRisco >= 50) {
    paragrafos.push(`A exposição a risco está em ${f.exposicaoRisco} de 100, sem nenhum risco em nível crítico.`);
  }

  // 5. Ressalvas que mudam como ler os números acima.
  const ressalvas: string[] = [];
  if (!f.temBaseline) {
    ressalvas.push(
      "esta obra não tem baseline congelada, então o desvio de prazo é medido contra as datas atuais e tende a aparecer menor do que é",
    );
  }
  if (f.diariosPendentes > 0) {
    ressalvas.push(`${plural(f.diariosPendentes, "dia útil", "dias úteis")} sem diário concluído`);
  }
  if (ressalvas.length) {
    paragrafos.push("Ressalvas: " + ressalvas.join("; ") + ".");
  }

  return paragrafos;
}

/** Uma linha para o painel e para a notificação. */
export function manchete(f: FatosDoProjeto): string {
  if (f.desvioPrazoDias !== null && f.desvioPrazoDias > 0 && f.cpi !== null && f.cpi < 0.9) {
    return `${f.obra}: atrasada em ${plural(f.desvioPrazoDias, "dia", "dias")} e acima do custo previsto.`;
  }
  if (f.desvioPrazoDias !== null && f.desvioPrazoDias > 0) {
    return `${f.obra}: ${plural(f.desvioPrazoDias, "dia", "dias")} além da previsão.`;
  }
  if (f.cpi !== null && f.cpi < 0.9) {
    return `${f.obra}: custo acima do previsto, com ${f.avancoFisicoPct.toFixed(0)}% de avanço.`;
  }
  if (f.riscosCriticos.length) {
    return `${f.obra}: ${plural(f.riscosCriticos.length, "risco crítico", "riscos críticos")} em aberto.`;
  }
  return `${f.obra}: dentro do previsto, com ${f.avancoFisicoPct.toFixed(0)}% de avanço.`;
}

/**
 * Os mesmos fatos em texto compacto, para servir de contexto ao
 * assistente. Nada de CPF, dado bancário ou nome de funcionário entra
 * aqui: o assistente responde sobre a obra, não sobre pessoas.
 */
export function fatosEmTexto(f: FatosDoProjeto): string {
  const linhas = [
    `Obra: ${f.obra} | Cliente: ${f.cliente} | Situação: ${f.status}`,
    `Início: ${f.inicio} | Previsão de término: ${f.previsaoTermino}` +
      (f.terminoCalculado ? ` | Término calculado pela rede: ${f.terminoCalculado}` : ""),
    f.desvioPrazoDias === null ? "Desvio de prazo: não calculado" : `Desvio de prazo: ${f.desvioPrazoDias} dias`,
    `Orçamento: ${f.orcamento} | Custo real: ${f.custoReal} | Valor agregado: ${f.valorAgregado}`,
    `CPI: ${f.cpi ?? "sem despesa"} | SPI: ${f.spi ?? "sem trabalho previsto"} | Avanço físico: ${f.avancoFisicoPct}%`,
    f.estimativaFinal === null ? "Custo final estimado: não calculado" : `Custo final estimado: ${f.estimativaFinal}`,
    `Baseline congelada: ${f.temBaseline ? "sim" : "não"}`,
    `Exposição a risco: ${f.exposicaoRisco}/100`,
    f.etapasCriticasAtrasadas.length
      ? `Etapas críticas atrasadas: ${f.etapasCriticasAtrasadas.map((e) => `${e.nome} (${e.diasAtraso}d)`).join(", ")}`
      : "Etapas críticas atrasadas: nenhuma",
    f.riscosCriticos.length
      ? `Riscos críticos: ${f.riscosCriticos.map((r) => `${r.codigo} ${r.descricao}`).join(" | ")}`
      : "Riscos críticos: nenhum",
    `Dias úteis sem diário concluído: ${f.diariosPendentes}`,
  ];
  return linhas.join("\n");
}
