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

async function main() {
  // Fetch first 30 'pending' customers
  const res = await fetch(
    `${U}/rest/v1/customers?latitude=is.null&cep=not.is.null&geocoding_status=eq.pending&select=id,name,cep,street_address,neighborhood,city`,
    { headers: { 'apikey': K, 'Authorization': `Bearer ${K}`, 'Range': '0-29', 'Range-Unit': 'items' } }
  );
  const data = await res.json();
  console.log('First 30 pending customers:');
  for (const c of data) {
    const clean = c.cep.replace(/\D/g, '').padStart(8, '0');
    console.log(`  id=${c.id} cep="${c.cep}" → padded="${clean}" city="${c.city}" name="${(c.name||'').substring(0,40)}"`);
  }

  // Test ViaCEP on first one
  if (data.length > 0) {
    const cep = data[0].cep.replace(/\D/g, '').padStart(8, '0');
    console.log(`\nTesting ViaCEP for "${cep}"...`);
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const v = await r.json();
    console.log('ViaCEP result:', JSON.stringify(v));
  }
}
main().catch(console.error);
