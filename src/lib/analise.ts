/**
 * Monta, a partir do banco, o que as bibliotecas de cálculo precisam.
 *
 * Aqui mora a única regra de leitura que importa: as datas do valor
 * planejado saem da BASELINE ATIVA. Sem baseline, caem para as datas
 * previstas da própria etapa — e nesse caso a tela avisa, porque medir
 * contra cronograma remanejado dá SPI 1,00 para sempre.
 */
import type { PrismaClient } from "@prisma/client";
import { calcularEvm, curvaS, type EtapaEvm, type Indicadores, type PontoCurva } from "./evm";
import { calcularRede, type Dependencia, type EtapaRede, type ResultadoRede } from "./cronograma";

/** Etapas folha: etapa-pai é soma das filhas e contaria o valor duas vezes. */
async function etapasFolha(db: PrismaClient, obraId: string) {
  const todas = await db.etapa.findMany({
    where: { obraId },
    select: {
      id: true, paiId: true, nome: true, ordem: true, ehMarco: true,
      inicioPrevisto: true, fimPrevisto: true, inicioReal: true, fimReal: true,
      percentual: true, valorOrcado: true, status: true,
    },
    orderBy: { ordem: "asc" },
  });
  const comFilha = new Set(todas.map((e) => e.paiId).filter(Boolean) as string[]);
  return { todas, folhas: todas.filter((e) => !comFilha.has(e.id)) };
}

export type DadosEvm = {
  indicadores: Indicadores;
  curva: PontoCurva[];
  /** false quando não há baseline: a tela precisa dizer isso ao usuário. */
  temBaseline: boolean;
  nomeBaseline: string | null;
  /** Semana do último fechamento gravado. */
  ultimoFechamento: Date | null;
};

export async function carregarEvm(db: PrismaClient, obraId: string, data = new Date()): Promise<DadosEvm> {
  const [{ folhas }, baseline, despesas, fechamentos] = await Promise.all([
    etapasFolha(db, obraId),
    db.cronogramaBaseline.findFirst({
      where: { obraId, ativa: true },
      select: { id: true, nome: true, itens: { select: { etapaId: true, inicioPrevisto: true, fimPrevisto: true, valorOrcado: true } } },
    }),
    db.despesa.aggregate({ where: { obraId }, _sum: { valor: true } }),
    db.indicadorSemanal.findMany({
      where: { obraId },
      select: { semana: true, valorAgregado: true, custoReal: true },
      orderBy: { semana: "asc" },
    }),
  ]);

  const porEtapa = new Map((baseline?.itens ?? []).map((i) => [i.etapaId, i]));

  const paraEvm: EtapaEvm[] = folhas.map((e) => {
    const b = porEtapa.get(e.id);
    return {
      id: e.id,
      inicioPrevisto: b?.inicioPrevisto ?? e.inicioPrevisto,
      fimPrevisto: b?.fimPrevisto ?? e.fimPrevisto,
      valorOrcado: Number(b?.valorOrcado ?? e.valorOrcado),
      percentual: Number(e.percentual),
    };
  });

  return {
    indicadores: calcularEvm(paraEvm, Number(despesas._sum.valor ?? 0), data),
    curva: curvaS(
      paraEvm,
      fechamentos.map((f) => ({ semana: f.semana, valorAgregado: Number(f.valorAgregado), custoReal: Number(f.custoReal) })),
    ),
    temBaseline: !!baseline,
    nomeBaseline: baseline?.nome ?? null,
    ultimoFechamento: fechamentos.length ? fechamentos[fechamentos.length - 1].semana : null,
  };
}

export type DadosRede = ResultadoRede & {
  /** Etapas do caminho crítico já atrasadas, para a regra de risco. */
  criticasAtrasadas: { nome: string; diasAtraso: number }[];
};

export async function carregarRede(db: PrismaClient, obraId: string, hoje = new Date()): Promise<DadosRede> {
  const [{ folhas }, deps] = await Promise.all([
    etapasFolha(db, obraId),
    db.etapaDependencia.findMany({
      where: { predecessora: { obraId } },
      select: { predecessoraId: true, sucessoraId: true, tipo: true, folgaDias: true },
    }),
  ]);

  const etapas: EtapaRede[] = folhas.map((e) => ({
    id: e.id, nome: e.nome,
    inicioPrevisto: e.inicioPrevisto, fimPrevisto: e.fimPrevisto, ehMarco: e.ehMarco,
  }));

  const resultado = calcularRede(etapas, deps as Dependencia[]);

  const DIA = 86_400_000;
  const porId = new Map(folhas.map((e) => [e.id, e]));
  const criticasAtrasadas = resultado.nos
    .filter((n) => n.ehCritica)
    .map((n) => {
      const e = porId.get(n.id)!;
      const concluida = Number(e.percentual) >= 100;
      const atraso = concluida ? 0 : Math.floor((hoje.getTime() - n.fimCedo.getTime()) / DIA);
      return { nome: n.nome, diasAtraso: atraso };
    })
    .filter((x) => x.diasAtraso > 0);

  return { ...resultado, criticasAtrasadas };
}

/** Grava o fechamento da semana. Idempotente: refazer a mesma semana sobrescreve. */
export async function fecharSemana(db: PrismaClient, obraId: string, segunda: Date) {
  const domingo = new Date(segunda.getTime() + 6 * 86_400_000);
  const { indicadores } = await carregarEvm(db, obraId, domingo);

  const dados = {
    valorPlanejado: indicadores.pv,
    valorAgregado: indicadores.ev,
    custoReal: indicadores.ac,
    orcamentoTotal: indicadores.bac,
    cpi: indicadores.cpi,
    spi: indicadores.spi,
    estimativaTermino: indicadores.eac,
    avancoFisicoPct: indicadores.avancoFisicoPct,
  };

  return db.indicadorSemanal.upsert({
    where: { obraId_semana: { obraId, semana: segunda } },
    create: { obraId, semana: segunda, ...dados },
    update: dados,
  });
}
