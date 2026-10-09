import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge, Card, TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Perfil" };

export default async function Perfil() {
  const sessao = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessao.id }, select: { nome: true, email: true, totpAtivo: true } });
  return (
    <div className="max-w-xl space-y-6">
      <h1 className={TITULO}>Perfil</h1>
      <Card className="space-y-2 p-5">
        <p className="text-lg font-medium">{user?.nome}</p>
        <p className="text-sm text-muted">{user?.email}</p>
      </Card>
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Verificação em duas etapas</h2>
          <Badge tom={user?.totpAtivo ? "ok" : "alerta"}>{user?.totpAtivo ? "Ativada" : "Desativada"}</Badge>
        </div>
        <p className="text-sm text-muted">Além da senha, o login pede um código de 6 dígitos gerado no seu celular. Protege a conta se a senha vazar.</p>
        {!user?.totpAtivo && <Link href="/perfil/2fa" className="inline-flex min-h-11 items-center rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg">Ativar agora</Link>}
      </Card>
    </div>
  );
}
