"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { HardHat, LayoutDashboard, UserCircle, LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Novos módulos entram aqui conforme forem construídos.
const ITENS = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/obras", rotulo: "Obras", icone: HardHat },
  { href: "/perfil", rotulo: "Perfil", icone: UserCircle },
];

const ROTULO_PERFIL: Record<string, string> = {
  SUPER_ADMIN: "Dono da empresa", ADMIN_OBRA: "Engenheiro", ENCARREGADO: "Encarregado", FISCAL: "Fiscal", VISUALIZADOR: "Cliente",
};

function alternarTema() {
  const escuro = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("tema", escuro ? "dark" : "light"); } catch {}
}

export function Nav({ nome, role }: { nome: string; role: string }) {
  const path = usePathname();
  const ativo = (h: string) => path === h || path.startsWith(h + "/");

  return (
    <>
      {/* Desktop: menu lateral */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-asfalto text-white md:flex print:!hidden">
        <div className="px-5 pb-4 pt-6">
          <p className="font-display text-xl font-semibold">Obra Manager</p>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Principal">
          {ITENS.map(({ href, rotulo, icone: Icone }) => (
            <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}
              className={cn("flex min-h-11 items-center gap-3 rounded border-l-4 px-3 text-sm font-medium",
                ativo(href) ? "border-amarelo bg-white/10" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white")}>
              <Icone size={18} aria-hidden /> {rotulo}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{nome}</p>
          <p className="mb-3 text-xs text-white/60">{ROTULO_PERFIL[role] ?? role}</p>
          <div className="flex gap-2">
            <button onClick={alternarTema} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-white/10 text-sm hover:bg-white/15">
              <Sun size={16} className="hidden dark:block" aria-hidden /><Moon size={16} className="dark:hidden" aria-hidden /> Tema
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-white/10 text-sm hover:bg-white/15">
              <LogOut size={16} aria-hidden /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Celular: barra inferior */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-white/10 bg-asfalto pb-[env(safe-area-inset-bottom)] text-white md:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${ITENS.length}, minmax(0, 1fr))` }}>
        {ITENS.map(({ href, rotulo, icone: Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-4 text-xs font-medium",
              ativo(href) ? "border-amarelo text-white" : "border-transparent text-white/60")}>
            <Icone size={20} aria-hidden /> {rotulo}
          </Link>
        ))}
      </nav>
    </>
  );
}
