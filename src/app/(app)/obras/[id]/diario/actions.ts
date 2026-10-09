"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { buscarTempoDoDia, type TempoDoDia } from "@/lib/clima";
import { pendenciasConclusao } from "@/lib/diario";
import { dataISOValida, dataLocalISO, dataParaBanco, validarFoto } from "@/lib/ponto";

type Res = { ok: boolean; mensagem: string };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };
const BLOQUEADO: Res = { ok: false, mensagem: "Este diário já foi concluído e está bloqueado. O engenheiro pode reabri-lo." };
const TURNOS = ["MANHA", "TARDE", "INTEGRAL"] as const;
const MAX_FOTOS = 30;

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const chave = (obraId: string, data: string, turno: (typeof TURNOS)[number]) => ({ obraId_data_turno: { obraId, data: dataParaBanco(data), turno } });
const refresh = (obraId: string, data?: string) => { revalidatePath(`/obras/${obraId}/diario`); if (data) revalidatePath(`/obras/${obraId}/diario/${data}`); };

const Base = z.object({ obraId: z.string().min(1), data: z.string().refine(dataISOValida), turno: z.enum(TURNOS) });

// ---------------------------------------------------------------------------
// Ajudas de preenchimento (não gravam nada)
// ---------------------------------------------------------------------------
export async function buscarClima(entrada: unknown): Promise<Res & { tempo?: TempoDoDia }> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), data: z.string().refine(dataISOValida) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const perfil = await perfilOuNull(user, p.data.obraId);
  if (!perfil || !can(perfil, "diario", "criar")) return NEGADO;
  const obra = await prisma.obra.findUnique({ where: { id: p.data.obraId }, select: { latitude: true, longitude: true } });
  if (obra?.latitude == null || obra.longitude == null)
    return { ok: false, mensagem: "A obra ainda não tem localização. Defina em Controle de ponto → Localização da obra, ou preencha o tempo à mão." };
  const tempo = await buscarTempoDoDia(obra.latitude, obra.longitude, p.data.data);
  if (!tempo) return { ok: false, mensagem: "Não consegui consultar o tempo agora. Preencha à mão." };
  return { ok: true, mensagem: tempo.nota, tempo };
}

export interface LinhaEfetivo { funcao: string; quantidade: number; terceiro: boolean; empresa: string }

/** Quem bateu ponto no dia, agrupado por função — a equipe do diário sai daqui. */
export async function efetivoDoPonto(entrada: unknown): Promise<Res & { linhas?: LinhaEfetivo[] }> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), data: z.string().refine(dataISOValida) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const perfil = await perfilOuNull(user, p.data.obraId);
  if (!perfil || !can(perfil, "diario", "criar")) return NEGADO;
  const linhas = await efetivoPorPonto(p.data.obraId, p.data.data);
  if (linhas.length === 0) return { ok: false, mensagem: "Ninguém bateu ponto neste dia. Preencha a equipe à mão." };
  return { ok: true, mensagem: `${linhas.reduce((s, l) => s + l.quantidade, 0)} pessoas vindas do controle de ponto.`, linhas };
}

