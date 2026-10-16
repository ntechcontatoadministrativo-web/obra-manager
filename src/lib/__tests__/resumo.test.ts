import { describe, it, expect } from "vitest";
import { fatosEmTexto, manchete, resumoExecutivo, type FatosDoProjeto } from "../resumo";

const fatos = (p: Partial<FatosDoProjeto> = {}): FatosDoProjeto => ({
  obra: "Residencial Alfa", cliente: "Construtora Beta", status: "Em andamento",
  inicio: "2026-01-01", previsaoTermino: "2026-12-31",
  terminoCalculado: "2026-12-31", desvioPrazoDias: 0,
  orcamento: 1_000_000, custoReal: 400_000, valorAgregado: 400_000,
  estimativaFinal: 1_000_000, sobraOuEstouro: 0,
  cpi: 1, spi: 1, avancoFisicoPct: 40,
  temBaseline: true, etapasCriticasAtrasadas: [], riscosCriticos: [],
  exposicaoRisco: 10, diariosPendentes: 0,
  ...p,
});

const tudo = (f: FatosDoProjeto) => resumoExecutivo(f).join(" ");

describe("resumo executivo", () => {
  it("abre dizendo obra, cliente, avanço e dinheiro", () => {
    const t = resumoExecutivo(fatos())[0];
    expect(t).toMatch(/Residencial Alfa/);
    expect(t).toMatch(/Construtora Beta/);
    expect(t).toMatch(/40%/);
  });

  it("conta o atraso e nomeia as etapas que o causam", () => {
    const t = tudo(fatos({
      desvioPrazoDias: 23, terminoCalculado: "2027-01-23",
      etapasCriticasAtrasadas: [{ nome: "Estrutura", diasAtraso: 12 }, { nome: "Cobertura", diasAtraso: 23 }],
    }));
    expect(t).toMatch(/23 dias além da previsão/);
    expect(t).toMatch(/Estrutura \(12 dias\)/);
    expect(t).toMatch(/Cobertura \(23 dias\)/);
  });

  it("diz adiantamento quando o desvio é negativo", () => {
    expect(tudo(fatos({ desvioPrazoDias: -5, terminoCalculado: "2026-12-26" }))).toMatch(/5 dias antes da previsão/);
  });

  it("usa singular com um dia só", () => {
    expect(tudo(fatos({ desvioPrazoDias: 1, terminoCalculado: "2027-01-01" }))).toMatch(/1 dia além/);
  });

  it("sem rede calculada, não inventa término", () => {
    const t = tudo(fatos({ desvioPrazoDias: null, terminoCalculado: null }));
    expect(t).toMatch(/Ainda não há cronograma em rede/);
    expect(t).not.toContain("além da previsão");
  });

  it("anuncia estouro com o valor", () => {
    const t = tudo(fatos({ cpi: 0.8, estimativaFinal: 1_250_000, sobraOuEstouro: -250_000 }));
    expect(t).toMatch(/0,80/);
    expect(t).toMatch(/estouro de/);
  });

  it("anuncia economia quando sobra", () => {
    expect(tudo(fatos({ cpi: 1.1, estimativaFinal: 909_000, sobraOuEstouro: 91_000 })))
      .toMatch(/abaixo do orçamento/);
  });

  it("obra sem despesa não ganha frase de desempenho de custo", () => {
    const t = tudo(fatos({ cpi: null, estimativaFinal: null, sobraOuEstouro: null }));
    expect(t).toMatch(/não há despesa lançada/);
    expect(t).not.toContain("desempenho de custo está em");
  });

  it("lista os riscos críticos", () => {
    const t = tudo(fatos({ riscosCriticos: [{ codigo: "R03", descricao: "Chuva na concretagem" }] }));
    expect(t).toMatch(/1 risco crítico em aberto/);
    expect(t).toMatch(/R03/);
  });

  it("sem risco crítico mas exposição alta, menciona só a exposição", () => {
    const t = tudo(fatos({ exposicaoRisco: 62 }));
    expect(t).toMatch(/62 de 100/);
  });

  it("obra tranquila não ganha parágrafo de risco", () => {
    expect(tudo(fatos())).not.toContain("exposição a risco");
  });

  it("avisa quando falta baseline, porque isso muda a leitura do prazo", () => {
    const t = tudo(fatos({ temBaseline: false }));
    expect(t).toMatch(/Ressalvas/);
    expect(t).toMatch(/baseline congelada/);
  });

  it("avisa sobre diário pendente", () => {
    expect(tudo(fatos({ diariosPendentes: 3 }))).toMatch(/3 dias úteis sem diário/);
  });

  it("obra em dia e com diário em ordem não ganha ressalva", () => {
    expect(tudo(fatos())).not.toContain("Ressalvas");
  });

  it("nunca devolve parágrafo vazio", () => {
    for (const f of [fatos(), fatos({ cpi: null, desvioPrazoDias: null, terminoCalculado: null })]) {
      expect(resumoExecutivo(f).every((p) => p.trim().length > 0)).toBe(true);
    }
  });
});

describe("manchete", () => {
  it("prioriza atraso somado a custo alto", () => {
    expect(manchete(fatos({ desvioPrazoDias: 10, cpi: 0.8 }))).toMatch(/atrasada em 10 dias e acima do custo/);
  });
  it("só atraso", () => {
    expect(manchete(fatos({ desvioPrazoDias: 10 }))).toMatch(/10 dias além da previsão/);
  });
  it("só custo", () => {
    expect(manchete(fatos({ cpi: 0.7 }))).toMatch(/custo acima do previsto/);
  });
  it("risco quando prazo e custo estão bem", () => {
    expect(manchete(fatos({ riscosCriticos: [{ codigo: "R01", descricao: "x" }] }))).toMatch(/1 risco crítico/);
  });
  it("obra saudável tem manchete positiva", () => {
    expect(manchete(fatos())).toMatch(/dentro do previsto/);
  });
});

describe("fatos em texto para o assistente", () => {
  const t = fatosEmTexto(fatos({ cpi: 0.82, riscosCriticos: [{ codigo: "R01", descricao: "Chuva" }] }));

  it("traz os números que o assistente precisa", () => {
    expect(t).toMatch(/CPI: 0.82/);
    expect(t).toMatch(/Orçamento: 1000000/);
    expect(t).toMatch(/R01 Chuva/);
  });

  it("marca explicitamente o que não foi calculado", () => {
    const vazio = fatosEmTexto(fatos({ cpi: null, spi: null, desvioPrazoDias: null, estimativaFinal: null }));
    expect(vazio).toMatch(/CPI: sem despesa/);
    expect(vazio).toMatch(/Desvio de prazo: não calculado/);
    expect(vazio).toMatch(/Custo final estimado: não calculado/);
  });

  it("não carrega dado pessoal", () => {
    expect(t.toLowerCase()).not.toContain("cpf");
    expect(t.toLowerCase()).not.toContain("banco");
  });
});
