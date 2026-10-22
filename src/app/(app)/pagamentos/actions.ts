"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { exigirPerfilNaObra } from "@/lib/auth/guard";
import { registrarAuditoria } from "@/lib/audit";
import { dataISOValida, dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { extrairDadosDoTexto, type DadosDocumento } from "@/lib/documento";
import { lerPix } from "@/lib/pix";
import { lerBoleto } from "@/lib/boleto";
import { transcreverImagem } from "@/lib/assistente";

type Res = { ok: boolean; mensagem: string; erros?: Record<string, string> };
const NEGADO: Res = { ok: false, mensagem: "Você não tem permissão para esta ação." };

async function perfilOuNull(user: Parameters<typeof exigirPerfilNaObra>[1], obraId: string) {
  try { return await exigirPerfilNaObra(prisma, user, obraId); }
  catch (e) { if (e instanceof ForbiddenError) return null; throw e; }
}
const refresh = (obraId: string) => {
  for (const p of ["/pagamentos", "/dashboard", `/obras/${obraId}`, `/obras/${obraId}/analise`, `/obras/${obraId}/compras`]) revalidatePath(p);
};

const TIPOS = ["MATERIAL", "MAO_DE_OBRA", "EQUIPAMENTO", "SERVICO", "TAXA", "OUTROS"] as const;

export async function salvarConta(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({
    obraId: z.string().min(1, "Escolha a obra."),
    descricao: z.string().trim().min(3, "Descreva a conta.").max(200),
    favorecido: z.string().trim().min(2, "Para quem é o pagamento?").max(120),
    tipo: z.enum(TIPOS),
    valor: z.coerce.number().positive("Informe o valor.").max(1e11),
    vencimento: z.string().refine(dataISOValida, "Data inválida."),
    pixChave: z.string().trim().max(140).optional(),
    pixCopiaECola: z.string().trim().max(600).optional(),
    linhaDigitavel: z.string().trim().max(80).optional(),
    etapaId: z.string().optional(),
    origem: z.enum(["MANUAL", "DOCUMENTO"]),
    documentoNome: z.string().max(160).optional(),
  }).safeParse(entrada);
  if (!p.success) {
    return { ok: false, mensagem: "Confira os campos.", erros: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = p.data;
  const perfil = await perfilOuNull(user, d.obraId);
  if (!perfil || !can(perfil, "financeiro", "criar")) return NEGADO;

  // Código colado com erro de digitação vira PIX que o banco recusa: melhor barrar aqui.
  if (d.pixCopiaECola && !lerPix(d.pixCopiaECola)) {
    return { ok: false, mensagem: "Confira os campos.", erros: { pixCopiaECola: "Este código PIX não é válido (o dígito de conferência não bate)." } };
  }
  const linha = d.linhaDigitavel?.replace(/\D/g, "") || null;
  if (linha && !lerBoleto(linha)) {
    return { ok: false, mensagem: "Confira os campos.", erros: { linhaDigitavel: "Linha digitável inválida." } };
  }

  let etapaId: string | null = null;
  if (d.etapaId) {
    const e = await prisma.etapa.findFirst({ where: { id: d.etapaId, obraId: d.obraId }, select: { id: true } });
    if (!e) return { ok: false, mensagem: "Etapa não encontrada nesta obra." };
    etapaId = e.id;
  }

  const hoje = dataLocalISO();
  const conta = await prisma.despesa.create({
    data: {
      obraId: d.obraId, etapaId, tipo: d.tipo, descricao: d.descricao, valor: d.valor,
      formaPagamento: d.vencimento > hoje ? "A_PRAZO" : "A_VISTA",
      competencia: dataParaBanco(hoje), vencimento: dataParaBanco(d.vencimento),
      favorecido: d.favorecido, pixChave: d.pixChave || null, pixCopiaECola: d.pixCopiaECola || null,
      linhaDigitavel: linha, origem: d.origem, documentoNome: d.documentoNome || null, criadoPorId: user.id,
    },
    select: { id: true },
  });
  await registrarAuditoria(prisma, {
    userId: user.id, obraId: d.obraId, acao: "CRIAR_CONTA_PAGAR", entidade: "Despesa", entidadeId: conta.id,
    depois: { valor: d.valor, vencimento: d.vencimento, favorecido: d.favorecido, origem: d.origem },
  });
  refresh(d.obraId);
  return { ok: true, mensagem: "Conta cadastrada." };
}

async function contaDoUsuario(user: Parameters<typeof exigirPerfilNaObra>[1], id: string) {
  const conta = await prisma.despesa.findUnique({ where: { id }, select: { id: true, obraId: true, valor: true, pagamento: true, favorecido: true } });
  if (!conta) return null;
  const perfil = await perfilOuNull(user, conta.obraId);
  return perfil ? { conta, perfil } : null;
}

export async function marcarPaga(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ id: z.string().min(1), data: z.string().refine(dataISOValida).optional() }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const alvo = await contaDoUsuario(user, p.data.id);
  if (!alvo || !can(alvo.perfil, "financeiro", "editar")) return NEGADO;
  if (alvo.conta.pagamento) return { ok: false, mensagem: "Esta conta já está paga." };

  const quando = p.data.data ?? dataLocalISO();
  await prisma.despesa.update({ where: { id: alvo.conta.id }, data: { pagamento: dataParaBanco(quando), pagoPorId: user.id } });
  await registrarAuditoria(prisma, {
    userId: user.id, obraId: alvo.conta.obraId, acao: "PAGAR_CONTA", entidade: "Despesa", entidadeId: alvo.conta.id,
    depois: { pagamento: quando, valor: Number(alvo.conta.valor) },
  });
  refresh(alvo.conta.obraId);
  return { ok: true, mensagem: `Pagamento de ${alvo.conta.favorecido ?? "conta"} registrado.` };
}

export async function desfazerPagamento(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ id: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const alvo = await contaDoUsuario(user, p.data.id);
  if (!alvo || !can(alvo.perfil, "financeiro", "editar")) return NEGADO;

  await prisma.despesa.update({ where: { id: alvo.conta.id }, data: { pagamento: null, pagoPorId: null } });
  await registrarAuditoria(prisma, { userId: user.id, obraId: alvo.conta.obraId, acao: "DESFAZER_PAGAMENTO", entidade: "Despesa", entidadeId: alvo.conta.id });
  refresh(alvo.conta.obraId);
  return { ok: true, mensagem: "Pagamento desfeito: a conta voltou para em aberto." };
}

export async function excluirConta(entrada: unknown): Promise<Res> {
  const user = await requireUser();
  const p = z.object({ id: z.string().min(1) }).safeParse(entrada);
  if (!p.success) return { ok: false, mensagem: "Requisição inválida." };
  const alvo = await contaDoUsuario(user, p.data.id);
  if (!alvo || !can(alvo.perfil, "financeiro", "excluir")) return NEGADO;

  const ligada = await prisma.despesa.findUnique({ where: { id: alvo.conta.id }, select: { ordemCompraId: true } });
  if (ligada?.ordemCompraId) return { ok: false, mensagem: "Esta conta veio de uma compra entregue. Cancele pela compra." };

  await prisma.despesa.delete({ where: { id: alvo.conta.id } });
  await registrarAuditoria(prisma, {
    userId: user.id, obraId: alvo.conta.obraId, acao: "EXCLUIR_CONTA_PAGAR", entidade: "Despesa", entidadeId: alvo.conta.id,
    antes: { valor: Number(alvo.conta.valor), favorecido: alvo.conta.favorecido },
  });
  refresh(alvo.conta.obraId);
  return { ok: true, mensagem: "Conta excluída." };
}

// ------------------------------------------------------------------ leitura --

export type ResLeitura =
  | { ok: true; dados: DadosDocumento; aviso: string | null }
  | { ok: false; mensagem: string };

const MAX_ARQUIVO = 1_500_000; // o corpo da Server Action vai até 2 MB

/**
 * Lê um documento e devolve os campos para a pessoa conferir. Não grava nada.
 * Aceita PDF (texto extraído aqui), imagem (transcrita pelo assistente, se
 * configurado) e os códigos que o celular já leu da imagem (QR do PIX,
 * código de barras do boleto).
 */
export async function lerDocumento(form: FormData): Promise<ResLeitura> {
  await requireUser();
  const arquivo = form.get("arquivo");
  const codigos = String(form.get("codigos") ?? "").slice(0, 4000);
  const colado = String(form.get("texto") ?? "").slice(0, 20000);

  const partes: string[] = [colado, codigos];
  let aviso: string | null = null;

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > MAX_ARQUIVO) return { ok: false, mensagem: "Arquivo grande demais (máximo 1,5 MB). Envie o PDF original ou uma foto menor." };
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        partes.push(String(text));
        if (!String(text).trim()) aviso = "Este PDF é uma imagem escaneada, sem texto. Tire uma foto do boleto ou digite os dados.";
      } catch {
        return { ok: false, mensagem: "Não consegui abrir este PDF." };
      }
    } else if (arquivo.type.startsWith("image/")) {
      const dataUrl = `data:${arquivo.type};base64,${Buffer.from(bytes).toString("base64")}`;
      const transcrito = await transcreverImagem(dataUrl);
      if (transcrito) partes.push(transcrito);
      else if (!codigos) aviso = "A leitura de foto precisa do assistente configurado (ASSISTENTE_API_KEY). Sem ele, só o QR do PIX e o código de barras são lidos pela câmera. Use o PDF ou digite os dados.";
    } else {
      return { ok: false, mensagem: "Envie um PDF ou uma foto (JPG, PNG)." };
    }
  }

  const texto = partes.filter(Boolean).join("\n");
  if (!texto.trim()) return { ok: false, mensagem: aviso ?? "Envie um arquivo ou cole o texto do documento." };

  const dados = extrairDadosDoTexto(texto);
  if (dados.valor == null && !aviso) aviso = "Não encontrei o valor no documento. Digite-o abaixo.";
  return { ok: true, dados, aviso };
}
