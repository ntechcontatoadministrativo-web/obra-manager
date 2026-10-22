"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { acessaTodasAsObras, can, type Role } from "@/lib/auth/permissions";
import { registrarAuditoria } from "@/lib/audit";
import { contasEmAberto, obrasComFinanceiro } from "@/lib/pagamentos";
import { statusAoAprovar } from "@/lib/compras";
import { AJUDA, interpretar, melhorCorrespondencia, reaisFalado, type Destino } from "@/lib/voz";
import { dataLocalISO } from "@/lib/ponto";
import { brl, dataBR } from "@/lib/utils";

export type Cartao = { id: string; titulo: string; detalhe: string; valor?: string; href?: string };
export type RespostaVoz = {
  /** O que a tela mostra e o navegador lê em voz alta. */
  fala: string;
  cartoes?: Cartao[];
  /** Ids na ordem falada: "pix do segundo" usa esta lista. */
  lista?: string[];
  navegar?: string;
  copiar?: { texto: string; rotulo: string };
};

type U = Awaited<ReturnType<typeof requireUser>>;

async function obrasDoUsuario(user: U) {
  if (acessaTodasAsObras(user.role)) {
    const o = await prisma.obra.findMany({ where: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } }, select: { id: true, nome: true } });
    return o.map((x) => ({ ...x, perfil: user.role as Role }));
  }
  const m = await prisma.obraMembro.findMany({ where: { userId: user.id, obra: { empresaId: user.empresaId, status: { not: "ARQUIVADA" } } }, select: { role: true, obra: { select: { id: true, nome: true } } } });
  return m.map((x) => ({ ...x.obra, perfil: x.role as Role }));
}

