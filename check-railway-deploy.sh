#!/bin/bash

# Script para verificar o status do deploy no Railway
echo "🚀 Verificando status do deploy Railway..."

# Verificar se o commit foi feito
echo "📋 Último commit:"
git log -1 --oneline

echo ""
echo "🌐 Testando endpoint Railway..."

# URL do projeto Railway (baseado no project ID fornecido)
RAILWAY_URL="https://plomes-rota-cep-production.up.railway.app"

# Verificar se o site está respondendo
echo "Testing $RAILWAY_URL..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" "$RAILWAY_URL" || echo "❌ Site não está respondendo"

echo ""
echo "🔍 Verificando se está servindo a versão correta..."

# Baixar a página inicial e verificar se contém PT-BR
response=$(curl -s "$RAILWAY_URL" 2>/dev/null)
if [[ $response == *"pt-BR"* ]]; then
    echo "✅ Detectado lang='pt-BR' na página"
else
    echo "❌ PROBLEMA: Não encontrado lang='pt-BR'"
fi

if [[ $response == *"Otimizador de Rotas"* ]]; then
    echo "✅ Detectado título em português"
else
    echo "❌ PROBLEMA: Título não está em português"
fi

if [[ $response == *"CIA MÁQUINAS"* ]] || [[ $response == *"logo.png"* ]]; then
    echo "✅ Logo CIA MÁQUINAS detectado"
else
    echo "❌ PROBLEMA: Logo CIA MÁQUINAS não encontrado"
fi

echo ""
echo "📊 Status resumido:"
echo "- Deploy foi triggerado pelo commit"
echo "- Railway deve estar fazendo rebuild agora"
echo "- Aguardar 5-10 minutos para propagação"
echo ""
echo "🔗 Acesse: $RAILWAY_URL"
echo "📱 Dashboard Railway: https://railway.app/project/799c5228-83f4-4c93-ba9e-9794f1f169be"