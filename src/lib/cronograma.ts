/**
 * Cronograma: rede de dependências, datas cedo/tarde, folga e caminho
 * crítico (CPM).
 *
 * O que o cálculo faz: respeita as dependências e trata a data prevista
 * de início de cada etapa como piso ("não antes de"). É assim que obra
 * funciona — a laje não começa antes da data contratada da concretagem
 * mesmo que a estrutura termine adiantada.
 *
 * O que ele não faz: calendário de dias úteis, feriado e turno. Tudo em
 * dias corridos. Obra trabalha sábado com frequência, e misturar
 * calendário aqui esconde erro de rede atrás de erro de calendário.
 */

export type TipoDependencia = "TI" | "II" | "TT" | "IT";

export type EtapaRede = {
  id: string;
  nome: string;
  inicioPrevisto: Date;
  fimPrevisto: Date;
  /** Marco: duração zero, aparece como losango no Gantt. */
  ehMarco?: boolean;
};

export type Dependencia = {
  predecessoraId: string;
  sucessoraId: string;
  tipo: TipoDependencia;
  /** Dias corridos. Negativo adianta a sucessora (sobreposição). */
  folgaDias: number;
};

export type NoCalculado = {
  id: string;
  nome: string;
  duracaoDias: number;
  inicioCedo: Date;
  fimCedo: Date;
  inicioTarde: Date;
  fimTarde: Date;
  /** Dias que a etapa pode atrasar sem empurrar o fim da obra. */
  folgaTotalDias: number;
  ehCritica: boolean;
  /** Dias entre a data prevista hoje e a data cedo calculada. */
  deslocamentoDias: number;
};

export type ResultadoRede = {
  nos: NoCalculado[];
  /** Fim da obra pela rede. */
  terminoProjeto: Date | null;
  /** Ids em ciclo. Enquanto houver ciclo, nada é calculado. */
  ciclo: string[];
  /** Problemas que não impedem o cálculo. */
  avisos: string[];
};

const DIA = 86_400_000;
const paraDia = (d: Date) => Math.floor(d.getTime() / DIA);
const paraData = (dia: number) => new Date(dia * DIA);

/**
 * Ordenação topológica (Kahn). Devolve a ordem, ou os nós que sobraram
 * quando há ciclo — esses são exatamente os que participam dele.
 */
function ordenar(ids: string[], deps: Dependencia[]): { ordem: string[]; ciclo: string[] } {
  const grau = new Map<string, number>(ids.map((id) => [id, 0]));
  const saindo = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const d of deps) {
    if (!grau.has(d.predecessoraId) || !grau.has(d.sucessoraId)) continue;
    saindo.get(d.predecessoraId)!.push(d.sucessoraId);
    grau.set(d.sucessoraId, grau.get(d.sucessoraId)! + 1);
  }

  const fila = ids.filter((id) => grau.get(id) === 0);
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const prox of saindo.get(id)!) {
      const g = grau.get(prox)! - 1;
      grau.set(prox, g);
      if (g === 0) fila.push(prox);
    }
  }

  return { ordem, ciclo: ordem.length === ids.length ? [] : ids.filter((id) => !ordem.includes(id)) };
}

