import { requireUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { AssistenteVoz } from "@/components/assistente-voz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr] print:block">
      <Nav nome={user.name ?? ""} role={user.role} />
      {/* pb-24: espaço para a barra inferior no celular */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-8 print:max-w-none print:p-0">{children}</main>
      <AssistenteVoz />
    </div>
  );
}
