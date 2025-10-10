// Quick check: What StageId values exist in deals?
const ploomesClient = require('./src/lib/ploomes-client.js').ploomesClient;

async function checkStageIds() {
  console.log('🔍 Fetching sample deals to check StageId values...\n');

  const deals = await ploomesClient.getDeals({
    select: ['Id', 'ContactId', 'StageId'],
    top: 1000 // Just first 1000 to be fast
  });

  console.log(`📊 Analyzed ${deals.length} deals:`);

  const stageCounts = {};
  let noStageId = 0;
  let noContactId = 0;

  deals.forEach(deal => {
    if (!deal.ContactId) noContactId++;
    if (!deal.StageId) {
      noStageId++;
    } else {
      stageCounts[deal.StageId] = (stageCounts[deal.StageId] || 0) + 1;
    }
  });

  console.log('\n📈 StageId Distribution:');
  Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([stageId, count]) => {
      const percentage = (count / deals.length * 100).toFixed(1);
      const marker = stageId === '3' ? ' ← WON DEALS' : '';
      console.log(`  StageId ${stageId}: ${count} deals (${percentage}%)${marker}`);
    });

  console.log(`\n⚠️  Missing StageId: ${noStageId} deals`);
  console.log(`⚠️  Missing ContactId: ${noContactId} deals`);

  console.log(`\n🎯 Deals with StageId = 3 (Won): ${stageCounts['3'] || 0} deals`);
  console.log(`🎯 Expected customers with sales: ~${stageCounts['3'] || 0} (if all unique)`);
}

checkStageIds().catch(console.error);
