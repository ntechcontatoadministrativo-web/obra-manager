import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";

/** Usuário logado ou redireciona ao login. Use no topo de toda página protegida. */
export async function requireUser() {
  const s = await getServerSession(authOptions);
  if (!s?.user) redirect("/login");
  return s.user;
}
