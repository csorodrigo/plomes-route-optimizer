#!/bin/bash

# PLOMES-ROTA-CEP Portuguese Translation Deployment Script
# Forces complete cache invalidation and fresh deployment to Railway

set -e

echo "🇧🇷 FORÇA IMPLANTAÇÃO PORTUGUÊS BRASILEIRO - PLOMES ROTA CEP 🇧🇷"
echo "======================================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Verificando configuração local...${NC}"

# Check if we're in the right directory
if [ ! -f "railway.toml" ]; then
    echo -e "${RED}❌ Erro: railway.toml não encontrado. Execute na raiz do projeto.${NC}"
    exit 1
fi

if [ ! -f "frontend/src/utils/translations.js" ]; then
    echo -e "${RED}❌ Erro: Arquivo de traduções não encontrado.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuração local verificada${NC}"

# Update timestamps to force rebuild
TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
BUILD_ID="pt-br-deployment-$TIMESTAMP"

echo -e "${BLUE}🔄 Atualizando timestamps para forçar rebuild...${NC}"

# Update the force rebuild file
cat > .railway-force-rebuild << EOF
# FORCE REBUILD - Portuguese Translation Deployment
# Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Version: 2.1.4-pt-br with complete Portuguese translations
# Reason: Force fresh deployment with Portuguese translations and CIA MÁQUINAS branding

FORCE_REBUILD=true
BUILD_ID=$BUILD_ID
CACHE_BUST=$TIMESTAMP
PORTUGUESE_TRANSLATIONS=true
CIA_MAQUINAS_BRANDING=true
FRONTEND_LANGUAGE=pt-BR
CLIENT_TAG_ID=40006184
EOF

echo -e "${GREEN}✅ Arquivo de força rebuild atualizado${NC}"

# Verify translations are in the source
echo -e "${BLUE}🔍 Verificando traduções em português no código fonte...${NC}"

if grep -q "CIA MÁQUINAS" frontend/src/utils/translations.js; then
    echo -e "${GREEN}✅ Branding CIA MÁQUINAS encontrado${NC}"
else
    echo -e "${RED}❌ Branding CIA MÁQUINAS não encontrado${NC}"
    exit 1
fi

if grep -q "Otimizador de Rotas" frontend/src/utils/translations.js; then
    echo -e "${GREEN}✅ Traduções em português encontradas${NC}"
else
    echo -e "${RED}❌ Traduções em português não encontradas${NC}"
    exit 1
fi

# Test build locally to verify translations
echo -e "${BLUE}🏗️ Testando build local para verificar traduções...${NC}"

cd frontend
npm run build > /dev/null 2>&1

if [ -f "build/static/js/main."*.js ]; then
    if grep -q "CIA" build/static/js/main.*.js; then
        echo -e "${GREEN}✅ Build local incluiu traduções CIA MÁQUINAS${NC}"
    else
        echo -e "${RED}❌ Build local não incluiu traduções${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Build local falhou${NC}"
    exit 1
fi

cd ..

echo -e "${BLUE}📝 Criando commit para forçar deployment...${NC}"

# Create a git commit to trigger deployment
git add .
git commit -m "🇧🇷 FORÇA DEPLOYMENT PT-BR: v2.1.4-pt-br com traduções completas

- Força invalidação completa de cache Railway
- Inclui todas as traduções portuguesas
- Branding CIA MÁQUINAS confirmado
- Build ID: $BUILD_ID
- Timestamp: $TIMESTAMP

🚀 Deploy para Railway com frontend em português

📋 Conteúdo incluído:
✅ Traduções completas em português brasileiro
✅ Branding CIA MÁQUINAS em todos os componentes
✅ Configuração de idioma pt-BR
✅ Cache invalidation forçada

🎯 Objetivo: Resolver problema de cache do Railway que serve versão inglesa antiga" || echo "Nada para commit (pode ser que já esteja atualizado)"

echo -e "${YELLOW}⚠️  INSTRUÇÕES PARA VERIFICAÇÃO PÓS-DEPLOYMENT:${NC}"
echo "1. Aguarde o deployment completar no Railway"
echo "2. Acesse a URL do frontend"
echo "3. Verifique se aparece 'Otimizador de Rotas' (português)"
echo "4. Verifique se aparece 'CIA MÁQUINAS' na marca"
echo "5. Verifique se o título da página está em português"

echo -e "${GREEN}🎉 Script de força deployment concluído!${NC}"
echo -e "${BLUE}🚀 Faça push para o Railway para ativar o deployment:${NC}"
echo -e "${YELLOW}   git push${NC}"

echo ""
echo -e "${BLUE}📊 RESUMO DA CONFIGURAÇÃO:${NC}"
echo "- Versão: 2.1.4-pt-br"
echo "- Build ID: $BUILD_ID"
echo "- Idioma: Português Brasileiro"
echo "- Branding: CIA MÁQUINAS"
echo "- Cache: Invalidado completamente"
echo ""
echo -e "${GREEN}✅ PRONTO PARA DEPLOYMENT!${NC}"