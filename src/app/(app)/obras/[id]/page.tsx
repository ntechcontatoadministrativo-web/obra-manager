import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { progressoFisico, progressoFinanceiro, semaforoCronograma } from "@/lib/progresso";
import { STATUS_OBRA } from "@/lib/obras";
import { statusEfetivo } from "@/lib/etapas";
import { dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { brl, dataBR } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, Clock, GanttChart, NotebookPen, ShieldAlert } from "lucide-react";
import { Badge, Card, Progresso, TITULO } from "@/components/ui";
import { StatusObra } from "./status-obra";

export const metadata: Metadata = { title: "Obra" };

const ROTULO_PERFIL: Record<string, string> = {
  SUPER_ADMIN: "Dono", ADMIN_OBRA: "Engenheiro", ENCARREGADO: "Encarregado", FISCAL: "Fiscal", VISUALIZADOR: "Cliente", VISITANTE: "Visitante",
};
const TOM = { verde: "ok", amarelo: "alerta", vermelho: "perigo" } as const;
const TXT = { verde: "No prazo", amarelo: "Atenção ao prazo", vermelho: "Atrasada" } as const;
const STATUS_ETAPA: Record<string, string> = {
  NAO_INICIADA: "Não iniciada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", ATRASADA: "Atrasada", PARALISADA: "Paralisada",
};

export default async function ObraPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  // Mesma resposta (404) para "não existe" e "sem acesso": não revela quais obras existem.
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil) notFound();

  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: {
      etapas: { orderBy: { ordem: "asc" } },
      membros: { include: { user: { select: { nome: true } } } },
    },
  });
  if (!obra) notFound();

  const etapas = obra.etapas.map((e) => ({ ...e, pct: Number(e.percentual), orc: Number(e.valorOrcado) }));
  const resumo = etapas.map((e) => ({ paiId: e.paiId, percentual: e.pct, valorOrcado: e.orc }));
  const fisico = progressoFisico(resumo);
  const orcamento = etapas.filter((e) => e.paiId === null).reduce((s, e) => s + e.orc, 0);
  const veFinanceiro = can(perfil, "financeiro", "ver");
  const custo = veFinanceiro
    ? Number((await prisma.despesa.aggregate({ where: { obraId: obra.id }, _sum: { valor: true } }))._sum.valor ?? 0)
    : 0;
  const financeiro = progressoFinanceiro(custo, orcamento);
  const semaforo = semaforoCronograma(fisico, obra.dataInicio, obra.previsaoTermino);
  const st = STATUS_OBRA[obra.status];
  const mapa = obra.latitude != null && obra.longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${obra.longitude - 0.004}%2C${obra.latitude - 0.003}%2C${obra.longitude + 0.004}%2C${obra.latitude + 0.003}&layer=mapnik&marker=${obra.latitude}%2C${obra.longitude}`
    : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={TITULO}>{obra.nome}</h1>
          <Badge tom={st.tom}>{st.rotulo}</Badge>
          <Badge tom={TOM[semaforo]}>{TXT[semaforo]}</Badge>
        </div>
        <p className="text-muted">{obra.endereco}</p>
        {can(perfil, "ponto", "ver") && (
          <div>
            <Link href={`/obras/${obra.id}/ponto`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja">
              <Clock size={18} aria-hidden /> Controle de ponto
            </Link>
          </div>
        )}
        {can(perfil, "etapa", "ver") && (
          <div>
            <Link href={`/obras/${obra.id}/etapas`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja">
              <GanttChart size={18} aria-hidden /> Etapas e cronograma
            </Link>
          </div>
        )}
        {can(perfil, "diario", "ver") && (
          <div>
            <Link href={`/obras/${obra.id}/diario`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja">
              <NotebookPen size={18} aria-hidden /> Diário de obra
            </Link>
          </div>
        )}
        {can(perfil, "analise", "ver") && (
          <div>
            <Link href={`/obras/${obra.id}/analise`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja">
              <TrendingUp size={18} aria-hidden /> Análise do projeto
            </Link>
          </div>
        )}
        {can(perfil, "risco", "ver") && (
          <div>
            <Link href={`/obras/${obra.id}/riscos`} className="inline-flex min-h-11 items-center gap-2 rounded border border-line bg-card px-4 text-sm font-semibold hover:border-laranja">
              <ShieldAlert size={18} aria-hidden /> Riscos
            </Link>
          </div>
        )}
        {can(perfil, "obra", "editar") && <StatusObra obraId={obra.id} atual={obra.status} podeArquivar={can(perfil, "obra", "excluir")} />}
      </header>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Progresso">
        <Card className="space-y-5 p-5">
          <Progresso valor={fisico} rotulo="Avanço físico" />
          {veFinanceiro && <Progresso valor={financeiro} rotulo="Custo sobre o orçamento" tom={financeiro > 100 ? "perigo" : "laranja"} />}
          {!veFinanceiro && <p className="text-sm text-muted">Os valores financeiros desta obra não estão disponíveis para o seu perfil.</p>}
        </Card>
        <Card className="space-y-3 p-5 text-sm">
          <Linha rotulo="Cliente" valor={obra.clienteNome} />
          {obra.engenheiroNome && <Linha rotulo="Engenheiro" valor={obra.engenheiroNome} />}
          <Linha rotulo="Início" valor={dataBR(obra.dataInicio)} />
          <Linha rotulo="Término previsto" valor={dataBR(obra.previsaoTermino)} />
          {obra.areaConstruidaM2 && <Linha rotulo="Área construída" valor={`${Number(obra.areaConstruidaM2).toLocaleString("pt-BR")} m²`} />}
          {veFinanceiro && <Linha rotulo="Valor do contrato" valor={brl(obra.valorContrato.toString())} />}
        </Card>
      </section>

      {obra.descricao && (
        <section><h2 className="mb-2 font-display text-xl font-semibold">Escopo</h2><p className="max-w-prose whitespace-pre-line text-muted">{obra.descricao}</p></section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Etapas</h2>
        {etapas.length === 0 ? (
          <Card className="p-5 text-sm text-muted">Nenhuma etapa cadastrada ainda. O cronograma será o próximo módulo.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {etapas.map((e) => (
              <div key={e.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_200px_130px] sm:items-center">
                <div>
                  <p className="font-medium">{e.nome}</p>
                  <p className="text-xs text-muted">{dataBR(e.inicioPrevisto)} a {dataBR(e.fimPrevisto)}</p>
                </div>
                <Progresso valor={e.pct} rotulo="Concluída" tom={e.pct >= 100 ? "ok" : e.fimPrevisto < dataParaBanco(dataLocalISO()) ? "perigo" : "laranja"} />
                <span className="text-sm text-muted sm:text-right">{STATUS_ETAPA[statusEfetivo({ percentual: e.pct, fimPrevisto: e.fimPrevisto, inicioReal: e.inicioReal, status: e.status }, dataParaBanco(dataLocalISO()))]}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {mapa && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Localização</h2>
          <iframe title={`Mapa de ${obra.nome}`} src={mapa} loading="lazy" className="h-64 w-full rounded-md border border-line" />
        </section>
      )}

      {can(perfil, "usuario", "ver") && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Equipe da obra</h2>
          <Card className="divide-y divide-line">
            {obra.membros.length === 0 && <p className="p-4 text-sm text-muted">Nenhum usuário vinculado.</p>}
            {obra.membros.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium">{m.user.nome}</span><span className="text-muted">{ROTULO_PERFIL[m.role]}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }) =>
  <div className="flex justify-between gap-4"><span className="text-muted">{rotulo}</span><span className="text-right font-medium">{valor}</span></div>;
