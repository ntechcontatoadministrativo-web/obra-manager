import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileSpreadsheet, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { calcularGantt, comPaisCalculados, ehFolha, emOrdemDeArvore, profundidade, statusEfetivo, PROFUNDIDADE_MAX, type EtapaNo, type EtapaStatus } from "@/lib/etapas";
import { progressoFisico } from "@/lib/progresso";
import { dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { brl, dataBR } from "@/lib/utils";
import { Badge, Card, Progresso, TITULO } from "@/components/ui";
import { carregarRede } from "@/lib/analise";
import { GanttView, type InfoRede } from "./gantt";
import { Dependencias, type LinhaDep } from "./dependencias";
import { ImportarCronograma } from "./importar";
import { Andamento, EtapaForm, EtapasPadraoBotao } from "./formularios";

export const metadata: Metadata = { title: "Etapas e cronograma" };
const TOM = { CONCLUIDA: "ok", EM_ANDAMENTO: "info", ATRASADA: "perigo", PARALISADA: "alerta", NAO_INICIADA: "neutro" } as const;
const ROTULO = { CONCLUIDA: "Concluída", EM_ANDAMENTO: "Em andamento", ATRASADA: "Atrasada", PARALISADA: "Paralisada", NAO_INICIADA: "Não iniciada" } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function EtapasPage({ params, searchParams }: { params: { id: string }; searchParams: { editar?: string; nova?: string; pai?: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "etapa", "ver")) notFound();

  const [obra, rows, membros, deps, rede] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, dataInicio: true, previsaoTermino: true } }),
    prisma.etapa.findMany({ where: { obraId: params.id } }),
    prisma.obraMembro.findMany({ where: { obraId: params.id }, select: { user: { select: { id: true, nome: true } } } }),
    prisma.etapaDependencia.findMany({
      where: { predecessora: { obraId: params.id } },
      select: {
        id: true, tipo: true, folgaDias: true,
        predecessora: { select: { id: true, nome: true } },
        sucessora: { select: { id: true, nome: true } },
      },
    }),
    carregarRede(prisma, params.id),
  ]);
  if (!obra) notFound();

  const nos: EtapaNo[] = comPaisCalculados(rows.map((r) => ({
    id: r.id, paiId: r.paiId, nome: r.nome, ordem: r.ordem, inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto, inicioReal: r.inicioReal, fimReal: r.fimReal,
    percentual: Number(r.percentual), valorOrcado: Number(r.valorOrcado), status: r.status as EtapaStatus,
  })));
  const hoje = dataParaBanco(dataLocalISO());
  const arvore = emOrdemDeArvore(nos);
  const gantt = calcularGantt(nos, hoje);
  const fisico = progressoFisico(nos.map((n) => ({ paiId: n.paiId, percentual: n.percentual, valorOrcado: n.valorOrcado })));
  const status = nos.map((n) => statusEfetivo(n, hoje));
  const atrasadas = nos.filter((n, i) => status[i] === "ATRASADA" && ehFolha(nos, n.id));
  // Rede: só vira leitura no Gantt quando não há ciclo — com ciclo não
  // existem datas calculadas, e desenhar folga seria mentira.
  const infoRede: InfoRede | undefined = rede.ciclo.length
    ? undefined
    : new Map(rede.nos.map((n) => [n.id, {
        ehCritica: n.ehCritica,
        folgaTotalDias: n.folgaTotalDias,
        deslocamentoDias: n.deslocamentoDias,
        predecessoras: deps.filter((d) => d.sucessora.id === n.id).map((d) => d.predecessora.nome),
      }]));
  const linhasDep: LinhaDep[] = deps.map((d) => ({
    id: d.id, tipo: d.tipo as LinhaDep["tipo"], folgaDias: d.folgaDias,
    predecessoraId: d.predecessora.id, predecessoraNome: d.predecessora.nome,
    sucessoraId: d.sucessora.id, sucessoraNome: d.sucessora.nome,
  }));
  const folhas = nos.filter((n) => ehFolha(nos, n.id)).map((n) => ({ id: n.id, nome: n.nome }));

  const podeEstruturar = can(perfil, "etapa", "criar");
  const podeAndamento = can(perfil, "etapa", "editar");
  const veValores = can(perfil, "financeiro", "ver");
  const responsaveis = membros.map((m) => m.user);
  const nome = new Map(responsaveis.map((r) => [r.id, r.nome]));
  const respDe = new Map(rows.map((r) => [r.id, r.responsavelId]));

  // Formulário: criar (?nova=1&pai=ID) ou editar (?editar=ID)
  const editando = searchParams.editar ? rows.find((r) => r.id === searchParams.editar) : undefined;
  const mostrarForm = podeEstruturar && (editando || searchParams.nova);
  const opcoesPai = arvore
    .filter((e) => profundidade(nos, e.id) < PROFUNDIDADE_MAX && (!editando || e.id !== editando.id))
    .map((e) => ({ id: e.id, rotulo: `${"— ".repeat(e.nivel - 1)}${e.nome}` }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> {obra.nome}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={TITULO}>Etapas e cronograma</h1>
          <div className="flex flex-wrap gap-2">
            {can(perfil, "medicao", "ver") && <Link href={`/obras/${params.id}/medicoes`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja"><FileSpreadsheet size={18} aria-hidden /> Medições</Link>}
            {podeEstruturar && <Link href={`/obras/${params.id}/etapas?nova=1#formulario`} className="inline-flex min-h-11 items-center gap-2 rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg hover:brightness-110"><Plus size={18} aria-hidden /> Nova etapa</Link>}
          </div>
        </div>
      </header>

      {nos.length > 0 && (
        <section className="grid gap-4 md:grid-cols-[2fr_1fr]" aria-label="Resumo">
          <Card className="p-5"><Progresso valor={fisico} rotulo="Avanço físico da obra (pelo valor de cada etapa)" /></Card>
          <Card className="p-5 text-sm">
            <p className="text-muted">Etapas atrasadas</p>
            <p className={`font-display text-2xl font-semibold tabular-nums ${atrasadas.length ? "text-perigo" : "text-ok"}`}>{atrasadas.length}</p>
            {atrasadas.length > 0 && <p className="mt-1 text-xs text-muted">{atrasadas.map((a) => a.nome).join(", ")}</p>}
          </Card>
        </section>
      )}

      {mostrarForm && (
        <Card className="space-y-4 p-5" >
          <h2 id="formulario" className="scroll-mt-4 font-display text-xl font-semibold">{editando ? `Editar: ${editando.nome}` : "Nova etapa"}</h2>
          <EtapaForm
            key={editando?.id ?? `nova-${searchParams.pai ?? ""}`}
            obraId={params.id} pais={opcoesPai} responsaveis={responsaveis} ehPai={editando ? !ehFolha(nos, editando.id) : false}
            inicial={{
              id: editando?.id, nome: editando?.nome ?? "", paiId: editando?.paiId ?? searchParams.pai ?? "",
              inicioPrevisto: iso(editando?.inicioPrevisto ?? obra.dataInicio), fimPrevisto: iso(editando?.fimPrevisto ?? obra.previsaoTermino),
              valorOrcado: editando ? String(Number(editando.valorOrcado)).replace(".", ",") : "", criterioMedicao: editando?.criterioMedicao ?? "",
              quantidadePrevista: editando?.quantidadePrevista != null ? String(Number(editando.quantidadePrevista)).replace(".", ",") : "",
              responsavelId: editando?.responsavelId ?? "", paralisada: editando?.status === "PARALISADA",
            }}
          />
        </Card>
      )}

      {podeEstruturar && <ImportarCronograma obraId={params.id} temEtapas={nos.length > 0} />}

      {nos.length === 0 ? (
        <Card className="space-y-3 p-6">
          <p className="font-medium">Esta obra ainda não tem etapas.</p>
          <p className="text-sm text-muted">{podeEstruturar ? "Comece pelo modelo típico (fundação, estrutura, alvenaria…), distribuído pelo prazo da obra, e depois ajuste datas e valores." : "O engenheiro ainda vai cadastrar o cronograma."}</p>
          {podeEstruturar && <EtapasPadraoBotao obraId={params.id} />}
        </Card>
      ) : (
        <>
          {gantt && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Cronograma</h2>
              <GanttView gantt={gantt} obraId={params.id} editavel={podeEstruturar} rede={infoRede} />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Rede</h2>
            <Dependencias
              obraId={params.id}
              etapas={folhas}
              deps={linhasDep}
              podeEditar={podeAndamento}
              avisoCiclo={rede.ciclo.length ? rede.avisos[0] : null}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Etapas</h2>
            <Card className="divide-y divide-line">
              {arvore.map((e) => {
                const st = statusEfetivo(e, hoje);
                const folha = ehFolha(nos, e.id);
                const resp = respDe.get(e.id);
                return (
                  <div key={e.id} className="space-y-3 p-4" style={{ paddingLeft: 16 + (e.nivel - 1) * 20 }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className={folha ? "font-medium" : "font-display text-lg font-semibold"}>{e.nome}</p>
                        <p className="text-xs text-muted">{dataBR(e.inicioPrevisto)} a {dataBR(e.fimPrevisto)}{veValores && ` · ${brl(e.valorOrcado)}`}{resp && nome.get(resp) ? ` · ${nome.get(resp)}` : ""}</p>
                      </div>
                      <Badge tom={TOM[st]}>{ROTULO[st]}</Badge>
                    </div>
                    <Progresso valor={e.percentual} rotulo={folha ? "Concluída" : "Concluída (soma das sub-etapas)"} tom={st === "ATRASADA" ? "perigo" : st === "CONCLUIDA" ? "ok" : "laranja"} />
                    <div className="flex flex-wrap items-center gap-3">
                      {folha && podeAndamento && <Andamento obraId={params.id} etapaId={e.id} valor={e.percentual} />}
                      {podeEstruturar && (
                        <>
                          {e.nivel < PROFUNDIDADE_MAX && <Link href={`/obras/${params.id}/etapas?nova=1&pai=${e.id}#formulario`} className="inline-flex min-h-11 items-center text-sm font-medium text-laranja hover:underline">+ Sub-etapa</Link>}
                          <Link href={`/obras/${params.id}/etapas?editar=${e.id}#formulario`} className="inline-flex min-h-11 items-center text-sm font-medium text-laranja hover:underline">Editar</Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
