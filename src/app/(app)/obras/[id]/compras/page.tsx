import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { aceitaAnexo, desvioDePreco, statusAoAprovar, type CategoriaAnexo, type CompraStatus, type MeioPagamento } from "@/lib/compras";
import { brl } from "@/lib/utils";
import { Card, TITULO } from "@/components/ui";
import { ListaCompras, NovaSolicitacao, type CompraCartao } from "./compras";

export const metadata: Metadata = { title: "Compras" };

// Ordem na tela: primeiro o que pede ação, por último o que já terminou.
const ORDEM: Record<CompraStatus, number> = {
  AGUARDANDO_ADMIN_OBRA: 0, AGUARDANDO_SUPER_ADMIN: 1, APROVADA: 2, PO_EMITIDA: 3, ENVIADA_FORNECEDOR: 4,
  ENTREGUE: 5, REPROVADA: 6, CANCELADA: 7,
};

export default async function ComprasPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "compra", "ver")) notFound();

  const [obra, solicitacoes, etapas, fornecedores, cfg] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true } }),
    prisma.solicitacaoCompra.findMany({
      where: { obraId: params.id },
      orderBy: { criadoEm: "desc" },
      take: 100,
      include: {
        etapa: { select: { nome: true } },
        itens: { include: { insumo: { select: { id: true, nome: true, unidade: true } } } },
        ordem: { include: { fornecedor: { select: { nome: true, pixChave: true } }, despesa: { select: { pagamento: true } } } },
        // Sem o conteúdo: o arquivo só é lido ao abrir o link.
        anexos: { orderBy: { criadoEm: "asc" }, select: { id: true, categoria: true, nome: true, tipo: true, tamanho: true, enviadoPorId: true } },
      },
    }),
    prisma.etapa.findMany({ where: { obraId: params.id }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    prisma.fornecedor.findMany({ where: { empresaId: user.empresaId }, orderBy: { nome: "asc" }, select: { id: true, nome: true, pixChave: true } }),
    prisma.configuracao.findUnique({ where: { empresaId: user.empresaId }, select: { limiteAprovacaoCompra: true, alertaDesvioPrecoPct: true } }),
  ]);
  if (!obra) notFound();

  const limite = Number(cfg?.limiteAprovacaoCompra ?? 5000);
  const limiteDesvio = Number(cfg?.alertaDesvioPrecoPct ?? 15);
  const insumoIds = [...new Set(solicitacoes.flatMap((s) => s.itens.map((i) => i.insumo.id)))];
  const [historico, pessoas] = await Promise.all([
    prisma.precoHistorico.findMany({ where: { insumoId: { in: insumoIds } }, select: { insumoId: true, preco: true } }),
    prisma.user.findMany({ where: { id: { in: [...new Set(solicitacoes.map((s) => s.solicitanteId))] } }, select: { id: true, nome: true } }),
  ]);
  const precos = new Map<string, number[]>();
  for (const h of historico) precos.set(h.insumoId, [...(precos.get(h.insumoId) ?? []), Number(h.preco)]);
  const nome = new Map(pessoas.map((p) => [p.id, p.nome]));

  const podeAprovarAlgo = can(perfil, "compra", "aprovar");
  const podeEmitir = can(perfil, "compra", "editar");
  const mexe = can(perfil, "compra", "criar") || podeEmitir || podeAprovarAlgo;
  const cartoes: CompraCartao[] = solicitacoes
    .sort((a, b) => ORDEM[a.status] - ORDEM[b.status])
    .map((s) => ({
      id: s.id,
      status: s.status,
      urgencia: s.urgencia,
      justificativa: s.justificativa,
      etapaNome: s.etapa?.nome ?? null,
      solicitante: nome.get(s.solicitanteId) ?? "—",
      criadoEm: s.criadoEm.toISOString(),
      valorEstimado: Number(s.valorEstimado),
      motivoReprovacao: s.motivoReprovacao,
      itens: s.itens.map((i) => {
        const preco = i.precoUnitEstimado == null ? null : Number(i.precoUnitEstimado);
        const d = preco == null ? null : desvioDePreco(preco, precos.get(i.insumo.id) ?? [], limiteDesvio);
        return {
          nome: i.insumo.nome, unidade: i.insumo.unidade, quantidade: Number(i.quantidade), preco,
          alertaPreco: d?.alerta ? `${d.desvioPct!.toFixed(0)}% acima da média (${brl(d.media!)})` : null,
        };
      }),
      ordem: s.ordem && {
        numero: s.ordem.numero, fornecedor: s.ordem.fornecedor.nome, valorTotal: Number(s.ordem.valorTotal),
        prazoPagamentoDias: s.ordem.prazoPagamentoDias, paga: !!s.ordem.despesa?.pagamento,
      },
      anexos: s.anexos.map((a) => ({
        id: a.id, categoria: a.categoria as CategoriaAnexo, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho,
        podeRemover: s.status !== "ENTREGUE" && (a.enviadoPorId === user.id || podeEmitir || podeAprovarAlgo),
      })),
      podeAnexar: mexe && aceitaAnexo(s.status),
      pagamento: { meio: s.meioPagamento as MeioPagamento | null, pix: s.pagamentoPix, linhaDigitavel: s.pagamentoLinhaDigitavel },
      podeMudarPagamento: mexe && !["ENTREGUE", "REPROVADA", "CANCELADA"].includes(s.status),
      podeAprovar: statusAoAprovar(perfil, s.status, Number(s.valorEstimado), limite) != null,
      acimaDoLimite: Number(s.valorEstimado) > limite,
      podeCancelar: (s.solicitanteId === user.id && s.status === "AGUARDANDO_ADMIN_OBRA") || (podeAprovarAlgo && ["AGUARDANDO_ADMIN_OBRA", "AGUARDANDO_SUPER_ADMIN", "APROVADA", "PO_EMITIDA", "ENVIADA_FORNECEDOR"].includes(s.status)),
    }));

  const aguardando = solicitacoes.filter((s) => s.status.startsWith("AGUARDANDO")).length;
  const caminho = solicitacoes.filter((s) => ["APROVADA", "PO_EMITIDA", "ENVIADA_FORNECEDOR"].includes(s.status)).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> {obra.nome}</Link>
        <h1 className={TITULO}>Compras</h1>
        <p className="text-muted">{aguardando} aguardando aprovação · {caminho} em andamento · compras acima de {brl(limite)} precisam do dono.</p>
      </header>

      {can(perfil, "compra", "criar") && <NovaSolicitacao obraId={params.id} etapas={etapas} />}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Solicitações</h2>
        {cartoes.length === 0
          ? <Card className="p-5 text-sm text-muted">Nenhuma compra solicitada nesta obra ainda.</Card>
          : <ListaCompras obraId={params.id} compras={cartoes} fornecedores={podeEmitir ? fornecedores : []}
              podeEmitir={podeEmitir} podeCriarFornecedor={can(perfil, "fornecedor", "criar")} podeReceber={podeEmitir || can(perfil, "compra", "criar")} />}
      </section>
    </div>
  );
}
