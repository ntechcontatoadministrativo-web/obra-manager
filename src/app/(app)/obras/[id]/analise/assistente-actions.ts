"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { montarFatos, perguntar, type Mensagem } from "@/lib/assistente";
import { resumoExecutivo } from "@/lib/resumo";

type Res = {
  ok: boolean;
  texto: string;
  /** false quando nenhum provedor está configurado: a tela diz isso. */
  modeloAtivo?: boolean;
};

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}

const Historico = z.array(z.object({
  papel: z.enum(["usuario", "assistente"]),
  texto: z.string().max(4000),
})).max(20).optional();

export async function perguntarAoAssistente(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    pergunta: z.string().trim().min(3, "Escreva a pergunta.").max(1000),
    historico: Historico,
  }).safeParse(entrada);
  if (!p.success) return { ok: false, texto: "Pergunta inválida." };

  const { obraId, pergunta, historico } = p.data;
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "analise", "ver")) {
    return { ok: false, texto: "Você não tem permissão para esta ação." };
  }

  const fatos = await montarFatos(prisma, obraId);
  if (!fatos) return { ok: false, texto: "Obra não encontrada." };

  const r = await perguntar(fatos, (historico ?? []) as Mensagem[], pergunta);

  // Fica registrado quem perguntou o quê: o assistente lê dados da obra,
  // e isso tem de aparecer na auditoria como qualquer outra leitura.
  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "CONSULTAR_ASSISTENTE", entidade: "Obra", entidadeId: obraId,
    depois: { pergunta: pergunta.slice(0, 200), modeloAtivo: r.modeloAtivo },
  });

  return { ok: true, texto: r.texto, modeloAtivo: r.modeloAtivo };
}

export async function gerarResumo(entrada: unknown): Promise<Res & { paragrafos?: string[] }> {
  const user = await requireUser();
  const p = z.object({ obraId: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, texto: "Requisição inválida." };

  const perfil = await perfilOuNull(user, p.data.obraId);
  if (!perfil || !can(perfil, "analise", "ver")) {
    return { ok: false, texto: "Você não tem permissão para esta ação." };
  }

  const fatos = await montarFatos(prisma, p.data.obraId);
  if (!fatos) return { ok: false, texto: "Obra não encontrada." };

  const paragrafos = resumoExecutivo(fatos);
  return { ok: true, texto: paragrafos.join("\n\n"), paragrafos };
}
