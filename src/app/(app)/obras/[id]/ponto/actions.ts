"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { criptografar, hashCpf, cpfValido, normalizarCpf } from "@/lib/crypto";
import { dentroDoRaio, distanciaMetros } from "@/lib/geo";
import { acoesPermitidas, dataLocalISO, dataParaBanco, EXIGE_FOTO, horaLocal, validarFoto, type AcaoPonto } from "@/lib/ponto";

type Resultado = { ok: boolean; mensagem: string };
const NEGADO: Resultado = { ok: false, mensagem: "Você não tem permissão para esta ação." };

const codigoPrisma = (e: unknown) => (e as { code?: string })?.code;

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}

// ---------------------------------------------------------------------------
// Bater o ponto (entrada / almoço / saída)
// ---------------------------------------------------------------------------
const PontoSchema = z.object({
  obraId: z.string().min(1),
  funcionarioId: z.string().min(1),
  acao: z.enum(["ENTRADA", "ALMOCO_SAIDA", "ALMOCO_VOLTA", "SAIDA"]),
  foto: z.string().optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
});

export async function registrarPonto(entrada: unknown): Promise<Resultado> {
  const user = await requireUser();
  const p = PontoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Dados inválidos. Recarregue a página e tente de novo." };
  const { obraId, funcionarioId, acao, foto, lat, lng } = p.data;

  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "ponto", "criar")) return NEGADO;

  const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, obraId, ativo: true }, select: { id: true, nome: true } });
  if (!funcionario) return { ok: false, mensagem: "Funcionário não encontrado nesta obra." };

  // Foto obrigatória na entrada e na saída.
  if (EXIGE_FOTO[acao as AcaoPonto]) {
    const v = validarFoto(foto);
    if (!v.ok) return { ok: false, mensagem: v.erro };
  }

  // Localização: valida o raio quando a obra tem coordenadas cadastradas.
  let noRaio: boolean | null = null;
  if (EXIGE_FOTO[acao as AcaoPonto]) {
    const [obra, cfg] = await Promise.all([
      prisma.obra.findUnique({ where: { id: obraId }, select: { latitude: true, longitude: true, raioGpsMetros: true, empresaId: true } }),
      prisma.configuracao.findFirst({ where: { empresa: { obras: { some: { id: obraId } } } }, select: { raioGpsMetros: true } }),
    ]);
    if (obra?.latitude != null && obra.longitude != null) {
      if (lat == null || lng == null)
        return { ok: false, mensagem: "Não consegui ler a localização. Ative o GPS e permita o acesso ao local no navegador." };
      const raio = obra.raioGpsMetros ?? cfg?.raioGpsMetros ?? 150;
      noRaio = dentroDoRaio({ lat, lng }, { lat: obra.latitude, lng: obra.longitude }, raio);
      if (!noRaio) {
        const dist = Math.round(distanciaMetros(lat, lng, obra.latitude, obra.longitude));
        return { ok: false, mensagem: `Você está a ${dist} m da obra. O ponto só pode ser batido a até ${raio} m.` };
      }
    }
  }

  const dia = dataParaBanco(dataLocalISO());
  const existente = await prisma.registroPonto.findUnique({ where: { funcionarioId_data: { funcionarioId, data: dia } } });
  if (existente && existente.tipo !== "TRABALHADO")
    return { ok: false, mensagem: "Este dia já foi marcado como ausência." };
  if (!acoesPermitidas(existente).includes(acao as AcaoPonto))
    return { ok: false, mensagem: "Essa batida não faz sentido agora. Atualize a página para ver o próximo passo." };

  const agora = new Date(); // horário do SERVIDOR, não do celular (evita adulterar a hora)
  const porTerceiro = true; // por enquanto, sempre lançado por um usuário do sistema (encarregado/engenheiro)
  try {
    if (acao === "ENTRADA") {
      await prisma.registroPonto.create({
        data: { obraId, funcionarioId, data: dia, tipo: "TRABALHADO", entradaEm: agora, entradaFotoUrl: foto, entradaLat: lat, entradaLng: lng, entradaNoRaio: noRaio, registradoPorId: user.id, lancadoPorTerceiro: porTerceiro },
      });
    } else {
      const dados =
        acao === "ALMOCO_SAIDA" ? { almocoSaidaEm: agora }
        : acao === "ALMOCO_VOLTA" ? { almocoVoltaEm: agora }
        : { saidaEm: agora, saidaFotoUrl: foto, saidaLat: lat, saidaLng: lng, saidaNoRaio: noRaio };
      await prisma.registroPonto.update({ where: { id: existente!.id }, data: dados });
    }
  } catch (e) {
    if (codigoPrisma(e) === "P2002") return { ok: false, mensagem: "Esse ponto já foi registrado agora há pouco." };
    throw e;
  }

  // A foto NÃO vai para o log de auditoria (é grande e pessoal).
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: `PONTO_${acao}`, entidade: "RegistroPonto", entidadeId: funcionarioId, depois: { data: dataLocalISO(), lat, lng, noRaio } });
  revalidatePath(`/obras/${obraId}/ponto`);
  const ROT: Record<string, string> = { ENTRADA: "Entrada", ALMOCO_SAIDA: "Saída para o almoço", ALMOCO_VOLTA: "Volta do almoço", SAIDA: "Saída" };
  return { ok: true, mensagem: `${ROT[acao]} de ${funcionario.nome} registrada às ${horaLocal(agora)}.` };
}

