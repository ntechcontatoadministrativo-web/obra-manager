/**
 * RBAC — matriz de permissões por perfil.
 * Fonte única de verdade: toda checagem (API e UI) passa por `can()`.
 * Perfis seguem a especificação: Super Admin, Admin de Obra, Encarregado,
 * Fiscal, Visualizador/Cliente e Visitante.
 */
export type Role = "SUPER_ADMIN" | "ADMIN_OBRA" | "ENCARREGADO" | "FISCAL" | "VISUALIZADOR" | "VISITANTE";

export type Recurso =
  | "obra" | "usuario" | "funcionario" | "ponto" | "diario" | "etapa" | "medicao"
  | "compra" | "financeiro" | "ocorrencia" | "foto" | "documento" | "equipamento"
  | "seguranca" | "contrato" | "fornecedor" | "relatorio" | "configuracao" | "auditoria"
  | "analise" | "risco";

export type Acao = "ver" | "criar" | "editar" | "excluir" | "aprovar" | "exportar";

const TODAS: Acao[] = ["ver", "criar", "editar", "excluir", "aprovar", "exportar"];
const VER: Acao[] = ["ver"];
const VER_CRIAR: Acao[] = ["ver", "criar"];
const VER_CRIAR_EDITAR: Acao[] = ["ver", "criar", "editar"];

type Matriz = Partial<Record<Recurso, Acao[]>>;

const SUPER_ADMIN: Matriz = Object.fromEntries(
  (["obra","usuario","funcionario","ponto","diario","etapa","medicao","compra","financeiro","ocorrencia",
    "foto","documento","equipamento","seguranca","contrato","fornecedor","relatorio","configuracao","auditoria",
    "analise","risco"] as Recurso[])
    .map((r) => [r, TODAS]),
);

/** Admin de Obra: tudo na(s) sua(s) obra(s), exceto criar/arquivar obras e configurações globais. */
const ADMIN_OBRA: Matriz = {
  obra: ["ver", "editar"],
  usuario: ["ver", "criar", "editar"], // somente sub-usuários da própria obra (ver podeAtribuirRole)
  funcionario: TODAS,
  ponto: TODAS,
  diario: TODAS,
  etapa: TODAS,
  medicao: TODAS,
  compra: TODAS, // "aprovar" limitado pelo valor (ver compras.ts)
  financeiro: ["ver", "criar", "editar", "exportar"],
  ocorrencia: TODAS,
  foto: TODAS,
  documento: TODAS,
  equipamento: TODAS,
  seguranca: TODAS,
  contrato: ["ver", "criar", "editar"],
  fornecedor: VER,
  relatorio: ["ver", "exportar"],
  // Analisa e congela baseline; cadastra e trata risco.
  analise: ["ver", "criar", "editar", "exportar"],
  risco: TODAS,
};

const ENCARREGADO: Matriz = {
  obra: VER,
  funcionario: VER,
  ponto: VER_CRIAR_EDITAR,
  diario: VER_CRIAR_EDITAR,
  etapa: ["ver", "editar"], // registra etapas em desenvolvimento
  compra: VER_CRIAR,        // abre solicitação, não aprova
  ocorrencia: VER,
  foto: VER_CRIAR,
  documento: VER,
  equipamento: VER,
  seguranca: VER,
  risco: VER_CRIAR,
};

const FISCAL: Matriz = {
  obra: VER,
  funcionario: VER,
  ponto: VER,      // sem editar
  diario: VER,     // sem editar
  etapa: VER,
  ocorrencia: VER_CRIAR_EDITAR,
  foto: VER_CRIAR,
  documento: VER_CRIAR, // laudos técnicos
  seguranca: VER,
  analise: VER,
  risco: VER_CRIAR_EDITAR, // quem está em campo é quem vê o risco primeiro
};

/** Visualizador/Cliente: dashboard resumido, fotos e progresso. Sem financeiro. */
const VISUALIZADOR: Matriz = {
  obra: VER,
  etapa: VER,
  foto: VER,
};

/** Visitante: todas as permissões, como o Super Admin. */
const VISITANTE: Matriz = SUPER_ADMIN;

const MATRIZ: Record<Role, Matriz> = {
  SUPER_ADMIN, ADMIN_OBRA, ENCARREGADO, FISCAL, VISUALIZADOR, VISITANTE,
};

/** Perfis que enxergam todas as obras da empresa, sem precisar de vínculo ObraMembro. */
export function acessaTodasAsObras(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "VISITANTE";
}

export function can(role: Role, recurso: Recurso, acao: Acao): boolean {
  return MATRIZ[role][recurso]?.includes(acao) ?? false;
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(msg = "Você não tem permissão para esta ação.") {
    super(msg);
  }
}

export function assertCan(role: Role, recurso: Recurso, acao: Acao): void {
  if (!can(role, recurso, acao)) throw new ForbiddenError();
}

/** Hierarquia: quanto menor o número, maior o poder. */
const NIVEL: Record<Role, number> = {
  SUPER_ADMIN: 0, ADMIN_OBRA: 1, ENCARREGADO: 2, FISCAL: 2, VISUALIZADOR: 3, VISITANTE: 0,
};

/**
 * Quem cria usuário só pode atribuir perfis estritamente abaixo do seu.
 * Impede escalada de privilégio (Admin de Obra criando outro Admin/Super Admin).
 * Exceção: Super Admin pode criar Admin de Obra e inferiores, mas não outro Super Admin
 * por esta função — criação de Super Admin deve ser um fluxo separado e auditado.
 */
export function podeAtribuirRole(criador: Role, alvo: Role): boolean {
  if (!can(criador, "usuario", "criar")) return false;
  if (alvo === "SUPER_ADMIN") return false;
  return NIVEL[alvo] > NIVEL[criador];
}
