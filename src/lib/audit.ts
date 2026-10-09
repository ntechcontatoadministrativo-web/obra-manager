import type { PrismaClient, Prisma } from "@prisma/client";

interface EntradaAuditoria {
  userId?: string | null;
  obraId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
}

/** Campos que nunca devem ir para o log (mesmo criptografados). */
const SENSIVEIS = ["senhaHash", "totpSecretEnc", "cpfEnc", "dadosBancariosEnc"];

function limpar(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor == null) return undefined;
  const copia = JSON.parse(JSON.stringify(valor));
  const walk = (o: any) => {
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        if (SENSIVEIS.includes(k)) o[k] = "[REDACTED]";
        else walk(o[k]);
      }
    }
  };
  walk(copia);
  return copia;
}

export async function registrarAuditoria(db: PrismaClient, e: EntradaAuditoria) {
  await db.auditLog.create({
    data: {
      userId: e.userId ?? null,
      obraId: e.obraId ?? null,
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      antes: limpar(e.antes),
      depois: limpar(e.depois),
      ip: e.ip ?? null,
    },
  });
}
