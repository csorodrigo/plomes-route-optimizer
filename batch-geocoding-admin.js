const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  'https://yxwokryybudwygtemfmu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk'
);

async function startBatchGeocoding() {
  console.log('🔄 DATABASE ADMIN: INICIANDO GEOCODIFICAÇÃO EM MASSA');
  console.log('📅', new Date().toLocaleString());

  // Get customers that need geocoding
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, full_address, city, state, cep, geocoding_attempts')
    .is('latitude', null)
    .neq('geocoding_status', 'failed')
    .order('id')
    .limit(100); // Process in batches of 100

  if (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    return;
  }

  console.log('📊 Clientes para geocodificar neste batch:', customers.length);

  let processed = 0;
  let geocoded = 0;
  let failed = 0;

  for (const customer of customers) {
    try {
      const addressToGeocode = customer.full_address ||
        `${customer.city || ''}, ${customer.state || ''}, ${customer.cep || ''}`.trim();

      console.log(`🔍 [${processed + 1}/${customers.length}] ${customer.name} - ${addressToGeocode}`);

      // Call geocoding API
      const response = await fetch('http://localhost:3001/api/geocoding/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: addressToGeocode
        })
      });

      if (response.ok) {
        const geocodeResult = await response.json();

        if (geocodeResult.success && geocodeResult.coordinates) {
          // Update customer with coordinates
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              latitude: geocodeResult.coordinates.lat,
              longitude: geocodeResult.coordinates.lng,
              geocoding_status: 'success',
              geocoded_address: geocodeResult.address,
              geocoded_at: new Date().toISOString(),
              geocoding_attempts: (customer.geocoding_attempts || 0) + 1,
              last_geocoding_attempt: new Date().toISOString()
            })
            .eq('id', customer.id);

          if (!updateError) {
            console.log('✅ Geocodificado:', customer.name);
            geocoded++;
          } else {
            console.error('❌ Erro ao atualizar:', updateError);
            failed++;
          }
        } else {
          console.log('⚠️ Geocodificação falhou para:', customer.name);

          // Mark as failed if too many attempts
          const attempts = (customer.geocoding_attempts || 0) + 1;
          await supabase
            .from('customers')
            .update({
              geocoding_attempts: attempts,
              geocoding_status: attempts >= 3 ? 'failed' : 'pending',
              last_geocoding_attempt: new Date().toISOString()
            })
            .eq('id', customer.id);

          failed++;
        }
      } else {
        console.error('❌ Erro na API de geocodificação:', response.status);
        failed++;
      }

      processed++;

      // Rate limiting - wait 150ms between requests
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.error('❌ Erro no processamento de', customer.name, ':', error.message);
      failed++;
      processed++;
    }
  }

  console.log('\n📊 BATCH COMPLETO');
  console.log('✅ Processados:', processed);
  console.log('🎯 Geocodificados:', geocoded);
  console.log('❌ Falharam:', failed);
  console.log('📅 Finalizado em:', new Date().toLocaleString());

  // Check overall progress
  const { data: stats } = await supabase
    .from('customers')
    .select('*')
    .not('latitude', 'is', null);

  console.log('🏆 PROGRESSO TOTAL:', stats?.length || 0, '/ 2247 clientes geocodificados');
}

startBatchGeocoding().catch(console.error);