import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Building2, HardHat, Wallet, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listarObrasComIndicadores, STATUS_OBRA } from "@/lib/obras";
import { can } from "@/lib/auth/permissions";
import { brl, dataBR } from "@/lib/utils";
import { Badge, Card, Progresso, TITULO } from "@/components/ui";

export const metadata: Metadata = { title: "Painel" };

const TOM_SEMAFORO = { verde: "ok", amarelo: "alerta", vermelho: "perigo" } as const;
const TXT_SEMAFORO = { verde: "No prazo", amarelo: "Atenção ao prazo", vermelho: "Atrasada" } as const;

export default async function Dashboard() {
  const user = await requireUser();
  const obras = await listarObrasComIndicadores(user);
  const ativas = obras.filter((o) => o.status === "EM_ANDAMENTO");
  const atrasadas = ativas.filter((o) => o.semaforo === "vermelho");
  const veFinanceiro = can(user.role, "financeiro", "ver");
  const totalContratos = obras.reduce((s, o) => s + o.valorContrato, 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-laranja">{hoje()}</p>
        <h1 className={TITULO}>Olá, {user.name?.split(" ")[0]}</h1>
        <p className="text-muted">{obras.length === 0 ? "Nenhuma obra liberada para você ainda." : "Situação das suas obras hoje."}</p>
      </header>

      {obras.length > 0 && (
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Resumo icone={HardHat} valor={String(ativas.length)} rotulo="Obras em andamento" />
          <Resumo icone={AlertTriangle} valor={String(atrasadas.length)} rotulo="Obras atrasadas" destaque={atrasadas.length > 0} />
          <Resumo icone={Building2} valor={String(obras.length)} rotulo="Obras no total" />
          {veFinanceiro && <Resumo icone={Wallet} valor={brl(totalContratos)} rotulo="Valor dos contratos" />}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {obras.map((o) => (
          <Link key={o.id} href={`/obras/${o.id}`} className="group block">
            <Card className="relative h-full space-y-4 overflow-hidden p-5 group-hover:-translate-y-0.5 group-hover:border-laranja/60 group-hover:shadow-2">
              <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-laranja transition-transform duration-300 group-hover:scale-x-100" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-1.5 font-display text-xl font-semibold">
                    {o.nome}
                    <ArrowUpRight size={18} className="text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:text-laranja group-hover:opacity-100" aria-hidden />
                  </h2>
                  <p className="text-sm text-muted">{o.endereco}</p>
                </div>
                <Badge tom={STATUS_OBRA[o.status].tom}>{STATUS_OBRA[o.status].rotulo}</Badge>
              </div>
              <Progresso valor={o.fisico} rotulo="Avanço físico" />
              {can(o.perfil, "financeiro", "ver") && <Progresso valor={o.financeiro} rotulo="Custo sobre o orçamento" tom={o.financeiro > 100 ? "perigo" : "laranja"} />}
              <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                <Badge tom={TOM_SEMAFORO[o.semaforo]}>{TXT_SEMAFORO[o.semaforo]}</Badge>
                <span className="text-muted">Término previsto: {dataBR(o.previsaoTermino)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}

function hoje() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
}

function Resumo({ icone: Icone, valor, rotulo, destaque }: { icone: LucideIcon; valor: string; rotulo: string; destaque?: boolean }) {
  return (
    <Card className={`p-4 ${destaque ? "border-perigo/40 bg-perigo/[0.04]" : ""}`}>
      <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${destaque ? "bg-perigo/10 text-perigo" : "bg-laranja/10 text-laranja"}`}>
        <Icone size={18} aria-hidden />
      </span>
      <p className={`truncate font-display text-2xl font-semibold tabular-nums ${destaque ? "text-perigo" : ""}`}>{valor}</p>
      <p className="text-sm text-muted">{rotulo}</p>
    </Card>
  );
}