// ---------------------------------------------------------------------------
// Cadastro de funcionário
// ---------------------------------------------------------------------------
const FuncSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo."),
  cpf: z.string().refine(cpfValido, "CPF inválido."),
  funcao: z.string().trim().min(2, "Informe a função."),
  vinculo: z.enum(["CLT", "MEI", "DIARISTA", "EMPREITADA"]),
  telefone: z.string().trim().optional().transform((s) => s || null),
  terceiro: z.enum(["sim", "nao"]).default("nao"),
  empresaTerceira: z.string().trim().optional().transform((s) => s || null),
});

export async function cadastrarFuncionario(obraId: string, entrada: Record<string, string>): Promise<{ ok: boolean; mensagem?: string; erros: Record<string, string> }> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "funcionario", "criar")) return { ok: false, mensagem: NEGADO.mensagem, erros: {} };

  const r = FuncSchema.safeParse(entrada);
  if (!r.success) {
    const erros: Record<string, string> = {};
    for (const i of r.error.issues) erros[String(i.path[0])] ??= i.message;
    return { ok: false, erros };
  }
  const { cpf, terceiro, ...resto } = r.data;
  try {
    const f = await prisma.funcionario.create({
      data: { ...resto, obraId, terceiro: terceiro === "sim", cpfEnc: criptografar(normalizarCpf(cpf)), cpfHash: hashCpf(cpf) },
    });
    await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "CRIAR", entidade: "Funcionario", entidadeId: f.id, depois: { nome: f.nome, funcao: f.funcao } });
  } catch (e) {
    if (codigoPrisma(e) === "P2002") return { ok: false, erros: { cpf: "Já existe um funcionário com este CPF nesta obra." } };
    throw e;
  }
  revalidatePath(`/obras/${obraId}/ponto`);
  return { ok: true, erros: {}, mensagem: "Funcionário cadastrado." };
}

// ---------------------------------------------------------------------------
// Definir a localização da obra (para a validação do raio)
// ---------------------------------------------------------------------------
export async function definirLocalObra(obraId: string, lat: number, lng: number): Promise<Resultado> {
  const user = await requireUser();
  const perfil = await perfilOuNull(user, obraId);
  if (!perfil || !can(perfil, "obra", "editar")) return NEGADO;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { ok: false, mensagem: "Coordenadas inválidas." };
  const antes = await prisma.obra.findUnique({ where: { id: obraId }, select: { latitude: true, longitude: true } });
  await prisma.obra.update({ where: { id: obraId }, data: { latitude: lat, longitude: lng } });
  await registrarAuditoria(prisma, { userId: user.id, obraId, acao: "EDITAR", entidade: "Obra", entidadeId: obraId, antes, depois: { latitude: lat, longitude: lng } });
  revalidatePath(`/obras/${obraId}`); revalidatePath(`/obras/${obraId}/ponto`);
  return { ok: true, mensagem: "Localização da obra salva. O ponto agora só vale perto daqui." };
}
