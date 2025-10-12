#!/bin/bash

# ========================================
# Deploy Automatizado - plomes-produtos-precos
# Usa Vercel CLI (sem precisar de VERCEL_TOKEN)
# ========================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_NAME="plomes-produtos-precos"

echo -e "${BLUE}🚀 Deploy Automatizado: ${PROJECT_NAME}${NC}\n"

# ========================================
# 1. Verificar Login no Vercel CLI
# ========================================
echo -e "${YELLOW}🔐 Verificando autenticação no Vercel...${NC}"

if ! vercel whoami &> /dev/null; then
    echo -e "${RED}❌ Você não está logado no Vercel CLI${NC}"
    echo -e "${YELLOW}Execute: vercel login${NC}\n"
    exit 1
fi

user=$(vercel whoami)
echo -e "${GREEN}✅ Logado como: ${user}${NC}\n"

# ========================================
# 2. Verificar se estamos no diretório correto
# ========================================
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script do diretório frontend-v0${NC}\n"
    exit 1
fi

# ========================================
# 3. Carregar variáveis do .env.production
# ========================================
echo -e "${BLUE}📋 Carregando variáveis de ambiente de .env.production...${NC}"

if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Arquivo .env.production não encontrado${NC}\n"
    exit 1
fi

source .env.production
echo -e "${GREEN}✅ Variáveis carregadas${NC}\n"

# ========================================
# 4. Configurar Variáveis via Vercel CLI
# ========================================
echo -e "${BLUE}⚙️  Configurando variáveis de ambiente...${NC}"
echo -e "${YELLOW}⚠️  Este passo pode ser interativo se as variáveis não existirem${NC}\n"

# Função para adicionar variável
add_env_var() {
    local key=$1
    local value=$2

    echo -e "${YELLOW}  → ${key}${NC}"

    # Usar echo para passar o valor automaticamente para o comando
    echo "$value" | vercel env add "$key" production preview development \
        --yes \
        --sensitive 2>&1 | grep -v "^>" || true

    echo -e "${GREEN}    ✓ ${key} configurado${NC}"
}

# Configurar todas as variáveis
add_env_var "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
add_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
add_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
add_env_var "JWT_SECRET" "$JWT_SECRET"
add_env_var "PLOOME_API_KEY" "$PLOOME_API_KEY"
add_env_var "PLOOME_BASE_URL" "$PLOOME_BASE_URL"
add_env_var "CLIENT_TAG_ID" "$CLIENT_TAG_ID"
add_env_var "GOOGLE_MAPS_API_KEY" "$GOOGLE_MAPS_API_KEY"
add_env_var "NODE_ENV" "production"
add_env_var "NEXT_TELEMETRY_DISABLED" "1"
add_env_var "NEXT_PUBLIC_OPTIMIZE_CSS" "true"

echo -e "${GREEN}\n✅ Variáveis de ambiente configuradas${NC}\n"

# ========================================
# 5. Deploy para Produção
# ========================================
echo -e "${BLUE}🚀 Iniciando deploy para produção...${NC}"
echo -e "${YELLOW}⏳ O build será feito remotamente no Vercel${NC}"
echo -e "${YELLOW}💡 Isso pode levar 2-5 minutos${NC}\n"

# Deploy com --yes para aceitar automaticamente
vercel deploy --prod --yes

deploy_status=$?

if [ $deploy_status -eq 0 ]; then
    echo -e "${GREEN}\n✅ Deploy concluído com sucesso!${NC}"
else
    echo -e "${RED}\n❌ Erro no deploy (código: ${deploy_status})${NC}\n"
    exit 1
fi

# ========================================
# 6. Verificar Deployments
# ========================================
echo -e "${BLUE}\n🔍 Verificando deployments...${NC}\n"

# Listar deployments recentes
vercel ls --json 2>&1 | head -20

echo -e "${GREEN}\n✨ Processo concluído!${NC}"
echo -e "${BLUE}🔗 Acesse: https://vercel.com/dashboard${NC}"
echo -e "${BLUE}📊 Deployments: https://vercel.com/csorodrigo-2569s-projects/${PROJECT_NAME}/deployments${NC}\n"
