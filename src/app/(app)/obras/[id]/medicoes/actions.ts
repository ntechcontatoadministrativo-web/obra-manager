"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { calcularMedicao, ehFolha, type EtapaNo } from "@/lib/etapas";
import { progressoFisico } from "@/lib/progresso";
import { dataISOValida, dataLocalISO, dataParaBanco } from "@/lib/ponto";

type Res = { ok: boolean; mensagem: string; numero?: number };

/** Fecha a medição do período: tira uma "foto" do andamento atual e calcula o que avançou desde a medição anterior. */
export async function fecharMedicao(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), de: z.string().refine(dataISOValida), ate: z.string().refine(dataISOValida) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Informe as duas datas do período." };
  const { obraId, de, ate } = p.data;

  let perfil;
  try { perfil = await exigirPerfilNaObra(prisma, user, obraId); } catch (e) { if (e instanceof ForbiddenError) return { ok: false, mensagem: "Sem permissão." }; throw e; }
  if (!can(perfil, "medicao", "criar")) return { ok: false, mensagem: "Você não tem permissão para fechar medições." };
  if (ate < de) return { ok: false, mensagem: "O fim do período não pode ser antes do início." };
  if (ate > dataLocalISO()) return { ok: false, mensagem: "O período não pode terminar em uma data futura." };

  const [rows, anterior] = await Promise.all([
    prisma.etapa.findMany({ where: { obraId } }),
    prisma.medicao.findFirst({ where: { obraId }, orderBy: { numero: "desc" }, include: { itens: true } }),
  ]);
  if (rows.length === 0) return { ok: false, mensagem: "A obra ainda não tem etapas." };
  if (anterior && dataParaBanco(de) <= anterior.periodoFim) return { ok: false, mensagem: `O período precisa começar depois do fim da medição anterior (${anterior.periodoFim.toISOString().slice(0, 10).split("-").reverse().join("/")}).` };

  const nos: EtapaNo[] = rows.map((r) => ({ id: r.id, paiId: r.paiId, nome: r.nome, ordem: r.ordem, inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto, inicioReal: r.inicioReal, fimReal: r.fimReal, percentual: Number(r.percentual), valorOrcado: Number(r.valorOrcado), status: r.status as EtapaNo["status"] }));
  const fol = nos.filter((n) => ehFolha(nos, n.id));
  const calc = calcularMedicao(fol, new Map((anterior?.itens ?? []).map((i) => [i.etapaId, Number(i.percentualAcumulado)])));
  const global = progressoFisico(nos.map((n) => ({ paiId: n.paiId, percentual: n.percentual, valorOrcado: n.valorOrcado })));
  const numero = (anterior?.numero ?? 0) + 1;

  try {
    await prisma.medicao.create({
      data: {
        obraId, numero, periodoInicio: dataParaBanco(de), periodoFim: dataParaBanco(ate), avancoGlobalPct: global, valorMedido: calc.valorPeriodo, criadoPorId: user.id,
        itens: { create: calc.itens.map((i) => ({ etapaId: i.etapaId, percentualAcumulado: i.acumulado, percentualPeriodo: i.periodo })) },
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, mensagem: "Outra medição foi fechada agora há pouco. Atualize a página." };
    throw e;
  }
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR", entidade: "Medicao", entidadeId: `${numero}`, depois: { numero, de, ate, valorMedido: calc.valorPeriodo } });
  revalidatePath(`/obras/${obraId}/medicoes`);
  const aviso = calc.regressoes.length ? ` Atenção: andamento reduzido em ${calc.regressoes.join("; ")}.` : "";
  return { ok: true, numero, mensagem: `Medição nº ${numero} fechada.${aviso}` };
}
