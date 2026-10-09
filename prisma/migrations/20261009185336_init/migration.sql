-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_OBRA', 'ENCARREGADO', 'FISCAL', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "ObraStatus" AS ENUM ('EM_PLANEJAMENTO', 'EM_ANDAMENTO', 'PARALISADA', 'CONCLUIDA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "Vinculo" AS ENUM ('CLT', 'MEI', 'DIARISTA', 'EMPREITADA');

-- CreateEnum
CREATE TYPE "DiaTipo" AS ENUM ('TRABALHADO', 'FALTA', 'FALTA_JUSTIFICADA', 'AFASTAMENTO', 'ATESTADO', 'FOLGA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "Clima" AS ENUM ('ENSOLARADO', 'NUBLADO', 'CHUVOSO', 'TEMPESTADE');

-- CreateEnum
CREATE TYPE "ImpactoClima" AS ENUM ('SEM_IMPACTO', 'PRODUCAO_REDUZIDA', 'PARALISACAO_PARCIAL', 'PARALISACAO_TOTAL');

-- CreateEnum
CREATE TYPE "EtapaStatus" AS ENUM ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA', 'PARALISADA');

-- CreateEnum
CREATE TYPE "Urgencia" AS ENUM ('URGENTE', 'NORMAL', 'PLANEJADA');

-- CreateEnum
CREATE TYPE "CompraStatus" AS ENUM ('AGUARDANDO_ADMIN_OBRA', 'AGUARDANDO_SUPER_ADMIN', 'APROVADA', 'REPROVADA', 'PO_EMITIDA', 'ENVIADA_FORNECEDOR', 'ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DespesaTipo" AS ENUM ('MATERIAL', 'MAO_DE_OBRA', 'EQUIPAMENTO', 'SERVICO', 'TAXA', 'OUTROS');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('A_VISTA', 'A_PRAZO');

-- CreateEnum
CREATE TYPE "OcorrenciaTipo" AS ENUM ('ACIDENTE_TRABALHO', 'DESVIO_QUALIDADE', 'ATRASO_ENTREGA', 'PROBLEMA_TECNICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "OcorrenciaClasse" AS ENUM ('SEGURANCA', 'QUALIDADE', 'PRAZO', 'FINANCEIRO', 'AMBIENTAL');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "OcorrenciaStatus" AS ENUM ('ABERTA', 'EM_TRATATIVA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "DocCategoria" AS ENUM ('CONTRATO', 'PROJETO', 'LAUDO', 'LICENCA', 'NF', 'SEGURO', 'OUTROS');

-- CreateEnum
CREATE TYPE "ManutencaoTipo" AS ENUM ('PREVENTIVA', 'CORRETIVA');

-- CreateEnum
CREATE TYPE "NotificacaoTipo" AS ENUM ('COMPRA_PENDENTE', 'ETAPA_ATRASADA', 'ORCAMENTO_ESTOURADO', 'PONTO_AUSENTE', 'DIARIO_PENDENTE', 'NOVA_OCORRENCIA', 'DOCUMENTO_VENCENDO', 'CONTRATO_VENCENDO', 'LOCACAO_DEVOLUCAO', 'TREINAMENTO_VENCENDO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "jornadaHorasDia" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "jornadaDiasSemana" INTEGER NOT NULL DEFAULT 5,
    "limiteAprovacaoCompra" DECIMAL(14,2) NOT NULL DEFAULT 5000,
    "alertaDesvioOrcamentoPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "alertaDesvioPrecoPct" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "raioGpsMetros" INTEGER NOT NULL DEFAULT 150,
    "diasSemPontoAlerta" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fotoUrl" TEXT,
    "totpSecretEnc" TEXT,
    "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
    "tentativasLogin" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "anonimizadoEm" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObraMembro" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "ObraMembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "obraId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "obraId" TEXT,
    "tipo" "NotificacaoTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "clienteNome" TEXT NOT NULL,
    "engenheiroNome" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "previsaoTermino" TIMESTAMP(3) NOT NULL,
    "valorContrato" DECIMAL(14,2) NOT NULL,
    "areaConstruidaM2" DECIMAL(10,2),
    "status" "ObraStatus" NOT NULL DEFAULT 'EM_PLANEJAMENTO',
    "descricao" TEXT,
    "raioGpsMetros" INTEGER,
    "tokenGaleriaPublica" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfEnc" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "terceiro" BOOLEAN NOT NULL DEFAULT false,
    "empresaTerceira" TEXT,
    "vinculo" "Vinculo" NOT NULL,
    "telefone" TEXT,
    "dadosBancariosEnc" TEXT,
    "fotoUrl" TEXT,
    "valorHora" DECIMAL(10,2),
    "valorDiaria" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonimizadoEm" TIMESTAMP(3),

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPonto" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "DiaTipo" NOT NULL DEFAULT 'TRABALHADO',
    "entradaEm" TIMESTAMP(3),
    "entradaFotoUrl" TEXT,
    "entradaLat" DOUBLE PRECISION,
    "entradaLng" DOUBLE PRECISION,
    "entradaNoRaio" BOOLEAN,
    "almocoSaidaEm" TIMESTAMP(3),
    "almocoVoltaEm" TIMESTAMP(3),
    "saidaEm" TIMESTAMP(3),
    "saidaFotoUrl" TEXT,
    "saidaLat" DOUBLE PRECISION,
    "saidaLng" DOUBLE PRECISION,
    "saidaNoRaio" BOOLEAN,
    "atestadoUrl" TEXT,
    "observacao" TEXT,
    "registradoPorId" TEXT,
    "lancadoPorTerceiro" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroPonto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioObra" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "turno" "Turno" NOT NULL,
    "clima" "Clima" NOT NULL,
    "temperaturaC" INTEGER,
    "impactoClima" "ImpactoClima" NOT NULL DEFAULT 'SEM_IMPACTO',
    "obsClima" TEXT,
    "descricao" TEXT NOT NULL,
    "observacoes" TEXT,
    "assinaturaUrl" TEXT,
    "assinadoPorId" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiarioObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioEfetivo" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "terceiro" BOOLEAN NOT NULL DEFAULT false,
    "empresa" TEXT,

    CONSTRAINT "DiarioEfetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioAtividade" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "descricao" TEXT,
    "quantidade" DECIMAL(12,3),
    "unidade" TEXT,

    CONSTRAINT "DiarioAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioEquipamento" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "horasUso" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "DiarioEquipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarioVisita" (
    "id" TEXT NOT NULL,
    "diarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "assinaturaUrl" TEXT,

    CONSTRAINT "DiarioVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "paiId" TEXT,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "inicioPrevisto" TIMESTAMP(3) NOT NULL,
    "fimPrevisto" TIMESTAMP(3) NOT NULL,
    "inicioReal" TIMESTAMP(3),
    "fimReal" TIMESTAMP(3),
    "percentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorOrcado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "responsavelId" TEXT,
    "status" "EtapaStatus" NOT NULL DEFAULT 'NAO_INICIADA',
    "criterioMedicao" TEXT,
    "quantidadePrevista" DECIMAL(12,3),

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "periodoInicio" DATE NOT NULL,
    "periodoFim" DATE NOT NULL,
    "avancoGlobalPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorMedido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicaoItem" (
    "id" TEXT NOT NULL,
    "medicaoId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "percentualAcumulado" DECIMAL(5,2) NOT NULL,
    "percentualPeriodo" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "MedicaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "contato" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "prazoEntregaDias" INTEGER,
    "avaliacaoMedia" DECIMAL(3,2),

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoFornecedor" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "ordemId" TEXT,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoHistorico" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "preco" DECIMAL(12,2) NOT NULL,
    "cotadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCompra" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "etapaId" TEXT,
    "solicitanteId" TEXT NOT NULL,
    "urgencia" "Urgencia" NOT NULL DEFAULT 'NORMAL',
    "justificativa" TEXT NOT NULL,
    "status" "CompraStatus" NOT NULL DEFAULT 'AGUARDANDO_ADMIN_OBRA',
    "valorEstimado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aprovadoAdminObraPorId" TEXT,
    "aprovadoSuperAdminPorId" TEXT,
    "motivoReprovacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoItem" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitEstimado" DECIMAL(12,2),

    CONSTRAINT "SolicitacaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemCompra" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "enviadaEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),

    CONSTRAINT "OrdemCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "etapaId" TEXT,
    "ordemCompraId" TEXT,
    "tipo" "DespesaTipo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "competencia" DATE NOT NULL,
    "pagamento" DATE,
    "documentoUrl" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "etapaId" TEXT,
    "diarioId" TEXT,
    "compraId" TEXT,
    "ocorrenciaId" TEXT,
    "url" TEXT NOT NULL,
    "legenda" TEXT,
    "tiradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "album" TEXT,
    "momento" TEXT,
    "enviadaPorId" TEXT,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "diarioId" TEXT,
    "tipo" "OcorrenciaTipo" NOT NULL,
    "classe" "OcorrenciaClasse" NOT NULL,
    "severidade" "Severidade" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "status" "OcorrenciaStatus" NOT NULL DEFAULT 'ABERTA',
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaTratativa" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaTratativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "categoria" "DocCategoria" NOT NULL,
    "nome" TEXT NOT NULL,
    "vencimento" TIMESTAMP(3),
    "perfisVisualizacao" "Role"[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVersao" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "assinadoPorId" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "enviadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoEquipamento" (
    "id" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "UsoEquipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manutencao" (
    "id" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "tipo" "ManutencaoTipo" NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "custo" DECIMAL(12,2),

    CONSTRAINT "Manutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locacao" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "devolucaoPrevista" DATE NOT NULL,
    "devolvidoEm" DATE,
    "valorDiario" DECIMAL(12,2),
    "valorMensal" DECIMAL(12,2),

    CONSTRAINT "Locacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treinamento" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "norma" TEXT NOT NULL,
    "realizadoEm" DATE NOT NULL,
    "validadeAte" DATE,
    "certificadoUrl" TEXT,

    CONSTRAINT "Treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiEntrega" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "ca" TEXT,
    "entregueEm" DATE NOT NULL,
    "assinaturaUrl" TEXT,

    CONSTRAINT "EpiEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspecaoSeguranca" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "resultado" TEXT NOT NULL,
    "inspetorId" TEXT NOT NULL,
    "anexoUrl" TEXT,

    CONSTRAINT "InspecaoSeguranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoCliente" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "assinadoEm" DATE,
    "vencimento" DATE,
    "documentoUrl" TEXT,

    CONSTRAINT "ContratoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaCliente" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "valorPrevisto" DECIMAL(14,2) NOT NULL,
    "valorMedido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pagoEm" DATE,
    "valorPago" DECIMAL(14,2),

    CONSTRAINT "ParcelaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracao_empresaId_key" ON "Configuracao"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_empresaId_idx" ON "User"("empresaId");

-- CreateIndex
CREATE INDEX "ObraMembro_obraId_idx" ON "ObraMembro"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "ObraMembro_userId_obraId_key" ON "ObraMembro"("userId", "obraId");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_obraId_criadoEm_idx" ON "AuditLog"("obraId", "criadoEm");

-- CreateIndex
CREATE INDEX "Notificacao_userId_lida_idx" ON "Notificacao"("userId", "lida");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_tokenGaleriaPublica_key" ON "Obra"("tokenGaleriaPublica");

-- CreateIndex
CREATE INDEX "Obra_empresaId_status_idx" ON "Obra"("empresaId", "status");

-- CreateIndex
CREATE INDEX "Funcionario_obraId_ativo_idx" ON "Funcionario"("obraId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_obraId_cpfHash_key" ON "Funcionario"("obraId", "cpfHash");

-- CreateIndex
CREATE INDEX "RegistroPonto_obraId_data_idx" ON "RegistroPonto"("obraId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPonto_funcionarioId_data_key" ON "RegistroPonto"("funcionarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "DiarioObra_obraId_data_turno_key" ON "DiarioObra"("obraId", "data", "turno");

-- CreateIndex
CREATE INDEX "Etapa_obraId_paiId_idx" ON "Etapa"("obraId", "paiId");

-- CreateIndex
CREATE UNIQUE INDEX "Medicao_obraId_numero_key" ON "Medicao"("obraId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_empresaId_cnpj_key" ON "Fornecedor"("empresaId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_empresaId_nome_key" ON "Insumo"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "PrecoHistorico_insumoId_cotadoEm_idx" ON "PrecoHistorico"("insumoId", "cotadoEm");

-- CreateIndex
CREATE INDEX "SolicitacaoCompra_obraId_status_idx" ON "SolicitacaoCompra"("obraId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemCompra_solicitacaoId_key" ON "OrdemCompra"("solicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemCompra_numero_key" ON "OrdemCompra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Despesa_ordemCompraId_key" ON "Despesa"("ordemCompraId");

-- CreateIndex
CREATE INDEX "Despesa_obraId_competencia_idx" ON "Despesa"("obraId", "competencia");

-- CreateIndex
CREATE INDEX "Foto_obraId_tiradaEm_idx" ON "Foto"("obraId", "tiradaEm");

-- CreateIndex
CREATE INDEX "Ocorrencia_obraId_status_idx" ON "Ocorrencia"("obraId", "status");

-- CreateIndex
CREATE INDEX "Documento_obraId_categoria_idx" ON "Documento"("obraId", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoVersao_documentoId_versao_key" ON "DocumentoVersao"("documentoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoCliente_obraId_key" ON "ContratoCliente"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaCliente_contratoId_numero_key" ON "ParcelaCliente"("contratoId", "numero");

-- AddForeignKey
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraMembro" ADD CONSTRAINT "ObraMembro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObraMembro" ADD CONSTRAINT "ObraMembro_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPonto" ADD CONSTRAINT "RegistroPonto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPonto" ADD CONSTRAINT "RegistroPonto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioObra" ADD CONSTRAINT "DiarioObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioEfetivo" ADD CONSTRAINT "DiarioEfetivo_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioAtividade" ADD CONSTRAINT "DiarioAtividade_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioAtividade" ADD CONSTRAINT "DiarioAtividade_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioEquipamento" ADD CONSTRAINT "DiarioEquipamento_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioEquipamento" ADD CONSTRAINT "DiarioEquipamento_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarioVisita" ADD CONSTRAINT "DiarioVisita_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicaoItem" ADD CONSTRAINT "MedicaoItem_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "Medicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicaoItem" ADD CONSTRAINT "MedicaoItem_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoFornecedor" ADD CONSTRAINT "AvaliacaoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoHistorico" ADD CONSTRAINT "PrecoHistorico_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoHistorico" ADD CONSTRAINT "PrecoHistorico_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCompra" ADD CONSTRAINT "SolicitacaoCompra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCompra" ADD CONSTRAINT "SolicitacaoCompra_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoItem" ADD CONSTRAINT "SolicitacaoItem_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoItem" ADD CONSTRAINT "SolicitacaoItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemCompra" ADD CONSTRAINT "OrdemCompra_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemCompra" ADD CONSTRAINT "OrdemCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_ordemCompraId_fkey" FOREIGN KEY ("ordemCompraId") REFERENCES "OrdemCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "SolicitacaoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_diarioId_fkey" FOREIGN KEY ("diarioId") REFERENCES "DiarioObra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaTratativa" ADD CONSTRAINT "OcorrenciaTratativa_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVersao" ADD CONSTRAINT "DocumentoVersao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoEquipamento" ADD CONSTRAINT "UsoEquipamento_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoEquipamento" ADD CONSTRAINT "UsoEquipamento_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locacao" ADD CONSTRAINT "Locacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treinamento" ADD CONSTRAINT "Treinamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiEntrega" ADD CONSTRAINT "EpiEntrega_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspecaoSeguranca" ADD CONSTRAINT "InspecaoSeguranca_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoCliente" ADD CONSTRAINT "ContratoCliente_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaCliente" ADD CONSTRAINT "ParcelaCliente_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
