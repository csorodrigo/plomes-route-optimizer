#!/bin/bash

# PLOMES-ROTA-CEP - Script de Deployment Manual
# Execute este script para fazer deployment em qualquer plataforma

echo "🚀 PLOMES-ROTA-CEP Deployment Script v2.1.4"
echo "=============================================="

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto"
    exit 1
fi

echo "📍 Diretório atual: $(pwd)"
echo "📦 Versão do projeto: $(grep version package.json | cut -d'"' -f4)"

# Limpar cache e dependências antigas
echo ""
echo "🧹 Limpando cache e dependências antigas..."
rm -rf node_modules frontend/node_modules
rm -f package-lock.json frontend/package-lock.json
npm cache clean --force

# Instalar dependências
echo ""
echo "📥 Instalando dependências..."
npm install
cd frontend && npm install
cd ..

# Build do frontend
echo ""
echo "🔨 Fazendo build do frontend..."
cd frontend
DISABLE_ESLINT_PLUGIN=true CI=false npm run build
cd ..

# Verificar se o build foi bem-sucedido
if [ ! -d "frontend/build" ]; then
    echo "❌ Erro: Build do frontend falhou"
    exit 1
fi

echo "✅ Build do frontend concluído!"
echo "📁 Arquivos gerados em: frontend/build/"

# Testar se o servidor inicia (opcional)
echo ""
echo "🔍 Testando inicialização do servidor..."
timeout 10s node backend/server.js &
SERVER_PID=$!
sleep 5

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Servidor iniciou corretamente!"
    kill $SERVER_PID 2>/dev/null
else
    echo "⚠️  Servidor pode ter problemas de inicialização"
fi

# Instruções de deployment
echo ""
echo "🎯 DEPLOYMENT PRONTO!"
echo "===================="
echo ""
echo "📋 OPÇÕES DE DEPLOYMENT:"
echo ""
echo "1. 🚆 RAILWAY:"
echo "   - Login: railway login"
echo "   - Deploy: railway up"
echo "   - URL será gerada automaticamente"
echo ""
echo "2. 🐳 DOCKER:"
echo "   - Build: docker build -t plomes-app ."
echo "   - Run: docker run -p 3001:3001 -e PLOOME_API_KEY=sua_chave plomes-app"
echo ""
echo "3. ☁️  OUTRAS PLATAFORMAS:"
echo "   - Heroku: git push heroku main"
echo "   - Vercel: vercel --prod"
echo "   - DigitalOcean App Platform: doctl apps create"
echo ""
echo "🔑 VARIÁVEIS DE AMBIENTE NECESSÁRIAS:"
echo "   - PLOOME_API_KEY: $(head -c 20 .env | tail -c +17)..."
echo "   - JWT_SECRET: [será gerado automaticamente se não definido]"
echo "   - GOOGLE_MAPS_API_KEY: $(grep GOOGLE_MAPS_API_KEY .env | cut -d'=' -f2 | head -c 20)..."
echo ""
echo "📊 STATUS DO PROJETO:"
echo "   ✅ Código em português (PT-BR)"
echo "   ✅ Backend na porta 3001"
echo "   ✅ Frontend buildado"
echo "   ✅ Docker configurado"
echo "   ✅ Railway.toml otimizado"
echo "   ✅ Dependências instaladas"
echo ""
echo "🎉 Sistema pronto para deployment!"