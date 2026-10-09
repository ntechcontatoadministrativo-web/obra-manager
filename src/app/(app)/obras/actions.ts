"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertCan, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { parseNumeroBR } from "@/lib/utils";

const numero = (min: number, max: number, msg: string) =>
  z.string().transform(parseNumeroBR).refine((n) => !Number.isNaN(n) && n >= min && n <= max, msg);
const numeroOpc = (min: number, max: number, msg: string) =>
  z.string().transform((s) => (s.trim() === "" ? null : parseNumeroBR(s)))
    .refine((n) => n === null || (!Number.isNaN(n) && n >= min && n <= max), msg);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").transform((s) => new Date(`${s}T00:00:00Z`));

const ObraSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome da obra (mínimo 3 letras)."),
  endereco: z.string().trim().min(5, "Informe o endereço completo."),
  clienteNome: z.string().trim().min(2, "Informe o cliente."),
  engenheiroNome: z.string().trim().optional().transform((s) => s || null),
  dataInicio: data,
  previsaoTermino: data,
  valorContrato: numero(0.01, 1e12, "Informe o valor do contrato (maior que zero)."),
  areaConstruidaM2: numeroOpc(0.01, 1e7, "Área inválida."),
  latitude: numeroOpc(-90, 90, "Latitude deve estar entre -90 e 90."),
  longitude: numeroOpc(-180, 180, "Longitude deve estar entre -180 e 180."),
  descricao: z.string().trim().optional().transform((s) => s || null),
  status: z.enum(["EM_PLANEJAMENTO", "EM_ANDAMENTO", "PARALISADA", "CONCLUIDA"]),
}).refine((o) => o.previsaoTermino >= o.dataInicio, { path: ["previsaoTermino"], message: "O término não pode ser antes do início." })
  .refine((o) => (o.latitude === null) === (o.longitude === null), { path: ["longitude"], message: "Preencha latitude e longitude juntas." });

export type ResultadoForm = { ok: false; erros: Record<string, string>; geral?: string };

export async function criarObra(entrada: Record<string, string>): Promise<ResultadoForm> {
  const user = await requireUser();
  try { assertCan(user.role, "obra", "criar"); }
  catch (e) { if (e instanceof ForbiddenError) return { ok: false, erros: {}, geral: "Só o dono da empresa pode cadastrar obras." }; throw e; }

  const r = ObraSchema.safeParse(entrada);
  if (!r.success) {
    const erros: Record<string, string> = {};
    for (const i of r.error.issues) erros[String(i.path[0])] ??= i.message;
    return { ok: false, erros };
  }

  const obra = await prisma.obra.create({ data: { ...r.data, empresaId: user.empresaId } });
  await registrarAuditoria(prisma, { userId: user.id, obraId: obra.id, acao: "CRIAR", entidade: "Obra", entidadeId: obra.id, depois: r.data });
  revalidatePath("/obras"); revalidatePath("/dashboard");
  redirect(`/obras/${obra.id}`);
}

const STATUS = ["EM_PLANEJAMENTO", "EM_ANDAMENTO", "PARALISADA", "CONCLUIDA", "ARQUIVADA"] as const;

export async function alterarStatusObra(obraId: string, novo: string): Promise<{ ok: boolean; erro?: string }> {
  const user = await requireUser();
  if (!(STATUS as readonly string[]).includes(novo)) return { ok: false, erro: "Status inválido." };
  try {
    const perfil = await exigirPerfilNaObra(prisma, user, obraId);
    assertCan(perfil, "obra", "editar");
    if (novo === "ARQUIVADA") assertCan(perfil, "obra", "excluir"); // arquivar: só o dono
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, erro: "Você não tem permissão para esta mudança." };
    throw e;
  }
  const antes = await prisma.obra.findUnique({ where: { id: obraId }, select: { status: true } });
  await prisma.obra.update({ where: { id: obraId }, data: { status: novo as (typeof STATUS)[number] } });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "EDITAR", entidade: "Obra", entidadeId: obraId, antes, depois: { status: novo } });
  revalidatePath(`/obras/${obraId}`); revalidatePath("/obras"); revalidatePath("/dashboard");
  return { ok: true };
}
