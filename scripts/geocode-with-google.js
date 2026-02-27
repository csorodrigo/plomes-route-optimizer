/**
 * Geocodifica customers restantes usando Google Maps Geocoding API.
 * Targets:
 *   1. CEPs inválidos (geocoding_status=failed) — tenta pelo endereço completo
 *   2. Sem CEP — tenta por street_address + city ou só city
 *
 * Usage: node scripts/geocode-with-google.js
 * Requires: GOOGLE_MAPS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
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
const GOOGLE_KEY   = process.env.GOOGLE_MAPS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }
if (!GOOGLE_KEY)                    { console.error('Missing GOOGLE_MAPS_API_KEY'); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function googleGeocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=br&language=pt-BR`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;

    const result = data.results[0];
    const loc = result.geometry.location;

    let city = null, state = null;
    for (const comp of result.address_components) {
      if (comp.types.includes('administrative_area_level_2')) city = comp.long_name;
      if (comp.types.includes('administrative_area_level_1')) state = comp.short_name;
    }

    return { lat: loc.lat, lng: loc.lng, city, state };
  } catch {
    return null;
  }
}

async function geocodeCustomer(c) {
  const cep = c.cep ? c.cep.replace(/\D/g, '').padStart(8, '0') : null;
  const street = c.street_address ? c.street_address.trim() : null;
  const neighborhood = c.neighborhood ? c.neighborhood.trim() : null;
  const city = c.city ? c.city.trim() : null;

  // Strategy 1: Full address with CEP (most precise)
  if (cep && street && city) {
    const query = `${street}${neighborhood ? ', ' + neighborhood : ''}, ${city}, ${cep}, Brasil`;
    const r = await googleGeocode(query);
    if (r) return { ...r, strategy: 'full_address_cep' };
  }

  // Strategy 2: Street + city without CEP
  if (street && city) {
    const query = `${street}${neighborhood ? ', ' + neighborhood : ''}, ${city}, Brasil`;
    const r = await googleGeocode(query);
    if (r) return { ...r, strategy: 'street_city' };
  }

  // Strategy 3: CEP only
  if (cep) {
    const r = await googleGeocode(`${cep}, Brasil`);
    if (r) return { ...r, strategy: 'cep_only' };
  }

  // Strategy 4: City only (approximate center)
  if (city) {
    const r = await googleGeocode(`${city}, Brasil`);
    if (r) return { ...r, strategy: 'city_only' };
  }

  return null;
}

async function fetchAll(filter) {
  const all = [];
  let start = 0;
  while (true) {
    const end = start + 999;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?${filter}&select=id,name,cep,street_address,neighborhood,city,state`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Range': `${start}-${end}`, 'Range-Unit': 'items' } }
    );
    const data = await res.json();
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
    start += 1000;
  }
  return all;
}

async function updateCustomer(id, lat, lng, city, state) {
  const body = {
    latitude: lat, longitude: lng,
    geocoding_status: 'geocoded',
    geocoded_at: new Date().toISOString(),
  };
  if (city) body.city = city;
  if (state) body.state = state;
  await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
}

async function processGroup(label, customers) {
  if (customers.length === 0) { console.log(`\n${label}: nenhum`); return { ok: 0, fail: 0 }; }

  console.log(`\n── ${label} (${customers.length}) ──`);
  let ok = 0, fail = 0;
  const strategies = {};

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const result = await geocodeCustomer(c);

    if (result) {
      await updateCustomer(c.id, result.lat, result.lng, result.city || c.city, result.state || c.state);
      ok++;
      strategies[result.strategy] = (strategies[result.strategy] || 0) + 1;
    } else {
      fail++;
    }

    if ((i + 1) % 10 === 0 || i + 1 === customers.length) {
      const pct = Math.round((i + 1) / customers.length * 100);
      process.stdout.write(`\r  [${pct}%] ${i+1}/${customers.length} | OK: ${ok} | Falha: ${fail}   `);
    }

    await sleep(50); // Google Maps: 50 req/s default quota
  }

  process.stdout.write('\n');
  console.log(`  Estratégias usadas:`, strategies);
  return { ok, fail };
}

async function main() {
  console.log('=== Geocodificação com Google Maps ===\n');

  const [failedCeps, noCep] = await Promise.all([
    fetchAll('latitude=is.null&geocoding_status=eq.failed'),
    fetchAll('latitude=is.null&cep=is.null'),
  ]);

  console.log(`CEPs inválidos a tentar: ${failedCeps.length}`);
  console.log(`Sem CEP a tentar:        ${noCep.length}`);

  const r1 = await processGroup('CEPs inválidos (Google Maps por endereço)', failedCeps);
  const r2 = await processGroup('Sem CEP (Google Maps por city/street)', noCep);

  console.log(`\n=== Resultado final ===`);
  console.log(`Geocodificados: ${r1.ok + r2.ok}`);
  console.log(`Falharam:       ${r1.fail + r2.fail}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
