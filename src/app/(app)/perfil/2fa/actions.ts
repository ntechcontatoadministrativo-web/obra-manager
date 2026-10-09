"use server";
import { revalidatePath } from "next/cache";
import { authenticator } from "otplib";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { criptografar, descriptografar } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";

/** Gera um segredo novo (ainda não ativo) e guarda criptografado. */
export async function iniciar2fa(): Promise<void> {
  const u = await requireUser();
  const atual = await prisma.user.findUnique({ where: { id: u.id }, select: { totpAtivo: true } });
  if (atual?.totpAtivo) return; // já ativo: trocar exigiria reautenticação (fase futura)
  await prisma.user.update({ where: { id: u.id }, data: { totpSecretEnc: criptografar(authenticator.generateSecret()) } });
  revalidatePath("/perfil/2fa");
}

/** Confere o primeiro código; se correto, ativa o 2FA. */
export async function ativar2fa(codigo: string): Promise<{ ok: boolean; erro?: string }> {
  const u = await requireUser();
  const reg = await prisma.user.findUnique({ where: { id: u.id }, select: { totpSecretEnc: true, totpAtivo: true } });
  if (!reg?.totpSecretEnc || reg.totpAtivo) return { ok: false, erro: "Inicie a configuração primeiro." };
  if (!/^\d{6}$/.test(codigo) || !authenticator.check(codigo, descriptografar(reg.totpSecretEnc)))
    return { ok: false, erro: "Código incorreto. Confira se o relógio do celular está no horário automático e tente o próximo código." };
  await prisma.user.update({ where: { id: u.id }, data: { totpAtivo: true } });
  await registrarAuditoria(prisma, { userId: u.id, acao: "ATIVAR_2FA", entidade: "User", entidadeId: u.id });
  return { ok: true };
}
