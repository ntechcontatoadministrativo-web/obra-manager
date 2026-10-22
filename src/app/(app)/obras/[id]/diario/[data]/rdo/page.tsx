import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { dataISOValida, dataParaBanco, horaLocal } from "@/lib/ponto";
import { dataLonga } from "@/lib/diario";
import { dataBR } from "@/lib/utils";
import { ImprimirBotao } from "../../relatorio/imprimir";

export const metadata: Metadata = { title: "RDO — Relatório diário de obra" };

/**
 * RDO no formato de papel que construtoras e fiscais conhecem: uma folha A4
 * por dia, com os turnos juntos, para imprimir, salvar em PDF e assinar.
 * `?branco=1` gera o mesmo modelo vazio, para preencher à mão.
 */

const CLIMAS = [["ENSOLARADO", "Sol"], ["NUBLADO", "Nublado"], ["CHUVOSO", "Chuva"], ["TEMPESTADE", "Tempestade"]] as const;
const IMPACTO: Record<string, string> = { SEM_IMPACTO: "Praticável", PRODUCAO_REDUZIDA: "Produção reduzida", PARALISACAO_PARCIAL: "Paralisação parcial", PARALISACAO_TOTAL: "Impraticável" };
const LINHAS_BRANCO = 8;
const MAX_FOTOS = 6;
const dias = (de: Date, ate: Date) => Math.round((ate.getTime() - de.getTime()) / 86_400_000);

