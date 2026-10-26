import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { perfilNaObra } from "@/lib/auth/guard";

/** Abre um anexo da compra. Também é o link do boleto na conta em Pagamentos. */
export async function GET(_: Request, { params }: { params: { id: string; anexoId: string } }) {
  const s = await getServerSession(authOptions);
  if (!s?.user) return new Response("Faça login.", { status: 401 });
  const perfil = await perfilNaObra(prisma, s.user, params.id);
  // Mesma resposta para "não existe" e "sem acesso".
  if (!perfil || !(can(perfil, "compra", "ver") || can(perfil, "financeiro", "ver"))) return new Response("Não encontrado.", { status: 404 });

  const a = await prisma.anexoCompra.findFirst({
    where: { id: params.anexoId, solicitacao: { obraId: params.id } },
    select: { nome: true, tipo: true, conteudo: true },
  });
  if (!a) return new Response("Não encontrado.", { status: 404 });

  return new Response(new Uint8Array(a.conteudo), {
    headers: {
      // O tipo foi conferido pelos bytes no envio (só PDF e imagens).
      "Content-Type": a.tipo,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
