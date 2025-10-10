#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const PLOOME_API_URL = process.env.PLOOME_BASE_URL || 'https://public-api2.ploomes.com';
const PLOOME_API_KEY = process.env.PLOOME_API_KEY;

async function fetchDealsFromPloomes() {
    console.log('\n🚀 Buscando vendas do Ploomes...\n');

    let allDeals = [];
    let skip = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore && skip < 500) { // Limit to 500 for testing
        try {
            const url = `${PLOOME_API_URL}/Deals?$top=${batchSize}&$skip=${skip}`;
            console.log(`📦 Buscando lote ${Math.floor(skip / batchSize) + 1}...`);

            const response = await axios.get(url, {
                headers: {
                    'User-Key': PLOOME_API_KEY,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                timeout: 60000
            });

            if (response.data.value && response.data.value.length > 0) {
                allDeals = allDeals.concat(response.data.value);
                console.log(`  ✅ ${response.data.value.length} vendas neste lote`);
                skip += batchSize;
                hasMore = response.data.value.length === batchSize && skip < 500;
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`  ❌ Erro ao buscar lote:`, error.message);
            hasMore = false;
        }
    }

    console.log(`\n✅ Total: ${allDeals.length} vendas encontradas\n`);
    return allDeals;
}

async function syncToSupabaseDirect(deals) {
    console.log('💾 Salvando diretamente no Supabase...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const deal of deals) {
        try {
            const products = [];
            if (deal.Amount && deal.Amount > 0) {
                products.push({
                    product_id: null,
                    product_name: deal.Title || 'Venda',
                    quantity: 1,
                    unit_price: deal.Amount,
                    total: deal.Amount
                });
            }

            const { data, error } = await supabase
                .from('sales')
                .upsert({
                    ploomes_deal_id: deal.Id.toString(),
                    customer_id: deal.ContactId?.toString() || null,
                    deal_stage: deal.StageId?.toString() || 'unknown',
                    deal_value: deal.Amount || 0,
                    status: deal.StatusId === 3 ? 'won' : deal.StatusId === 2 ? 'lost' : 'open',
                    products: products,
                    created_at: deal.CreateDate || new Date().toISOString(),
                    updated_at: deal.LastUpdateDate || new Date().toISOString()
                }, {
                    onConflict: 'ploomes_deal_id'
                });

            if (error) {
                throw error;
            }

            successCount++;
            if (successCount % 50 === 0) {
                console.log(`  ✅ ${successCount} vendas salvas...`);
            }
        } catch (err) {
            console.error(`  ❌ Erro na venda ${deal.Id}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n✅ ${successCount} vendas sincronizadas`);
    if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} erros`);
    }

    return { successCount, errorCount };
}

async function main() {
    try {
        const deals = await fetchDealsFromPloomes();
        if (deals.length === 0) {
            console.log('⚠️  Nenhuma venda encontrada');
            return;
        }

        const result = await syncToSupabaseDirect(deals);

        // Get statistics
        const { data: stats } = await supabase
            .from('sales')
            .select('products');

        const productMap = new Map();
        stats?.forEach(sale => {
            sale.products?.forEach(p => {
                const name = p.product_name;
                productMap.set(name, (productMap.get(name) || 0) + 1);
            });
        });

        console.log(`\n📊 Produtos únicos: ${productMap.size}`);
        console.log('\nTop 5 produtos:');
        Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([name, count], idx) => {
                console.log(`  ${idx + 1}. ${name}: ${count} vendas`);
            });

        console.log('\n✅ Sincronização concluída!\n');
    } catch (error) {
        console.error('\n💥 Erro:', error.message);
        process.exit(1);
    }
}

main();
