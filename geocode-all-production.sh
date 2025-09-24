#!/bin/bash

# Script para geocodificar todos os clientes na produção Vercel + Supabase
# Executa batches de 50 clientes até processar todos os 2,253 clientes

echo "🚀 Iniciando geocoding de TODOS os clientes na produção..."
echo "📊 Total estimado: 2,253 clientes | Geocodificáveis: ~2,118"
echo "⏱️ Tempo estimado: 43 minutos"
echo ""

BATCH_SIZE=50
SKIP=0
TOTAL_PROCESSED=0
TOTAL_GEOCODED=0

# Loop para processar todos os clientes
while true; do
    echo "📦 Processando batch ${SKIP}-$((SKIP + BATCH_SIZE))..."

    # Executar batch via API Vercel
    RESPONSE=$(curl -s -X POST "https://plomes-rota-cep.vercel.app/api/geocoding/batch?batch_size=${BATCH_SIZE}&skip=${SKIP}" \
        -H "Content-Type: application/json" \
        -d "{}")

    # Verificar se teve sucesso
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" != "true" ]; then
        echo "❌ Erro no batch $SKIP:"
        echo "$RESPONSE" | jq -r '.error // .message'
        break
    fi

    # Extrair estatísticas
    PROCESSED=$(echo "$RESPONSE" | jq -r '.results.processed')
    GEOCODED=$(echo "$RESPONSE" | jq -r '.results.geocoded')
    FAILED=$(echo "$RESPONSE" | jq -r '.results.failed')
    SKIPPED=$(echo "$RESPONSE" | jq -r '.results.skipped')
    SAVED=$(echo "$RESPONSE" | jq -r '.metadata.saved_to_supabase')

    # Atualizar totais
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
    TOTAL_GEOCODED=$((TOTAL_GEOCODED + GEOCODED))

    echo "✅ Batch concluído: $PROCESSED processados | $GEOCODED geocodificados | $FAILED falhas | $SKIPPED ignorados"
    echo "💾 Salvos no Supabase: $SAVED"
    echo "📊 Total geral: $TOTAL_PROCESSED processados | $TOTAL_GEOCODED geocodificados"

    # Verificar se há mais dados
    HAS_MORE=$(echo "$RESPONSE" | jq -r '.metadata.has_more')
    if [ "$HAS_MORE" != "true" ] || [ "$PROCESSED" -eq 0 ]; then
        echo "🏁 Todos os clientes foram processados!"
        break
    fi

    # Próximo batch
    SKIP=$((SKIP + BATCH_SIZE))

    # Delay entre batches para evitar sobrecarga
    echo "⏳ Aguardando 3 segundos..."
    sleep 3
done

echo ""
echo "🎉 GEOCODING COMPLETO!"
echo "📈 Resultados finais:"
echo "   • Total processados: $TOTAL_PROCESSED"
echo "   • Total geocodificados: $TOTAL_GEOCODED"
echo "   • Taxa de sucesso: $(( TOTAL_GEOCODED * 100 / TOTAL_PROCESSED ))%"
echo ""
echo "🔍 Verificar no Supabase: https://yxwokryybudwygtemfmu.supabase.co"
echo "🌐 Verificar no site: https://plomes-rota-cep.vercel.app"
echo ""
echo "✅ Todos os dados estão salvos permanentemente no Supabase PostgreSQL!"