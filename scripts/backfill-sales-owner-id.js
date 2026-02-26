/* eslint-disable no-console */
/**
 * Backfill sales.owner_id from Ploomes Deals.OwnerId
 *
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (service_role JWT)
 * - PLOOMES_API_KEY
 * Optional:
 * - PLOOMES_BASE_URL (default https://public-api2.ploomes.com)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL || 'https://public-api2.ploomes.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PLOOMES_API_KEY) {
  console.error('Missing env vars. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_API_KEY');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function supabaseFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { res, data };
}

async function ploomesFetch(endpoint) {
  const res = await fetch(`${PLOOMES_BASE_URL}${endpoint}`, {
    headers: {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Ploomes ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}

async function countSales(filter) {
  const { res } = await supabaseFetch(`/rest/v1/sales?select=id&${filter}`, {
    headers: { Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range') || '';
  return Number((range.split('/')[1] || '0'));
}

async function main() {
  const stats = {
    salesNullBefore: 0,
    salesRowsFetched: 0,
    ploomesDealsFetched: 0,
    updatesPreparedRows: 0,
    groupedOwners: 0,
    patchRequests: 0,
    patchFailures: 0,
    salesNoMatchingDeal: 0,
    salesMatchedButNullOwner: 0,
    salesNullAfter: null,
    salesWithOwnerAfter: null,
  };

  stats.salesNullBefore = await countSales('owner_id=is.null');
  console.log('[OWNER BACKFILL] sales sem owner_id antes:', stats.salesNullBefore);

  const sales = [];
  for (let offset = 0; ; offset += 1000) {
    const { res, data } = await supabaseFetch(
      `/rest/v1/sales?select=id,ploomes_deal_id,owner_id&owner_id=is.null&limit=1000&offset=${offset}`
    );

    if (!res.ok) {
      throw new Error(`Supabase sales fetch failed ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    sales.push(...data);

    if (data.length < 1000) {
      break;
    }
  }
  stats.salesRowsFetched = sales.length;
  console.log('[OWNER BACKFILL] sales carregadas:', stats.salesRowsFetched);

  const dealToOwner = new Map();
  for (let skip = 0, page = 0; ; skip += 300, page++) {
    const data = await ploomesFetch(`/Deals?$select=Id,OwnerId&$top=300&$skip=${skip}`);
    const items = Array.isArray(data?.value) ? data.value : [];

    stats.ploomesDealsFetched += items.length;
    for (const deal of items) {
      if (deal?.Id != null) {
        dealToOwner.set(String(deal.Id), deal.OwnerId ?? null);
      }
    }

    if (page % 15 === 0) {
      console.log('[OWNER BACKFILL] deals Ploomes carregados:', stats.ploomesDealsFetched);
    }

    if (items.length < 300) {
      break;
    }

    await sleep(120);
  }

  const dealsByOwner = new Map();
  for (const row of sales) {
    const dealId = row.ploomes_deal_id == null ? '' : String(row.ploomes_deal_id).trim();

    if (!dealId || !dealToOwner.has(dealId)) {
      stats.salesNoMatchingDeal += 1;
      continue;
    }

    const ownerId = dealToOwner.get(dealId);
    if (ownerId == null) {
      stats.salesMatchedButNullOwner += 1;
      continue;
    }

    if (!dealsByOwner.has(ownerId)) {
      dealsByOwner.set(ownerId, []);
    }
    dealsByOwner.get(ownerId).push(dealId);
    stats.updatesPreparedRows += 1;
  }

  stats.groupedOwners = dealsByOwner.size;
  console.log('[OWNER BACKFILL] updates preparados:', stats.updatesPreparedRows);
  console.log('[OWNER BACKFILL] owners distintos:', stats.groupedOwners);
  console.log('[OWNER BACKFILL] deals sem match:', stats.salesNoMatchingDeal);
  console.log('[OWNER BACKFILL] deals com OwnerId nulo:', stats.salesMatchedButNullOwner);

  for (const [ownerId, dealIds] of dealsByOwner.entries()) {
    const uniqueDealIds = [...new Set(dealIds)];

    for (let i = 0; i < uniqueDealIds.length; i += 80) {
      const chunk = uniqueDealIds.slice(i, i + 80);
      const inList = chunk.join(',');

      const { res, data } = await supabaseFetch(
        `/rest/v1/sales?ploomes_deal_id=in.(${inList})&owner_id=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { owner_id: ownerId },
        }
      );

      stats.patchRequests += 1;

      if (!res.ok) {
        stats.patchFailures += 1;
        console.error(
          '[OWNER BACKFILL] PATCH failed',
          ownerId,
          res.status,
          JSON.stringify(data).slice(0, 300)
        );
      }

      if (stats.patchRequests % 25 === 0) {
        console.log('[OWNER BACKFILL] patch requests:', stats.patchRequests);
      }

      await sleep(30);
    }
  }

  stats.salesNullAfter = await countSales('owner_id=is.null');
  stats.salesWithOwnerAfter = await countSales('owner_id=not.is.null');

  console.log('[OWNER BACKFILL] DONE');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error('[OWNER BACKFILL] ERROR', error);
  process.exit(1);
});

