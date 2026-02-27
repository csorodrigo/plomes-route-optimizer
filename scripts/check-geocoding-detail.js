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

async function count(filter) {
  const res = await fetch(`${U}/rest/v1/customers?${filter}&select=id`, {
    headers: { 'apikey': K, 'Authorization': `Bearer ${K}`, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
  });
  const cr = res.headers.get('content-range');
  const m = cr && cr.match(/\/([0-9]+)/);
  return m ? parseInt(m[1]) : 0;
}

async function main() {
  // Get distinct geocoding_status values with counts (fetch sample and analyze)
  const res = await fetch(`${U}/rest/v1/customers?select=geocoding_status&latitude=is.null&cep=not.is.null`, {
    headers: { 'apikey': K, 'Authorization': `Bearer ${K}`, 'Range': '0-4999', 'Range-Unit': 'items' }
  });
  const data = await res.json();

  const counts = {};
  for (const row of data) {
    const s = row.geocoding_status ?? '(null)';
    counts[s] = (counts[s] || 0) + 1;
  }

  console.log(`\nDistinct geocoding_status for customers with CEP but no lat (sample ${data.length}):`);
  for (const [status, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${status}": ${n}`);
  }

  // Final summary
  const [pending, failed] = await Promise.all([
    count('latitude=is.null&cep=not.is.null&geocoding_status=is.null'),
    count('geocoding_status=eq.failed&cep=not.is.null'),
  ]);
  console.log(`\nResumo real:`);
  console.log(`  Pendentes (nunca tentado): ${pending}`);
  console.log(`  Falharam (CEP inválido):   ${failed}`);
}
main().catch(console.error);
