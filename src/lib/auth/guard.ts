import type { PrismaClient } from "@prisma/client";
import { ForbiddenError, type Role } from "./permissions";

/**
 * Perfil efetivo do usuário em uma obra:
 * - SUPER_ADMIN: sempre (mesma empresa).
 * - Demais: o perfil do vínculo ObraMembro, ou null se não for membro.
 * TODA rota /obras/[id]/* deve chamar isto antes de tocar em dados
 * (evita IDOR: acessar obra de outro por adivinhar o ID).
 */
export async function perfilNaObra(
  db: PrismaClient,
  user: { id: string; role: Role; empresaId: string },
  obraId: string,
): Promise<Role | null> {
  const obra = await db.obra.findFirst({ where: { id: obraId, empresaId: user.empresaId }, select: { id: true } });
  if (!obra) return null;
  if (user.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  const m = await db.obraMembro.findUnique({
    where: { userId_obraId: { userId: user.id, obraId } },
    select: { role: true },
  });
  return (m?.role as Role) ?? null;
}

export async function exigirPerfilNaObra(
  db: PrismaClient,
  user: { id: string; role: Role; empresaId: string },
  obraId: string,
): Promise<Role> {
  const perfil = await perfilNaObra(db, user, obraId);
  // Mesma resposta para "não existe" e "sem acesso" — não vaza a existência da obra.
  if (!perfil) throw new ForbiddenError("Obra não encontrada ou sem acesso.");
  return perfil;
}
