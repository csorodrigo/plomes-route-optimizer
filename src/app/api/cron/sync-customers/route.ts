import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const PAGE_SIZE = 200;
const DELAY_MS = 200;
// Max customers to geocode per cron run (to avoid timeouts)
const MAX_GEOCODE_PER_RUN = 50;

interface PloomeContact {
  Id: number;
  Name?: string;
  OwnerId?: number;
  Email?: string;
  CNPJ?: string;
  CPF?: string;
  ZipCode?: string | number;
  StreetAddress?: string;
  StreetAddressNumber?: string;
  Neighborhood?: string;
  TypeId?: number;
  Tags?: Array<{ TagId: number }>;
  City?: { Name: string };
  StateId?: number;
}

// Ploomes tag ID → Name mapping (fetched once at startup)
// Hardcoded known tags to avoid an extra API call per run
const PLOOMES_TAG_NAMES: Record<number, string> = {
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPloomeContacts(apiKey: string): Promise<PloomeContact[]> {
  const all: PloomeContact[] = [];
  let skip = 0;

  while (true) {
    // Filter by "Cliente" tag (TagId=40006184) to match original customer import logic
    const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID || '40006184';
    const filter = encodeURIComponent(`Tags/any(t:t/TagId eq ${CLIENT_TAG_ID})`);
    const url = `${PLOOMES_BASE_URL}/Contacts?$select=Id,Name,OwnerId,Email,CNPJ,CPF,ZipCode,StreetAddress,StreetAddressNumber,Neighborhood,TypeId&$expand=Tags,City&$filter=${filter}&$top=${PAGE_SIZE}&$skip=${skip}`;
    const res = await fetch(url, {
      headers: { 'User-Key': apiKey, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Ploomes Contacts API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const contacts: PloomeContact[] = data.value || [];
    all.push(...contacts);

    if (contacts.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
    await sleep(DELAY_MS);
  }

  return all;
}

async function geocodeCep(cep: string): Promise<{ lat: number; lng: number; city?: string; state?: string } | null> {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    // ViaCEP to get address
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, { signal: AbortSignal.timeout(5000) });
    if (!viaCepRes.ok) return null;
    const viaCep = await viaCepRes.json();
    if (viaCep.erro) return null;

    // Nominatim to get coordinates
    const query = `${viaCep.logradouro || ''} ${viaCep.bairro || ''} ${viaCep.localidade} ${viaCep.uf} Brazil`.trim();
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const nominatimRes = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PlomesRotaCEP/1.0 (customer-sync-cron)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!nominatimRes.ok) return null;
    const results = await nominatimRes.json();
    if (!results || results.length === 0) return null;

    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      city: viaCep.localidade,
      state: viaCep.uf,
    };
  } catch {
    return null;
  }
}

/**
 * CRON Job: Sync Ploomes Contacts → Supabase customers table
 *
 * - Upserts all Ploomes contacts (TypeId=1 companies + TypeId=2 persons) into customers
 * - Sets owner_id = Contact.OwnerId (the vendor responsible for the contact)
 * - Geocodes up to MAX_GEOCODE_PER_RUN new customers without lat/lng per run
 *
 * Schedule: daily at 2am ("0 2 * * *")
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!PLOOMES_API_KEY) return NextResponse.json({ error: 'Missing PLOOMES_API_KEY' }, { status: 500 });
  if (!SUPABASE_KEY) return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });

  console.log('[SYNC-CUSTOMERS] Starting...');

  try {
    // Step 1: Fetch all Ploomes contacts
    console.log('[SYNC-CUSTOMERS] Fetching contacts from Ploomes...');
    const contacts = await fetchAllPloomeContacts(PLOOMES_API_KEY);
    console.log(`[SYNC-CUSTOMERS] Fetched ${contacts.length} contacts`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Step 2: Upsert into customers table
    const rows = contacts.map((c) => {
      const cep = c.ZipCode ? String(c.ZipCode).replace(/\D/g, '') : null;
      const tags = (c.Tags || [])
        .map((t) => PLOOMES_TAG_NAMES[t.TagId] || null)
        .filter((name): name is string => name !== null);

      return {
        id: String(c.Id),
        ploome_person_id: String(c.Id), // required NOT NULL column
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
        // Don't overwrite existing lat/lng — geocoding step handles that
      };
    });

    let upserted = 0;
    let upsertErrors = 0;
    const BATCH = 300;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from('customers')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

      if (error) {
        console.error(`[SYNC-CUSTOMERS] Upsert batch ${i} error:`, error.message);
        upsertErrors += batch.length;
      } else {
        upserted += batch.length;
      }
    }

    console.log(`[SYNC-CUSTOMERS] Upserted ${upserted}, errors ${upsertErrors}`);

    // Step 3: Geocode customers without lat/lng (up to MAX_GEOCODE_PER_RUN)
    const { data: toGeocode } = await supabase
      .from('customers')
      .select('id, name, cep, street_address, neighborhood, city, state')
      .is('latitude', null)
      .not('cep', 'is', null)
      .limit(MAX_GEOCODE_PER_RUN);

    console.log(`[SYNC-CUSTOMERS] Customers to geocode this run: ${toGeocode?.length || 0}`);

    let geocoded = 0;
    let geocodeFailed = 0;

    for (const customer of toGeocode || []) {
      const result = await geocodeCep(customer.cep);
      if (result) {
        await supabase
          .from('customers')
          .update({
            latitude: result.lat,
            longitude: result.lng,
            city: result.city || customer.city,
            state: result.state || customer.state,
            geocoding_status: 'geocoded',
            geocoded_at: new Date().toISOString(),
          })
          .eq('id', customer.id);
        geocoded++;
      } else {
        await supabase
          .from('customers')
          .update({ geocoding_status: 'failed', geocoding_attempts: 1 })
          .eq('id', customer.id);
        geocodeFailed++;
      }
      await sleep(1100); // Nominatim rate limit: 1 req/sec
    }

    console.log(`[SYNC-CUSTOMERS] Geocoded ${geocoded}, failed ${geocodeFailed}`);

    const elapsed = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      stats: {
        contactsFetched: contacts.length,
        upserted,
        upsertErrors,
        geocoded,
        geocodeFailed,
        elapsed,
      },
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('[SYNC-CUSTOMERS] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown', elapsed },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
