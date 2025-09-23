#!/bin/bash

echo "==================================="
echo "🚀 INICIANDO DASHBOARD PLOOMES"
echo "==================================="

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro."
    exit 1
fi

# Mostra versão do Node.js
echo "✅ Node.js $(node --version) encontrado"

# Navega para o diretório do projeto
cd "$(dirname "$0")"

# Lista as portas que vamos tentar
PORTS=(8080 3000 3001 8000 8888 9000)

for PORT in "${PORTS[@]}"; do
    echo "🔍 Verificando porta $PORT..."
    
    # Verifica se a porta está livre
    if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "✅ Porta $PORT disponível"
        echo "🚀 Iniciando servidor na porta $PORT..."
        echo ""
        echo "🌐 ACESSE O DASHBOARD EM:"
        echo "   http://localhost:$PORT"
        echo ""
        echo "📊 RECURSOS DISPONÍVEIS:"
        echo "   • Seletor de clientes"
        echo "   • Análise de preços por CEP"
        echo "   • Gráficos interativos"
        echo "   • Alertas em tempo real"
        echo "   • Dados regionais detalhados"
        echo ""
        echo "⏹️  Para parar o servidor: Ctrl+C"
        echo "==================================="
        
        # Inicia o servidor
        PORT=$PORT node server.js
        exit 0
    else
        echo "❌ Porta $PORT em uso"
    fi
done

echo "❌ Nenhuma porta disponível encontrada. Por favor, libere uma das portas: ${PORTS[*]}"
exit 1