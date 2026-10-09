import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { dataLocalISO } from "@/lib/ponto";
import { somarDias } from "@/lib/diario";
import { brl, dataBR } from "@/lib/utils";
import { Card, TITULO } from "@/components/ui";
import { FecharMedicaoForm } from "./form";

export const metadata: Metadata = { title: "Medições" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function MedicoesPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "medicao", "ver")) notFound();

  const [obra, medicoes] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, dataInicio: true } }),
    prisma.medicao.findMany({ where: { obraId: params.id }, orderBy: { numero: "desc" } }),
  ]);
  if (!obra) notFound();
  const hoje = dataLocalISO();
  const de = medicoes[0] ? somarDias(iso(medicoes[0].periodoFim), 1) : iso(obra.dataInicio);
  const acumulado = medicoes.reduce((s, m) => s + Number(m.valorMedido), 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}/etapas`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> Etapas e cronograma</Link>
        <h1 className={TITULO}>Medições</h1>
        <p className="text-muted">{medicoes.length} medição(ões) · total medido {brl(acumulado)}</p>
      </header>

      {can(perfil, "medicao", "criar") && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-xl font-semibold">Fechar nova medição</h2>
          <FecharMedicaoForm obraId={params.id} de={de <= hoje ? de : hoje} ate={hoje} hoje={hoje} />
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Medições fechadas</h2>
        {medicoes.length === 0 ? <Card className="p-5 text-sm text-muted">Nenhuma medição fechada ainda.</Card> : (
          <Card className="divide-y divide-line">
            {medicoes.map((m) => (
              <Link key={m.id} href={`/obras/${params.id}/medicoes/${m.numero}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-bg">
                <div><p className="font-medium">Medição nº {m.numero}</p><p className="text-sm text-muted">{dataBR(m.periodoInicio)} a {dataBR(m.periodoFim)}</p></div>
                <div className="text-right text-sm"><p className="font-display text-lg font-semibold tabular-nums">{brl(Number(m.valorMedido))}</p><p className="text-muted">avanço físico {Number(m.avancoGlobalPct).toFixed(1).replace(".", ",")}%</p></div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
