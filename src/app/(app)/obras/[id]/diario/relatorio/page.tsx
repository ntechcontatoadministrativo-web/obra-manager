import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { dataISOValida, dataLocalISO, dataParaBanco, horaLocal } from "@/lib/ponto";
import { dataLonga, somarDias } from "@/lib/diario";
import { Badge, TITULO } from "@/components/ui";
import { ImprimirBotao } from "./imprimir";

export const metadata: Metadata = { title: "Relatório do diário" };
const MAX_DIAS = 31;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const CLIMA = { ENSOLARADO: "Ensolarado", NUBLADO: "Nublado", CHUVOSO: "Chuvoso", TEMPESTADE: "Tempestade" } as const;
const IMPACTO = { SEM_IMPACTO: "Sem impacto", PRODUCAO_REDUZIDA: "Produção reduzida", PARALISACAO_PARCIAL: "Paralisação parcial", PARALISACAO_TOTAL: "Paralisação total" } as const;
const TURNO = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Dia inteiro" } as const;

export default async function Relatorio({ params, searchParams }: { params: { id: string }; searchParams: { de?: string; ate?: string; fotos?: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "diario", "ver")) notFound();

  const hoje = dataLocalISO();
  const de = searchParams.de && dataISOValida(searchParams.de) ? searchParams.de : somarDias(hoje, -6);
  let ate = searchParams.ate && dataISOValida(searchParams.ate) ? searchParams.ate : hoje;
  if (ate < de) ate = de;
  const limitado = ate > somarDias(de, MAX_DIAS - 1);
  if (limitado) ate = somarDias(de, MAX_DIAS - 1);
  const comFotos = searchParams.fotos === "sim";

  const [obra, diarios] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, endereco: true, clienteNome: true } }),
    prisma.diarioObra.findMany({
      where: { obraId: params.id, data: { gte: dataParaBanco(de), lte: dataParaBanco(ate) } },
      orderBy: [{ data: "asc" }, { turno: "asc" }],
      include: {
        efetivo: true, equipamentos: { include: { equipamento: { select: { nome: true } } } }, visitas: true,
        atividades: { include: { etapa: { select: { nome: true } } } },
        fotos: comFotos ? { orderBy: { tiradaEm: "asc" }, select: { id: true, url: true, legenda: true } } : false,
        ocorrencias: { select: { id: true, titulo: true, severidade: true, status: true } },
        _count: { select: { fotos: true } },
      },
    }),
  ]);
  if (!obra) notFound();

  const nomes = new Map((await prisma.user.findMany({ where: { id: { in: diarios.map((d) => d.assinadoPorId).filter((x): x is string => !!x) } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]));
  const pessoas = (d: (typeof diarios)[number]) => d.efetivo.reduce((s: number, e: { quantidade: number }) => s + e.quantidade, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:hidden">
        <Link href={`/obras/${params.id}/diario`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> Diário de obra</Link>
        <ImprimirBotao />
        {limitado && <p role="note" className="text-sm text-alerta">O relatório mostra no máximo {MAX_DIAS} dias de uma vez. Gere outro para o restante.</p>}
      </div>

      <header className="space-y-1 border-b border-line pb-4">
        <h1 className={TITULO}>Relatório do diário de obra</h1>
        <p className="font-medium">{obra.nome}</p>
        <p className="text-sm text-muted">{obra.endereco} · Cliente: {obra.clienteNome}</p>
        <p className="text-sm text-muted">Período: {dataLonga(de)} a {dataLonga(ate)} · Gerado em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short", timeStyle: "short" }).format(new Date())}</p>
      </header>

      {diarios.length === 0 ? <p className="text-muted">Nenhum diário registrado neste período.</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Resumo do período</caption>
              <thead><tr className="border-b border-line text-muted"><th className="py-2 pr-3">Dia</th><th className="pr-3">Tempo</th><th className="pr-3">Efeito</th><th className="pr-3">Pessoas</th><th className="pr-3">Atividades</th><th className="pr-3">Fotos</th><th>Situação</th></tr></thead>
              <tbody>
                {diarios.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 capitalize">{new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d.data)}{d.turno !== "INTEGRAL" && ` (${TURNO[d.turno].toLowerCase()})`}</td>
                    <td className="pr-3">{CLIMA[d.clima]}{d.temperaturaC != null && ` ${d.temperaturaC}°C`}</td>
                    <td className="pr-3">{IMPACTO[d.impactoClima]}</td>
                    <td className="pr-3 tabular-nums">{pessoas(d)}</td>
                    <td className="pr-3 tabular-nums">{d.atividades.length}</td>
                    <td className="pr-3 tabular-nums">{d._count.fotos}</td>
                    <td>{d.assinadoEm ? "Concluído" : "Rascunho"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {diarios.map((d) => (
            <article key={d.id} className="space-y-3 border-t-2 border-asfalto pt-4 print:break-inside-avoid-page">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold capitalize">{dataLonga(iso(d.data))} <span className="text-base font-normal normal-case text-muted">· {TURNO[d.turno]}</span></h2>
                <Badge tom={d.assinadoEm ? "ok" : "alerta"}>{d.assinadoEm ? "Concluído" : "Rascunho"}</Badge>
              </div>
              <p className="text-sm"><strong>Tempo:</strong> {CLIMA[d.clima]}{d.temperaturaC != null && `, ${d.temperaturaC}°C`} · <strong>Efeito na obra:</strong> {IMPACTO[d.impactoClima]}{d.obsClima && ` — ${d.obsClima}`}</p>

              {d.efetivo.length > 0 && <p className="text-sm"><strong>Equipe ({pessoas(d)}):</strong> {d.efetivo.map((e) => `${e.quantidade} ${e.funcao}${e.empresa ? ` (${e.empresa})` : ""}`).join("; ")}.</p>}

              {d.atividades.length > 0 && (
                <div className="text-sm"><p className="font-semibold">Atividades executadas</p>
                  <ul className="list-disc pl-5">{d.atividades.map((a) => <li key={a.id}>{a.etapa.nome}{a.descricao && `: ${a.descricao}`}{a.quantidade != null && ` — ${Number(a.quantidade).toLocaleString("pt-BR")} ${a.unidade ?? ""}`}</li>)}</ul>
                </div>
              )}
              {d.equipamentos.length > 0 && <p className="text-sm"><strong>Equipamentos:</strong> {d.equipamentos.map((e) => `${e.equipamento.nome} (${Number(e.horasUso).toLocaleString("pt-BR")} h)`).join("; ")}.</p>}
              {d.visitas.length > 0 && <p className="text-sm"><strong>Visitas:</strong> {d.visitas.map((v) => `${v.nome} (${v.tipo})`).join("; ")}.</p>}
              {d.descricao && <div className="text-sm"><p className="font-semibold">Resumo do dia</p><p className="whitespace-pre-line">{d.descricao}</p></div>}
              {d.observacoes && <div className="text-sm"><p className="font-semibold">Intercorrências e observações</p><p className="whitespace-pre-line">{d.observacoes}</p></div>}
              {d.ocorrencias.length > 0 && <p className="text-sm"><strong>Ocorrências ligadas:</strong> {d.ocorrencias.map((o) => `${o.titulo} (${o.severidade.toLowerCase()}, ${o.status.toLowerCase().replace("_", " ")})`).join("; ")}.</p>}

              {comFotos && Array.isArray(d.fotos) && d.fotos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 print:grid-cols-4">
                  {d.fotos.map((f) => (
                    <li key={f.id} className="print:break-inside-avoid">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.legenda ?? "Foto do dia"} className="aspect-[4/3] w-full rounded border border-line object-cover" />
                      {f.legenda && <p className="text-xs text-muted">{f.legenda}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {!comFotos && <p className="text-xs text-muted">{d._count.fotos} foto{d._count.fotos === 1 ? "" : "s"} anexada{d._count.fotos === 1 ? "" : "s"} (não incluídas neste relatório).</p>}

              <p className="border-t border-dashed border-line pt-2 text-xs text-muted">
                {d.assinadoEm ? `Assinado digitalmente por ${nomes.get(d.assinadoPorId ?? "") ?? "usuário"} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short" }).format(d.assinadoEm)} às ${horaLocal(d.assinadoEm)}.` : "Diário ainda não concluído: sem assinatura."}
              </p>
            </article>
          ))}
        </>
      )}
    </div>
  );
}
