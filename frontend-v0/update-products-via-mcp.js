const fs = require('fs');

// Load deals with products
const dealsFile = 'ploomes-deals-with-products.json';
const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
const dealsWithProducts = allDeals.filter(d => d.Products && d.Products.length > 0);

console.log(`📦 Deals with products: ${dealsWithProducts.length}\n`);

// Generate SQL for batch update
const updates = dealsWithProducts.map(deal => {
  const dealId = String(deal.Id);
  const productsJson = JSON.stringify(deal.Products).replace(/'/g, "''");
  return `UPDATE sales SET products = '${productsJson}'::jsonb WHERE ploomes_deal_id = '${dealId}';`;
});

// Split into batches of 100
const batchSize = 100;
const batches = [];
for (let i = 0; i < updates.length; i += batchSize) {
  batches.push(updates.slice(i, i + batchSize));
}

console.log(`📊 Total batches: ${batches.length}\n`);

// Write batches to files
batches.forEach((batch, index) => {
  const sql = batch.join('\n');
  fs.writeFileSync(`update-batch-${index + 1}.sql`, sql);
  console.log(`✅ Wrote batch ${index + 1}/${batches.length} (${batch.length} updates)`);
});

console.log('\n✅ SQL batches generated!');
console.log('🎯 Use Supabase MCP to execute each batch\n');
