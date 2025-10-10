#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');

/**
 * Script para sincronizar vendas do Ploomes para o Supabase
 * Usa a API do Next.js que já está funcionando
 */

const PLOOME_API_URL = process.env.PLOOME_API_URL || 'https://public-api2.ploomes.com';
const PLOOME_API_KEY = process.env.PLOOME_API_KEY;

async function fetchDealsFromPloomes() {
    console.log('\n🚀 Buscando vendas do Ploomes...\n');

    if (!PLOOME_API_KEY) {
        throw new Error('PLOOME_API_KEY não configurada');
    }

    let allDeals = [];
    let skip = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
        try {
            const url = `${PLOOME_API_URL}/Deals?$top=${batchSize}&$skip=${skip}&$expand=Products,Contact`;

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
                hasMore = response.data.value.length === batchSize;

                // Delay para respeitar rate limit
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

async function syncDealsToSupabase(deals) {
    console.log('💾 Salvando vendas no Supabase via API Next.js...\n');

    const NEXT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

    // Preparar todas as vendas
    // Nota: Ploomes API não retorna produtos em Deals/$expand=Products
    // Criando produto genérico baseado no valor da venda
    const salesData = deals.map(deal => {
        const products = [];

        // Se a venda tem valor, criar um item genérico
        if (deal.Amount && deal.Amount > 0) {
            products.push({
                product_id: null,
                product_name: deal.Title || 'Venda',
                quantity: 1,
                unit_price: deal.Amount,
                total: deal.Amount
            });
        }

        return {
            ploomes_deal_id: deal.Id.toString(),
            customer_id: deal.ContactId?.toString() || null,
            deal_stage: deal.StageId?.toString() || 'unknown',
            deal_value: deal.Amount || 0,
            status: deal.StatusId === 3 ? 'won' : deal.StatusId === 2 ? 'lost' : 'open',
            products: products,
            created_at: deal.CreateDate || new Date().toISOString(),
            updated_at: deal.LastUpdateDate || new Date().toISOString()
        };
    });

    // Enviar em lotes de 50 para o Supabase
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < salesData.length; i += batchSize) {
        const batch = salesData.slice(i, i + batchSize);

        try {
            const response = await axios.post(`${NEXT_API_URL}/api/sync/sales`, {
                sales: batch
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            successCount += response.data.results.success;
            errorCount += response.data.results.errors;

            console.log(`  ✅ Lote ${Math.floor(i / batchSize) + 1}: ${response.data.results.success} sucesso, ${response.data.results.errors} erros`);
        } catch (err) {
            console.error(`  ❌ Erro ao enviar lote ${Math.floor(i / batchSize) + 1}:`, err.message);
            errorCount += batch.length;
        }
    }

    console.log(`\n✅ ${successCount} vendas salvas no Supabase`);
    if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} vendas com erro`);
    }

    // Estatísticas de produtos (baseado em títulos das vendas)
    const allProducts = new Map();
    salesData.forEach(sale => {
        sale.products.forEach(p => {
            const name = p.product_name;
            if (!allProducts.has(name)) {
                allProducts.set(name, 0);
            }
            allProducts.set(name, allProducts.get(name) + 1);
        });
    });

    console.log(`\n📊 Produtos únicos encontrados: ${allProducts.size}`);
    console.log('\nTop 10 produtos mais vendidos:');
    const topProducts = Array.from(allProducts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    topProducts.forEach(([name, count], index) => {
        console.log(`  ${index + 1}. ${name}: ${count} vendas`);
    });

    return {
        totalSynced: successCount,
        errors: errorCount,
        uniqueProducts: allProducts.size,
        topProducts: topProducts
    };
}

async function main() {
    try {
        const deals = await fetchDealsFromPloomes();

        if (deals.length === 0) {
            console.log('⚠️  Nenhuma venda encontrada no Ploomes');
            return;
        }

        await syncDealsToSupabase(deals);

        console.log('\n✅ Sincronização concluída!\n');
    } catch (error) {
        console.error('\n💥 Erro:', error.message);
        process.exit(1);
    }
}

main();
