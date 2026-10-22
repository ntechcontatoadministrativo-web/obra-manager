import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/auth/permissions";
import { TITULO } from "@/components/ui";
import { Fornecedores } from "./fornecedores";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const user = await requireUser();
  if (!can(user.role, "fornecedor", "ver")) notFound();

  const lista = await prisma.fornecedor.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, cnpj: true, contato: true, telefone: true, email: true, pixChave: true, prazoEntregaDias: true,
      _count: { select: { ordens: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className={TITULO}>Fornecedores</h1>
        <p className="text-muted">A chave PIX cadastrada aqui vai sozinha para cada conta a pagar das compras.</p>
      </header>
      <Fornecedores
        podeCriar={can(user.role, "fornecedor", "criar")}
        podeEditar={can(user.role, "fornecedor", "editar")}
        fornecedores={lista.map(({ _count, ...f }) => ({ ...f, ordens: _count.ordens }))}
      />
    </div>
  );
}
