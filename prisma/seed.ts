/**
 * Seed de demonstração. Uso: npm run db:seed
 * Cria 1 empresa, 1 obra, um usuário de cada perfil, etapas, insumos, compras,
 * fornecedores, contas a pagar e funcionários. Senha de todos: "Demo@12345" (SÓ PARA DEMO).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { criptografar, hashCpf } from "../src/lib/crypto";

const prisma = new PrismaClient();
const dia = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  const senhaHash = await hash("Demo@12345", 12);

  const empresa = await prisma.empresa.upsert({
    where: { cnpj: "00.000.000/0001-00" },
    update: {},
    create: { nome: "Construtora Demo Ltda", cnpj: "00.000.000/0001-00" },
  });
  await prisma.configuracao.upsert({ where: { empresaId: empresa.id }, update: {}, create: { empresaId: empresa.id } });

  const mk = (nome: string, email: string, role: any) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { empresaId: empresa.id, nome, email, senhaHash, role } });

  const dono = await mk("Dono da Empresa", "dono@demo.com", "SUPER_ADMIN");
  const eng = await mk("Eng. Responsável", "engenheiro@demo.com", "ADMIN_OBRA");
  const enc = await mk("Mestre de Obras", "encarregado@demo.com", "ENCARREGADO");
  const fis = await mk("Fiscal Técnico", "fiscal@demo.com", "FISCAL");
  const cli = await mk("Cliente", "cliente@demo.com", "VISUALIZADOR");
  await mk("Setor de Compras", "compras@demo.com", "COMPRADOR"); // vê todas as obras: não precisa de vínculo

  let obra = await prisma.obra.findFirst({ where: { empresaId: empresa.id, nome: "Residencial Aurora" } });
  if (!obra) {
    obra = await prisma.obra.create({
      data: {
        empresaId: empresa.id, nome: "Residencial Aurora", endereco: "Av. Nazaré, 100 — Belém/PA",
        latitude: -1.4558, longitude: -48.4902, clienteNome: "Cliente Demo", engenheiroNome: "Eng. Responsável",
        dataInicio: dia(-60), previsaoTermino: dia(300), valorContrato: 1_800_000, areaConstruidaM2: 420,
        status: "EM_ANDAMENTO", descricao: "Sobrado residencial de 2 pavimentos.",
      },
    });
    await prisma.obraMembro.createMany({
      data: [
        { userId: eng.id, obraId: obra.id, role: "ADMIN_OBRA" },
        { userId: enc.id, obraId: obra.id, role: "ENCARREGADO" },
        { userId: fis.id, obraId: obra.id, role: "FISCAL" },
        { userId: cli.id, obraId: obra.id, role: "VISUALIZADOR" },
      ],
    });

    const mkEtapa = (nome: string, ordem: number, ini: number, fim: number, pct: number, orc: number, status: any) =>
      prisma.etapa.create({
        data: { obraId: obra!.id, nome, ordem, inicioPrevisto: dia(ini), fimPrevisto: dia(fim), percentual: pct, valorOrcado: orc, status },
      });
    await mkEtapa("Fundação", 1, -60, -20, 100, 180_000, "CONCLUIDA");
    await mkEtapa("Estrutura", 2, -20, 60, 45, 420_000, "EM_ANDAMENTO");
    await mkEtapa("Alvenaria", 3, 30, 120, 0, 260_000, "NAO_INICIADA");
    await mkEtapa("Instalações Elétricas", 4, 100, 200, 0, 150_000, "NAO_INICIADA");

    const forn = await prisma.fornecedor.create({
      data: { empresaId: empresa.id, nome: "Casa do Construtor", cnpj: "11.111.111/0001-11", prazoEntregaDias: 3, pixChave: "11111111000111" },
    });
    const areial = await prisma.fornecedor.create({
      data: { empresaId: empresa.id, nome: "Areial Bom Jesus", cnpj: "22.222.222/0001-22", prazoEntregaDias: 1, pixChave: "financeiro@areialbomjesus.com.br" },
    });
    const cimento = await prisma.insumo.create({
      data: { empresaId: empresa.id, nome: "Cimento CP-II 50kg", categoria: "Aglomerantes", unidade: "saco" },
    });
    const vergalhao = await prisma.insumo.create({
      data: { empresaId: empresa.id, nome: "Vergalhão CA-50 10mm", categoria: "Aço", unidade: "barra" },
    });
    await prisma.precoHistorico.createMany({
      data: [32.5, 33.9, 34.2].map((preco) => ({ insumoId: cimento.id, fornecedorId: forn.id, preco })),
    });

    // Compras em fases diferentes, para a tela e o comando de voz terem o que mostrar.
    await prisma.solicitacaoCompra.create({
      data: {
        obraId: obra.id, solicitanteId: enc.id, urgencia: "URGENTE", justificativa: "Concretagem da laje do 2º pavimento",
        valorEstimado: 200 * 41.9, itens: { create: [{ insumoId: cimento.id, quantidade: 200, precoUnitEstimado: 41.9 }] },
      },
    });
    const entregue = await prisma.solicitacaoCompra.create({
      data: {
        obraId: obra.id, solicitanteId: enc.id, justificativa: "Armação dos pilares", status: "ENTREGUE", valorEstimado: 120 * 48,
        aprovadoAdminObraPorId: eng.id, itens: { create: [{ insumoId: vergalhao.id, quantidade: 120, precoUnitEstimado: 48 }] },
      },
    });
    const oc = await prisma.ordemCompra.create({
      data: { solicitacaoId: entregue.id, fornecedorId: forn.id, numero: `OC-${new Date().getFullYear()}-0001`, valorTotal: 5640, prazoPagamentoDias: 14, emitidaPorId: eng.id, entregueEm: dia(-3) },
    });

    // Contas a pagar: uma vencida, uma da compra acima e uma lida de documento.
    const conta = (d: Omit<Prisma.DespesaUncheckedCreateInput, "obraId" | "criadoPorId" | "formaPagamento" | "competencia">) =>
      prisma.despesa.create({ data: { obraId: obra!.id, criadoPorId: eng.id, formaPagamento: "A_PRAZO", competencia: dia(-5), ...d } });
    await conta({ tipo: "MATERIAL", descricao: "20 m³ de areia média", valor: 1980, vencimento: dia(-2), favorecido: areial.nome, fornecedorId: areial.id, pixChave: areial.pixChave, origem: "MANUAL" });
    await conta({ tipo: "MATERIAL", descricao: `${oc.numero}: 120 barra Vergalhão CA-50 10mm`, valor: 5640, vencimento: dia(11), favorecido: forn.nome, fornecedorId: forn.id, pixChave: forn.pixChave, ordemCompraId: oc.id, origem: "COMPRA" });
    await conta({ tipo: "SERVICO", descricao: "Locação de betoneira — outubro", valor: 750, vencimento: dia(4), favorecido: "Loca Fácil Equipamentos", pixChave: "+5591988887777", origem: "DOCUMENTO", documentoNome: "boleto-locafacil.pdf" });

    for (const [nome, cpf, funcao] of [
      ["João Pedreiro", "529.982.247-25", "Pedreiro"],
      ["Maria Servente", "111.444.777-35", "Servente"],
    ]) {
      await prisma.funcionario.create({
        data: { obraId: obra.id, nome, cpfEnc: criptografar(cpf), cpfHash: hashCpf(cpf), funcao, vinculo: "CLT" },
      });
    }
  }
  console.log("Seed concluído. Login: dono@demo.com / Demo@12345 (Super Admin — exigirá configurar 2FA)");
  void dono;
}

main().finally(() => prisma.$disconnect());
