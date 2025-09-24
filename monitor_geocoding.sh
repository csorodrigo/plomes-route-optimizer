#!/bin/bash

# Monitor de progresso da geocodificação
LOG_FILE="/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/geocoding_progress.log"

echo "=== MONITOR DE GEOCODIFICAÇÃO ==="

if [ -f "$LOG_FILE" ]; then
    # Última linha com progresso
    last_progress=$(tail -20 "$LOG_FILE" | grep "📈 Progresso" | tail -1)
    echo "Último progresso: $last_progress"

    # Última linha com total acumulado
    last_total=$(tail -20 "$LOG_FILE" | grep "📊 Total acumulado" | tail -1)
    echo "Último total: $last_total"

    # Contagem total de batches processados
    batches_count=$(grep -c "✅ Batch" "$LOG_FILE")
    echo "Batches processados: $batches_count de 106"

    # Taxa de sucesso geral
    if echo "$last_total" | grep -q "Total acumulado"; then
        processed=$(echo "$last_total" | grep -o '[0-9]* processados' | grep -o '[0-9]*')
        geocoded=$(echo "$last_total" | grep -o '[0-9]* geocodificados' | grep -o '[0-9]*')
        if [ ! -z "$processed" ] && [ "$processed" -gt 0 ]; then
            success_rate=$((geocoded * 100 / processed))
            echo "Taxa de sucesso atual: $success_rate%"
        fi
    fi

    echo ""
    echo "Últimas 10 linhas do log:"
    tail -10 "$LOG_FILE"
else
    echo "Arquivo de log não encontrado: $LOG_FILE"
fi