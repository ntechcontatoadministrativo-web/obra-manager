import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can, ForbiddenError } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";
import { acoesPermitidas, dataISOValida, dataLocalISO, dataParaBanco, horaLocal } from "@/lib/ponto";
import { horasExtras, horasTrabalhadas } from "@/lib/jornada";
import { dataBR } from "@/lib/utils";
import { Badge, Card, TITULO } from "@/components/ui";
import { Registrar } from "./registrar";
import { LocalObra, NovoFuncionario } from "./admin-forms";

export const metadata: Metadata = { title: "Ponto" };

const AUSENCIA: Record<string, string> = {
  FALTA: "Falta", FALTA_JUSTIFICADA: "Falta justificada", AFASTAMENTO: "Afastamento", ATESTADO: "Atestado", FOLGA: "Folga",
};
const horas = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export default async function PontoPage({ params, searchParams }: { params: { id: string }; searchParams: { data?: string } }) {
  const user = await requireUser();
  const perfil = await perfilNaObra(prisma, user, params.id).catch((e) => { if (e instanceof ForbiddenError) return null; throw e; });
  if (!perfil || !can(perfil, "ponto", "ver")) notFound();

  const hoje = dataLocalISO();
  const dia = searchParams.data && dataISOValida(searchParams.data) ? searchParams.data : hoje;
  const ehHoje = dia === hoje;

  const [obra, cfg, funcionarios, registros] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, latitude: true } }),
    prisma.configuracao.findFirst({ where: { empresa: { obras: { some: { id: params.id } } } }, select: { jornadaHorasDia: true } }),
    prisma.funcionario.findMany({ where: { obraId: params.id, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, funcao: true } }),
    prisma.registroPonto.findMany({ where: { obraId: params.id, data: dataParaBanco(dia) } }),
  ]);
  if (!obra) notFound();

  const jornada = Number(cfg?.jornadaHorasDia ?? 8);
  const porFunc = new Map<string, (typeof registros)[number]>(registros.map((r) => [r.funcionarioId, r]));
  const podeBater = can(perfil, "ponto", "criar");
  const podeCadastrar = can(perfil, "funcionario", "criar");
  const podeLocal = can(perfil, "obra", "editar");

  // Próximas batidas de cada um (só faz sentido para o dia de hoje).
  const paraRegistrar = funcionarios.map((f) => ({ ...f, acoes: acoesPermitidas(porFunc.get(f.id) ?? null) }));
  const presentes = registros.filter((r) => r.entradaEm).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/obras/${params.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} aria-hidden /> {obra.nome}</Link>
        <h1 className={TITULO}>Controle de ponto</h1>
        <p className="text-muted">{ehHoje ? "Hoje" : dataBR(dataParaBanco(dia))} · {presentes} de {funcionarios.length} funcionários com entrada registrada</p>
      </header>

      {podeBater && ehHoje && <Registrar obraId={params.id} funcionarios={paraRegistrar} />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Registros do dia</h2>
          <form className="flex items-end gap-2" method="get">
            <label className="space-y-1 text-sm"><span className="block text-muted">Ver outro dia</span>
              <input type="date" name="data" defaultValue={dia} max={hoje} className="min-h-11 rounded border border-line bg-card px-3 text-ink" />
            </label>
            <button className="min-h-11 rounded border border-line bg-card px-4 text-sm font-semibold hover:bg-bg">Ver</button>
          </form>
        </div>

        {funcionarios.length === 0 ? (
          <Card className="p-5 text-sm text-muted">Nenhum funcionário cadastrado nesta obra.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {funcionarios.map((f) => {
              const r = porFunc.get(f.id);
              const h = r ? horasTrabalhadas({ entradaEm: r.entradaEm, saidaEm: r.saidaEm, almocoSaidaEm: r.almocoSaidaEm, almocoVoltaEm: r.almocoVoltaEm }) : 0;
              const ex = r ? horasExtras({ entradaEm: r.entradaEm, saidaEm: r.saidaEm, almocoSaidaEm: r.almocoSaidaEm, almocoVoltaEm: r.almocoVoltaEm }, jornada) : 0;
              return (
                <div key={f.id} className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                  <div><p className="font-medium">{f.nome}</p><p className="text-sm text-muted">{f.funcao}</p></div>
                  {!r ? <p className="text-sm text-muted md:col-span-2">Sem registro</p>
                    : r.tipo !== "TRABALHADO" ? <div className="md:col-span-2"><Badge tom="alerta">{AUSENCIA[r.tipo]}</Badge></div>
                    : (<>
                        <Batida titulo="Entrada" hora={r.entradaEm} foto={r.entradaFotoUrl} noRaio={r.entradaNoRaio} />
                        <Batida titulo="Saída" hora={r.saidaEm} foto={r.saidaFotoUrl} noRaio={r.saidaNoRaio} />
                      </>)}
                  <div className="text-sm md:text-right">
                    {r && r.tipo === "TRABALHADO" && r.saidaEm ? (<><p className="font-display text-lg font-semibold tabular-nums">{horas(h)}</p>{ex > 0 && <p className="text-xs text-alerta">{horas(ex)} extras</p>}</>)
                      : r?.almocoSaidaEm && !r.almocoVoltaEm ? <Badge tom="info">No almoço</Badge>
                      : r?.entradaEm && !r.saidaEm ? <Badge tom="info">Trabalhando</Badge> : null}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {podeCadastrar && (
        <details className="rounded-md border border-line bg-card p-5">
          <summary className="min-h-11 cursor-pointer font-display text-lg font-semibold">Cadastrar funcionário</summary>
          <div className="mt-4"><NovoFuncionario obraId={params.id} /></div>
        </details>
      )}
      {podeLocal && (
        <details className="rounded-md border border-line bg-card p-5" open={obra.latitude == null}>
          <summary className="min-h-11 cursor-pointer font-display text-lg font-semibold">Localização da obra (GPS)</summary>
          <div className="mt-4"><LocalObra obraId={params.id} temLocal={obra.latitude != null} /></div>
        </details>
      )}
    </div>
  );
}

function Batida({ titulo, hora, foto, noRaio }: { titulo: string; hora: Date | null; foto: string | null; noRaio: boolean | null }) {
  if (!hora) return <div className="text-sm text-muted">{titulo}: —</div>;
  return (
    <div className="flex items-center gap-3">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt={`Foto da ${titulo.toLowerCase()}`} width={48} height={48} className="h-12 w-12 rounded border border-line object-cover" />
      ) : <div className="h-12 w-12 rounded border border-dashed border-line" aria-hidden />}
      <div className="text-sm">
        <p className="text-muted">{titulo}</p>
        <p className="font-semibold tabular-nums">{horaLocal(hora)}</p>
        {noRaio === false && <Badge tom="perigo">Fora do raio</Badge>}
      </div>
    </div>
  );
}