async function efetivoPorPonto(obraId: string, data: string): Promise<LinhaEfetivo[]> {
  const regs = await prisma.registroPonto.findMany({
    where: { obraId, data: dataParaBanco(data), tipo: "TRABALHADO", entradaEm: { not: null } },
    select: { funcionario: { select: { funcao: true, terceiro: true, empresaTerceira: true } } },
  });
  const mapa = new Map<string, LinhaEfetivo>();
  for (const r of regs) {
    const f = r.funcionario;
    const k = `${f.funcao}|${f.terceiro}|${f.empresaTerceira ?? ""}`;
    const l = mapa.get(k) ?? { funcao: f.funcao, quantidade: 0, terceiro: f.terceiro, empresa: f.empresaTerceira ?? "" };
    l.quantidade++; mapa.set(k, l);
  }
  return [...mapa.values()].sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Abrir o diário do dia (já vem com tempo e equipe preenchidos, quando possível)
// ---------------------------------------------------------------------------
export async function iniciarDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Base.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const { obraId, data, turno } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "diario", "criar")) return NEGADO;
  if (data > dataLocalISO()) return { ok: false, mensagem: "Não dá para abrir o diário de um dia que ainda não chegou." };

  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { latitude: true, longitude: true } });
  const [tempo, efetivo] = await Promise.all([
    obra?.latitude != null && obra.longitude != null ? buscarTempoDoDia(obra.latitude, obra.longitude, data) : Promise.resolve(null),
    efetivoPorPonto(obraId, data),
  ]);

  try {
    await prisma.diarioObra.create({
      data: {
        obraId, data: dataParaBanco(data), turno, criadoPorId: user.id, descricao: "",
        clima: tempo?.clima ?? "ENSOLARADO", temperaturaC: tempo?.temperaturaC ?? null,
        impactoClima: tempo?.impacto ?? "SEM_IMPACTO", obsClima: tempo && tempo.impacto !== "SEM_IMPACTO" ? tempo.nota : null,
        efetivo: { create: efetivo.map((l) => ({ funcao: l.funcao, quantidade: l.quantidade, terceiro: l.terceiro, empresa: l.empresa || null })) },
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e; // já existia: tudo bem
  }
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR", entidade: "DiarioObra", entidadeId: `${data}/${turno}` });
  refresh(obraId, data);
  return { ok: true, mensagem: "Diário aberto." };
}

// ---------------------------------------------------------------------------
// Salvar o rascunho (substitui as listas inteiras, tudo ou nada)
// ---------------------------------------------------------------------------
const Texto = (max: number) => z.string().trim().max(max);
const SalvarSchema = Base.extend({
  clima: z.enum(["ENSOLARADO", "NUBLADO", "CHUVOSO", "TEMPESTADE"]),
  temperaturaC: z.number().int().min(-10).max(60).nullable(),
  impactoClima: z.enum(["SEM_IMPACTO", "PRODUCAO_REDUZIDA", "PARALISACAO_PARCIAL", "PARALISACAO_TOTAL"]),
  obsClima: Texto(500), descricao: Texto(5000), observacoes: Texto(5000),
  efetivo: z.array(z.object({ funcao: Texto(80).min(2), quantidade: z.number().int().min(1).max(500), terceiro: z.boolean(), empresa: Texto(80) })).max(40),
  atividades: z.array(z.object({ etapaId: z.string().min(1), descricao: Texto(1000), quantidade: z.number().min(0).max(1e9).nullable(), unidade: Texto(20) })).max(60),
  equipamentos: z.array(z.object({ nome: Texto(80).min(2), horas: z.number().min(0).max(24) })).max(40),
  visitas: z.array(z.object({ nome: Texto(80).min(2), tipo: Texto(40) })).max(40),
});

export async function salvarDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = SalvarSchema.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Alguns campos estão inválidos (confira quantidades e textos muito longos)." };
  const d = p.data;
  const perfil = await perfilOuNull(user, d.obraId);
  if (!perfil || !can(perfil, "diario", "editar")) return NEGADO;

  const diario = await prisma.diarioObra.findUnique({ where: chave(d.obraId, d.data, d.turno), select: { id: true, assinadoEm: true } });
  if (!diario) return { ok: false, mensagem: "Abra o diário do dia antes de salvar." };
  if (diario.assinadoEm) return BLOQUEADO;

  // Etapas precisam ser desta obra (impede referenciar etapa de outra obra).
  const ids = [...new Set(d.atividades.map((a) => a.etapaId))];
  if (ids.length) {
    const validas = await prisma.etapa.count({ where: { id: { in: ids }, obraId: d.obraId } });
    if (validas !== ids.length) return { ok: false, mensagem: "Uma das etapas escolhidas não pertence a esta obra." };
  }

  // Equipamentos: reaproveita o cadastro da empresa pelo nome, ou cria.
  const equipIds: { id: string; horas: number }[] = [];
  for (const e of d.equipamentos) {
    const existente = await prisma.equipamento.findFirst({ where: { empresaId: user.empresaId, nome: { equals: e.nome, mode: "insensitive" } }, select: { id: true } });
    const id = existente?.id ?? (await prisma.equipamento.create({ data: { empresaId: user.empresaId, nome: e.nome }, select: { id: true } })).id;
    equipIds.push({ id, horas: e.horas });
  }

  await prisma.$transaction([
    prisma.diarioObra.update({
      where: { id: diario.id },
      data: { clima: d.clima, temperaturaC: d.temperaturaC, impactoClima: d.impactoClima, obsClima: d.obsClima || null, descricao: d.descricao, observacoes: d.observacoes || null },
    }),
    prisma.diarioEfetivo.deleteMany({ where: { diarioId: diario.id } }),
    prisma.diarioAtividade.deleteMany({ where: { diarioId: diario.id } }),
    prisma.diarioEquipamento.deleteMany({ where: { diarioId: diario.id } }),
    prisma.diarioVisita.deleteMany({ where: { diarioId: diario.id } }),
    prisma.diarioEfetivo.createMany({ data: d.efetivo.map((e) => ({ diarioId: diario.id, funcao: e.funcao, quantidade: e.quantidade, terceiro: e.terceiro, empresa: e.empresa || null })) }),
    prisma.diarioAtividade.createMany({ data: d.atividades.map((a) => ({ diarioId: diario.id, etapaId: a.etapaId, descricao: a.descricao || null, quantidade: a.quantidade, unidade: a.unidade || null })) }),
    prisma.diarioEquipamento.createMany({ data: equipIds.map((e) => ({ diarioId: diario.id, equipamentoId: e.id, horasUso: e.horas })) }),
    prisma.diarioVisita.createMany({ data: d.visitas.map((v) => ({ diarioId: diario.id, nome: v.nome, tipo: v.tipo || "visita" })) }),
  ]);

  await registrarAuditoria(prisma, { userId: user.id, obraId: d.obraId, acao: "EDITAR", entidade: "DiarioObra", entidadeId: diario.id,
    depois: { data: d.data, turno: d.turno, clima: d.clima, impacto: d.impactoClima, efetivo: d.efetivo.length, atividades: d.atividades.length } });
  refresh(d.obraId, d.data);
  return { ok: true, mensagem: "Rascunho salvo." };
}

// ---------------------------------------------------------------------------
// Concluir (assinar), reabrir
// ---------------------------------------------------------------------------
export async function concluirDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Base.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const { obraId, data, turno } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "diario", "editar")) return NEGADO;

  const dia = await prisma.diarioObra.findUnique({
    where: chave(obraId, data, turno),
    include: { efetivo: true, _count: { select: { atividades: true, fotos: true } } },
  });
  if (!dia) return { ok: false, mensagem: "Diário não encontrado." };
  if (dia.assinadoEm) return { ok: false, mensagem: "Este diário já foi concluído." };

  // Confere NO SERVIDOR, com o que está salvo: não dá para burlar pelo navegador.
  const pendencias = pendenciasConclusao({
    descricao: dia.descricao, temperaturaC: dia.temperaturaC, impactoClima: dia.impactoClima, obsClima: dia.obsClima ?? "",
    pessoas: dia.efetivo.reduce((s: number, e: { quantidade: number }) => s + e.quantidade, 0), atividades: dia._count.atividades, fotos: dia._count.fotos,
  });
  if (pendencias.length) return { ok: false, mensagem: `Ainda falta: ${pendencias.join(" ")}` };

  await prisma.diarioObra.update({ where: { id: dia.id }, data: { assinadoPorId: user.id, assinadoEm: new Date() } });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CONCLUIR", entidade: "DiarioObra", entidadeId: dia.id, depois: { data, turno } });
  refresh(obraId, data);
  return { ok: true, mensagem: "Diário concluído e assinado." };
}

