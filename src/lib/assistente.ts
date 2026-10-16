/**
 * Assistente do projeto.
 *
 * Desenho em três partes, para que o sistema continue útil mesmo sem
 * nenhum provedor de IA configurado:
 *
 *   1. `montarFatos` lê o banco e produz um retrato factual da obra.
 *   2. `resumoExecutivo` (em resumo.ts) escreve o relatório a partir
 *      desses fatos, sem modelo nenhum. É o que vai para o cliente.
 *   3. `perguntar` leva os mesmos fatos a um modelo, para conversa livre.
 *      Sem chave configurada, devolve o resumo determinístico e diz que
 *      a conversa está desligada.
 *
 * O modelo nunca toca no banco: recebe um texto pronto, montado aqui, do
 * qual CPF, dado bancário e nome de funcionário ficam de fora.
 */
import type { PrismaClient } from "@prisma/client";
import { carregarEvm, carregarRede } from "./analise";
import { atrasoContraBaseline } from "./cronograma";
import { exposicaoDaObra, faixa, nivel } from "./risco";
import { fatosEmTexto, type FatosDoProjeto } from "./resumo";
import { diasSemDiario } from "./diario";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function montarFatos(db: PrismaClient, obraId: string): Promise<FatosDoProjeto | null> {
  const obra = await db.obra.findUnique({
    where: { id: obraId },
    select: {
      nome: true, clienteNome: true, status: true,
      dataInicio: true, previsaoTermino: true,
    },
  });
  if (!obra) return null;

  const [evm, rede, riscos, diarios] = await Promise.all([
    carregarEvm(db, obraId),
    carregarRede(db, obraId),
    db.risco.findMany({
      where: { obraId },
      select: { codigo: true, descricao: true, probabilidade: true, impacto: true, situacao: true },
    }),
    db.diarioObra.findMany({
      where: { obraId, assinadoEm: { not: null } },
      select: { data: true },
    }),
  ]);

  // Janela de 30 dias: pendência mais antiga que isso já não é notícia.
  const pendentes = diasSemDiario({
    hoje: iso(new Date()),
    inicio: iso(obra.dataInicio),
    concluidos: new Set(diarios.map((d) => iso(d.data))),
    diasPorSemana: 5,
    janela: 30,
  }).length;

  return {
    obra: obra.nome,
    cliente: obra.clienteNome,
    status: obra.status,
    inicio: iso(obra.dataInicio),
    previsaoTermino: iso(obra.previsaoTermino),
    terminoCalculado: rede.terminoProjeto ? iso(rede.terminoProjeto) : null,
    desvioPrazoDias: atrasoContraBaseline(rede.terminoProjeto, obra.previsaoTermino),

    orcamento: evm.indicadores.bac,
    custoReal: evm.indicadores.ac,
    valorAgregado: evm.indicadores.ev,
    estimativaFinal: evm.indicadores.eac,
    sobraOuEstouro: evm.indicadores.vac,

    cpi: evm.indicadores.cpi,
    spi: evm.indicadores.spi,
    avancoFisicoPct: evm.indicadores.avancoFisicoPct,

    temBaseline: evm.temBaseline,
    etapasCriticasAtrasadas: rede.criticasAtrasadas,
    riscosCriticos: riscos
      .filter((r) => r.situacao !== "ENCERRADO" && faixa(nivel(r)) === "critico")
      .map((r) => ({ codigo: r.codigo, descricao: r.descricao })),
    exposicaoRisco: exposicaoDaObra(riscos),
    diariosPendentes: pendentes,
  };
}

// ----------------------------------------------------------- modelo --

export type Mensagem = { papel: "usuario" | "assistente"; texto: string };

const INSTRUCAO = `Você responde perguntas sobre uma obra de construção civil para engenheiros e gestores brasileiros.

Regras:
- Use SOMENTE os dados do bloco FATOS. Não estime, não complete e não suponha número que não esteja lá.
- Quando a resposta depender de algo que não está nos FATOS, diga exatamente o que falta.
- Responda em português do Brasil, direto, sem rodeio e sem repetir a pergunta.
- Valores em reais e datas no formato brasileiro.
- Não dê parecer jurídico nem contábil.`;

export type Resposta = {
  texto: string;
  /** false quando nenhum provedor está configurado. */
  modeloAtivo: boolean;
};

/**
 * Chamada ao provedor, isolada aqui de propósito: trocar de fornecedor
 * é mexer nesta função e em mais nada.
 *
 * Precisa de ASSISTENTE_API_KEY. Opcionalmente ASSISTENTE_URL e
 * ASSISTENTE_MODELO, para apontar a outro provedor compatível.
 */
async function chamarModelo(fatos: string, historico: Mensagem[], pergunta: string): Promise<string> {
  const chave = process.env.ASSISTENTE_API_KEY;
  if (!chave) throw new Error("sem chave");

  const url = process.env.ASSISTENTE_URL ?? "https://api.openai.com/v1/chat/completions";
  const modelo = process.env.ASSISTENTE_MODELO ?? "gpt-4o-mini";

  const mensagens = [
    { role: "system", content: `${INSTRUCAO}\n\nFATOS\n${fatos}` },
    ...historico.slice(-8).map((m) => ({
      role: m.papel === "usuario" ? "user" : "assistant",
      content: m.texto,
    })),
    { role: "user", content: pergunta },
  ];

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 30_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({ model: modelo, messages: mensagens, temperature: 0.2, max_tokens: 700 }),
      signal: controle.signal,
    });
    if (!r.ok) throw new Error(`provedor respondeu ${r.status}`);
    const dados = await r.json();
    const texto = dados?.choices?.[0]?.message?.content;
    if (typeof texto !== "string" || !texto.trim()) throw new Error("resposta vazia do provedor");
    return texto.trim();
  } finally {
    clearTimeout(limite);
  }
}

export async function perguntar(
  fatos: FatosDoProjeto,
  historico: Mensagem[],
  pergunta: string,
): Promise<Resposta> {
  const contexto = fatosEmTexto(fatos);
  try {
    return { texto: await chamarModelo(contexto, historico, pergunta), modeloAtivo: true };
  } catch (e) {
    const semChave = e instanceof Error && e.message === "sem chave";
    return {
      modeloAtivo: false,
      texto: semChave
        ? "A conversa com o assistente não está configurada neste ambiente (falta ASSISTENTE_API_KEY). " +
          "O resumo executivo abaixo é gerado a partir dos números da obra e não depende disso."
        : "Não consegui falar com o assistente agora. O resumo executivo abaixo vem direto dos números da obra.",
    };
  }
}
