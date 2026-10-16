import type { Metadata } from "next";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { descriptografar } from "@/lib/crypto";
import { Card, TITULO } from "@/components/ui";
import { IniciarBotao, ConfirmarForm } from "./forms";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function Pagina2FA() {
  const sessao = await requireUser();
  const u = await prisma.user.findUnique({ where: { id: sessao.id }, select: { email: true, totpSecretEnc: true, totpAtivo: true } });

  let qr: string | null = null;
  let segredo: string | null = null;
  if (u?.totpSecretEnc && !u.totpAtivo) {
    segredo = descriptografar(u.totpSecretEnc);
    qr = await QRCode.toDataURL(authenticator.keyuri(u.email, "Obra Manager", segredo), { margin: 1, width: 220 });
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className={TITULO}>Verificação em duas etapas</h1>
      {sessao.sugerir2fa && (
        <p role="note" className="rounded border border-amarelo/60 bg-amarelo/15 p-3 text-sm">
          Esta conta tem acesso a todas as obras da empresa. Ativar a verificação
          em duas etapas é opcional, mas recomendado antes de o sistema receber
          dados reais.
        </p>
      )}
      {u?.totpAtivo ? (
        <Card className="p-5">A verificação em duas etapas já está ativa nesta conta.</Card>
      ) : !qr ? (
        <Card className="space-y-4 p-5">
          <p className="text-sm">Você vai precisar de um aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator ou Authy).</p>
          <IniciarBotao />
        </Card>
      ) : (
        <Card className="space-y-5 p-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Abra o aplicativo autenticador e escolha adicionar conta.</li>
            <li>Aponte a câmera para o QR code abaixo.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code para configurar o autenticador" width={220} height={220} className="rounded border border-line bg-white" />
          <p className="text-xs text-muted">Sem câmera? Digite esta chave no aplicativo: <code className="break-all font-mono text-ink">{segredo}</code></p>
          <ConfirmarForm />
        </Card>
      )}
    </div>
  );
}
