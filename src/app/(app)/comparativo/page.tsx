import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { carregarEvm, carregarRede } from "@/lib/analise";
import { atrasoContraBaseline } from "@/lib/cronograma";
import { exposicaoDaObra } from "@/lib/risco";
import { mediaDaEmpresa, padroes, ranquear, type ObraComparada } from "@/lib/comparativo";
import { Badge, Card, TITULO } from "@/components/ui";
import { Seletor } from "./seletor";
import { Tabela } from "./tabela";

export const metadata: Metadata = { title: "Comparativo de obras" };

const MAX = 5;

export default async function ComparativoPage({ searchParams }: { searchParams: { obras?: string } }) {
  const user = await requireUser();
  if (!can(user.role, "analise", "ver")) notFound();

  // Só obras da empresa e, fora o Super Admin, só aquelas de que o
  // usuário é membro — a lista não pode virar um índice de tudo.
  const todas = await prisma.obra.findMany({
    where: {
      empresaId: user.empresaId,
      ...(user.role === "SUPER_ADMIN" ? {} : { membros: { some: { userId: user.id } } }),
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, status: true, previsaoTermino: true, valorContrato: true },
  });

  const pedidas = (searchParams.obras ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const permitidas = new Set(todas.map((o) => o.id));
  const escolhidas = pedidas.filter((id) => permitidas.has(id)).slice(0, MAX);

  // Sem escolha explícita, abre com as obras em andamento.
  const alvos = escolhidas.length
    ? todas.filter((o) => escolhidas.includes(o.id))
    : todas.filter((o) => o.status === "EM_ANDAMENTO").slice(0, 3);

  const comparadas: ObraComparada[] = await Promise.all(
    alvos.map(async (o): Promise<ObraComparada> => {
      // Confirma o acesso obra a obra: a lista acima já filtra, mas a
      // checagem aqui é o que vale se a consulta mudar depois.
      const perfil = await perfilNaObra(prisma, user, o.id);
      const vazia: ObraComparada = {
        id: o.id, nome: o.nome, status: o.status,
        cpi: null, spi: null, desvioPrazoDias: null, vac: null,
        orcamento: Number(o.valorContrato), avancoFisicoPct: 0, exposicaoRisco: 0,
      };
      if (!perfil) return vazia;

      const [evm, rede, riscos] = await Promise.all([
        carregarEvm(prisma, o.id),
        carregarRede(prisma, o.id),
        prisma.risco.findMany({
          where: { obraId: o.id },
          select: { probabilidade: true, impacto: true, situacao: true },
        }),
      ]);

      return {
        ...vazia,
        cpi: evm.indicadores.cpi,
        spi: evm.indicadores.spi,
        vac: evm.indicadores.vac,
        avancoFisicoPct: evm.indicadores.avancoFisicoPct,
        desvioPrazoDias: atrasoContraBaseline(rede.terminoProjeto, o.previsaoTermino),
        exposicaoRisco: exposicaoDaObra(riscos),
      };
    }),
  );

  const linhas = ranquear(comparadas);

  // A média usa todas as obras às quais o usuário tem acesso, não só as
  // comparadas — senão a "referência da empresa" muda a cada seleção.
  const universo: ObraComparada[] = await Promise.all(
    todas.map(async (o): Promise<ObraComparada> => {
      const jaTem = comparadas.find((c) => c.id === o.id);
      if (jaTem) return jaTem;
      const evm = await carregarEvm(prisma, o.id);
      return {
        id: o.id, nome: o.nome, status: o.status,
        cpi: evm.indicadores.cpi, spi: evm.indicadores.spi, vac: evm.indicadores.vac,
        desvioPrazoDias: null, orcamento: Number(o.valorContrato),
        avancoFisicoPct: evm.indicadores.avancoFisicoPct, exposicaoRisco: 0,
      };
    }),
  );
  const media = mediaDaEmpresa(universo);
  const achados = padroes(universo);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className={TITULO}>Comparativo de obras</h1>
        <p className="text-muted">
          Até {MAX} obras lado a lado, com a média das {media.base} obras a que você
          tem acesso como referência.
        </p>
      </header>

      <Seletor obras={todas.map((o) => ({ id: o.id, nome: o.nome }))} selecionadas={alvos.map((o) => o.id)} max={MAX} />

      {linhas.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">Escolha ao menos uma obra para comparar.</p>
        </Card>
      ) : (
        <>
          <Tabela linhas={linhas} media={media} />

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-display text-lg font-semibold">Ranking</h2>
              <ol className="mt-3 space-y-2">
                {linhas.map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center font-display text-lg font-semibold tabular-nums text-muted">
                      {l.posicao}
                    </span>
                    <Link href={`/obras/${l.id}/analise`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-laranja hover:underline">
                      {l.nome}
                    </Link>
                    <Badge tom={l.indice >= 7 ? "ok" : l.indice >= 5 ? "alerta" : "perigo"}>
                      {l.indice.toFixed(1).replace(".", ",")}
                    </Badge>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">
                Índice de 0 a 10: custo 30%, prazo 30%, risco 20%, avanço 20%.
              </p>
            </Card>

            <Card className="p-4">
              <h2 className="font-display text-lg font-semibold">Padrões</h2>
              {achados.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {achados.map((a) => <li key={a}>• {a}</li>)}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Ainda não há obras concluídas em número suficiente para apontar
                  padrão. Abaixo de seis obras com indicador, qualquer diferença
                  é ruído.
                </p>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
