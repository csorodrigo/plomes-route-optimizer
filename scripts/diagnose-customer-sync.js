/**
 * Diagnóstico de sincronização de clientes por vendedor.
 *
 * Compara contatos no Ploomes vs customers no Supabase por vendedor.
 * Identifica contatos faltando no Supabase e sincroniza se pedido.
 *
 * Usage:
 *   node scripts/diagnose-customer-sync.js               # só diagnóstico
 *   node scripts/diagnose-customer-sync.js --sync        # diagnóstico + sincroniza faltando
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_API_KEY in .env.local
 */

const path = require('path');
const fs = require('fs');

// Load .env.local manually
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
const PLOOMES_KEY = process.env.PLOOMES_API_KEY;
const DO_SYNC = process.argv.includes('--sync');

if (!SUPABASE_URL || !SUPABASE_KEY || !PLOOMES_KEY) {
  console.error('Missing env vars. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_API_KEY');
  process.exit(1);
}

const PLOOMES_BASE = 'https://public-api2.ploomes.com';
const CLIENT_TAG_ID = 40006184;

// Ploomes tag ID → Name mapping
const PLOOMES_TAG_NAMES = {
  40005047: 'Inadimplente',
  40006184: 'Cliente',
  40006185: 'Fornecedor',
  40006187: 'Transportadora',
  40006188: 'Funcionário',
  40006935: 'Ativo',
  120000705: 'Inativo',
  120000706: 'Baixado',
  120016028: 'Bloqueado',
};

// Vendors to diagnose (name → Ploomes OwnerId)
const VENDORS = {
  'nayton.loureiro': 120000825,
  'henrique.barroso': 120001339,
  'sandra.nascimento': 120001335,
  'tiago.fraga': 120001336,
  'yuri.lima': 120001588,
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPloomes(url) {
  const res = await fetch(url, {
    headers: { 'User-Key': PLOOMES_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Fetch all Ploomes contacts for a given OwnerId (with any tags).
 * Returns array of contacts.
 */
async function fetchContactsByOwner(ownerId) {
  const all = [];
  let skip = 0;
  const top = 200;

  while (true) {
    const filter = encodeURIComponent(`OwnerId eq ${ownerId}`);
    const url = `${PLOOMES_BASE}/Contacts?$select=Id,Name,OwnerId,Email,CNPJ,CPF,ZipCode,StreetAddress,StreetAddressNumber,Neighborhood,TypeId&$expand=Tags,City&$filter=${filter}&$top=${top}&$skip=${skip}`;
    const data = await fetchPloomes(url);
    const contacts = data.value || [];
    all.push(...contacts);
    if (contacts.length < top) break;
    skip += top;
    await sleep(150);
  }
  return all;
}

/**
 * Fetch ALL Ploomes contacts with Cliente tag (paginated).
 * Returns array of contacts.
 */
async function fetchAllClienteContacts() {
  const all = [];
  let skip = 0;
  const top = 200;

  while (true) {
    const filter = encodeURIComponent(`Tags/any(t:t/TagId eq ${CLIENT_TAG_ID})`);
    const url = `${PLOOMES_BASE}/Contacts?$select=Id,Name,OwnerId,Email,CNPJ,CPF,ZipCode,StreetAddress,StreetAddressNumber,Neighborhood,TypeId&$expand=Tags,City&$filter=${filter}&$top=${top}&$skip=${skip}`;
    const data = await fetchPloomes(url);
    const contacts = data.value || [];
    all.push(...contacts);
    process.stdout.write(`\r  Fetched ${all.length} Cliente contacts from Ploomes...`);
    if (contacts.length < top) break;
    skip += top;
    await sleep(150);
  }
  process.stdout.write('\n');
  return all;
}

/**
 * Fetch all customers from Supabase for a given owner_id.
 * Returns array of { id, name, tags, owner_id }.
 */
async function fetchSupabaseCustomersByOwner(ownerId) {
  const all = [];
  let rangeStart = 0;
  const pageSize = 1000;

  while (true) {
    const rangeEnd = rangeStart + pageSize - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${ownerId}&select=id,name,tags,owner_id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Range': `${rangeStart}-${rangeEnd}`,
          'Range-Unit': 'items',
          'Prefer': 'count=exact',
        }
      }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    rangeStart += pageSize;
  }
  return all;
}

/**
 * Count customers in Supabase for a given owner_id.
 */
async function countSupabaseCustomers(ownerId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${ownerId}&select=id`,
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
  const contentRange = res.headers.get('content-range');
  // content-range: 0-0/550 → parse total
  if (contentRange) {
    const match = contentRange.match(/\/(\d+|\*)/);
    if (match && match[1] !== '*') return parseInt(match[1]);
  }
  // fallback: count array
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

function hasClienteTag(contact) {
  const tags = contact.Tags || [];
  return tags.some(t => t.TagId === CLIENT_TAG_ID);
}

/**
 * Upsert a batch of Ploomes contacts into Supabase customers table.
 */
async function upsertContacts(contacts) {
  const rows = contacts.map(c => {
    const cep = c.ZipCode ? String(c.ZipCode).replace(/\D/g, '') : null;
    const tags = (c.Tags || [])
      .map(t => PLOOMES_TAG_NAMES[t.TagId] || null)
      .filter(n => n !== null);

    return {
      id: String(c.Id),
      ploome_person_id: String(c.Id),
      name: c.Name || 'Sem nome',
      owner_id: c.OwnerId || null,
      email: c.Email || null,
      cnpj: c.CNPJ || null,
      cpf: c.CPF || null,
      cep: cep || null,
      street_address: c.StreetAddress || null,
      street_number: c.StreetAddressNumber || null,
      neighborhood: c.Neighborhood || null,
      city: c.City?.Name || null,
      tags,
    };
  });

  let upserted = 0;
  let errors = 0;
  const BATCH = 200;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  Upsert batch ${i} error: ${text.substring(0, 200)}`);
      errors += batch.length;
    } else {
      upserted += batch.length;
    }
    await sleep(100);
  }

  return { upserted, errors };
}

