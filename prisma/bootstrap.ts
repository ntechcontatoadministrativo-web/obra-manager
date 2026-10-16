/**
 * Bootstrap de PRODUÇÃO. Uso: npm run db:bootstrap
 *
 * Cria o mínimo para o sistema existir: a empresa real, a linha de
 * Configuracao (raio do GPS, jornada, limites de aprovação) e o primeiro
 * SUPER_ADMIN. Nada de dados de demonstração.
 *
 * Diferente de prisma/seed.ts, que cria usuários com senha pública
 * ("Demo@12345") e NUNCA deve rodar em produção.
 *
 * Variáveis necessárias:
 *   EMPRESA_NOME    nome da construtora
 *   EMPRESA_CNPJ    opcional
 *   ADMIN_NOME      nome do primeiro usuário
 *   ADMIN_EMAIL     e-mail de login
 *   ADMIN_SENHA     senha inicial (mínimo 12 caracteres) — troque após entrar
 *
 * É idempotente: rodar de novo não duplica nem sobrescreve a senha.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function exigir(nome: string): string {
  const v = process.env[nome]?.trim();
  if (!v) {
    console.error(`\n  Falta a variável ${nome}.\n`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const empresaNome = exigir("EMPRESA_NOME");
  const adminNome = exigir("ADMIN_NOME");
  const adminEmail = exigir("ADMIN_EMAIL").toLowerCase();
  const adminSenha = exigir("ADMIN_SENHA");
  const cnpj = process.env.EMPRESA_CNPJ?.trim() || null;

  if (adminSenha.length < 12) {
    console.error("\n  ADMIN_SENHA precisa de pelo menos 12 caracteres.\n");
    process.exit(1);
  }
  for (const chave of ["ENCRYPTION_KEY", "HASH_KEY"]) {
    const v = process.env[chave];
    if (!v || v.length !== 64) {
      console.error(`\n  ${chave} precisa ter 64 caracteres hex (openssl rand -hex 32).\n`);
      process.exit(1);
    }
  }

  const jaTem = await prisma.user.count();
  if (jaTem > 0) {
    console.log(`Banco já tem ${jaTem} usuário(s). Nada foi alterado.`);
    return;
  }

  const empresa = await prisma.empresa.create({ data: { nome: empresaNome, cnpj } });
  await prisma.configuracao.create({ data: { empresaId: empresa.id } });

  const admin = await prisma.user.create({
    data: {
      empresaId: empresa.id,
      nome: adminNome,
      email: adminEmail,
      senhaHash: await hash(adminSenha, 12),
      role: "SUPER_ADMIN",
    },
  });

  console.log(`
  Pronto.
    Empresa ........ ${empresa.nome}
    Administrador .. ${admin.email}

  Entre com esse e-mail e a senha que você definiu. A verificação em duas
  etapas é opcional e fica em Perfil → Verificação em duas etapas; ative
  antes de o sistema receber dados reais.
  Troque a senha inicial depois de entrar.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
