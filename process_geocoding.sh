#!/bin/bash

# PLOMES-ROTA-CEP - Geocodificação Completa de Todos os Clientes
# Processa 2,118 clientes em batches de 50
# Data: 2025-09-24

API_URL="https://plomes-rota-cep.vercel.app/api/geocoding/batch"
BATCH_SIZE=20
TOTAL_CLIENTS=2118
LOG_FILE="/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/geocoding_progress.log"
ERROR_LOG="/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/geocoding_errors.log"

# Limpar logs anteriores
> "$LOG_FILE"
> "$ERROR_LOG"

echo "=== INICIANDO GEOCODIFICAÇÃO COMPLETA ===" | tee -a "$LOG_FILE"
echo "Data/Hora: $(date)" | tee -a "$LOG_FILE"
echo "Total de clientes: $TOTAL_CLIENTS" | tee -a "$LOG_FILE"
echo "Batch size: $BATCH_SIZE" | tee -a "$LOG_FILE"
echo "Total de batches: $((($TOTAL_CLIENTS + $BATCH_SIZE - 1) / $BATCH_SIZE))" | tee -a "$LOG_FILE"
echo "===============================" | tee -a "$LOG_FILE"

# Variáveis de controle
skip=0
batch_count=0
total_processed=0
total_geocoded=0
total_failed=0

# Loop principal
while [ $skip -lt $TOTAL_CLIENTS ]; do
    batch_count=$((batch_count + 1))

    echo "Processando Batch $batch_count - Skip: $skip ($(date))" | tee -a "$LOG_FILE"

    # Fazer requisição com timeout
    response=$(curl -X POST "${API_URL}?batch_size=${BATCH_SIZE}&skip=${skip}" \
                    -H "Content-Type: application/json" \
                    -s --max-time 90)

    # Verificar se a resposta contém success:true
    if echo "$response" | grep -q '"success":true'; then
        # Extrair dados do JSON usando jq se disponível, senão usar grep
        if command -v jq >/dev/null 2>&1; then
            processed=$(echo "$response" | jq -r '.results.processed // 0')
            geocoded=$(echo "$response" | jq -r '.results.geocoded // 0')
            failed=$(echo "$response" | jq -r '.results.failed // 0')
            has_more=$(echo "$response" | jq -r '.metadata.has_more // false')
        else
            processed=$(echo "$response" | grep -o '"processed":[0-9]*' | cut -d: -f2)
            geocoded=$(echo "$response" | grep -o '"geocoded":[0-9]*' | cut -d: -f2)
            failed=$(echo "$response" | grep -o '"failed":[0-9]*' | cut -d: -f2)
            has_more=$(echo "$response" | grep -o '"has_more":[a-z]*' | cut -d: -f2)
        fi

        # Atualizar contadores
        total_processed=$((total_processed + processed))
        total_geocoded=$((total_geocoded + geocoded))
        total_failed=$((total_failed + failed))

        echo "  ✅ Batch $batch_count OK: $processed processados, $geocoded geocodificados, $failed falharam" | tee -a "$LOG_FILE"
        echo "  📊 Total acumulado: $total_processed processados, $total_geocoded geocodificados, $total_failed falharam" | tee -a "$LOG_FILE"

        # Verificar se há mais dados
        if [ "$has_more" = "false" ]; then
            echo "  🎯 Último batch processado!" | tee -a "$LOG_FILE"
            break
        fi

    else
        echo "  ❌ ERRO Batch $batch_count - Resposta inválida ou erro" | tee -a "$LOG_FILE" | tee -a "$ERROR_LOG"
        echo "  Response: $response" | tee -a "$ERROR_LOG"

        # Aguardar antes de tentar novamente
        echo "  ⏳ Aguardando 10 segundos antes de continuar..." | tee -a "$LOG_FILE"
        sleep 10
    fi

    # Próximo batch
    skip=$((skip + BATCH_SIZE))

    # Aguardar entre requests para não sobrecarregar
    sleep 1

    # Progress indicator
    progress=$((skip * 100 / TOTAL_CLIENTS))
    echo "  📈 Progresso: $progress% ($skip/$TOTAL_CLIENTS)" | tee -a "$LOG_FILE"
done

echo "===============================" | tee -a "$LOG_FILE"
echo "=== GEOCODIFICAÇÃO COMPLETA ===" | tee -a "$LOG_FILE"
echo "Data/Hora Final: $(date)" | tee -a "$LOG_FILE"
echo "Total de batches processados: $batch_count" | tee -a "$LOG_FILE"
echo "Total processados: $total_processed" | tee -a "$LOG_FILE"
echo "Total geocodificados: $total_geocoded" | tee -a "$LOG_FILE"
echo "Total falharam: $total_failed" | tee -a "$LOG_FILE"

if [ $total_failed -gt 0 ]; then
    success_rate=$((total_geocoded * 100 / total_processed))
    echo "Taxa de sucesso: $success_rate%" | tee -a "$LOG_FILE"
else
    echo "Taxa de sucesso: 100%" | tee -a "$LOG_FILE"
fi

echo "===============================" | tee -a "$LOG_FILE"