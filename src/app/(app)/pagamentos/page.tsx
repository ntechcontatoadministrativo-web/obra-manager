import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/auth/permissions";
import { contasEmAberto, obrasComFinanceiro, resumoPorObra } from "@/lib/pagamentos";
import { dataLocalISO, dataParaBanco } from "@/lib/ponto";
import { somarDias } from "@/lib/diario";
import { brl, dataBR } from "@/lib/utils";
import { Card, TITULO } from "@/components/ui";
import { ListaContas, NovaConta, PagasRecentes } from "./contas";

export const metadata: Metadata = { title: "Pagamentos" };

export default async function PagamentosPage({ searchParams }: { searchParams: { obra?: string } }) {
  const user = await requireUser();
  const obras = await obrasComFinanceiro(prisma, user);

  if (obras.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className={TITULO}>Pagamentos</h1>
        <Card className="p-5 text-muted">O seu perfil não tem acesso ao financeiro de nenhuma obra.</Card>
      </div>
    );
  }

  const hoje = dataLocalISO();
  const ids = obras.map((o) => o.id);
  const filtro = obras.find((o) => o.id === searchParams.obra) ?? null;
  const inicioMes = `${hoje.slice(0, 8)}01`;

  const [abertas, pagasMes, recentes] = await Promise.all([
    contasEmAberto(prisma, ids),
    prisma.despesa.aggregate({ where: { obraId: { in: ids }, pagamento: { gte: dataParaBanco(inicioMes) } }, _sum: { valor: true } }),
    prisma.despesa.findMany({
      where: { obraId: { in: filtro ? [filtro.id] : ids }, pagamento: { not: null } },
      orderBy: [{ pagamento: "desc" }, { criadoEm: "desc" }], take: 10,
      select: { id: true, descricao: true, favorecido: true, valor: true, pagamento: true, obraId: true, obra: { select: { nome: true } } },
    }),
  ]);

  const porObra = resumoPorObra(abertas, hoje);
  const total = abertas.reduce((s, c) => s + c.valor, 0);
  const vencido = abertas.filter((c) => c.vencimento && c.vencimento < hoje).reduce((s, c) => s + c.valor, 0);
  const semana = abertas.filter((c) => c.vencimento && c.vencimento >= hoje && c.vencimento <= somarDias(hoje, 7)).reduce((s, c) => s + c.valor, 0);
  const lista = filtro ? abertas.filter((c) => c.obraId === filtro.id) : abertas;
  const perfilDe = new Map(obras.map((o) => [o.id, o.perfil]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={TITULO}>Pagamentos</h1>
          <p className="text-muted">
            {abertas.length === 0 ? "Nenhuma conta em aberto." : `${abertas.length} conta${abertas.length === 1 ? "" : "s"} em aberto em ${porObra.size} obra${porObra.size === 1 ? "" : "s"}.`}
          </p>
        </div>
        <NovaConta obras={obras.filter((o) => can(o.perfil, "financeiro", "criar")).map((o) => ({ id: o.id, nome: o.nome }))} obraInicial={filtro?.id ?? null} />
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumo rotulo="Total a pagar" valor={brl(total)} />
        <Resumo rotulo="Vencido" valor={brl(vencido)} destaque={vencido > 0} />
        <Resumo rotulo="Vence em 7 dias" valor={brl(semana)} />
        <Resumo rotulo="Pago este mês" valor={brl(Number(pagasMes._sum.valor ?? 0))} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Por obra</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Quanto falta pagar em cada obra</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-2.5 font-medium">Obra</th>
                <th className="px-4 py-2.5 text-right font-medium">Em aberto</th>
                <th className="px-4 py-2.5 text-right font-medium">Vencido</th>
                <th className="px-4 py-2.5 font-medium">Próximo vencimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Contas</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((o) => {
                const r = porObra.get(o.id);
                const ativo = filtro?.id === o.id;
                return (
                  <tr key={o.id} className={`border-b border-line/60 last:border-0 ${ativo ? "bg-laranja/5" : ""}`}>
                    <td className="px-4 py-2.5">
                      <Link href={ativo ? "/pagamentos" : `/pagamentos?obra=${o.id}`} className="font-medium hover:text-laranja hover:underline" aria-current={ativo ? "true" : undefined}>{o.nome}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{brl(r?.aPagar ?? 0)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${r?.vencido ? "font-semibold text-perigo" : "text-muted"}`}>{brl(r?.vencido ?? 0)}</td>
                    <td className="px-4 py-2.5">{r?.proximo ? dataBR(r.proximo) : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r?.quantidade ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{brl(total)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-perigo">{brl(vencido)}</td>
                <td />
                <td className="px-4 py-2.5 text-right tabular-nums">{abertas.length}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Contas em aberto{filtro && <span className="text-muted"> · {filtro.nome}</span>}</h2>
          {filtro && <Link href="/pagamentos" className="text-sm font-medium text-laranja hover:underline">Ver todas as obras</Link>}
        </div>
        <ListaContas
          hoje={hoje}
          contas={lista.map((c) => ({
            ...c,
            podePagar: can(perfilDe.get(c.obraId)!, "financeiro", "editar"),
            podeExcluir: can(perfilDe.get(c.obraId)!, "financeiro", "excluir") && !c.ordemNumero,
          }))}
        />
      </section>

      {recentes.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Pagas recentemente</h2>
          <PagasRecentes contas={recentes.map((r) => ({
            id: r.id, descricao: r.descricao, favorecido: r.favorecido ?? "", valor: Number(r.valor),
            pagamento: r.pagamento!.toISOString().slice(0, 10), obraNome: r.obra.nome,
            podeDesfazer: can(perfilDe.get(r.obraId)!, "financeiro", "editar"),
          }))} />
        </section>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <Card className={`p-4 ${destaque ? "border-perigo/40 bg-perigo/5" : ""}`}>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className={`font-display text-xl font-semibold tabular-nums md:text-2xl ${destaque ? "text-perigo" : ""}`}>{valor}</p>
    </Card>
  );
}