/** Calcula a rede inteira: datas cedo e tarde, folga e caminho crítico. */
export function calcularRede(etapas: EtapaRede[], dependencias: Dependencia[]): ResultadoRede {
  const avisos: string[] = [];
  if (!etapas.length) return { nos: [], terminoProjeto: null, ciclo: [], avisos };

  const ids = etapas.map((e) => e.id);
  const conhecidos = new Set(ids);

  // Dependência órfã (etapa apagada) é descartada com aviso, não quebra.
  const deps = dependencias.filter((d) => {
    const ok = conhecidos.has(d.predecessoraId) && conhecidos.has(d.sucessoraId);
    if (!ok) avisos.push(`Dependência ignorada: etapa ${conhecidos.has(d.predecessoraId) ? d.sucessoraId : d.predecessoraId} não existe.`);
    return ok && d.predecessoraId !== d.sucessoraId;
  });

  const { ordem, ciclo } = ordenar(ids, deps);
  if (ciclo.length) {
    const nomes = ciclo.map((id) => etapas.find((e) => e.id === id)?.nome ?? id);
    return {
      nos: [], terminoProjeto: null, ciclo,
      avisos: [...avisos, `Ciclo de dependências entre: ${nomes.join(", ")}. Nenhuma data foi calculada.`],
    };
  }

  type Estado = { etapa: EtapaRede; dur: number; piso: number; es: number; ef: number; ls: number; lf: number };
  const estado = new Map<string, Estado>();

  for (const e of etapas) {
    const ini = paraDia(e.inicioPrevisto);
    const fim = paraDia(e.fimPrevisto);
    let dur = e.ehMarco ? 0 : fim - ini;
    if (dur < 0) {
      avisos.push(`"${e.nome}" termina antes de começar; tratei a duração como zero.`);
      dur = 0;
    }
    estado.set(e.id, { etapa: e, dur, piso: ini, es: ini, ef: ini + dur, ls: 0, lf: 0 });
  }

  const porPredecessora = new Map<string, Dependencia[]>();
  const porSucessora = new Map<string, Dependencia[]>();
  for (const d of deps) {
    if (!porPredecessora.has(d.predecessoraId)) porPredecessora.set(d.predecessoraId, []);
    if (!porSucessora.has(d.sucessoraId)) porSucessora.set(d.sucessoraId, []);
    porPredecessora.get(d.predecessoraId)!.push(d);
    porSucessora.get(d.sucessoraId)!.push(d);
  }

  // ---- Passagem para a frente: datas mais cedo ----
  for (const id of ordem) {
    const n = estado.get(id)!;
    let es = n.piso; // a data prevista é piso: nada começa antes dela

    for (const d of porSucessora.get(id) ?? []) {
      const p = estado.get(d.predecessoraId)!;
      let exigido: number;
      switch (d.tipo) {
        case "TI": exigido = p.ef + d.folgaDias; break;            // termina -> começa
        case "II": exigido = p.es + d.folgaDias; break;            // começam juntas
        case "TT": exigido = p.ef + d.folgaDias - n.dur; break;    // terminam juntas
        case "IT": exigido = p.es + d.folgaDias - n.dur; break;    // começa -> termina
      }
      if (exigido > es) es = exigido;
    }

    n.es = es;
    n.ef = es + n.dur;
  }

  const terminoProjeto = Math.max(...[...estado.values()].map((n) => n.ef));

  // ---- Passagem para trás: datas mais tarde ----
  for (const id of [...ordem].reverse()) {
    const n = estado.get(id)!;
    let lf = terminoProjeto;

    for (const d of porPredecessora.get(id) ?? []) {
      const s = estado.get(d.sucessoraId)!;
      let limite: number;
      switch (d.tipo) {
        case "TI": limite = s.ls - d.folgaDias; break;
        case "II": limite = s.ls - d.folgaDias + n.dur; break;
        case "TT": limite = s.lf - d.folgaDias; break;
        case "IT": limite = s.lf - d.folgaDias + n.dur; break;
      }
      if (limite < lf) lf = limite;
    }

    n.lf = lf;
    n.ls = lf - n.dur;
  }

  const nos: NoCalculado[] = ordem.map((id) => {
    const n = estado.get(id)!;
    const folga = n.ls - n.es;
    return {
      id, nome: n.etapa.nome, duracaoDias: n.dur,
      inicioCedo: paraData(n.es), fimCedo: paraData(n.ef),
      inicioTarde: paraData(n.ls), fimTarde: paraData(n.lf),
      folgaTotalDias: folga,
      ehCritica: folga <= 0,
      deslocamentoDias: n.es - n.piso,
    };
  });

  // Devolve na ordem original das etapas, para a tela não reordenar sozinha.
  const porId = new Map(nos.map((n) => [n.id, n]));
  return {
    nos: ids.map((id) => porId.get(id)!).filter(Boolean),
    terminoProjeto: paraData(terminoProjeto),
    ciclo: [],
    avisos,
  };
}

/**
 * Diz se ligar duas etapas fecharia um ciclo. Usar antes de gravar: é
 * mais barato recusar na tela do que descobrir na hora do cálculo.
 */
export function criariaCiclo(
  predecessoraId: string,
  sucessoraId: string,
  existentes: Dependencia[],
): boolean {
  if (predecessoraId === sucessoraId) return true;

  // Existe caminho de sucessora de volta até predecessora?
  const saindo = new Map<string, string[]>();
  for (const d of existentes) {
    if (!saindo.has(d.predecessoraId)) saindo.set(d.predecessoraId, []);
    saindo.get(d.predecessoraId)!.push(d.sucessoraId);
  }

  const vistos = new Set<string>();
  const pilha = [sucessoraId];
  while (pilha.length) {
    const atual = pilha.pop()!;
    if (atual === predecessoraId) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    for (const prox of saindo.get(atual) ?? []) pilha.push(prox);
  }
  return false;
}

/**
 * Caminho crítico em ordem, para destacar no Gantt. Com empate (duas
 * frentes críticas em paralelo) devolve todas as etapas críticas.
 */
export function caminhoCritico(resultado: ResultadoRede): NoCalculado[] {
  return resultado.nos
    .filter((n) => n.ehCritica)
    .sort((a, b) => a.inicioCedo.getTime() - b.inicioCedo.getTime());
}

/**
 * Atraso do projeto contra a baseline, em dias. Positivo é atraso.
 */
export function atrasoContraBaseline(
  terminoCalculado: Date | null,
  terminoBaseline: Date | null,
): number | null {
  if (!terminoCalculado || !terminoBaseline) return null;
  return paraDia(terminoCalculado) - paraDia(terminoBaseline);
}