export async function reabrirDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Base.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const { obraId, data, turno } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "diario", "aprovar")) return { ok: false, mensagem: "Só o engenheiro ou o dono podem reabrir um diário concluído." };
  const dia = await prisma.diarioObra.findUnique({ where: chave(obraId, data, turno), select: { id: true, assinadoEm: true, assinadoPorId: true } });
  if (!dia?.assinadoEm) return { ok: false, mensagem: "Este diário não está concluído." };
  await prisma.diarioObra.update({ where: { id: dia.id }, data: { assinadoEm: null, assinadoPorId: null } });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "REABRIR", entidade: "DiarioObra", entidadeId: dia.id, antes: { assinadoPorId: dia.assinadoPorId, assinadoEm: dia.assinadoEm } });
  refresh(obraId, data);
  return { ok: true, mensagem: "Diário reaberto para edição." };
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
export async function adicionarFotoDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = Base.extend({ foto: z.string(), legenda: z.string().trim().max(200).optional() }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const { obraId, data, turno, foto, legenda } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "foto", "criar") || !can(perfil, "diario", "editar")) return NEGADO;
  const v = validarFoto(foto);
  if (!v.ok) return { ok: false, mensagem: v.erro };
  const dia = await prisma.diarioObra.findUnique({ where: chave(obraId, data, turno), select: { id: true, assinadoEm: true, _count: { select: { fotos: true } } } });
  if (!dia) return { ok: false, mensagem: "Abra o diário do dia antes de enviar fotos." };
  if (dia.assinadoEm) return BLOQUEADO;
  if (dia._count.fotos >= MAX_FOTOS) return { ok: false, mensagem: `Limite de ${MAX_FOTOS} fotos por diário.` };
  await prisma.foto.create({ data: { obraId, diarioId: dia.id, url: foto, legenda: legenda || null, enviadaPorId: user.id } });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "ANEXAR_FOTO", entidade: "DiarioObra", entidadeId: dia.id });
  refresh(obraId, data);
  return { ok: true, mensagem: "Foto anexada." };
}

export async function removerFotoDiario(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1), fotoId: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos." };
  const perfil = await perfilOuNull(user, p.data.obraId);
  if (!perfil || !can(perfil, "diario", "editar")) return NEGADO;
  const foto = await prisma.foto.findFirst({ where: { id: p.data.fotoId, obraId: p.data.obraId, diarioId: { not: null } }, select: { id: true, diario: { select: { assinadoEm: true, data: true } } } });
  if (!foto) return { ok: false, mensagem: "Foto não encontrada." };
  if (foto.diario?.assinadoEm) return BLOQUEADO;
  await prisma.foto.delete({ where: { id: foto.id } });
  await registrarAuditoria(prisma, { userId: user.id, obraId: p.data.obraId, acao: "REMOVER_FOTO", entidade: "DiarioObra", entidadeId: foto.id });
  refresh(p.data.obraId, foto.diario?.data.toISOString().slice(0, 10));
  return { ok: true, mensagem: "Foto removida." };
}
