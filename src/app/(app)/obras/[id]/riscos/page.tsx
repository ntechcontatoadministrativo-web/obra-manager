import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { contarPorFaixa, exposicaoDaObra } from "@/lib/risco";
import { Card, TITULO } from "@/components/ui";
import { MatrizRisco } from "./matriz";
import { PainelRiscos } from "./formulario";

export const metadata: Metadata = { title: "Riscos" };

export default async function RiscosPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => {
    if (e instanceof ForbiddenError) return null;
    throw e;
  });
  if (!perfil || !can(perfil, "risco", "ver")) notFound();

  const [obra, riscos, etapas] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true } }),
    prisma.risco.findMany({
      where: { obraId: params.id },
      orderBy: [{ situacao: "asc" }, { codigo: "asc" }],
      select: {
        id: true, codigo: true, descricao: true, categoria: true, situacao: true,
        probabilidade: true, impacto: true, automatico: true, planoMitigacao: true,
        etapa: { select: { nome: true } },
      },
    }),
    prisma.etapa.findMany({
      where: { obraId: params.id },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  if (!obra) notFound();

  const exposicao = exposicaoDaObra(riscos);
  const porFaixa = contarPorFaixa(riscos);
  const abertos = riscos.filter((r) => r.situacao !== "ENCERRADO").length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}/analise`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft size={16} aria-hidden /> Análise · {obra.nome}
        </Link>
        <h1 className={TITULO}>Riscos</h1>
        <p className="text-muted">
          {abertos} em aberto · exposição da obra em{" "}
          <strong className="text-ink tabular-nums">{exposicao}/100</strong>
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Matriz</h2>
          <MatrizRisco riscos={riscos} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Por faixa</h2>
          <dl className="space-y-2 text-sm">
            {([["critico", "Crítico"], ["alto", "Alto"], ["moderado", "Moderado"], ["baixo", "Baixo"]] as const).map(([k, r]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
                <dt className="text-muted">{r}</dt>
                <dd className="font-display text-lg font-semibold tabular-nums">{porFaixa[k]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            A exposição pondera 60% o pior risco e 40% a média dos abertos.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Registro</h2>
        <PainelRiscos
          obraId={params.id}
          podeCriar={can(perfil, "risco", "criar")}
          podeEditar={can(perfil, "risco", "editar")}
          etapas={etapas}
          riscos={riscos.map((r) => ({
            id: r.id, codigo: r.codigo, descricao: r.descricao,
            categoria: r.categoria, situacao: r.situacao,
            probabilidade: r.probabilidade, impacto: r.impacto,
            automatico: r.automatico, planoMitigacao: r.planoMitigacao,
            etapaNome: r.etapa?.nome ?? null,
          }))}
        />
      </section>
    </div>
  );
}
