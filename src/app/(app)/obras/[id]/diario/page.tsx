import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { dataCurta, diasSemDiario, somarDias } from "@/lib/diario";
import { Badge, Card, TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Diário de obra" };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const CLIMA = { ENSOLARADO: "☀️", NUBLADO: "☁️", CHUVOSO: "🌧️", TEMPESTADE: "⛈️" } as const;

export default async function DiarioLista({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "diario", "ver")) notFound();

  const hoje = dataLocalISO();
  const desde = somarDias(hoje, -60);
  const [obra, cfg, diarios] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, dataInicio: true, status: true } }),
    prisma.configuracao.findFirst({ where: { empresa: { obras: { some: { id: params.id } } } }, select: { jornadaDiasSemana: true } }),
    prisma.diarioObra.findMany({
      where: { obraId: params.id, data: { gte: dataParaBanco(desde) } }, orderBy: [{ data: "desc" }, { turno: "asc" }],
      select: { id: true, data: true, turno: true, clima: true, temperaturaC: true, assinadoEm: true, _count: { select: { fotos: true, atividades: true } } },
    }),
  ]);
  if (!obra) notFound();

  const concluidos = new Set<string>(diarios.filter((d) => d.assinadoEm).map((d) => iso(d.data)));
  const atrasados = obra.status === "EM_ANDAMENTO"
    ? diasSemDiario({ hoje: somarDias(hoje, -1), inicio: iso(obra.dataInicio), concluidos, diasPorSemana: cfg?.jornadaDiasSemana ?? 5, janela: 14 })
    : [];
  const hojeDiario = diarios.find((d) => iso(d.data) === hoje);
  const estadoHoje = hojeDiario?.assinadoEm ? "concluido" : hojeDiario ? "rascunho" : "aberto";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> {obra.nome}</Link>
        <h1 className={TITULO}>Diário de obra</h1>
      </header>

      <Card className={`flex flex-wrap items-center justify-between gap-4 p-5 ${estadoHoje === "concluido" ? "border-ok/40" : "border-laranja/50"}`}>
        <div>
          <p className="font-display text-xl font-semibold">Hoje</p>
          <p className="text-sm text-muted">{estadoHoje === "concluido" ? "Diário de hoje concluído." : estadoHoje === "rascunho" ? "Diário de hoje em rascunho. Falta concluir." : "O diário de hoje ainda não foi aberto."}</p>
        </div>
        <Link href={`/obras/${params.id}/diario/${hoje}`} className="inline-flex min-h-11 items-center rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg hover:brightness-110">
          {estadoHoje === "concluido" ? "Ver diário" : estadoHoje === "rascunho" ? "Continuar" : "Abrir diário de hoje"}
        </Link>
      </Card>

      {atrasados.length > 0 && (
        <section className="space-y-3" aria-label="Dias sem diário">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-alerta"><AlertTriangle size={20} aria-hidden /> {atrasados.length} dia{atrasados.length > 1 ? "s" : ""} sem diário concluído</h2>
          <div className="flex flex-wrap gap-2">
            {atrasados.map((d) => <Link key={d} href={`/obras/${params.id}/diario/${d}`} className="min-h-11 rounded border border-alerta/50 bg-amarelo/15 px-3 py-2.5 text-sm font-medium capitalize hover:border-laranja">{dataCurta(d)}</Link>)}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Relatório do período</h2>
          <form method="get" action={`/obras/${params.id}/diario/relatorio`} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm"><span className="block text-muted">De</span><input type="date" name="de" required defaultValue={somarDias(hoje, -6)} max={hoje} className="min-h-11 rounded border border-line bg-card px-3" /></label>
            <label className="space-y-1 text-sm"><span className="block text-muted">Até</span><input type="date" name="ate" required defaultValue={hoje} max={hoje} className="min-h-11 rounded border border-line bg-card px-3" /></label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="fotos" value="sim" defaultChecked className="h-4 w-4" /> Com fotos</label>
            <button className="min-h-11 rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg hover:brightness-110">Gerar</button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Últimos 60 dias</h2>
        {diarios.length === 0 ? <Card className="p-5 text-sm text-muted">Nenhum diário registrado ainda.</Card> : (
          <Card className="divide-y divide-line">
            {diarios.map((d) => (
              <Link key={d.id} href={`/obras/${params.id}/diario/${iso(d.data)}${d.turno !== "INTEGRAL" ? `?turno=${d.turno}` : ""}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-bg">
                <div>
                  <p className="font-medium capitalize">{dataCurta(iso(d.data))}{d.turno !== "INTEGRAL" && <span className="ml-2 text-sm font-normal text-muted normal-case">{d.turno === "MANHA" ? "manhã" : "tarde"}</span>}</p>
                  <p className="text-sm text-muted">{CLIMA[d.clima]} {d.temperaturaC != null ? `${d.temperaturaC}°C` : ""} · {d._count.atividades} atividade{d._count.atividades === 1 ? "" : "s"} · {d._count.fotos} foto{d._count.fotos === 1 ? "" : "s"}</p>
                </div>
                <Badge tom={d.assinadoEm ? "ok" : "alerta"}>{d.assinadoEm ? "Concluído" : "Rascunho"}</Badge>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
