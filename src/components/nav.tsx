"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { HardHat, LayoutDashboard, Scale, UserCircle, LogOut, Moon, Sun, Presentation, Wallet, Truck, ShoppingCart } from "lucide-react";
import { can, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { AssinaturaNtech } from "./ntech";

// Novos módulos entram aqui conforme forem construídos.
// `soDesktop`: fica fora da barra inferior do celular, que só comporta cinco itens.
const TODOS = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/obras", rotulo: "Obras", icone: HardHat },
  { href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, recurso: "financeiro" },
  { href: "/compras", rotulo: "Compras", icone: ShoppingCart, recurso: "compra" },
  { href: "/fornecedores", rotulo: "Fornecedores", icone: Truck, recurso: "fornecedor", soDesktop: true },
  { href: "/comparativo", rotulo: "Comparar", icone: Scale, recurso: "analise", soDesktop: true },
  { href: "/perfil", rotulo: "Perfil", icone: UserCircle },
] as const;

const ROTULO_PERFIL: Record<string, string> = {
  SUPER_ADMIN: "Dono da empresa", ADMIN_OBRA: "Engenheiro", ENCARREGADO: "Encarregado", FISCAL: "Fiscal", VISUALIZADOR: "Cliente", VISITANTE: "Visitante", COMPRADOR: "Comprador",
};

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

function alternarTema() {
  const escuro = document.documentElement.classList.toggle("dark");
  try { localStorage.setItem("tema", escuro ? "dark" : "light"); } catch {}
}

export function Nav({ nome, role }: { nome: string; role: string }) {
  const path = usePathname();
  const ativo = (h: string) => path === h || path.startsWith(h + "/");
  const ITENS = TODOS.filter((i) => !("recurso" in i) || can(role as Role, i.recurso, "ver"));
  const MOVEL = ITENS.filter((i) => !("soDesktop" in i));

  return (
    <>
      {/* Desktop: menu lateral */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-asfalto text-white md:flex print:!hidden">
        <div className="faixa-obra h-1.5" aria-hidden />
        <div className="flex items-center gap-3 px-5 pb-5 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-laranja text-white shadow-lg shadow-laranja/30" aria-hidden>
            <HardHat size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">Obra Manager</p>
            <AssinaturaNtech className="text-white" />
          </div>
        </div>
        <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Menu</p>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Principal">
          {ITENS.map(({ href, rotulo, icone: Icone }) => (
            <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}
              className={cn("group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                ativo(href) ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
              {ativo(href) && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-amarelo" aria-hidden />}
              <Icone size={18} aria-hidden className={cn("transition-colors", ativo(href) ? "text-amarelo" : "group-hover:text-white")} /> {rotulo}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-3">
          <Link href="/apresentacao" target="_blank" className="flex min-h-11 items-center gap-3 rounded-md border border-dashed border-white/15 px-3 text-sm font-medium text-white/65 transition-colors hover:border-amarelo/60 hover:text-amarelo">
            <Presentation size={18} aria-hidden /> Apresentação
          </Link>
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amarelo font-display text-sm font-bold text-asfalto" aria-hidden>
              {iniciais(nome)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="text-xs text-white/55">{ROTULO_PERFIL[role] ?? role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={alternarTema} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-white/[0.07] text-sm text-white/80 transition-colors hover:bg-white/15 hover:text-white">
              <Sun size={16} className="hidden dark:block" aria-hidden /><Moon size={16} className="dark:hidden" aria-hidden /> Tema
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-white/[0.07] text-sm text-white/80 transition-colors hover:bg-white/15 hover:text-white">
              <LogOut size={16} aria-hidden /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Celular: barra inferior */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-white/10 bg-asfalto pb-[env(safe-area-inset-bottom)] text-white md:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${MOVEL.length}, minmax(0, 1fr))` }}>
        {MOVEL.map(({ href, rotulo, icone: Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              ativo(href) ? "text-white" : "text-white/55")}>
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", ativo(href) && "bg-amarelo text-asfalto")}>
              <Icone size={19} aria-hidden />
            </span>
            {rotulo}
          </Link>
        ))}
      </nav>
    </>
  );
}
