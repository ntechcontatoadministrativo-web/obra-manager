"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/auth/permissions";
import { registrarAuditoria } from "@/lib/audit";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };

const opcional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export async function salvarFornecedor(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    id: z.string().optional(),
    nome: z.string().trim().min(2, "Nome do fornecedor.").max(120),
    cnpj: opcional(20),
    contato: opcional(80),
    telefone: opcional(30),
    email: z.string().trim().email("E-mail inválido.").max(120).optional().or(z.literal("")).transform((v) => v || null),
    pixChave: opcional(140),
    prazoEntregaDias: z.coerce.number().int().min(0).max(365).optional().nullable(),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Confira os campos.", erros: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };

  const { id, ...dados } = p.data;
  if (!can(user.role, "fornecedor", id ? "editar" : "criar")) return { ok: false, mensagem: "Você não tem permissão para esta ação." };

  try {
    if (id) {
      const r = await prisma.fornecedor.updateMany({ where: { id, empresaId: user.empresaId }, data: dados });
      if (r.count === 0) return { ok: false, mensagem: "Fornecedor não encontrado." };
    } else {
      await prisma.fornecedor.create({ data: { ...dados, empresaId: user.empresaId } });
    }
  } catch {
    return { ok: false, mensagem: "Confira os campos.", erros: { cnpj: "Já existe um fornecedor com este CNPJ." } };
  }
  await registrarAuditoria(prisma, { userId: user.id, acao: id ? "EDITAR_FORNECEDOR" : "CRIAR_FORNECEDOR", entidade: "Fornecedor", entidadeId: id ?? null, depois: { nome: dados.nome } });
  revalidatePath("/fornecedores");
  return { ok: true, mensagem: id ? "Fornecedor atualizado." : "Fornecedor cadastrado." };
}
