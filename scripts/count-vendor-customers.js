/**
 * Conta clientes por vendedor no Supabase e compara com esperado.
 * Usage: node scripts/count-vendor-customers.js
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

const VENDORS = {
  'nayton.loureiro':    120000825,
  'henrique.barroso':  120001339,
  'sandra.nascimento': 40048138,
  'tiago.fraga':       120000081,
  'yuri.lima':         120001588,
};

const EXPECTED = {
  'nayton.loureiro':    653,
  'henrique.barroso':   369,
  'sandra.nascimento':  198,
  'tiago.fraga':         33,
  'yuri.lima':          257,
};

// Fetch all pages for a given owner
async function fetchAllForOwner(ownerId) {
  const all = [];
  let rangeStart = 0;
  const pageSize = 1000;

  while (true) {
    const rangeEnd = rangeStart + pageSize - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${ownerId}&select=id,tags`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${rangeStart}-${rangeEnd}`,
          'Range-Unit': 'items',
        }
      }
    );
    const data = await res.json();
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    rangeStart += pageSize;
  }
  return all;
}

async function main() {
  const header = 'Vendor                   | Expected | Total SB | Cliente | Cliente(no Forn) | Diff';
  const sep =    '-------------------------|----------|----------|---------|------------------|-----';
  console.log(header);
  console.log(sep);

  for (const [vendor, ownerId] of Object.entries(VENDORS)) {
    const data = await fetchAllForOwner(ownerId);
    const total = data.length;
    const withCliente = data.filter(c => (c.tags || []).includes('Cliente')).length;
    const withClienteNoForn = data.filter(c => {
      const tags = c.tags || [];
      return tags.includes('Cliente') && !tags.includes('Fornecedor');
    }).length;
    const expected = EXPECTED[vendor];
    const diff = withClienteNoForn - expected;
    const sign = diff >= 0 ? '+' : '';
    console.log(
      `${vendor.padEnd(25)}| ${String(expected).padEnd(9)}| ${String(total).padEnd(9)}| ${String(withCliente).padEnd(8)}| ${String(withClienteNoForn).padEnd(17)}| ${sign}${diff}`
    );
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
