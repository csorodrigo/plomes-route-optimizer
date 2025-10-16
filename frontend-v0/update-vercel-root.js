#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read Vercel token
const authPath = path.join(process.env.HOME, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json');
const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const token = authData.token;

console.log('🔧 Updating Vercel project root directory...');

const data = JSON.stringify({
  rootDirectory: 'frontend-v0'
});

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: '/v9/projects/prj_2R3MSWXjidlPhtKXk8I7RMOrWin3?teamId=team_2Z0REfaA6EnDHlFdjlLlRHcA',
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(responseData);

      if (response.error) {
        console.error('❌ Error:', response.error.message);
        console.error(JSON.stringify(response, null, 2));
        process.exit(1);
      }

      console.log('\n✅ Root directory updated successfully!');
      console.log('📁 Root Directory:', response.rootDirectory || 'frontend-v0');
      console.log('\n🚀 Now triggering a new deployment...');

      // Trigger new deployment
      const deployData = JSON.stringify({
        name: 'frontend-v0',
        project: 'prj_2R3MSWXjidlPhtKXk8I7RMOrWin3',
        target: 'production',
        gitSource: {
          type: 'github',
          ref: 'main',
          repoId: 1052883721
        }
      });

      const deployOptions = {
        hostname: 'api.vercel.com',
        port: 443,
        path: '/v13/deployments',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': deployData.length
        }
      };

      const deployReq = https.request(deployOptions, (deployRes) => {
        let deployResponseData = '';

        deployRes.on('data', (chunk) => {
          deployResponseData += chunk;
        });

        deployRes.on('end', () => {
          const deployResponse = JSON.parse(deployResponseData);

          if (deployResponse.url) {
            console.log('\n✅ New deployment triggered!');
            console.log('🌐 URL:', 'https://' + deployResponse.url);
            console.log('📊 ID:', deployResponse.id);
            console.log('\n⏳ Building with correct root directory...');
          }
        });
      });

      deployReq.on('error', (error) => {
        console.error('Deploy error:', error.message);
      });

      deployReq.write(deployData);
      deployReq.end();

    } catch (e) {
      console.error('Parse error:', e.message);
      console.error('Response:', responseData);
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
