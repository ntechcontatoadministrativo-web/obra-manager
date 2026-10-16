/**
 * NextAuth (Credentials + JWT).
 * Segurança:
 *  - bcrypt (custo 12) para senha
 *  - bloqueio temporário após 5 tentativas erradas
 *  - 2FA TOTP: OPCIONAL. Quem ativa passa a ter o código exigido no login;
 *    quem não ativa entra só com e-mail e senha. Não há mais trava obrigando
 *    o Super Admin a configurar antes de usar o sistema.
 *  - mensagem de erro única (não revela se o e-mail existe)
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authenticator } from "otplib";
import { prisma } from "@/lib/prisma";
import { descriptografar } from "@/lib/crypto";
import { registrarAuditoria } from "@/lib/audit";
import { acessaTodasAsObras, type Role } from "./permissions";

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;
const ERRO_GENERICO = "Credenciais inválidas.";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
        totp: { label: "Código 2FA", type: "text" },
      },
      async authorize(creds) {
        const email = creds?.email?.trim().toLowerCase();
        if (!email || !creds?.senha) throw new Error(ERRO_GENERICO);

        let user;
        try {
          user = await prisma.user.findUnique({ where: { email } });
        } catch (e) {
          // O detalhe (endereço do banco etc.) vai só para o log do servidor, nunca para a tela.
          console.error("Falha ao consultar o banco no login:", e);
          throw new Error("SERVICO_INDISPONIVEL");
        }
        if (!user || !user.ativo || user.anonimizadoEm) throw new Error(ERRO_GENERICO);

        if (user.bloqueadoAte && user.bloqueadoAte > new Date()) {
          throw new Error("Conta temporariamente bloqueada. Tente novamente mais tarde.");
        }

        const senhaOk = await compare(creds.senha, user.senhaHash);
        let totpOk = true;
        if (user.totpAtivo && user.totpSecretEnc) {
          totpOk = !!creds.totp && authenticator.check(creds.totp, descriptografar(user.totpSecretEnc));
        }

        if (!senhaOk || !totpOk) {
          const tentativas = user.tentativasLogin + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tentativasLogin: tentativas >= MAX_TENTATIVAS ? 0 : tentativas,
              bloqueadoAte: tentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MIN * 60_000) : null,
            },
          });
          await registrarAuditoria(prisma, { userId: user.id, acao: "LOGIN_FALHOU", entidade: "User", entidadeId: user.id });
          // Mensagem distinta só para "falta o código 2FA" (após senha correta).
          if (senhaOk && user.totpAtivo && !creds.totp) throw new Error("2FA_REQUERIDO");
          throw new Error(ERRO_GENERICO);
        }

        await prisma.user.update({ where: { id: user.id }, data: { tentativasLogin: 0, bloqueadoAte: null } });
        await registrarAuditoria(prisma, { userId: user.id, acao: "LOGIN", entidade: "User", entidadeId: user.id });

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          role: user.role as Role,
          empresaId: user.empresaId,
          // Informativo, para a tela de perfil sugerir ativar. Não bloqueia nada.
          sugerir2fa: acessaTodasAsObras(user.role as Role) && !user.totpAtivo,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.empresaId = user.empresaId;
        token.sugerir2fa = user.sugerir2fa;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.empresaId = token.empresaId;
      session.user.sugerir2fa = token.sugerir2fa;
      return session;
    },
  },
};
