#!/bin/bash

# Monitor Ploomes sync progress

LOGFILE="sync-full.log"

echo "📊 Monitorando sync do Ploomes..."
echo "======================================"
echo ""

# Check if sync is running
if ps aux | grep "step1-fetch-ploomes" | grep -v grep > /dev/null; then
  echo "✅ Sync está rodando (PID: $(pgrep -f step1-fetch-ploomes))"
else
  echo "❌ Sync não está rodando"
  exit 1
fi

echo ""

# Show last 10 lines
echo "📄 Últimas 10 linhas do log:"
echo "------------------------------"
tail -10 "$LOGFILE"

echo ""

# Count total deals fetched
if [ -f "$LOGFILE" ]; then
  TOTAL=$(grep "✅ Fetched" "$LOGFILE" | tail -1 | grep -o "total: [0-9]*" | grep -o "[0-9]*")
  PAGES=$(grep "🌐 Page" "$LOGFILE" | wc -l | tr -d ' ')

  if [ ! -z "$TOTAL" ]; then
    echo "📈 Progresso:"
    echo "  • Total de vendas: $TOTAL"
    echo "  • Páginas processadas: $PAGES"
    echo "  • Estimativa de conclusão: ~$((10228 / 50)) páginas (~$(((10228 - TOTAL) / 50)) páginas restantes)"
  fi
fi

echo ""
echo "💡 Comandos úteis:"
echo "  • Ver log completo: tail -f $LOGFILE"
echo "  • Matar processo: pkill -f step1-fetch-ploomes"
echo "  • Verificar checkpoint: ls -lh ploomes-deals-checkpoint.json"
