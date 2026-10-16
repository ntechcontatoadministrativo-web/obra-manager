/*
  Warnings:

  - A unique constraint covering the columns `[empresaId,codigo]` on the table `Obra` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoDependencia" AS ENUM ('TI', 'II', 'TT', 'IT');

-- CreateEnum
CREATE TYPE "CategoriaRisco" AS ENUM ('PRAZO', 'CUSTO', 'QUALIDADE', 'SEGURANCA', 'CLIMA', 'SUPRIMENTOS', 'REGULATORIO', 'MAO_DE_OBRA');

-- CreateEnum
CREATE TYPE "SituacaoRisco" AS ENUM ('IDENTIFICADO', 'EM_MITIGACAO', 'MATERIALIZADO', 'ENCERRADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'RISCO_CRITICO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'DESEMPENHO_ABAIXO';

-- AlterTable
ALTER TABLE "Etapa" ADD COLUMN     "ehCritica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ehMarco" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "folgaTotalDias" INTEGER;

-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "artEmitidaEm" TIMESTAMP(3),
ADD COLUMN     "artNumero" TEXT,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "fotoCapaUrl" TEXT,
ADD COLUMN     "inicioReal" TIMESTAMP(3),
ADD COLUMN     "responsavelTecnicoId" TEXT,
ADD COLUMN     "terminoReal" TIMESTAMP(3),
ADD COLUMN     "tipoEngenharia" TEXT;

-- CreateTable
CREATE TABLE "ObraStatusHistorico" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "de" "ObraStatus",
    "para" "ObraStatus" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "alteradoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraStatusHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaDependencia" (
    "id" TEXT NOT NULL,
    "predecessoraId" TEXT NOT NULL,
    "sucessoraId" TEXT NOT NULL,
    "tipo" "TipoDependencia" NOT NULL DEFAULT 'TI',
    "folgaDias" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtapaDependencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronogramaBaseline" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "observacao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronogramaBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineItem" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "inicioPrevisto" TIMESTAMP(3) NOT NULL,
    "fimPrevisto" TIMESTAMP(3) NOT NULL,
    "valorOrcado" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BaselineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicadorSemanal" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "semana" DATE NOT NULL,
    "valorPlanejado" DECIMAL(14,2) NOT NULL,
    "valorAgregado" DECIMAL(14,2) NOT NULL,
    "custoReal" DECIMAL(14,2) NOT NULL,
    "orcamentoTotal" DECIMAL(14,2) NOT NULL,
    "cpi" DECIMAL(6,3),
    "spi" DECIMAL(6,3),
    "estimativaTermino" DECIMAL(14,2),
    "avancoFisicoPct" DECIMAL(5,2) NOT NULL,
    "fechadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicadorSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risco" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "etapaId" TEXT,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "CategoriaRisco" NOT NULL,
    "situacao" "SituacaoRisco" NOT NULL DEFAULT 'IDENTIFICADO',
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "impactoFinanceiro" DECIMAL(14,2),
    "impactoPrazoDias" INTEGER,
    "planoMitigacao" TEXT,
    "responsavelId" TEXT,
    "prazoMitigacao" TIMESTAMP(3),
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "origemRegra" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiscoHistorico" (
    "id" TEXT NOT NULL,
    "riscoId" TEXT NOT NULL,
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "situacao" "SituacaoRisco" NOT NULL,
    "nota" TEXT,
    "alteradoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiscoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObraStatusHistorico_obraId_criadoEm_idx" ON "ObraStatusHistorico"("obraId", "criadoEm");

-- CreateIndex
CREATE INDEX "EtapaDependencia_sucessoraId_idx" ON "EtapaDependencia"("sucessoraId");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaDependencia_predecessoraId_sucessoraId_key" ON "EtapaDependencia"("predecessoraId", "sucessoraId");

-- CreateIndex
CREATE INDEX "CronogramaBaseline_obraId_ativa_idx" ON "CronogramaBaseline"("obraId", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "CronogramaBaseline_obraId_numero_key" ON "CronogramaBaseline"("obraId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineItem_baselineId_etapaId_key" ON "BaselineItem"("baselineId", "etapaId");

-- CreateIndex
CREATE INDEX "IndicadorSemanal_obraId_semana_idx" ON "IndicadorSemanal"("obraId", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorSemanal_obraId_semana_key" ON "IndicadorSemanal"("obraId", "semana");

-- CreateIndex
CREATE INDEX "Risco_obraId_situacao_idx" ON "Risco"("obraId", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "Risco_obraId_codigo_key" ON "Risco"("obraId", "codigo");

-- CreateIndex
CREATE INDEX "RiscoHistorico_riscoId_criadoEm_idx" ON "RiscoHistorico"("riscoId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_empresaId_codigo_key" ON "Obra"("empresaId", "codigo");

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_responsavelTecnicoId_fkey" FOREIGN KEY ("responsavelTecnicoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraStatusHistorico" ADD CONSTRAINT "ObraStatusHistorico_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraStatusHistorico" ADD CONSTRAINT "ObraStatusHistorico_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaDependencia" ADD CONSTRAINT "EtapaDependencia_predecessoraId_fkey" FOREIGN KEY ("predecessoraId") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaDependencia" ADD CONSTRAINT "EtapaDependencia_sucessoraId_fkey" FOREIGN KEY ("sucessoraId") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaBaseline" ADD CONSTRAINT "CronogramaBaseline_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaBaseline" ADD CONSTRAINT "CronogramaBaseline_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineItem" ADD CONSTRAINT "BaselineItem_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "CronogramaBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineItem" ADD CONSTRAINT "BaselineItem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicadorSemanal" ADD CONSTRAINT "IndicadorSemanal_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiscoHistorico" ADD CONSTRAINT "RiscoHistorico_riscoId_fkey" FOREIGN KEY ("riscoId") REFERENCES "Risco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiscoHistorico" ADD CONSTRAINT "RiscoHistorico_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
