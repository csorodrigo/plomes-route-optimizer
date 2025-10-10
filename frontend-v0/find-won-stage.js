// Find which StageId represents "won" deals
const https = require('https');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';

// First, get deal stages to find the "won" stage
const url = 'https://api2.ploomes.com/DealStages';

const options = {
  headers: {
    'User-Key': PLOOMES_API_KEY
  }
};

console.log('🔍 Fetching DealStages from Ploomes API...\n');

https.get(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const stages = JSON.parse(data).value;

    console.log(`📊 Found ${stages.length} Deal Stages:\n`);

    stages.forEach((stage) => {
      const name = stage.Name || 'No Name';
      const id = stage.Id;
      const isWon = stage.IsWon === true || stage.Win === true || name.toLowerCase().includes('gan') || name.toLowerCase().includes('won');
      const marker = isWon ? ' ← 🏆 LIKELY WON STAGE' : '';

      console.log(`ID: ${id} | Name: ${name}${marker}`);
    });

    // Find the "won" stage(s)
    const wonStages = stages.filter(s =>
      s.IsWon === true ||
      s.Win === true ||
      (s.Name && s.Name.toLowerCase().includes('gan'))  ||
      (s.Name && s.Name.toLowerCase().includes('won'))
    );

    console.log('\n🎯 WON STAGES:');
    wonStages.forEach(s => {
      console.log(`  ID: ${s.Id} | Name: ${s.Name}`);
    });
  });
}).on('error', (err) => {
  console.error('❌ Error:', err.message);
});
