"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { importarCronograma, paraEtapas } from "@/lib/importar";
import { marcarCriticas } from "./actions";

type Res = { ok: boolean; mensagem: string; avisos?: string[] };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };

/** 8 MB de texto já é cronograma gigante; acima disso é engano ou ataque. */
const LIMITE_BYTES = 8 * 1024 * 1024;

/**
 * Importa cronograma do MS Project (XML) ou do Primavera P6 (XER).
 *
 * Substitui o cronograma inteiro da obra: etapas, dependências e
 * baselines saem juntas. Importar por cima do que existe, mesclando,
 * geraria duplicata silenciosa — e cronograma duplicado é pior do que
 * cronograma nenhum.
 */
export async function importarParaObra(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1),
    conteudo: z.string().min(1, "Arquivo vazio."),
    nomeArquivo: z.string().max(260).optional(),
  }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };

  const { obraId, conteudo, nomeArquivo } = p.data;
  if (conteudo.length > LIMITE_BYTES) {
    return { ok: false, mensagem: "Arquivo acima de 8 MB. Exporte só o projeto desta obra." };
  }

  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "etapa", "criar")) return NEGADO;

  let cronograma;
  try {
    cronograma = importarCronograma(conteudo);
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Não consegui ler o arquivo." };
  }

  const etapas = paraEtapas(cronograma);
  if (!etapas.length) return { ok: false, mensagem: "O arquivo não trouxe nenhuma tarefa com data." };
  if (etapas.length > 2000) {
    return { ok: false, mensagem: `O arquivo tem ${etapas.length} tarefas; o limite por obra é 2000.` };
  }

  const mapa = new Map<string, string>(); // chave do arquivo -> id no banco

  await prisma.$transaction(async (tx) => {
    // Fora o que existe. Baseline e dependência caem junto por cascata,
    // mas as baselines são removidas à mão para a intenção ficar explícita.
    await tx.cronogramaBaseline.deleteMany({ where: { obraId } });
    await tx.etapa.deleteMany({ where: { obraId } });

    // Pai antes de filha: paraEtapas já devolve nessa ordem.
    for (const e of etapas) {
      const criada = await tx.etapa.create({
        data: {
          obraId,
          paiId: e.chavePai ? mapa.get(e.chavePai) ?? null : null,
          nome: e.nome,
          ordem: e.ordem,
          inicioPrevisto: e.inicioPrevisto,
          fimPrevisto: e.fimPrevisto,
          percentual: e.percentual,
          valorOrcado: e.valorOrcado,
          ehMarco: e.ehMarco,
        },
        select: { id: true },
      });
      mapa.set(e.chave, criada.id);
    }

    const deps = cronograma.dependencias
      .map((d) => ({
        predecessoraId: mapa.get(d.predecessora),
        sucessoraId: mapa.get(d.sucessora),
        tipo: d.tipo,
        folgaDias: d.folgaDias,
      }))
      .filter((d): d is { predecessoraId: string; sucessoraId: string; tipo: "TI" | "II" | "TT" | "IT"; folgaDias: number } =>
        !!d.predecessoraId && !!d.sucessoraId && d.predecessoraId !== d.sucessoraId);

    if (deps.length) await tx.etapaDependencia.createMany({ data: deps, skipDuplicates: true });
  });

  await marcarCriticas(obraId);

  await registrarAuditoria(prisma, {
    userId: user.id, obraId, acao: "IMPORTAR_CRONOGRAMA", entidade: "Etapa",
    depois: { origem: cronograma.origem, arquivo: nomeArquivo ?? null, etapas: etapas.length, dependencias: cronograma.dependencias.length },
  });

  for (const s of ["etapas", "analise", "medicoes", ""]) {
    revalidatePath(`/obras/${obraId}${s ? `/${s}` : ""}`);
  }
  revalidatePath("/dashboard");

  return {
    ok: true,
    mensagem: `${etapas.length} etapas e ${cronograma.dependencias.length} dependências importadas de ${cronograma.origem}.`,
    avisos: cronograma.avisos,
  };
}

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
