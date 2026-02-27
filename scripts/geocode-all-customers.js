/**
 * Geocodifica todos os customers com CEP mas sem coordenadas.
 * Usa ViaCEP + Nominatim (1 req/seg para respeitar rate limit).
 *
 * Usage: node scripts/geocode-all-customers.js
 * Estimativa: ~40 min para 2224 customers
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PlomesRotaCEP/1.0 (geocode-all-script)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const results = await res.json();
  return results && results.length > 0 ? results[0] : null;
}

async function geocodeCepAndCity(cep, cityName) {
  // Pad to 8 digits — CEPs from São Paulo often lose the leading zero in import
  const clean = cep.replace(/\D/g, '').padStart(8, '0');

  try {
    // Strategy 1: Search Nominatim directly by CEP (no ViaCEP dependency)
    const byCep = await nominatimSearch(`${clean}, Brazil`);
    if (byCep) {
      return { lat: parseFloat(byCep.lat), lng: parseFloat(byCep.lon), city: cityName };
    }

    // Strategy 2: Try ViaCEP to enrich the address, then Nominatim
    try {
      const viaCepRes = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
        signal: AbortSignal.timeout(5000)
      });
      if (viaCepRes.ok) {
        const viaCep = await viaCepRes.json();
        if (!viaCep.erro) {
          const query = `${viaCep.logradouro || ''} ${viaCep.bairro || ''} ${viaCep.localidade} ${viaCep.uf} Brazil`.trim();
          const byAddr = await nominatimSearch(query);
          if (byAddr) {
            return {
              lat: parseFloat(byAddr.lat),
              lng: parseFloat(byAddr.lon),
              city: viaCep.localidade,
              state: viaCep.uf,
            };
          }
        }
      }
    } catch {
      // ViaCEP blocked or failed — continue to strategy 3
    }

    // Strategy 3: Geocode by city name only (less precise but better than nothing)
    if (cityName) {
      const byCity = await nominatimSearch(`${cityName}, Brazil`);
      if (byCity) {
        return { lat: parseFloat(byCity.lat), lng: parseFloat(byCity.lon), city: cityName };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch all customers with CEP but no lat/lng, skipping already-failed ones (paginated)
async function fetchCustomersToGeocode() {
  const all = [];
  let start = 0;
  const pageSize = 1000;

  while (true) {
    const end = start + pageSize - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?latitude=is.null&cep=not.is.null&geocoding_status=neq.failed&select=id,name,cep,city,state`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${start}-${end}`,
          'Range-Unit': 'items',
        }
      }
    );
    const data = await res.json();
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    start += pageSize;
  }
  return all;
}

async function updateCustomer(id, lat, lng, city, state, status) {
  const body = {
    latitude: lat,
    longitude: lng,
    geocoding_status: status,
    geocoded_at: new Date().toISOString(),
  };
  if (city) body.city = city;
  if (state) body.state = state;

  await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

async function markFailed(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ geocoding_status: 'failed', geocoding_attempts: 1 }),
  });
}

async function main() {
  console.log('=== Geocodificação em massa ===');
  console.log('Buscando customers com CEP sem coordenada...');

  const customers = await fetchCustomersToGeocode();
  const total = customers.length;
  console.log(`Total a geocodificar: ${total}`);

  if (total === 0) {
    console.log('Nada a fazer!');
    return;
  }

  const etaMin = Math.ceil(total * 1.1 / 60);
  console.log(`Estimativa: ~${etaMin} minutos (1.1s/req Nominatim)`);
  console.log('Iniciando...\n');

  let geocoded = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const result = await geocodeCepAndCity(customer.cep, customer.city);

    if (result) {
      await updateCustomer(
        customer.id,
        result.lat,
        result.lng,
        result.city || customer.city,
        result.state || customer.state,
        'geocoded'
      );
      geocoded++;
    } else {
      await markFailed(customer.id);
      failed++;
    }

    // Progress every 10
    if ((i + 1) % 10 === 0 || i + 1 === total) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (total - i - 1) / rate;
      const remMin = Math.round(remaining / 60);
      const pct = Math.round((i + 1) / total * 100);
      process.stdout.write(
        `\r[${pct}%] ${i + 1}/${total} | OK: ${geocoded} | Falha: ${failed} | Restante: ~${remMin}min   `
      );
    }

    // Nominatim rate limit: 1 req/sec
    await sleep(1100);
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n=== Concluído em ${totalTime}s ===`);
  console.log(`Geocodificados: ${geocoded}`);
  console.log(`Falhou (CEP inválido ou não encontrado): ${failed}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
