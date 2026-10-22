# Obra Manager — Fases 1 e 2

## Rodar localmente
```bash
cp .env.example .env          # preencha NEXTAUTH_SECRET, ENCRYPTION_KEY e HASH_KEY (openssl rand -hex 32)
bash scripts/preparar-migrations.sh   # sobe o Postgres, instala e gera prisma/migrations
npm run db:seed               # dados de demonstração
npm test                      # testes unitários
npm run dev                   # http://localhost:3000
```
Logins de demo (senha `Demo@12345`): dono@, engenheiro@, encarregado@, fiscal@, cliente@, compras@ `demo.com`.

## O que já existe
| Peça | Arquivo |
|---|---|
| Schema completo (13 módulos) | `prisma/schema.prisma` |
| Login (bcrypt, bloqueio, 2FA TOTP opcional) | `src/lib/auth/options.ts` |
| Matriz de permissões (5 perfis) | `src/lib/auth/permissions.ts` |
| Acesso por obra (anti-IDOR) | `src/lib/auth/guard.ts` |
| Criptografia CPF/banco (AES-256-GCM) | `src/lib/crypto.ts` |
| Auditoria sem dados sensíveis | `src/lib/audit.ts` |
| Raio GPS do ponto, horas extras | `src/lib/geo.ts`, `src/lib/jornada.ts` |
| Fluxo de aprovação de compras | `src/lib/compras.ts` |
| Seed e CI | `prisma/seed.ts`, `.github/workflows/ci.yml` |

## Regras de ouro para os próximos módulos
1. Toda rota `/api/obras/[id]/...` chama `exigirPerfilNaObra()` e depois `assertCan()`.
2. Toda ação crítica chama `registrarAuditoria()`.
3. CPF e dados bancários só entram/saem via `crypto.ts`.

## Próximos passos (ordem da especificação)
Obras (CRUD + painel) → Usuários → Ponto (PWA + câmera + GPS) → Diário → Etapas/Gantt → Compras → Financeiro.


## Fase 2 (telas)
- `/login` (com etapa do código 2FA, quando a conta tiver ativado), menu lateral (desktop) e barra inferior (celular), tema claro/escuro
- `/dashboard`: resumo e cartões de cada obra (avanço físico, custo, semáforo do prazo)
- `/obras`, `/obras/nova` (só o dono), `/obras/[id]` (painel, etapas, mapa, equipe, mudança de situação)
- `/perfil` e `/perfil/2fa` (QR code para o aplicativo autenticador)

Para ver: `npm install` e `npm run dev`, abrir http://localhost:3000.

## Fase 3a — Ponto por foto
- `/obras/[id]/ponto`: bater entrada, almoço e saída; entrada e saída pedem **foto** (câmera do celular) e **GPS**
- Valida o raio da obra (padrão 150 m); fora do raio, o ponto é recusado
- Horário gravado pelo servidor (fuso de Belém), foto reduzida a ~640 px, tudo auditado
- Cadastro de funcionários (CPF criptografado) e botão para marcar a localização da obra
- Fotos ficam no banco por enquanto. Quando o volume crescer, migrar para Cloudflare R2 (campos `*FotoUrl` já aceitam URL).
- **Não há mudança no banco**: não precisa rodar `prisma db push` nem seed de novo.

## Fase 3b — Diário de obra
- `/obras/[id]/diario`: situação de hoje, dias úteis sem diário concluído (alerta), histórico de 60 dias e gerador de relatório
- `/obras/[id]/diario/AAAA-MM-DD`: diário do dia (turno: manhã, tarde ou dia inteiro)
  - **Preenchimento automático:** tempo e temperatura (Open-Meteo, pela localização da obra), equipe (vinda do controle de ponto), situação da obra, etapas em andamento
  - **Conclusão obrigatória:** só conclui com temperatura, resumo (20+ letras), equipe, 1+ atividade e 3+ fotos (dia de paralisação total: 1 foto e explicação). Conferido no servidor.
  - Concluído = assinado (nome + hora) e bloqueado; só engenheiro/dono reabre