export default async function Rdo({ params, searchParams }: { params: { id: string; data: string }; searchParams: { branco?: string } }) {
  const user = await requireUser();
  if (!dataISOValida(params.data)) notFound();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "diario", "ver")) notFound();
  const branco = searchParams.branco === "1";
  const dia = dataParaBanco(params.data);

  const [obra, diarios, numero, naPonto] = await Promise.all([
    prisma.obra.findUnique({
      where: { id: params.id },
      select: {
        nome: true, endereco: true, clienteNome: true, codigo: true, artNumero: true, engenheiroNome: true,
        dataInicio: true, previsaoTermino: true,
        empresa: { select: { nome: true, cnpj: true } },
        responsavelTecnico: { select: { nome: true } },
      },
    }),
    branco ? Promise.resolve([]) : prisma.diarioObra.findMany({
      where: { obraId: params.id, data: dia },
      orderBy: { turno: "asc" },
      include: {
        efetivo: true,
        atividades: { include: { etapa: { select: { nome: true } } } },
        equipamentos: { include: { equipamento: { select: { nome: true } } } },
        visitas: true,
        ocorrencias: { select: { id: true, titulo: true, descricao: true, severidade: true } },
        fotos: { orderBy: { tiradaEm: "asc" }, take: MAX_FOTOS, select: { id: true, url: true, legenda: true } },
      },
    }),
    // Nº do RDO = quantos dias com diário a obra tem até esta data.
    branco ? Promise.resolve(0) : prisma.diarioObra.findMany({ where: { obraId: params.id, data: { lte: dia } }, distinct: ["data"], select: { data: true } }).then((l) => l.length),
    branco ? Promise.resolve(0) : prisma.registroPonto.count({ where: { obraId: params.id, data: dia, tipo: "TRABALHADO", entradaEm: { not: null } } }),
  ]);
  if (!obra) notFound();

  const assinantes = new Map((await prisma.user.findMany({
    where: { id: { in: diarios.map((d) => d.assinadoPorId).filter((x): x is string => !!x) } }, select: { id: true, nome: true },
  })).map((u) => [u.id, u.nome]));

  // Manhã e tarde: um diário "dia inteiro" vale para os dois turnos.
  const turno = (t: "MANHA" | "TARDE") => diarios.find((d) => d.turno === t) ?? diarios.find((d) => d.turno === "INTEGRAL") ?? null;
  const efetivo = diarios.flatMap((d) => d.efetivo);
  // O mesmo pedreiro aparece de manhã e de tarde: soma por função ficaria em dobro, então fica o maior turno.
  const porFuncao = new Map<string, { funcao: string; quantidade: number; terceiro: boolean; empresa: string | null }>();
  for (const e of efetivo) {
    const k = `${e.funcao}|${e.empresa ?? ""}`;
    const atual = porFuncao.get(k);
    if (!atual || e.quantidade > atual.quantidade) porFuncao.set(k, { funcao: e.funcao, quantidade: e.quantidade, terceiro: e.terceiro, empresa: e.empresa });
  }
  const maoDeObra = [...porFuncao.values()];
  const totalPessoas = maoDeObra.reduce((s, e) => s + e.quantidade, 0);
  const atividades = diarios.flatMap((d) => d.atividades);
  const equipamentos = diarios.flatMap((d) => d.equipamentos);
  const visitas = diarios.flatMap((d) => d.visitas);
  const ocorrencias = diarios.flatMap((d) => d.ocorrencias);
  const fotos = diarios.flatMap((d) => d.fotos).slice(0, MAX_FOTOS);
  const resumo = diarios.map((d) => d.descricao).filter(Boolean).join("\n\n");
  const observacoes = diarios.flatMap((d) => [d.observacoes, d.obsClima]).filter(Boolean).join("\n");
  const concluido = diarios.find((d) => d.assinadoEm);

  const prazo = dias(obra.dataInicio, obra.previsaoTermino);
  const decorridos = dias(obra.dataInicio, dia);
  const vazio = (n: number) => Array.from({ length: n }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <Link href={`/obras/${params.id}/diario/${params.data}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> Diário do dia</Link>
        <div className="flex flex-wrap items-center gap-3">
          <ImprimirBotao />
          <Link href={branco ? `/obras/${params.id}/diario/${params.data}/rdo` : `/obras/${params.id}/diario/${params.data}/rdo?branco=1`} className="text-sm font-medium text-laranja hover:underline">
            {branco ? "Ver o RDO preenchido deste dia" : "Modelo em branco para preencher à mão"}
          </Link>
        </div>
        <p className="text-sm text-muted">Na janela de impressão, escolha “Salvar como PDF”, papel A4.</p>
      </div>

      <article className="rdo mx-auto w-full max-w-[210mm] bg-white p-[10mm] text-[12px] leading-snug text-black shadow-lg ring-1 ring-black/10 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        {/* Cabeçalho */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[32%] border border-black p-2 align-middle">
                <p className="font-bold">{obra.empresa.nome}</p>
                {obra.empresa.cnpj && <p className="text-[10px]">CNPJ {obra.empresa.cnpj}</p>}
              </td>
              <td className="border border-black p-2 text-center align-middle">
                <p className="text-[15px] font-bold uppercase tracking-wide">Relatório Diário de Obra</p>
                <p className="text-[10px]">RDO</p>
              </td>
              <td className="w-[24%] border border-black p-0 align-top">
                <div className="border-b border-black px-2 py-1"><span className="text-[10px]">Nº</span> <strong>{branco ? "" : String(numero).padStart(3, "0")}</strong></div>
                <div className="px-2 py-1"><span className="text-[10px]">Data</span> <strong>{branco ? "____/____/______" : dataBR(params.data)}</strong></div>
              </td>
            </tr>
          </tbody>
        </table>
        {!branco && <p className="mt-1 text-right text-[10px] capitalize">{dataLonga(params.data)}</p>}

        {/* Dados da obra */}
        <Secao titulo="Dados da obra">
          <table className="w-full border-collapse">
            <tbody>
              <tr><Rot>Obra</Rot><Val colSpan={3}>{obra.nome}{obra.codigo && ` (${obra.codigo})`}</Val></tr>
              <tr><Rot>Endereço</Rot><Val colSpan={3}>{obra.endereco}</Val></tr>
              <tr><Rot>Contratante</Rot><Val>{obra.clienteNome}</Val><Rot>Resp. técnico</Rot><Val>{obra.responsavelTecnico?.nome ?? obra.engenheiroNome ?? ""}</Val></tr>
              <tr><Rot>ART/RRT</Rot><Val>{obra.artNumero ?? ""}</Val><Rot>Início</Rot><Val>{dataBR(obra.dataInicio)}</Val></tr>
              <tr>
                <Rot>Prazo contratual</Rot><Val>{prazo} dias · término {dataBR(obra.previsaoTermino)}</Val>
                <Rot>Decorridos / restantes</Rot><Val>{branco ? "" : `${Math.max(0, decorridos)} / ${prazo - decorridos} dias`}</Val>
              </tr>
            </tbody>
          </table>
        </Secao>

        {/* Clima */}
        <Secao titulo="Condições do tempo">
          <table className="w-full border-collapse">
            <thead><tr><Th>Turno</Th><Th>Tempo</Th><Th>Condição de trabalho</Th><Th className="w-[14%]">Temperatura</Th></tr></thead>
            <tbody>
              {(["MANHA", "TARDE"] as const).map((t) => {
                const d = branco ? null : turno(t);
                return (
                  <tr key={t}>
                    <Td className="font-semibold">{t === "MANHA" ? "Manhã" : "Tarde"}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {CLIMAS.map(([v, r]) => <Marca key={v} marcado={d?.clima === v}>{r}</Marca>)}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <Marca marcado={!!d && d.impactoClima !== "PARALISACAO_TOTAL"}>Praticável</Marca>
                        <Marca marcado={d?.impactoClima === "PARALISACAO_TOTAL"}>Impraticável</Marca>
                      </span>
                      {d && d.impactoClima !== "SEM_IMPACTO" && d.impactoClima !== "PARALISACAO_TOTAL" && <span className="block text-[10px]">{IMPACTO[d.impactoClima]}</span>}
                    </Td>
                    <Td>{d?.temperaturaC != null ? `${d.temperaturaC} °C` : ""}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Secao>

        {/* Mão de obra e equipamentos lado a lado */}
        <div className="grid grid-cols-[3fr_2fr] gap-3">
          <Secao titulo={`Mão de obra${branco ? "" : ` · ${totalPessoas} pessoa${totalPessoas === 1 ? "" : "s"}${naPonto ? ` (${naPonto} no ponto)` : ""}`}`}>
            <table className="w-full border-collapse">
              <thead><tr><Th>Função</Th><Th className="w-[14%]">Qtd.</Th><Th className="w-[34%]">Própria / empresa</Th></tr></thead>
              <tbody>
                {maoDeObra.map((e, i) => <tr key={i}><Td>{e.funcao}</Td><Td className="text-center">{e.quantidade}</Td><Td>{e.terceiro ? e.empresa ?? "Terceiro" : "Própria"}</Td></tr>)}
                {vazio(Math.max(0, (branco ? LINHAS_BRANCO : 3) - maoDeObra.length)).map((i) => <tr key={`v${i}`}><Td>&nbsp;</Td><Td /><Td /></tr>)}
              </tbody>
            </table>
          </Secao>
          <Secao titulo="Equipamentos">
            <table className="w-full border-collapse">
              <thead><tr><Th>Equipamento</Th><Th className="w-[24%]">Horas</Th></tr></thead>
              <tbody>
                {equipamentos.map((e) => <tr key={e.id}><Td>{e.equipamento.nome}</Td><Td className="text-center">{Number(e.horasUso).toLocaleString("pt-BR")}</Td></tr>)}
                {vazio(Math.max(0, (branco ? LINHAS_BRANCO : 3) - equipamentos.length)).map((i) => <tr key={`v${i}`}><Td>&nbsp;</Td><Td /></tr>)}
              </tbody>
            </table>
          </Secao>
        </div>

        {/* Atividades */}
        <Secao titulo="Serviços executados">
          <table className="w-full border-collapse">
            <thead><tr><Th className="w-[28%]">Etapa</Th><Th>Descrição</Th><Th className="w-[18%]">Quantidade</Th></tr></thead>
            <tbody>
              {atividades.map((a) => (
                <tr key={a.id}><Td>{a.etapa.nome}</Td><Td>{a.descricao ?? ""}</Td><Td>{a.quantidade != null ? `${Number(a.quantidade).toLocaleString("pt-BR")} ${a.unidade ?? ""}` : ""}</Td></tr>
              ))}
              {vazio(Math.max(0, (branco ? LINHAS_BRANCO : 2) - atividades.length)).map((i) => <tr key={`v${i}`}><Td>&nbsp;</Td><Td /><Td /></tr>)}
            </tbody>
          </table>
        </Secao>

        <Secao titulo="Resumo do dia">
          <Caixa linhas={branco ? 4 : 0}>{resumo}</Caixa>
        </Secao>

        <Secao titulo="Ocorrências, visitas e observações">
          <Caixa linhas={branco ? 4 : 0}>
            {ocorrencias.map((o) => <span key={o.id} className="block"><strong>Ocorrência ({o.severidade.toLowerCase()}):</strong> {o.titulo} — {o.descricao}</span>)}
            {visitas.length > 0 && <span className="block"><strong>Visitas:</strong> {visitas.map((v) => `${v.nome} (${v.tipo})`).join("; ")}</span>}
            {observacoes && <span className="block whitespace-pre-line">{observacoes}</span>}
            {!branco && !ocorrencias.length && !visitas.length && !observacoes && <span className="text-[11px]">Sem ocorrências.</span>}
          </Caixa>
        </Secao>

        {fotos.length > 0 && (
          <Secao titulo="Registro fotográfico">
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f) => (
                <figure key={f.id} className="break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.legenda ?? "Foto do dia"} className="aspect-[4/3] w-full border border-black object-cover" />
                  {f.legenda && <figcaption className="text-[10px]">{f.legenda}</figcaption>}
                </figure>
              ))}
            </div>
          </Secao>
        )}

        {/* Assinaturas */}
        <div className="mt-8 grid grid-cols-3 gap-6 break-inside-avoid text-center text-[11px]">
          {[
            ["Responsável técnico", obra.responsavelTecnico?.nome ?? obra.engenheiroNome ?? ""],
            ["Encarregado / mestre de obras", concluido?.assinadoPorId ? assinantes.get(concluido.assinadoPorId) ?? "" : ""],
            ["Fiscalização / contratante", ""],
          ].map(([papel, nome]) => (
            <div key={papel}>
              <div className="mb-1 h-10 border-b border-black" />
              <p className="font-semibold">{papel}</p>
              {!branco && nome && <p>{nome}</p>}
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-black/40 pt-1 text-[9px]">
          {branco
            ? "Modelo de RDO gerado pelo Obra Manager · NTECH"
            : concluido
              ? `Diário concluído no sistema por ${assinantes.get(concluido.assinadoPorId ?? "") ?? "usuário"} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short" }).format(concluido.assinadoEm!)} às ${horaLocal(concluido.assinadoEm!)}. Gerado pelo Obra Manager · NTECH.`
              : diarios.length ? "Diário ainda em rascunho no sistema. Gerado pelo Obra Manager · NTECH." : "Nenhum diário registrado no sistema para este dia. Gerado pelo Obra Manager · NTECH."}
        </p>
      </article>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h2 className="mb-1 bg-black px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">{titulo}</h2>
      {children}
    </section>
  );
}
const Rot = ({ children }: { children: React.ReactNode }) => <td className="w-[17%] border border-black bg-black/5 px-2 py-1 text-[10px] font-semibold uppercase">{children}</td>;
const Val = ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => <td colSpan={colSpan} className="border border-black px-2 py-1">{children}</td>;
const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <th className={`border border-black bg-black/5 px-2 py-1 text-left text-[10px] font-semibold uppercase ${className}`}>{children}</th>;
const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => <td className={`h-6 border border-black px-2 py-0.5 ${className}`}>{children}</td>;
const Marca = ({ marcado, children }: { marcado: boolean; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1">
    <span className="inline-flex h-3 w-3 items-center justify-center border border-black text-[9px] font-bold leading-none" aria-hidden>{marcado ? "X" : ""}</span>
    <span className={marcado ? "font-semibold" : ""}>{children}</span>
    {marcado && <span className="sr-only">(marcado)</span>}
  </span>
);
function Caixa({ children, linhas }: { children: React.ReactNode; linhas: number }) {
  return (
    <div className="min-h-[3rem] whitespace-pre-line border border-black px-2 py-1">
      {children}
      {Array.from({ length: linhas }, (_, i) => <div key={i} className="h-6 border-b border-dotted border-black/50" />)}
    </div>
  );
}
