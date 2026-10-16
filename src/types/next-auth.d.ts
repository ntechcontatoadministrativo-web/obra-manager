import type { Role } from "@/lib/auth/permissions";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { role: Role; empresaId: string; sugerir2fa: boolean }
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; role: Role; empresaId: string; sugerir2fa: boolean };
  }
}
declare module "next-auth/jwt" {
  interface JWT { uid: string; role: Role; empresaId: string; sugerir2fa: boolean }
}