async function main() {
  console.log('=== Diagnóstico de Sincronização de Clientes ===\n');

  // Step 1: Fetch ALL Cliente contacts from Ploomes (as the cron does)
  console.log('Buscando TODOS os contatos "Cliente" do Ploomes (como o cron faz)...');
  const allClienteContacts = await fetchAllClienteContacts();
  console.log(`Total "Cliente" no Ploomes: ${allClienteContacts.length}`);

  // Build a map: Id → contact (for fast lookup)
  const ploomesByIdMap = new Map();
  for (const c of allClienteContacts) {
    ploomesByIdMap.set(String(c.Id), c);
  }

  // Group by OwnerId from the cron's perspective
  const byOwnerInCron = {};
  for (const c of allClienteContacts) {
    const oid = c.OwnerId || 0;
    if (!byOwnerInCron[oid]) byOwnerInCron[oid] = [];
    byOwnerInCron[oid].push(c);
  }

  console.log('\n--- Por vendedor nos contatos que o cron buscou ---');
  for (const [vendor, ownerId] of Object.entries(VENDORS)) {
    const inCron = (byOwnerInCron[ownerId] || []).length;
    console.log(`  ${vendor} (${ownerId}): ${inCron} contatos no fetch do cron`);
  }

  console.log('\n--- Comparando com Supabase ---');

  const syncTasks = [];

  for (const [vendor, ownerId] of Object.entries(VENDORS)) {
    const inCron = byOwnerInCron[ownerId] || [];
    const inCronCount = inCron.length;

    // Count what's in Supabase
    const inSupabase = await countSupabaseCustomers(ownerId);
    const supabaseCustomers = await fetchSupabaseCustomersByOwner(ownerId);

    // Filter Cliente tag in Supabase
    const inSupabaseWithTag = supabaseCustomers.filter(c => {
      const tags = c.tags || [];
      return tags.includes('Cliente');
    }).length;

    // IDs in Supabase
    const supabaseIds = new Set(supabaseCustomers.map(c => String(c.id)));

    // Which Ploomes contacts are missing from Supabase?
    const missing = inCron.filter(c => !supabaseIds.has(String(c.Id)));

    console.log(`\n  ${vendor} (${ownerId}):`);
    console.log(`    Ploomes (tag+owner filter direto):  buscando...`);
    // Also fetch directly from Ploomes by OwnerId to cross-check
    const byOwner = await fetchContactsByOwner(ownerId);
    const byOwnerWithTag = byOwner.filter(hasClienteTag);
    console.log(`    Ploomes (owner filter): ${byOwner.length} total, ${byOwnerWithTag.length} com tag Cliente`);
    console.log(`    Ploomes (cron tag filter): ${inCronCount} com owner_id=${ownerId}`);
    console.log(`    Supabase total (owner_id): ${inSupabase}`);
    console.log(`    Supabase com tag Cliente: ${inSupabaseWithTag}`);
    console.log(`    Faltando no Supabase (vs cron): ${missing.length}`);

    // Find contacts in OwnerId query but NOT in cron's tag query
    const cronIds = new Set(inCron.map(c => String(c.Id)));
    const inOwnerButNotCron = byOwnerWithTag.filter(c => !cronIds.has(String(c.Id)));
    if (inOwnerButNotCron.length > 0) {
      console.log(`    ⚠️  Em owner-filter mas NÃO no cron tag-filter: ${inOwnerButNotCron.length}`);
    }

    if (missing.length > 0 || inOwnerButNotCron.length > 0) {
      syncTasks.push({ vendor, ownerId, missing, inOwnerButNotCron, byOwnerWithTag });
    }

    await sleep(300);
  }

  if (!DO_SYNC) {
    console.log('\n---');
    console.log('Para sincronizar contatos faltando, rode: node scripts/diagnose-customer-sync.js --sync');
    return;
  }

  // Sync missing contacts
  console.log('\n\n=== Sincronizando contatos faltando ===');

  for (const { vendor, ownerId, missing, inOwnerButNotCron } of syncTasks) {
    const toSync = [...missing, ...inOwnerButNotCron];
    // Deduplicate by Id
    const deduped = Array.from(new Map(toSync.map(c => [String(c.Id), c])).values());

    if (deduped.length === 0) {
      console.log(`\n${vendor}: nada para sincronizar`);
      continue;
    }

    console.log(`\n${vendor}: sincronizando ${deduped.length} contatos...`);
    const { upserted, errors } = await upsertContacts(deduped);
    console.log(`  Resultado: ${upserted} inseridos, ${errors} erros`);
  }

  console.log('\n=== Concluído ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
