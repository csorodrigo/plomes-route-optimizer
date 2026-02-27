/**
 * Reseta geocoding_status='failed' → null para permitir nova tentativa.
 * Útil após corrigir bugs no geocoder.
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

async function main() {
  // Count failed
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/customers?geocoding_status=eq.failed&select=id`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      }
    }
  );
  const cr = countRes.headers.get('content-range');
  const match = cr && cr.match(/\/([0-9]+)/);
  const count = match ? parseInt(match[1]) : '?';
  console.log(`Reseting ${count} customers with geocoding_status=failed...`);

  // Reset
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/customers?geocoding_status=eq.failed`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ geocoding_status: null, geocoding_attempts: null }),
    }
  );
  if (res.ok) {
    console.log('Done! All failed geocodings reset to null.');
  } else {
    console.error('Error:', res.status, await res.text());
  }
}
main().catch(console.error);
