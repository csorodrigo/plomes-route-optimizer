#!/bin/bash

# ========================================
# Auto-Configure and Deploy to Vercel
# plomes-produtos-precos Project
# ========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project Configuration
PROJECT_ID="prj_p67yLwIObBufyHtToBODY3Pip9ap"
TEAM_ID="team_2Z0REfaA6EnDHlFdjlLlRHcA"
PROJECT_NAME="plomes-produtos-precos"

echo -e "${BLUE}🚀 Iniciando configuração automática do projeto ${PROJECT_NAME}${NC}\n"

# ========================================
# 1. Verificar VERCEL_TOKEN
# ========================================
echo -e "${YELLOW}🔐 Verificando VERCEL_TOKEN...${NC}"

if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${RED}❌ Erro: VERCEL_TOKEN não está definido${NC}"
    echo -e "${YELLOW}📝 Configure com: export VERCEL_TOKEN=seu_token${NC}"
    echo -e "${YELLOW}💡 Obtenha em: https://vercel.com/account/tokens${NC}"
    exit 1
fi

echo -e "${GREEN}✅ VERCEL_TOKEN encontrado${NC}\n"

# ========================================
# 2. Configurar Variáveis de Ambiente
# ========================================
echo -e "${BLUE}📝 Configurando variáveis de ambiente via API...${NC}"

# Read environment variables from .env.production
source .env.production

# Function to create/update environment variable
create_env_var() {
    local key=$1
    local value=$2
    local type=${3:-"encrypted"}  # default to encrypted

    echo -e "${YELLOW}  → Configurando ${key}...${NC}"

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"key\": \"${key}\",
            \"value\": \"${value}\",
            \"type\": \"${type}\",
            \"target\": [\"production\", \"preview\", \"development\"]
        }")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}    ✅ ${key} configurado${NC}"
    else
        echo -e "${RED}    ❌ Erro ao configurar ${key}: HTTP ${http_code}${NC}"
        echo -e "${RED}    Response: ${body}${NC}"
    fi
}

# Configure all environment variables
create_env_var "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL" "plain"
create_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "encrypted"
create_env_var "SUPABASE_URL" "$SUPABASE_URL" "plain"
create_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "encrypted"
create_env_var "JWT_SECRET" "$JWT_SECRET" "encrypted"
create_env_var "PLOOME_API_KEY" "$PLOOME_API_KEY" "encrypted"
create_env_var "PLOOME_BASE_URL" "$PLOOME_BASE_URL" "plain"
create_env_var "CLIENT_TAG_ID" "$CLIENT_TAG_ID" "plain"
create_env_var "GOOGLE_MAPS_API_KEY" "$GOOGLE_MAPS_API_KEY" "encrypted"
create_env_var "NODE_ENV" "production" "plain"
create_env_var "NEXT_TELEMETRY_DISABLED" "1" "plain"
create_env_var "NEXT_PUBLIC_OPTIMIZE_CSS" "true" "plain"

echo -e "${GREEN}\n✅ Variáveis de ambiente configuradas${NC}\n"

# ========================================
# 3. Atualizar Project Settings
# ========================================
echo -e "${BLUE}⚙️  Atualizando configurações do projeto...${NC}"

response=$(curl -s -w "\n%{http_code}" -X PATCH \
    "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "framework": "nextjs",
        "rootDirectory": "frontend-v0",
        "buildCommand": "npm run build",
        "installCommand": "npm install --legacy-peer-deps",
        "outputDirectory": ".next",
        "nodeVersion": "22.x"
    }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Configurações do projeto atualizadas${NC}\n"
else
    echo -e "${RED}❌ Erro ao atualizar projeto: HTTP ${http_code}${NC}"
    echo -e "${RED}Response: ${body}${NC}\n"
fi

# ========================================
# 4. Deploy via Vercel CLI
# ========================================
echo -e "${BLUE}🚀 Iniciando deploy remoto...${NC}"
echo -e "${YELLOW}⏳ O build será feito nos servidores do Vercel (não local)${NC}\n"

# Deploy to production
vercel deploy --prod \
    --yes \
    --token "$VERCEL_TOKEN" \
    --scope "$TEAM_ID" \
    --name "$PROJECT_NAME"

deploy_exit_code=$?

if [ $deploy_exit_code -eq 0 ]; then
    echo -e "${GREEN}\n✅ Deploy iniciado com sucesso!${NC}"
    echo -e "${YELLOW}⏳ Aguarde o build ser concluído nos servidores do Vercel${NC}"
    echo -e "${BLUE}🔗 Acompanhe em: https://vercel.com/${TEAM_ID/team_/}/${PROJECT_NAME}${NC}\n"
else
    echo -e "${RED}\n❌ Erro ao iniciar deploy (código: ${deploy_exit_code})${NC}\n"
    exit 1
fi

# ========================================
# 5. Aguardar e Verificar Deploy
# ========================================
echo -e "${BLUE}🔍 Verificando status do deployment...${NC}\n"

sleep 5  # Wait a bit for deployment to register

# Get latest deployment
response=$(curl -s -X GET \
    "https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=1" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}")

deployment_url=$(echo "$response" | grep -o '"url":"[^"]*"' | head -1 | sed 's/"url":"\(.*\)"/\1/')

if [ -n "$deployment_url" ]; then
    echo -e "${GREEN}✅ Deployment URL: https://${deployment_url}${NC}"
    echo -e "${BLUE}📊 Status: Aguardando build remoto${NC}"
    echo -e "${YELLOW}⏰ O build pode levar 2-5 minutos${NC}\n"

    echo -e "${BLUE}🔗 Links úteis:${NC}"
    echo -e "   Dashboard: https://vercel.com/${TEAM_ID/team_/}/${PROJECT_NAME}"
    echo -e "   Deployments: https://vercel.com/${TEAM_ID/team_/}/${PROJECT_NAME}/deployments"
    echo -e "   Settings: https://vercel.com/${TEAM_ID/team_/}/${PROJECT_NAME}/settings\n"
else
    echo -e "${YELLOW}⚠️  Deployment URL não encontrado ainda${NC}"
    echo -e "${BLUE}🔗 Verifique em: https://vercel.com/${TEAM_ID/team_/}/${PROJECT_NAME}/deployments${NC}\n"
fi

echo -e "${GREEN}✨ Configuração e deploy concluídos!${NC}\n"
