import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { ImprimirBotao } from "@/components/imprimir-botao";
import { brl, dataBR } from "@/lib/utils";
import { TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Boletim de medição" };
const pct = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;

export default async function Boletim({ params }: { params: { id: string; numero: string } }) {
  const user = await requireUser();
  const numero = Number(params.numero);
  if (!Number.isInteger(numero) || numero < 1) notFound();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "medicao", "ver")) notFound();

  const [obra, med] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, endereco: true, clienteNome: true, engenheiroNome: true } }),
    prisma.medicao.findUnique({ where: { obraId_numero: { obraId: params.id, numero } }, include: { itens: { include: { etapa: { select: { nome: true, valorOrcado: true } } } } } }),
  ]);
  if (!obra || !med) notFound();
  const criador = await prisma.user.findUnique({ where: { id: med.criadoPorId }, select: { nome: true } });

  const linhas = med.itens.map((i) => {
    const orc = Number(i.etapa.valorOrcado), per = Number(i.percentualPeriodo), acu = Number(i.percentualAcumulado);
    return { nome: i.etapa.nome, orc, ant: Math.max(0, acu - per), per, acu, valorPer: (per / 100) * orc, valorAcu: (acu / 100) * orc };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const tot = linhas.reduce((t, l) => ({ orc: t.orc + l.orc, per: t.per + l.valorPer, acu: t.acu + l.valorAcu }), { orc: 0, per: 0, acu: 0 });

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:hidden">
        <Link href={`/obras/${params.id}/medicoes`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> Medições</Link>
        <ImprimirBotao />
      </div>
      <header className="space-y-1 border-b border-line pb-4">
        <h1 className={TITULO}>Boletim de medição nº {med.numero}</h1>
        <p className="font-medium">{obra.nome}</p>
        <p className="text-sm text-muted">{obra.endereco} · Cliente: {obra.clienteNome}{obra.engenheiroNome && ` · Engenheiro: ${obra.engenheiroNome}`}</p>
        <p className="text-sm text-muted">Período: {dataBR(med.periodoInicio)} a {dataBR(med.periodoFim)} · Avanço físico da obra: {pct(Number(med.avancoGlobalPct))}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Medição por etapa</caption>
          <thead><tr className="border-b border-line text-muted">
            <th className="py-2 pr-3">Etapa</th><th className="pr-3 text-right">Orçado</th><th className="pr-3 text-right">Anterior</th><th className="pr-3 text-right">Neste período</th><th className="pr-3 text-right">Acumulado</th><th className="pr-3 text-right">Valor do período</th><th className="text-right">Valor acumulado</th>
          </tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-b border-line/60 tabular-nums">
                <td className="py-2 pr-3 font-sans">{l.nome}</td><td className="pr-3 text-right">{brl(l.orc)}</td><td className="pr-3 text-right">{pct(l.ant)}</td>
                <td className="pr-3 text-right font-semibold">{pct(l.per)}</td><td className="pr-3 text-right">{pct(l.acu)}</td><td className="pr-3 text-right font-semibold">{brl(l.valorPer)}</td><td className="text-right">{brl(l.valorAcu)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold tabular-nums"><td className="py-3 pr-3">Total</td><td className="pr-3 text-right">{brl(tot.orc)}</td><td colSpan={3} /><td className="pr-3 text-right">{brl(tot.per)}</td><td className="text-right">{brl(tot.acu)}</td></tr></tfoot>
        </table>
      </div>

      <p className="text-xs text-muted">Gerado por {criador?.nome ?? "usuário"} em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short", timeStyle: "short" }).format(med.criadoEm)}. As porcentagens são as informadas em cada etapa no fechamento da medição.</p>
      <div className="grid grid-cols-2 gap-12 pt-12 text-center text-sm print:pt-20">
        <div className="border-t border-ink pt-2">Responsável técnico</div><div className="border-t border-ink pt-2">Cliente</div>
      </div>
    </div>
  );
}
