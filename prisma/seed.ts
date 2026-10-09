/**
 * Seed de demonstração. Uso: npm run db:seed
 * Cria 1 empresa, 1 obra, um usuário de cada perfil, etapas, insumos,
 * fornecedor e funcionários. Senha de todos: "Demo@12345" (SÓ PARA DEMO).
 */
import { PrismaClient } from "@prisma/client";
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
      data: { empresaId: empresa.id, nome: "Casa do Construtor", cnpj: "11.111.111/0001-11", prazoEntregaDias: 3 },
    });
    const cimento = await prisma.insumo.create({
      data: { empresaId: empresa.id, nome: "Cimento CP-II 50kg", categoria: "Aglomerantes", unidade: "saco" },
    });
    await prisma.precoHistorico.createMany({
      data: [32.5, 33.9, 34.2].map((preco) => ({ insumoId: cimento.id, fornecedorId: forn.id, preco })),
    });

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
