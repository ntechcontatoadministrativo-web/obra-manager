import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { carregarEvm, carregarRede } from "@/lib/analise";
import { montarFatos } from "@/lib/assistente";
import { resumoExecutivo } from "@/lib/resumo";
import { lerIndicadores } from "@/lib/evm";
import { atrasoContraBaseline } from "@/lib/cronograma";
import { exposicaoDaObra, faixa, nivel, ROTULO_FAIXA, TOM_FAIXA } from "@/lib/risco";
import { Badge, Card, TITULO } from "@/components/ui";
import { CurvaS } from "./curva-s";
import { PainelIndicadores } from "./indicadores";
import { Baselines, FecharSemana } from "./baselines";
import { Assistente } from "./assistente";

export const metadata: Metadata = { title: "Análise do projeto" };

export default async function AnalisePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => {
    if (e instanceof ForbiddenError) return null;
    throw e;
  });
  if (!perfil || !can(perfil, "analise", "ver")) notFound();

  const [obra, evm, rede, baselines, riscos, fatos] = await Promise.all([
    prisma.obra.findUnique({
      where: { id: params.id },
      select: { nome: true, previsaoTermino: true, valorContrato: true },
    }),
    carregarEvm(prisma, params.id),
    carregarRede(prisma, params.id),
    prisma.cronogramaBaseline.findMany({
      where: { obraId: params.id },
      orderBy: { numero: "desc" },
      select: { id: true, numero: true, nome: true, ativa: true, criadoEm: true, _count: { select: { itens: true } } },
    }),
    prisma.risco.findMany({
      where: { obraId: params.id },
      select: { id: true, codigo: true, descricao: true, probabilidade: true, impacto: true, situacao: true },
    }),
    montarFatos(prisma, params.id),
  ]);
  if (!obra) notFound();

  const podeEditar = can(perfil, "analise", "criar");
  const avisos = lerIndicadores(evm.indicadores);
  const atraso = atrasoContraBaseline(rede.terminoProjeto, obra.previsaoTermino);
  const exposicao = exposicaoDaObra(riscos);
  const criticos = riscos
    .filter((r) => r.situacao !== "ENCERRADO" && faixa(nivel(r)) === "critico")
    .slice(0, 3);

  const dataBR = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft size={16} aria-hidden /> {obra.nome}
        </Link>
        <h1 className={TITULO}>Análise do projeto</h1>
        <p className="text-muted">
          Valor agregado, cronograma e risco.{" "}
          {evm.temBaseline
            ? <>Medindo contra a baseline <strong className="text-ink">{evm.nomeBaseline}</strong>.</>
            : <>Ainda sem baseline: o prazo está sendo medido contra as datas atuais.</>}
        </p>
      </header>

      {!evm.temBaseline && (
        <p className="rounded-md border border-amarelo/50 bg-amarelo/10 p-3 text-sm">
          <strong>Sem baseline, o desvio de prazo não existe.</strong> Toda vez que uma
          etapa for remanejada, a data antiga some e o SPI volta para 1,00. Congele o
          cronograma abaixo antes de usar esses números com o cliente.
        </p>
      )}

      {avisos.length > 0 && (
        <Card className="border-perigo/30 bg-perigo/5 p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-perigo">
            <ShieldAlert size={18} aria-hidden /> O que precisa de atenção
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {avisos.map((a) => <li key={a}>• {a}</li>)}
          </ul>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Indicadores</h2>
        <PainelIndicadores i={evm.indicadores} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Evolução</h2>
        <CurvaS
          pontos={evm.curva.map((p) => ({
            semana: p.semana.toISOString(), pv: p.pv, ev: p.ev, ac: p.ac,
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-display text-lg font-semibold">Prazo pela rede</h2>
          {rede.ciclo.length > 0 ? (
            <p className="mt-2 rounded border border-perigo/30 bg-perigo/10 p-3 text-sm text-perigo">
              {rede.avisos[0]}
            </p>
          ) : rede.terminoProjeto ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                Término calculado:{" "}
                <strong className="tabular-nums">{dataBR(rede.terminoProjeto)}</strong>
              </p>
              <p className="text-muted">
                Previsão da obra: <span className="tabular-nums">{dataBR(obra.previsaoTermino)}</span>
              </p>
              {atraso !== null && (
                <p>
                  {atraso > 0
                    ? <Badge tom="perigo">{atraso} dia{atraso === 1 ? "" : "s"} além da previsão</Badge>
                    : atraso < 0
                      ? <Badge tom="ok">{Math.abs(atraso)} dia{atraso === -1 ? "" : "s"} de folga</Badge>
                      : <Badge tom="neutro">Em cima da previsão</Badge>}
                </p>
              )}
              <p className="text-muted">
                {rede.nos.filter((n) => n.ehCritica).length} de {rede.nos.length} etapas no caminho crítico.
              </p>
              <Link href={`/obras/${params.id}/etapas`} className="inline-flex min-h-11 items-center text-sm font-medium text-laranja hover:underline">
                Ver no cronograma →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Cadastre as etapas para a rede ser calculada.</p>
          )}
          {rede.avisos.length > 0 && rede.ciclo.length === 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {rede.avisos.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-lg font-semibold">Exposição a risco</h2>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            {exposicao}<span className="text-base text-muted">/100</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {riscos.filter((r) => r.situacao !== "ENCERRADO").length} risco(s) em aberto.
          </p>
          {criticos.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {criticos.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <Badge tom={TOM_FAIXA[faixa(nivel(r))]}>{ROTULO_FAIXA[faixa(nivel(r))]}</Badge>
                  <span className="min-w-0 flex-1">{r.codigo} — {r.descricao}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/obras/${params.id}/riscos`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-laranja hover:underline">
            Ver matriz de risco →
          </Link>
        </Card>
      </section>

      {fatos && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Assistente</h2>
          <Assistente obraId={params.id} resumoInicial={resumoExecutivo(fatos)} />
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Baselines
          obraId={params.id}
          podeEditar={podeEditar}
          linhas={baselines.map((b) => ({
            id: b.id, numero: b.numero, nome: b.nome, ativa: b.ativa,
            criadoEm: b.criadoEm.toISOString(), qtdEtapas: b._count.itens,
          }))}
        />
        {podeEditar && (
          <FecharSemana
            obraId={params.id}
            ultimoFechamento={evm.ultimoFechamento?.toISOString() ?? null}
          />
        )}
      </section>
    </div>
  );
}
