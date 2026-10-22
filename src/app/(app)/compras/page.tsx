import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { acessaTodasAsObras, can, type Role } from "@/lib/auth/permissions";
import { ROTULO_COMPRA, type CompraStatus } from "@/lib/compras";
import { brl } from "@/lib/utils";
import { Badge, Card, TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Compras" };

/** O que cada grupo pede, na ordem em que o setor de compras trabalha. */
const GRUPOS: { titulo: string; dica: string; status: CompraStatus[] }[] = [
  { titulo: "Esperando ordem de compra", dica: "Aprovadas: falta escolher o fornecedor e emitir a ordem.", status: ["APROVADA"] },
  { titulo: "A caminho", dica: "Ordem emitida ou já com o fornecedor: falta registrar a entrega.", status: ["PO_EMITIDA", "ENVIADA_FORNECEDOR"] },
  { titulo: "Aguardando aprovação", dica: "Com o engenheiro ou, acima do limite, com o dono.", status: ["AGUARDANDO_ADMIN_OBRA", "AGUARDANDO_SUPER_ADMIN"] },
];

export default async function ComprasGeral() {
  const user = await requireUser();
  if (!can(user.role, "compra", "ver")) notFound();

  const obras = acessaTodasAsObras(user.role)
    ? (await prisma.obra.findMany({ where: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }))
    : (await prisma.obraMembro.findMany({ where: { userId: user.id, obra: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } } }, select: { role: true, obra: { select: { id: true, nome: true } } } }))
        .filter((m) => can(m.role as Role, "compra", "ver")).map((m) => m.obra);

  const compras = await prisma.solicitacaoCompra.findMany({
    where: { obraId: { in: obras.map((o) => o.id) }, status: { in: GRUPOS.flatMap((g) => g.status) } },
    orderBy: [{ urgencia: "asc" }, { criadoEm: "asc" }],
    select: {
      id: true, obraId: true, status: true, urgencia: true, justificativa: true, valorEstimado: true, criadoEm: true,
      obra: { select: { nome: true } },
      ordem: { select: { numero: true, fornecedor: { select: { nome: true } } } },
      _count: { select: { itens: true } },
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className={TITULO}>Compras</h1>
        <p className="text-muted">
          Pedidos em aberto de {obras.length === 1 ? "1 obra" : `${obras.length} obras`}. Para fazer um pedido novo, entre em Compras dentro da obra.
        </p>
      </header>

      {obras.length > 0 && (
        <nav aria-label="Compras por obra" className="flex flex-wrap gap-2">
          {obras.map((o) => (
            <Link key={o.id} href={`/obras/${o.id}/compras`} className="min-h-11 rounded border border-line bg-card px-3 py-2.5 text-sm font-medium hover:border-laranja">{o.nome}</Link>
          ))}
        </nav>
      )}

      {GRUPOS.map((g) => {
        const lista = compras.filter((c) => g.status.includes(c.status));
        return (
          <section key={g.titulo}>
            <h2 className="font-display text-xl font-semibold">{g.titulo} <span className="text-muted">({lista.length})</span></h2>
            <p className="mb-3 text-sm text-muted">{g.dica}</p>
            {lista.length === 0 ? <Card className="p-4 text-sm text-muted">Nada aqui.</Card> : (
              <Card className="divide-y divide-line">
                {lista.map((c) => (
                  <Link key={c.id} href={`/obras/${c.obraId}/compras`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.justificativa}</p>
                      <p className="text-xs text-muted">
                        {c.obra.nome} · {c._count.itens} {c._count.itens === 1 ? "item" : "itens"}
                        {c.ordem && ` · ${c.ordem.numero} · ${c.ordem.fornecedor.nome}`}
                      </p>
                    </div>
                    {c.urgencia === "URGENTE" && <Badge tom="perigo">Urgente</Badge>}
                    <span className="tabular-nums">{brl(Number(c.valorEstimado))}</span>
                    <Badge tom={ROTULO_COMPRA[c.status].tom}>{ROTULO_COMPRA[c.status].rotulo}</Badge>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
