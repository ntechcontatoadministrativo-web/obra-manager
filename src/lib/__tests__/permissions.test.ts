import { describe, it, expect } from "vitest";
import { can, podeAtribuirRole, assertCan, ForbiddenError, type Role } from "../auth/permissions";

describe("RBAC", () => {
  it("Super Admin pode tudo", () => {
    expect(can("SUPER_ADMIN", "configuracao", "editar")).toBe(true);
    expect(can("SUPER_ADMIN", "obra", "criar")).toBe(true);
  });

  it("Admin de Obra não cria obras nem altera configurações globais", () => {
    expect(can("ADMIN_OBRA", "obra", "criar")).toBe(false);
    expect(can("ADMIN_OBRA", "configuracao", "editar")).toBe(false);
    expect(can("ADMIN_OBRA", "financeiro", "ver")).toBe(true);
  });

  it("Encarregado abre compra mas não aprova", () => {
    expect(can("ENCARREGADO", "compra", "criar")).toBe(true);
    expect(can("ENCARREGADO", "compra", "aprovar")).toBe(false);
  });

  it("Fiscal vê ponto e diário sem editar, mas registra ocorrência", () => {
    expect(can("FISCAL", "ponto", "ver")).toBe(true);
    expect(can("FISCAL", "ponto", "editar")).toBe(false);
    expect(can("FISCAL", "diario", "editar")).toBe(false);
    expect(can("FISCAL", "ocorrencia", "criar")).toBe(true);
  });

  it("Visualizador nunca acessa dados financeiros", () => {
    for (const a of ["ver", "criar", "editar", "excluir", "aprovar", "exportar"] as const) {
      expect(can("VISUALIZADOR", "financeiro", a)).toBe(false);
      expect(can("VISUALIZADOR", "contrato", a)).toBe(false);
    }
  });

  it("assertCan lança ForbiddenError", () => {
    expect(() => assertCan("VISUALIZADOR", "ponto", "criar")).toThrow(ForbiddenError);
  });

  it("impede escalada de privilégio ao criar usuários", () => {
    expect(podeAtribuirRole("ADMIN_OBRA", "ADMIN_OBRA")).toBe(false);
    expect(podeAtribuirRole("ADMIN_OBRA", "SUPER_ADMIN")).toBe(false);
    expect(podeAtribuirRole("ADMIN_OBRA", "ENCARREGADO")).toBe(true);
    expect(podeAtribuirRole("SUPER_ADMIN", "ADMIN_OBRA")).toBe(true);
    expect(podeAtribuirRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(false);
    for (const r of ["ENCARREGADO", "FISCAL", "VISUALIZADOR"] as Role[]) {
      expect(podeAtribuirRole(r, "VISUALIZADOR")).toBe(false);
    }
  });
});
