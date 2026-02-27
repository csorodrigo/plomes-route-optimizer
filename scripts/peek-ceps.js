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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/customers?latitude=is.null&cep=not.is.null&select=id,name,cep&limit=20`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range': '0-19',
        'Range-Unit': 'items',
      }
    }
  );
  const data = await res.json();
  console.log('Sample CEPs with no geocoding:');
  data.forEach(c => console.log(`  id=${c.id} cep="${c.cep}" name="${c.name}"`));

  // Try one geocode manually
  if (data.length > 0) {
    const cep = data[0].cep.replace(/\D/g, '');
    console.log(`\nTesting ViaCEP for "${cep}"...`);
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const v = await r.json();
    console.log('ViaCEP result:', JSON.stringify(v));
  }
}
main().catch(console.error);
