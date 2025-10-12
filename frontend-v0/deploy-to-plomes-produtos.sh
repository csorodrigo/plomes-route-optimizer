#!/bin/bash

# Deploy script para o projeto plomes-produtos-precos
# Este script configura e faz o deploy do frontend para o Vercel

echo "🚀 Iniciando deploy para plomes-produtos-precos..."

# Variáveis
PROJECT_NAME="plomes-produtos-precos"
TEAM_ID="team_2Z0REfaA6EnDHlFdjlLlRHcA"
PROJECT_ID="prj_p67yLwIObBufyHtToBODY3Pip9ap"

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Este script deve ser executado no diretório frontend-v0"
    exit 1
fi

echo "📁 Diretório correto verificado"

# Verificar se o Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Erro: Vercel CLI não está instalado"
    echo "Execute: npm install -g vercel"
    exit 1
fi

echo "✅ Vercel CLI encontrado"

# Configurar variáveis de ambiente no Vercel
echo "🔧 Configurando variáveis de ambiente no Vercel..."

# Ler variáveis do .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Erro: Arquivo .env.production não encontrado"
    exit 1
fi

echo "📋 Arquivo .env.production encontrado"

# Fazer deploy usando Vercel CLI (sem build local)
echo "🚀 Iniciando deploy remoto (build será feito no Vercel)..."

# Usar vercel deploy com --force para forçar novo deploy
vercel deploy --prod \
    --yes \
    --force \
    --token "$VERCEL_TOKEN" \
    --scope "$TEAM_ID"

if [ $? -eq 0 ]; then
    echo "✅ Deploy iniciado com sucesso!"
    echo "📊 Aguarde o build ser concluído no Vercel"
    echo "🔗 Acesse: https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos"
else
    echo "❌ Erro ao iniciar deploy"
    exit 1
fi