- `/obras/[id]/diario/relatorio?de=&ate=`: relatório do período (máx. 31 dias) para imprimir ou salvar em PDF, com ou sem fotos
- **Sem mudança no banco.** O tempo usa a API gratuita Open-Meteo (uso não comercial).

## Fase 3c — Etapas, cronograma e medições
- `/obras/[id]/etapas`: lista em árvore (etapa > sub-etapa > sub-sub-etapa), Gantt (planejado x realizado, hoje, atrasadas em vermelho), andamento informado direto na lista
- Etapas-pai são calculadas: orçamento = soma das filhas, % = média ponderada pelo valor, datas = menor início e maior fim
- Status automático: concluída (100%), atrasada (prazo passou), em andamento, não iniciada; paralisada é marcada à mão
- "Criar etapas típicas de obra": modelo de 11 etapas distribuído pelo prazo da obra
- `/obras/[id]/medicoes`: fechar medição do período (andamento atual − medição anterior) e boletim para imprimir ou salvar em PDF
- **Sem mudança no banco.**

## Fase 4 — Compras, pagamentos, voz e RDO

**Precisa de migração:** `20261021200000_compras_pagamentos` (chave PIX no fornecedor;
vencimento, favorecido e PIX na despesa). Rode `npm run db:deploy` antes de subir o código.

- `/obras/[id]/compras`: solicitação (encarregado) → aprovação (engenheiro; acima do
  limite da empresa, o dono) → ordem de compra com fornecedor e prazo de pagamento →
  enviada → entregue. Na entrega nasce a conta a pagar, com o PIX do fornecedor.
  Preço acima da média histórica do material aparece como alerta.
- `/pagamentos`: todas as obras com o que falta pagar, o vencido e o próximo vencimento;
  lista das contas com "Copiar PIX", QR code e "Marcar como paga". Cada conta é uma
  `Despesa` (`pagamento` nulo = em aberto), então entra no custo real da análise.
- Conta nova à mão ou **lida de documento**: PDF (texto extraído no servidor com `unpdf`),
  foto (QR do PIX e código de barras pelo leitor do celular; o resto pelo assistente, se
  `ASSISTENTE_API_KEY` estiver configurada) ou texto colado. PIX e linha digitável são
  conferidos pelos dígitos verificadores; a pessoa confere tudo antes de salvar.
- PIX: usa o "copia e cola" do documento ou gera um a partir da chave, já com o valor.
- `/fornecedores`: cadastro com chave PIX.
- **Perfil Comprador** (`compras@demo.com` no seed): setor de compras, em todas as obras.
  Abre pedido, emite e envia a ordem de compra, cadastra fornecedor e registra a entrega;
  não aprova e não vê o financeiro. Só o dono cria um Comprador. `/compras` reúne os
  pedidos em aberto de todas as obras (esperando ordem, a caminho, aguardando aprovação).
- **Comando de voz** (botão do microfone em todas as telas): "o que falta pagar",
  "pix do primeiro", "compras para aprovar", "abrir diário da obra X". O navegador faz
  a fala → texto; a interpretação é por regras (`src/lib/voz.ts`), sem IA.
  Funciona no Chrome/Edge e no Safari do iPhone; no Firefox, digite o comando.
- **RDO em PDF**: `/obras/[id]/diario/AAAA-MM-DD/rdo` — folha A4 no formato de papel
  (cabeçalho, clima por turno, mão de obra, equipamentos, serviços, fotos, assinaturas).
  `?branco=1` gera o modelo vazio para preencher à mão.

---

# Deploy — Vercel + Neon

## Antes do primeiro deploy (uma vez só, na sua máquina)

A pasta `prisma/migrations/` precisa existir e estar commitada. Sem ela o
Vercel não tem como criar as tabelas no Neon.

