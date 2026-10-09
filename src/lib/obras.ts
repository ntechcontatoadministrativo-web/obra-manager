import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/auth/permissions";
import { progressoFisico, progressoFinanceiro, semaforoCronograma } from "@/lib/progresso";

type U = { id: string; role: Role; empresaId: string };

/** Obras que o usuário pode ver, já com os indicadores calculados. */
export async function listarObrasComIndicadores(user: U) {
  const where =
    user.role === "SUPER_ADMIN"
      ? { empresaId: user.empresaId }
      : { empresaId: user.empresaId, membros: { some: { userId: user.id } } };

  const obras = await prisma.obra.findMany({
    where,
    orderBy: [{ status: "asc" }, { nome: "asc" }],
    include: {
      etapas: { select: { paiId: true, percentual: true, valorOrcado: true } },
      membros: { where: { userId: user.id }, select: { role: true } },
    },
  });

  const custos = await prisma.despesa.groupBy({
    by: ["obraId"],
    where: { obraId: { in: obras.map((o) => o.id) } },
    _sum: { valor: true },
  });
  const custoPorObra = new Map(custos.map((c) => [c.obraId, Number(c._sum.valor ?? 0)]));

  return obras.map((o) => {
    const etapas = o.etapas.map((e) => ({ paiId: e.paiId, percentual: Number(e.percentual), valorOrcado: Number(e.valorOrcado) }));
    const orcamento = etapas.filter((e) => e.paiId === null).reduce((s, e) => s + e.valorOrcado, 0);
    const fisico = progressoFisico(etapas);
    return {
      id: o.id, nome: o.nome, endereco: o.endereco, status: o.status, clienteNome: o.clienteNome,
      dataInicio: o.dataInicio, previsaoTermino: o.previsaoTermino, valorContrato: Number(o.valorContrato),
      perfil: (user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : o.membros[0]?.role ?? "VISUALIZADOR") as Role,
      fisico,
      financeiro: progressoFinanceiro(custoPorObra.get(o.id) ?? 0, orcamento),
      semaforo: semaforoCronograma(fisico, o.dataInicio, o.previsaoTermino),
    };
  });
}

export const STATUS_OBRA: Record<string, { rotulo: string; tom: "neutro" | "ok" | "alerta" | "perigo" | "info" }> = {
  EM_PLANEJAMENTO: { rotulo: "Em planejamento", tom: "neutro" },
  EM_ANDAMENTO: { rotulo: "Em andamento", tom: "info" },
  PARALISADA: { rotulo: "Paralisada", tom: "alerta" },
  CONCLUIDA: { rotulo: "Concluída", tom: "ok" },
  ARQUIVADA: { rotulo: "Arquivada", tom: "neutro" },
};
