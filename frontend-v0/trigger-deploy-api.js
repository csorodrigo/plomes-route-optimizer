#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read Vercel token
const authPath = path.join(process.env.HOME, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json');
const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const token = authData.token;

console.log('🚀 Triggering Vercel deployment via API...');
console.log('📦 Project: frontend-v0');
console.log('🌿 Branch: main');

const data = JSON.stringify({
  name: 'frontend-v0',
  project: 'prj_2R3MSWXjidlPhtKXk8I7RMOrWin3',
  target: 'production',
  gitSource: {
    type: 'github',
    ref: 'main',
    repoId: 1052883721
  }
});

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: '/v13/deployments',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`✓ Status: ${res.statusCode}`);

  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(responseData);

      if (response.error) {
        console.error('❌ Error:', response.error.message);
        console.error('Details:', JSON.stringify(response.error, null, 2));
        process.exit(1);
      }

      if (response.url) {
        console.log('\n✅ Deployment triggered successfully!');
        console.log('🌐 URL:', 'https://' + response.url);
        console.log('📊 Deployment ID:', response.id);
        console.log('🔗 Inspector:', response.inspectorUrl || `https://vercel.com/csorodrigo-2569s-projects/frontend-v0/${response.id}`);
        console.log('\n⏳ Deployment is building... This may take a few minutes.');
        console.log('💡 Check status at: https://vercel.com/csorodrigo-2569s-projects/frontend-v0');
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      console.error('Raw response:', responseData);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(data);
req.end();
