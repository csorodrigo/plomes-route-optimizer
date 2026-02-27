/**
 * Verifica quais campos de endereço estão disponíveis nos customers sem geocodificação.
 * Ajuda a estimar o potencial do Google Maps para geocodificar mais.
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
const U = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchAll(filter) {
  const all = [];
  let start = 0;
  while (true) {
    const end = start + 999;
    const res = await fetch(
      `${U}/rest/v1/customers?${filter}&select=id,cep,street_address,neighborhood,city,state`,
      { headers: { 'apikey': K, 'Authorization': `Bearer ${K}`, 'Range': `${start}-${end}`, 'Range-Unit': 'items' } }
    );
    const data = await res.json();
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
    start += 1000;
  }
  return all;
}

function analyze(label, data) {
  const total = data.length;
  const hasCity    = data.filter(c => c.city && c.city.trim()).length;
  const hasStreet  = data.filter(c => c.street_address && c.street_address.trim()).length;
  const hasState   = data.filter(c => c.state && c.state.trim()).length;
  const hasCep     = data.filter(c => c.cep && c.cep.trim()).length;
  // Best address quality (city + street)
  const fullAddr   = data.filter(c => c.city && c.street_address).length;
  // At minimum city
  const cityOnly   = data.filter(c => c.city && !c.street_address).length;
  // Nothing usable
  const nothing    = data.filter(c => !c.city && !c.street_address && !c.cep).length;

  console.log(`\n── ${label} (${total} total) ──`);
  console.log(`  Tem city:              ${hasCity} (${pct(hasCity, total)}%)`);
  console.log(`  Tem street_address:    ${hasStreet} (${pct(hasStreet, total)}%)`);
  console.log(`  Tem state:             ${hasState} (${pct(hasState, total)}%)`);
  console.log(`  Tem CEP:               ${hasCep} (${pct(hasCep, total)}%)`);
  console.log(`  ✅ Endereço completo (city+street): ${fullAddr} → Google Maps resolve`);
  console.log(`  🟡 Só city:            ${cityOnly} → ponto aproximado da cidade`);
  console.log(`  ❌ Sem nada útil:      ${nothing} → impossível geocodificar`);
}

function pct(n, total) { return total > 0 ? Math.round(n / total * 100) : 0; }

async function main() {
  console.log('=== Potencial de Geocodificação com Google Maps ===\n');

  const [failed, noCep] = await Promise.all([
    fetchAll('latitude=is.null&cep=not.is.null&geocoding_status=eq.failed'),
    fetchAll('latitude=is.null&cep=is.null'),
  ]);

  analyze('CEPs inválidos (Nominatim falhou)', failed);
  analyze('Sem CEP', noCep);

  const totalPotential = [
    ...failed.filter(c => c.city || c.street_address),
    ...noCep.filter(c => c.city || c.street_address),
  ].length;

  console.log(`\n→ Potencial total com Google Maps: ~${totalPotential} customers`);
  console.log('  (precisaria da GOOGLE_MAPS_API_KEY no .env.local para rodar localmente)');
}
main().catch(console.error);
