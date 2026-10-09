#!/usr/bin/env bash
# Gera a migration inicial versionada a partir do schema.
# Rode UMA VEZ na sua máquina, antes do primeiro deploy, e commite o resultado.
#
#   bash scripts/preparar-migrations.sh
#
# Depois disso o Vercel cria as tabelas sozinho no build (prisma migrate deploy).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Crie o .env primeiro:  cp .env.example .env  (e preencha as chaves)"
  exit 1
fi

if [ -d prisma/migrations ]; then
  echo "prisma/migrations já existe. Nada a fazer."
  exit 0
fi

echo "1/4 subindo o PostgreSQL local..."
docker compose up -d

echo "2/4 aguardando o banco aceitar conexão..."
for _ in $(seq 1 30); do
  docker compose exec -T db pg_isready -U obra >/dev/null 2>&1 && break
  sleep 1
done

echo "3/4 instalando dependências..."
npm ci

echo "4/4 gerando a migration inicial..."
npx prisma migrate dev --name init

echo
echo "Pronto. Agora commite:"
echo "   git add prisma/migrations && git commit -m 'migrations iniciais'"
