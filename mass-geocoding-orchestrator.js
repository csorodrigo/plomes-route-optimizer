const fetch = require('node-fetch');

async function massGeocoding() {
  console.log('🎯 ORCHESTRATOR: Iniciando geocodificação em massa via backend API');
  console.log('📅', new Date().toLocaleString());

  let processedBatch = 0;
  let totalProcessed = 0;
  let totalGeocoded = 0;
  let batchSize = 50;

  // Run multiple batches until all customers are processed
  while (processedBatch < 25) { // Max 25 batches = 1250 customers
    try {
      console.log(`\n🔄 BATCH ${processedBatch + 1}: Processando geocodificação em lote`);

      const response = await fetch('http://localhost:3001/api/geocoding/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchSize: batchSize,
          skipExisting: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Resultado do batch:', result);

        if (result.processed === 0) {
          console.log('🎉 FINALIZADO: Não há mais clientes para processar!');
          break;
        }

        totalProcessed += result.processed || 0;
        totalGeocoded += result.geocoded || 0;

        console.log('📊 PROGRESSO ACUMULADO:', {
          batch: processedBatch + 1,
          processedThisBatch: result.processed,
          geocodedThisBatch: result.geocoded,
          totalProcessed,
          totalGeocoded
        });

        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 2000));

      } else {
        console.error('❌ Erro na API de geocodificação:', response.status);
        break;
      }

      processedBatch++;

    } catch (error) {
      console.error('❌ Erro no batch:', error.message);
      break;
    }
  }

  console.log('\n🏆 GEOCODIFICAÇÃO MASSIVA COMPLETA');
  console.log('✅ Total processado:', totalProcessed);
  console.log('🎯 Total geocodificado:', totalGeocoded);
  console.log('📅 Finalizado em:', new Date().toLocaleString());

  // Final statistics
  try {
    const statsResponse = await fetch('http://localhost:3001/api/statistics');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('\n📊 ESTATÍSTICAS FINAIS:', stats);
    }
  } catch (error) {
    console.log('⚠️ Não foi possível obter estatísticas finais:', error.message);
  }
}

massGeocoding().catch(console.error);