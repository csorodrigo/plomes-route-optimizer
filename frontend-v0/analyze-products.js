const deals = require('./ploomes-deals-with-products.json');

console.log('📊 ANÁLISE COMPLETA DE PRODUTOS:\n');

const withProducts = deals.filter(d => d.Products && d.Products.length > 0);
const withoutProducts = deals.filter(d => !d.Products || d.Products.length === 0);

console.log(`Total Deals: ${deals.length}`);
console.log(`✅ Com produtos: ${withProducts.length} (${(withProducts.length / deals.length * 100).toFixed(1)}%)`);
console.log(`❌ Sem produtos: ${withoutProducts.length} (${(withoutProducts.length / deals.length * 100).toFixed(1)}%)`);

// Count product sources
const bySource = {};
withProducts.forEach(d => {
  d.Products.forEach(p => {
    const source = p.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });
});

console.log(`\n📦 Produtos por fonte:`);
Object.entries(bySource).sort((a,b) => b[1] - a[1]).forEach(([source, count]) => {
  console.log(`  ${source}: ${count} produtos`);
});

// Sample deal with most products
const dealWithMostProducts = withProducts.reduce((max, d) =>
  d.Products.length > max.Products.length ? d : max
, withProducts[0]);

console.log(`\n🏆 Deal com mais produtos:`);
console.log(`  ID: ${dealWithMostProducts.Id}`);
console.log(`  Title: ${dealWithMostProducts.Title.substring(0, 60)}...`);
console.log(`  Produtos: ${dealWithMostProducts.Products.length}`);
console.log(`  Primeiro produto:`, dealWithMostProducts.Products[0]);

// Check if deals without products might have them in Quotes/Orders
console.log(`\n\n🔍 CONCLUSÃO:`);
console.log(`\nDe ${deals.length} deals totais:`);
console.log(`  ${withProducts.length} já foram sincronizados com produtos (via step4-fetch-products-ALL.js)`);
console.log(`  ${withoutProducts.length} não têm produtos`);
console.log(`\n⚠️  IMPORTANTE:`);
console.log(`  Os ${withoutProducts.length} deals "sem produtos" podem ter produtos no Ploomes`);
console.log(`  mas não foram sincronizados porque:`);
console.log(`    1. Não têm Quotes/Orçamentos vinculados`);
console.log(`    2. Não têm Orders/Pedidos vinculados`);
console.log(`    3. Produtos estão cadastrados apenas no título do deal`);
console.log(`    4. Foram vendidos antes do sistema de Quotes ser implementado`);
