#!/bin/bash

# Script para verificar se a geocodificação foi completada
LOG_FILE="/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/geocoding_progress.log"

echo "=== VERIFICAÇÃO DE CONCLUSÃO ==="
echo "Data/Hora: $(date)"

if [ -f "$LOG_FILE" ]; then
    # Verificar se há mensagem de conclusão
    if grep -q "GEOCODIFICAÇÃO COMPLETA" "$LOG_FILE"; then
        echo "🎉 GEOCODIFICAÇÃO COMPLETADA!"

        # Extrair estatísticas finais
        echo ""
        echo "=== ESTATÍSTICAS FINAIS ==="
        grep -A 10 "GEOCODIFICAÇÃO COMPLETA" "$LOG_FILE" | head -15

    else
        echo "⏳ Geocodificação ainda em progresso..."

        # Mostrar progresso atual
        last_progress=$(tail -20 "$LOG_FILE" | grep "📈 Progresso" | tail -1)
        last_total=$(tail -20 "$LOG_FILE" | grep "📊 Total acumulado" | tail -1)

        echo "Progresso atual: $last_progress"
        echo "Total atual: $last_total"

        # Estimar tempo restante
        if echo "$last_progress" | grep -q "Progresso:"; then
            current_percent=$(echo "$last_progress" | grep -o '[0-9]*%' | grep -o '[0-9]*')
            if [ ! -z "$current_percent" ] && [ "$current_percent" -gt 0 ]; then
                # Assumindo que começou há ~6 minutos e está em $current_percent%
                elapsed_minutes=6
                rate=$((current_percent / elapsed_minutes))
                remaining_percent=$((100 - current_percent))
                if [ "$rate" -gt 0 ]; then
                    estimated_remaining=$((remaining_percent / rate))
                    echo "Tempo estimado restante: ~$estimated_remaining minutos"
                fi
            fi
        fi
    fi
else
    echo "❌ Arquivo de log não encontrado!"
fi