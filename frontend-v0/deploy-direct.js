#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vercel deployment...');

try {
  const cwd = __dirname;
  console.log('📁 Working directory:', cwd);

  // Try to deploy with explicit settings
  const deployCmd = 'vercel deploy --prod --yes --no-wait';
  console.log('📦 Running:', deployCmd);

  const result = execSync(deployCmd, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 120000 // 2 minute timeout
  });

  console.log('✅ Deployment initiated!');
  console.log(result);

} catch (error) {
  console.error('❌ Deployment failed:', error.message);

  // Try alternative: check if we can at least get deployment list
  try {
    console.log('\n🔍 Checking recent deployments...');
    const listCmd = 'vercel ls --prod';
    const deployments = execSync(listCmd, {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 30000
    });
    console.log(deployments);
  } catch (e) {
    console.error('❌ Could not list deployments:', e.message);
  }

  process.exit(1);
}