function quando(venc: string | null, hoje: string): string {
  if (!venc) return "sem vencimento";
  const dias = Math.round((Date.parse(`${venc}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias === -1) return "venceu ontem";
  if (dias < 0) return `venceu há ${-dias} dias`;
  return `vence dia ${dataBR(venc).slice(0, 5)}`;
}

const MODULO: Partial<Record<Destino, { caminho: string; recurso: Parameters<typeof can>[1]; nome: string }>> = {
  obra: { caminho: "", recurso: "obra", nome: "a obra" },
  ponto: { caminho: "/ponto", recurso: "ponto", nome: "o ponto" },
  diario: { caminho: "/diario", recurso: "diario", nome: "o diário" },
  etapas: { caminho: "/etapas", recurso: "etapa", nome: "as etapas" },
  medicoes: { caminho: "/medicoes", recurso: "medicao", nome: "as medições" },
  analise: { caminho: "/analise", recurso: "analise", nome: "a análise" },
  riscos: { caminho: "/riscos", recurso: "risco", nome: "os riscos" },
  compras: { caminho: "/compras", recurso: "compra", nome: "as compras" },
};

export async function comandoDeVoz(entrada: unknown): Promise<RespostaVoz> {
  const user = await requireUser();
  const p = z.object({ texto: z.string().max(300), lista: z.array(z.string().max(40)).max(20).optional() }).safeParse(entrada);
  if (!p.success || !p.data.texto.trim()) return { fala: "Não ouvi nada. Tente de novo." };

  const cmd = interpretar(p.data.texto);
  const hoje = dataLocalISO();

  switch (cmd.tipo) {
    case "ajuda":
      return { fala: "Você pode dizer: o que falta pagar; pix do primeiro; compras para aprovar; ou abrir diário da obra tal.", cartoes: AJUDA.map((a, i) => ({ id: String(i), titulo: a, detalhe: "" })) };

    case "a_pagar": {
      let obras = await obrasComFinanceiro(prisma, user);
      if (!obras.length) return { fala: "O seu perfil não tem acesso aos pagamentos." };
      if (cmd.obra) {
        const o = melhorCorrespondencia(cmd.obra, obras);
        if (!o) return { fala: `Não achei a obra ${cmd.obra}.` };
        obras = [o];
      }
      let contas = await contasEmAberto(prisma, obras.map((o) => o.id));
      if (cmd.soVencidas) contas = contas.filter((c) => c.vencimento && c.vencimento < hoje);
      const onde = cmd.obra ? ` na obra ${obras[0].nome}` : "";
      if (!contas.length) return { fala: cmd.soVencidas ? `Nenhuma conta vencida${onde}.` : `Nada para pagar${onde}.`, navegar: undefined };

      const total = contas.reduce((s, c) => s + c.valor, 0);
      const vencidas = contas.filter((c) => c.vencimento && c.vencimento < hoje).length;
      const topo = contas.slice(0, 5);
      const itens = topo.map((c, i) => `${i + 1}: ${c.favorecido || c.descricao}, ${reaisFalado(c.valor)}, ${quando(c.vencimento, hoje)}${obras.length > 1 ? `, obra ${c.obraNome}` : ""}`);
      const fala =
        `${cmd.soVencidas ? "Vencidas" : "Faltam pagar"}${onde}: ${contas.length} conta${contas.length === 1 ? "" : "s"}, total de ${reaisFalado(total)}.` +
        (vencidas && !cmd.soVencidas ? ` ${vencidas} já vencida${vencidas === 1 ? "" : "s"}.` : "") +
        ` ${itens.join(". ")}.` +
        (topo.some((c) => c.pix) ? " Para copiar, diga: pix do primeiro." : "");
      return {
        fala,
        lista: topo.map((c) => c.id),
        cartoes: topo.map((c, i) => ({
          id: c.id, titulo: `${i + 1}. ${c.favorecido || c.descricao}`, valor: brl(c.valor),
          detalhe: `${quando(c.vencimento, hoje)} · ${c.obraNome}${c.pix ? "" : " · sem PIX"}`, href: `/pagamentos?obra=${c.obraId}`,
        })),
      };
    }

    case "pix": {
      const obras = await obrasComFinanceiro(prisma, user);
      if (!obras.length) return { fala: "O seu perfil não tem acesso aos pagamentos." };
      const contas = await contasEmAberto(prisma, obras.map((o) => o.id));
      if (!contas.length) return { fala: "Não há contas em aberto." };

      let conta = null as (typeof contas)[number] | null;
      if (cmd.indice != null) {
        const id = p.data.lista?.[cmd.indice - 1];
        // Sem lista falada antes, "o primeiro" é a próxima a vencer.
        conta = id ? contas.find((c) => c.id === id) ?? null : contas[cmd.indice - 1] ?? null;
        if (!conta) return { fala: `Não achei a conta número ${cmd.indice}. Diga: o que falta pagar.` };
      } else if (cmd.alvo) {
        conta = melhorCorrespondencia(cmd.alvo, contas.map((c) => ({ ...c, nome: `${c.favorecido} ${c.descricao} ${c.obraNome}` })));
        if (!conta) return { fala: `Não achei conta em aberto de ${cmd.alvo}.` };
      } else {
        conta = contas[0];
      }

      const cartao: Cartao = { id: conta.id, titulo: conta.favorecido || conta.descricao, valor: brl(conta.valor), detalhe: `${quando(conta.vencimento, hoje)} · ${conta.obraNome}`, href: `/pagamentos?obra=${conta.obraId}` };
      if (conta.pix) {
        await registrarAuditoria(prisma, { userId: user.id, obraId: conta.obraId, acao: "COPIAR_PIX_VOZ", entidade: "Despesa", entidadeId: conta.id });
        return {
          fala: `PIX de ${reaisFalado(conta.valor)} para ${conta.favorecido || "o favorecido"} copiado. Abra o aplicativo do banco e use Pix copia e cola.`,
          copiar: { texto: conta.pix, rotulo: "Copiar PIX" }, cartoes: [cartao],
        };
      }
      if (conta.linhaDigitavel) {
        return { fala: `Essa conta não tem PIX, mas tem boleto. Copiei a linha digitável de ${reaisFalado(conta.valor)}.`, copiar: { texto: conta.linhaDigitavel, rotulo: "Copiar boleto" }, cartoes: [cartao] };
      }
      return { fala: `A conta de ${conta.favorecido || conta.descricao} não tem PIX nem boleto cadastrado.`, cartoes: [cartao] };
    }

    case "compras_pendentes": {
      const todas = await obrasDoUsuario(user);
      let obras = todas.filter((o) => can(o.perfil, "compra", "aprovar"));
      if (!obras.length) {
        // Comprador não aprova: o que espera por ele é a ordem de compra das já aprovadas.
        const compra = todas.filter((o) => can(o.perfil, "compra", "editar"));
        if (!compra.length) return { fala: "O seu perfil não aprova compras." };
        const aprovadas = await prisma.solicitacaoCompra.findMany({
          where: { obraId: { in: compra.map((o) => o.id) }, status: "APROVADA" },
          orderBy: [{ urgencia: "asc" }, { criadoEm: "asc" }], take: 5,
          select: { id: true, obraId: true, justificativa: true, valorEstimado: true, urgencia: true, obra: { select: { nome: true } } },
        });
        if (!aprovadas.length) return { fala: "Nenhuma compra aprovada esperando ordem de compra." };
        return {
          fala: `${aprovadas.length} compra${aprovadas.length === 1 ? "" : "s"} aprovada${aprovadas.length === 1 ? "" : "s"} esperando ordem de compra. ` +
            aprovadas.map((s, i) => `${i + 1}: ${s.justificativa}, obra ${s.obra.nome}${s.urgencia === "URGENTE" ? ", urgente" : ""}`).join(". ") + ".",
          cartoes: aprovadas.map((s, i) => ({ id: s.id, titulo: `${i + 1}. ${s.justificativa}`, valor: brl(Number(s.valorEstimado)), detalhe: s.obra.nome, href: `/obras/${s.obraId}/compras` })),
        };
      }
      if (cmd.obra) {
        const o = melhorCorrespondencia(cmd.obra, obras);
        if (!o) return { fala: `Não achei a obra ${cmd.obra}.` };
        obras = [o];
      }
      const cfg = await prisma.configuracao.findUnique({ where: { empresaId: user.empresaId }, select: { limiteAprovacaoCompra: true } });
      const limite = Number(cfg?.limiteAprovacaoCompra ?? 5000);
      const perfilDe = new Map(obras.map((o) => [o.id, o]));
      const sol = await prisma.solicitacaoCompra.findMany({
        where: { obraId: { in: obras.map((o) => o.id) }, status: { in: ["AGUARDANDO_ADMIN_OBRA", "AGUARDANDO_SUPER_ADMIN"] } },
        orderBy: [{ urgencia: "asc" }, { criadoEm: "asc" }],
        select: { id: true, obraId: true, status: true, valorEstimado: true, justificativa: true, urgencia: true },
      });
      const minhas = sol.filter((s) => statusAoAprovar(perfilDe.get(s.obraId)!.perfil, s.status, Number(s.valorEstimado), limite) != null);
      if (!minhas.length) return { fala: "Nenhuma compra esperando a sua aprovação." };
      const topo = minhas.slice(0, 5);
      return {
        fala: `${minhas.length} compra${minhas.length === 1 ? "" : "s"} esperando você. ` +
          topo.map((s, i) => `${i + 1}: ${s.justificativa}, ${reaisFalado(Number(s.valorEstimado))}${s.urgencia === "URGENTE" ? ", urgente" : ""}`).join(". ") + ".",
        cartoes: topo.map((s, i) => ({ id: s.id, titulo: `${i + 1}. ${s.justificativa}`, valor: brl(Number(s.valorEstimado)), detalhe: perfilDe.get(s.obraId)!.nome, href: `/obras/${s.obraId}/compras` })),
      };
    }

    case "navegar": {
      if (cmd.destino === "compras" && !cmd.obra) return { fala: "Abrindo as compras.", navegar: "/compras" };
      const globais: Partial<Record<Destino, [string, string]>> = {
        painel: ["/dashboard", "o painel"], obras: ["/obras", "as obras"], fornecedores: ["/fornecedores", "os fornecedores"],
        comparar: ["/comparativo", "o comparativo"], pagamentos: ["/pagamentos", "os pagamentos"],
      };
      const obras = await obrasDoUsuario(user);
      const obra = cmd.obra ? melhorCorrespondencia(cmd.obra, obras) : obras.length === 1 ? obras[0] : null;
      if (cmd.obra && !obra) return { fala: `Não achei a obra ${cmd.obra}.` };

      const g = globais[cmd.destino];
      if (g) {
        if (cmd.destino === "pagamentos" && obra && cmd.obra) return { fala: `Abrindo os pagamentos da obra ${obra.nome}.`, navegar: `/pagamentos?obra=${obra.id}` };
        return { fala: `Abrindo ${g[1]}.`, navegar: g[0] };
      }
      if (cmd.destino === "rdo") {
        if (!obra) return { fala: "De qual obra? Diga, por exemplo: abrir RDO da obra Residencial." };
        if (!can(obra.perfil, "diario", "ver")) return { fala: "O seu perfil não vê o diário desta obra." };
        return { fala: `Abrindo o RDO de hoje da obra ${obra.nome}.`, navegar: `/obras/${obra.id}/diario/${hoje}/rdo` };
      }
      const m = MODULO[cmd.destino];
      if (!m) return { fala: "Não entendi para onde ir." };
      if (!obra) return { fala: `De qual obra? Diga, por exemplo: abrir ${m.nome.replace(/^(o|a|os|as) /, "")} da obra ${obras[0]?.nome ?? "Residencial"}.` };
      if (!can(obra.perfil, m.recurso, "ver")) return { fala: `O seu perfil não tem acesso a ${m.nome} desta obra.` };
      return { fala: `Abrindo ${m.nome} da obra ${obra.nome}.`, navegar: `/obras/${obra.id}${m.caminho}` };
    }

    default:
      return { fala: "Não entendi. Diga “ajuda” para ouvir os comandos." };
  }
}
