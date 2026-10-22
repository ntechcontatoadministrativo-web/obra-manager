-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "pixChave" TEXT;

-- AlterTable
ALTER TABLE "OrdemCompra" ADD COLUMN     "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "emitidaPorId" TEXT,
ADD COLUMN     "prazoPagamentoDias" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Despesa" ADD COLUMN     "documentoNome" TEXT,
ADD COLUMN     "favorecido" TEXT,
ADD COLUMN     "fornecedorId" TEXT,
ADD COLUMN     "linhaDigitavel" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "pagoPorId" TEXT,
ADD COLUMN     "pixChave" TEXT,
ADD COLUMN     "pixCopiaECola" TEXT,
ADD COLUMN     "vencimento" DATE;

-- CreateIndex
CREATE INDEX "Despesa_obraId_pagamento_vencimento_idx" ON "Despesa"("obraId", "pagamento", "vencimento");

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

