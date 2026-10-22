import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { dataISOValida, dataLocalISO, dataParaBanco, horaLocal } from "@/lib/ponto";
import { dataLonga, somarDias } from "@/lib/diario";
import { progressoFisico } from "@/lib/progresso";
import { STATUS_OBRA } from "@/lib/obras";
import { Badge, Card, TITULO } from "@/components/ui";
import { DiarioForm, type EtapaOpcao } from "./diario-form";
import { Fotos } from "./fotos";
import { IniciarDiario } from "./iniciar";

export const metadata: Metadata = { title: "Diário de obra" };
const TURNOS = ["MANHA", "TARDE", "INTEGRAL"] as const;
const ROTULO_TURNO = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Dia inteiro" } as const;

export default async function DiarioDia({ params, searchParams }: { params: { id: string; data: string }; searchParams: { turno?: string } }) {
  const user = await requireUser();
  if (!dataISOValida(params.data)) notFound();
  const turno = (TURNOS as readonly string[]).includes(searchParams.turno ?? "") ? (searchParams.turno as (typeof TURNOS)[number]) : "INTEGRAL";
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "diario", "ver")) notFound();

  const hoje = dataLocalISO();
  const [obra, etapas, diario] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, status: true } }),
    prisma.etapa.findMany({ where: { obraId: params.id }, orderBy: { ordem: "asc" }, select: { id: true, nome: true, paiId: true, percentual: true, valorOrcado: true, status: true, criterioMedicao: true, inicioPrevisto: true, fimPrevisto: true } }),
    prisma.diarioObra.findUnique({
      where: { obraId_data_turno: { obraId: params.id, data: dataParaBanco(params.data), turno } },
      include: {
        efetivo: true, atividades: true, equipamentos: { include: { equipamento: { select: { nome: true } } } }, visitas: true,
        fotos: { orderBy: { tiradaEm: "asc" }, select: { id: true, url: true, legenda: true } },
      },
    }),
  ]);
  if (!obra) notFound();

  const ehFuturo = params.data > hoje;
  const podeCriar = can(perfil, "diario", "criar");
  const podeEditar = can(perfil, "diario", "editar");
  const assinante = diario?.assinadoPorId ? await prisma.user.findUnique({ where: { id: diario.assinadoPorId }, select: { nome: true } }) : null;

  // "Situação da obra" no dia: calculada, sem digitar nada.
  const fisico = progressoFisico(etapas.map((e) => ({ paiId: e.paiId, percentual: Number(e.percentual), valorOrcado: Number(e.valorOrcado) })));
  const emAndamento = etapas.filter((e) => e.status === "EM_ANDAMENTO");
  const naPonto = await prisma.registroPonto.count({ where: { obraId: params.id, data: dataParaBanco(params.data), tipo: "TRABALHADO", entradaEm: { not: null } } });
  const opcoes: EtapaOpcao[] = etapas.map((e) => ({ id: e.id, nome: e.nome, unidade: e.criterioMedicao ?? "", emAndamento: e.status === "EM_ANDAMENTO" }));

  const nav = (d: string) => `/obras/${params.id}/diario/${d}${turno !== "INTEGRAL" ? `?turno=${turno}` : ""}`;
  const st = STATUS_OBRA[obra.status];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href={`/obras/${params.id}/diario`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink print:hidden"><ChevronLeft size={16} aria-hidden /> Diários de {obra.nome}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={`${TITULO} first-letter:uppercase`}>{dataLonga(params.data)}</h1>
          <div className="flex items-center gap-1 print:hidden">
            <Link href={nav(somarDias(params.data, -1))} aria-label="Dia anterior" className="flex min-h-11 min-w-11 items-center justify-center rounded border border-line bg-card hover:border-laranja"><ChevronLeft size={18} aria-hidden /></Link>
            {params.data !== hoje && <Link href={nav(hoje)} className="flex min-h-11 items-center rounded border border-line bg-card px-3 text-sm font-medium hover:border-laranja">Hoje</Link>}
            {params.data < hoje && <Link href={nav(somarDias(params.data, 1))} aria-label="Próximo dia" className="flex min-h-11 min-w-11 items-center justify-center rounded border border-line bg-card hover:border-laranja"><ChevronRight size={18} aria-hidden /></Link>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tom={diario?.assinadoEm ? "ok" : diario ? "alerta" : "neutro"}>{diario?.assinadoEm ? "Concluído" : diario ? "Rascunho" : "Não aberto"}</Badge>
          <nav aria-label="Turno" className="flex gap-1">
            {TURNOS.map((t) => <Link key={t} href={`/obras/${params.id}/diario/${params.data}?turno=${t}`} aria-current={t === turno ? "page" : undefined}
              className={`min-h-9 rounded border px-3 py-1.5 text-xs font-semibold ${t === turno ? "border-laranja bg-laranja/10 text-laranja" : "border-line text-muted hover:text-ink"}`}>{ROTULO_TURNO[t]}</Link>)}
          </nav>
          <Link href={`/obras/${params.id}/diario/${params.data}/rdo`} className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm font-medium text-laranja hover:underline print:hidden"><Printer size={16} aria-hidden /> RDO em PDF</Link>
        </div>
      </header>

      <Card className="grid gap-3 p-4 text-sm sm:grid-cols-4">
        <div><p className="text-muted">Situação da obra</p><Badge tom={st.tom}>{st.rotulo}</Badge></div>
        <div><p className="text-muted">Avanço físico</p><p className="font-display text-lg font-semibold tabular-nums">{fisico.toFixed(1).replace(".", ",")}%</p></div>
        <div><p className="text-muted">Bateram ponto neste dia</p><p className="font-display text-lg font-semibold tabular-nums">{naPonto}</p></div>
        <div><p className="text-muted">Etapas em andamento</p><p className="font-medium">{emAndamento.length ? emAndamento.map((e) => e.nome).join(", ") : "Nenhuma"}</p></div>
      </Card>

      {!diario ? (
        <Card className="space-y-3 p-6">
          {ehFuturo ? <p className="text-muted">Este dia ainda não chegou.</p>
            : podeCriar ? (<><p className="font-medium">Ainda não há diário para este dia.</p><p className="text-sm text-muted">Ao abrir, o sistema já preenche o tempo do dia e a equipe que bateu ponto.</p><IniciarDiario obraId={params.id} data={params.data} turno={turno} /></>)
            : <p className="text-muted">Nenhum diário foi registrado neste dia.</p>}
        </Card>
      ) : (
        <>
          {diario.assinadoEm && (
            <p role="note" className="rounded border border-ok/30 bg-ok/10 p-3 text-sm font-medium text-ok">
              Concluído e assinado por {assinante?.nome ?? "usuário"} em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short" }).format(diario.assinadoEm)} às {horaLocal(diario.assinadoEm)}. Bloqueado para edição.
            </p>
          )}
          <DiarioForm
            obraId={params.id} data={params.data} turno={turno}
            travado={!!diario.assinadoEm || !podeEditar} podeReabrir={can(perfil, "diario", "aprovar")} fotos={diario.fotos.length} etapas={opcoes}
            inicial={{
              clima: diario.clima, temperaturaC: diario.temperaturaC, impactoClima: diario.impactoClima, obsClima: diario.obsClima ?? "",
              descricao: diario.descricao, observacoes: diario.observacoes ?? "",
              efetivo: diario.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, terceiro: e.terceiro, empresa: e.empresa ?? "" })),
              atividades: diario.atividades.map((a) => ({ etapaId: a.etapaId, descricao: a.descricao ?? "", quantidade: a.quantidade == null ? null : Number(a.quantidade), unidade: a.unidade ?? "" })),
              equipamentos: diario.equipamentos.map((e) => ({ nome: e.equipamento.nome, horas: Number(e.horasUso) })),
              visitas: diario.visitas.map((v) => ({ nome: v.nome, tipo: v.tipo })),
            }}
          />
          <Fotos obraId={params.id} data={params.data} turno={turno} fotos={diario.fotos} travado={!!diario.assinadoEm || !podeEditar} />
        </>
      )}
    </div>
  );
}
