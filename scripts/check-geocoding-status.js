/**
 * Verifica status de geocodificação dos customers.
 * Usage: node scripts/check-geocoding-status.js
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

async function countWhere(filter) {
  const url = `${SUPABASE_URL}/rest/v1/customers?${filter}&select=id`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
      'Range-Unit': 'items',
      'Range': '0-0',
    }
  });
  const cr = res.headers.get('content-range');
  const match = cr && cr.match(/\/([0-9]+|\*)/);
  if (match && match[1] !== '*') return parseInt(match[1]);
  // fallback
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function main() {
  const [total, geocoded, noLat, noCep, hasCepNoLat] = await Promise.all([
    countWhere(''),
    countWhere('latitude=not.is.null'),
    countWhere('latitude=is.null'),
    countWhere('cep=is.null'),
    countWhere('latitude=is.null&cep=not.is.null'),
  ]);

  const noCepNoLat = noLat - hasCepNoLat;
  const pct = total > 0 ? Math.round(geocoded / total * 100) : 0;

  console.log('=== Status de Geocodificação ===');
  console.log(`Total de customers:         ${total}`);
  console.log(`Geocodificados (tem lat):   ${geocoded}  (${pct}%)`);
  console.log(`Sem geocodificação:         ${noLat}`);
  console.log(`  Tem CEP, sem coordenada:  ${hasCepNoLat}  ← o cron resolve estes`);
  console.log(`  Sem CEP e sem coordenada: ${noCepNoLat}  ← impossível geocodificar`);
  console.log('');
  if (hasCepNoLat > 0) {
    const dias = Math.ceil(hasCepNoLat / 50);
    console.log(`Com o cron rodando 50/dia: ~${dias} dia(s) para geocodificar todos`);
  } else {
    console.log('Todos que têm CEP já estão geocodificados!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
