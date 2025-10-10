#!/bin/bash

# Script para iniciar o dashboard do cliente

echo "🚀 Iniciando Dashboard do Cliente..."

# Matar processos antigos
echo "🧹 Limpando portas..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3003 | xargs kill -9 2>/dev/null
sleep 2

# Verificar backend
echo "🔌 Verificando backend..."
if ! lsof -i :3001 > /dev/null 2>&1; then
    echo "⚠️ Backend não está rodando. Iniciando..."
    cd ../
    PORT=3001 node backend/server.js &
    sleep 3
    cd frontend-v0
else
    echo "✅ Backend já está rodando na porta 3001"
fi

# Iniciar frontend
echo "🎨 Iniciando frontend..."
PORT=3000 npm run dev &

sleep 5

# Abrir navegador
echo "🌐 Abrindo dashboard no navegador..."
open http://localhost:3000/dashboard/cliente

echo "✅ Dashboard iniciado!"
echo "📍 Acesse: http://localhost:3000/dashboard/cliente"
echo ""
echo "🔍 Para buscar cliente:"
echo "   - Digite 'CIARA' ou 'CIA MAQUINAS'"
echo "   - Clique no card do cliente para ver histórico de pedidos"