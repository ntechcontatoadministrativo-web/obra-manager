import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HardHat, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listarObrasComIndicadores, STATUS_OBRA } from "@/lib/obras";
import { can } from "@/lib/auth/permissions";
import { brl, dataBR } from "@/lib/utils";
import { Badge, Card, Progresso, TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Obras" };

export default async function ObrasPage() {
  const user = await requireUser();
  const obras = await listarObrasComIndicadores(user);
  const podeCriar = can(user.role, "obra", "criar");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className={TITULO}>Obras</h1>
        {podeCriar && (
          <Link href="/obras/nova" className="inline-flex min-h-11 items-center gap-2 rounded bg-laranja px-4 text-sm font-semibold text-laranja-fg shadow-1 transition hover:shadow-2 hover:brightness-110 active:scale-[0.98]">
            <Plus size={18} aria-hidden /> Nova obra
          </Link>
        )}
      </header>

      {obras.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-laranja/10 text-laranja" aria-hidden><HardHat size={24} /></span>
          <p className="font-medium">{podeCriar ? "Você ainda não cadastrou nenhuma obra." : "Nenhuma obra foi liberada para você."}</p>
          <p className="mt-1 text-sm text-muted">{podeCriar ? "Cadastre a primeira para começar a registrar ponto, diário e compras." : "Peça ao dono da empresa para vincular você a uma obra."}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {obras.map((o) => (
            <li key={o.id}>
              <Link href={`/obras/${o.id}`} className="group block">
                <Card className="grid gap-4 border-l-4 border-l-transparent p-5 group-hover:border-laranja/60 group-hover:border-l-laranja group-hover:shadow-2 md:grid-cols-[1.4fr_1fr_auto_auto] md:items-center">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{o.nome}</h2>
                    <p className="text-sm text-muted">{o.clienteNome} · {o.endereco}</p>
                    <p className="mt-1 text-xs text-muted">{dataBR(o.dataInicio)} a {dataBR(o.previsaoTermino)}{can(o.perfil, "financeiro", "ver") && ` · ${brl(o.valorContrato)}`}</p>
                  </div>
                  <Progresso valor={o.fisico} rotulo="Avanço físico" />
                  <Badge tom={STATUS_OBRA[o.status].tom} className="justify-self-start md:justify-self-end">{STATUS_OBRA[o.status].rotulo}</Badge>
                  <ChevronRight size={20} className="hidden text-muted transition group-hover:translate-x-0.5 group-hover:text-laranja md:block" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
