-- Compras: até 3 pedidos anexados, boleto anexado e a forma de pagamento pedida pelo fornecedor.
ALTER TABLE "SolicitacaoCompra" ADD COLUMN "meioPagamento" TEXT,
ADD COLUMN "pagamentoPix" TEXT,
ADD COLUMN "pagamentoLinhaDigitavel" TEXT;

CREATE TABLE "AnexoCompra" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'PEDIDO',
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "enviadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnexoCompra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnexoCompra_solicitacaoId_idx" ON "AnexoCompra"("solicitacaoId");

ALTER TABLE "AnexoCompra" ADD CONSTRAINT "AnexoCompra_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