```bash
bash scripts/preparar-migrations.sh
git add prisma/migrations && git commit -m "migrations iniciais"
```

## 1. Neon

Crie o projeto na região **AWS São Paulo (`sa-east-1`)** — não aceite o padrão
dos Estados Unidos: cada consulta atravessaria o continente e o app é usado em
campo, no celular.

Copie as duas strings de conexão. A agrupada tem `-pooler` no host:

| Variável | String | Para quê |
|---|---|---|
| `DATABASE_URL` | `...@ep-xxx-pooler.sa-east-1.aws.neon.tech/...?sslmode=require&pgbouncer=true&connect_timeout=15` | tempo de execução |
| `DIRECT_URL` | `...@ep-xxx.sa-east-1.aws.neon.tech/...?sslmode=require` | migrations |

## 2. Vercel

Importe o repositório (detecta Next.js sozinho). O `vercel.json` já fixa a
região `gru1`, junto do banco.

Variáveis de ambiente, em Production **e** Preview:

```
DATABASE_URL     = <agrupada do Neon>
DIRECT_URL       = <direta do Neon>
NEXTAUTH_URL     = https://seu-dominio.vercel.app
NEXTAUTH_SECRET  = openssl rand -base64 32
ENCRYPTION_KEY   = openssl rand -hex 32
HASH_KEY         = openssl rand -hex 32
```

> **As duas últimas são irrecuperáveis.** Perder `ENCRYPTION_KEY` transforma
> todo CPF e dado bancário do banco em lixo — não existe recuperação. Trocar
> `HASH_KEY` faz a busca por CPF parar de encontrar os registros antigos.
> Guarde as duas num cofre antes de subir.

O `build` do `package.json` roda `prisma migrate deploy && prisma generate &&
next build` — as tabelas são criadas no primeiro deploy.

## 3. Primeiro acesso

Nunca rode `npm run db:seed` em produção: ele cria usuários com a senha
pública `Demo@12345`. Use o bootstrap, que cria só a empresa real, a
configuração e o primeiro administrador:

```bash
EMPRESA_NOME="Construtora X" ADMIN_NOME="Seu Nome" \
ADMIN_EMAIL="voce@empresa.com" ADMIN_SENHA="<12+ caracteres>" \
DATABASE_URL="<direta do Neon>" ENCRYPTION_KEY=... HASH_KEY=... \
npm run db:bootstrap
```

Entre com esse e-mail e senha. A verificação em duas etapas é **opcional**:
fica em Perfil → Verificação em duas etapas. Quem ativa passa a ter o código
pedido no login; quem não ativa entra só com e-mail e senha.

> Com dados reais de trabalhador no banco (CPF, foto de rosto, GPS), ative o
> 2FA pelo menos na conta do dono, que enxerga todas as obras.

## Limites conhecidos

- **Armazenamento.** As fotos vão em base64 dentro do Postgres (~310 KB cada).
  Uma obra com 30 funcionários gera ~60 fotos/dia entre ponto e diário: o
  plano gratuito do Neon (0,5 GB) estoura em cerca de 25 dias de uso real.
  Antes de cliente pagante, migrar para Cloudflare R2 ou S3 — os campos
  `*FotoUrl` já aceitam URL.
- **Hibernação.** No plano gratuito o Neon dorme; a primeira requisição depois
  de ociosidade demora um pouco mais. Em demonstração ao vivo, abra o app
  alguns minutos antes.
- **Deploys de preview.** `NEXTAUTH_URL` é fixa, então o login falha nas URLs
  geradas por preview. Aponte a Preview para uma URL fixa de homologação ou
  teste só em produção.
- **Conexões.** Se aparecer erro de limite de conexão, acrescente
  `&connection_limit=1` à `DATABASE_URL`.
- **Offline.** Ainda não existe service worker. Marcação de ponto depende de
  conexão no momento do toque — a maior lacuna para uso real em obra.
