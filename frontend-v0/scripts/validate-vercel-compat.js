#!/usr/bin/env node

/**
 * Vercel Compatibility Validation Script
 * Checks code for Vercel deployment compatibility issues
 * Usage: node scripts/validate-vercel-compat.js
 */

const fs = require('fs');
const path = require('path');

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let totalIssues = 0;
let criticalIssues = 0;
let warnings = 0;

function log(type, message, details = '') {
  const icons = {
    pass: `${colors.green}✓${colors.reset}`,
    fail: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`
  };

  console.log(`${icons[type]} ${message}`);
  if (details) {
    console.log(`  ${colors.cyan}→${colors.reset} ${details}`);
  }
}

function checkFileSystemOperations() {
  console.log(`\n${colors.bright}1. Checking for File System Operations${colors.reset}`);
  console.log('─'.repeat(60));

  const problematicPatterns = [
    { pattern: /fs\.(readFile|writeFile|appendFile|mkdir|rmdir|unlink)/g, name: 'fs operations' },
    { pattern: /process\.cwd\(\)/g, name: 'process.cwd()' },
    { pattern: /__dirname/g, name: '__dirname' },
    { pattern: /__filename/g, name: '__filename' },
  ];

  const apiDir = path.join(__dirname, '../src/app/api');
  let foundIssues = false;

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf-8');

        problematicPatterns.forEach(({ pattern, name }) => {
          const matches = content.match(pattern);
          if (matches) {
            foundIssues = true;
            criticalIssues++;
            totalIssues++;
            log('fail', `Found ${name} in ${filePath}`,
              `Serverless functions cannot access file system. Use database or external storage.`);
          }
        });
      }
    });
  }

  if (fs.existsSync(apiDir)) {
    scanDirectory(apiDir);
  }

  if (!foundIssues) {
    log('pass', 'No file system operations found in API routes');
  }
}

function checkExecutionTime() {
  console.log(`\n${colors.bright}2. Checking API Route Complexity${colors.reset}`);
  console.log('─'.repeat(60));

  const apiDir = path.join(__dirname, '../src/app/api');
  const longRunningPatterns = [
    { pattern: /await.*Promise\.all\([^)]{200,}\)/g, name: 'Complex Promise.all' },
    { pattern: /for\s*\([^)]*\)\s*{[^}]{500,}}/g, name: 'Large loop' },
    { pattern: /while\s*\([^)]*\)\s*{[^}]{500,}}/g, name: 'Large while loop' },
  ];

  let foundWarnings = false;

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf-8');

        longRunningPatterns.forEach(({ pattern, name }) => {
          const matches = content.match(pattern);
          if (matches) {
            foundWarnings = true;
            warnings++;
            totalIssues++;
            log('warn', `Found ${name} in ${filePath}`,
              `Review for potential timeout (Vercel Hobby: 10s limit). Consider optimization.`);
          }
        });
      }
    });
  }

  if (fs.existsSync(apiDir)) {
    scanDirectory(apiDir);
  }

  if (!foundWarnings) {
    log('pass', 'No obvious long-running operations detected');
  }

  log('info', 'Recommendation: Test API routes in production to verify <10s execution time');
}

function checkClientComponents() {
  console.log(`\n${colors.bright}3. Checking Client/Server Component Boundaries${colors.reset}`);
  console.log('─'.repeat(60));

  const srcDir = path.join(__dirname, '../src');
  const serverOnlyPatterns = [
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, name: 'require("fs")' },
    { pattern: /import.*from\s+['"]fs['"]/g, name: 'import from "fs"' },
    { pattern: /process\.env\.(?!NEXT_PUBLIC_)/g, name: 'Non-public env vars' },
  ];

  let foundIssues = false;

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !filePath.includes('api')) {
        scanDirectory(filePath);
      } else if ((file.endsWith('.tsx') || file.endsWith('.jsx')) && !filePath.includes('api')) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check if it's a client component
        if (content.includes("'use client'") || content.includes('"use client"')) {
          serverOnlyPatterns.forEach(({ pattern, name }) => {
            const matches = content.match(pattern);
            if (matches) {
              foundIssues = true;
              criticalIssues++;
              totalIssues++;
              log('fail', `Found ${name} in client component ${filePath}`,
                `Client components cannot use server-only APIs. Move to server component or API route.`);
            }
          });
        }
      }
    });
  }

  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir);
  }

  if (!foundIssues) {
    log('pass', 'Client/server component boundaries are correct');
  }
}

function checkEnvironmentVariables() {
  console.log(`\n${colors.bright}4. Checking Environment Variables${colors.reset}`);
  console.log('─'.repeat(60));

  const exampleEnvPath = path.join(__dirname, '../.env.dashboard.example');
  const localEnvPath = path.join(__dirname, '../.env.local');

  if (!fs.existsSync(exampleEnvPath)) {
    warnings++;
    totalIssues++;
    log('warn', '.env.dashboard.example not found',
      'Create example file to document required environment variables');
  } else {
    log('pass', 'Environment example file exists');
  }

  if (fs.existsSync(localEnvPath)) {
    const content = fs.readFileSync(localEnvPath, 'utf-8');
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PLOOME_API_KEY'
    ];

    requiredVars.forEach(varName => {
      if (!content.includes(varName)) {
        warnings++;
        totalIssues++;
        log('warn', `Missing ${varName} in .env.local`,
          'Add to Vercel environment variables before deployment');
      }
    });

    if (warnings === 0) {
      log('pass', 'All required environment variables present');
    }
  } else {
    warnings++;
    totalIssues++;
    log('warn', '.env.local not found',
      'Create from .env.dashboard.example for local development');
  }
}

function checkPackageJson() {
  console.log(`\n${colors.bright}5. Checking package.json${colors.reset}`);
  console.log('─'.repeat(60));

  const packagePath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

  // Check for required scripts
  const requiredScripts = ['build', 'start'];
  requiredScripts.forEach(script => {
    if (!pkg.scripts[script]) {
      criticalIssues++;
      totalIssues++;
      log('fail', `Missing required script: ${script}`,
        'Vercel requires build and start scripts');
    } else {
      log('pass', `Script "${script}" exists`);
    }
  });

  // Check for problematic dependencies
  const problematicDeps = ['express', 'koa', 'hapi'];
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  problematicDeps.forEach(dep => {
    if (allDeps[dep]) {
      warnings++;
      totalIssues++;
      log('warn', `Found ${dep} in dependencies`,
        'Server frameworks may not work as expected in serverless environment');
    }
  });

  // Check Next.js version
  if (pkg.dependencies.next) {
    const nextVersion = pkg.dependencies.next.replace(/[^0-9.]/g, '');
    log('pass', `Using Next.js ${nextVersion}`);
  }
}

function checkVercelConfig() {
  console.log(`\n${colors.bright}6. Checking Vercel Configuration${colors.reset}`);
  console.log('─'.repeat(60));

  const vercelConfigPath = path.join(__dirname, '../vercel.json');

  if (fs.existsSync(vercelConfigPath)) {
    const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));

    // Check for common misconfigurations
    if (config.functions && config.functions['**/*']) {
      log('info', 'Custom function configuration detected');

      if (config.functions['**/*'].maxDuration) {
        const maxDuration = config.functions['**/*'].maxDuration;
        if (maxDuration > 10) {
          warnings++;
          totalIssues++;
          log('warn', `maxDuration set to ${maxDuration}s`,
            'Hobby plan limit is 10s. Requires Pro plan.');
        } else {
          log('pass', `maxDuration is ${maxDuration}s (within Hobby limit)`);
        }
      }
    }

    log('pass', 'vercel.json configuration exists');
  } else {
    log('info', 'No vercel.json found (using Vercel defaults)');
  }
}

function printSummary() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}    Validation Summary${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n  Total Issues:     ${totalIssues > 0 ? colors.yellow : colors.green}${totalIssues}${colors.reset}`);
  console.log(`  Critical Issues:  ${criticalIssues > 0 ? colors.red : colors.green}${criticalIssues}${colors.reset}`);
  console.log(`  Warnings:         ${warnings > 0 ? colors.yellow : colors.green}${warnings}${colors.reset}\n`);

  if (criticalIssues === 0 && warnings === 0) {
    console.log(`${colors.green}${colors.bright}✓ Ready for Vercel deployment!${colors.reset}\n`);
    process.exit(0);
  } else if (criticalIssues === 0) {
    console.log(`${colors.yellow}${colors.bright}⚠ Deployment possible but review warnings${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bright}✗ Critical issues must be fixed before deployment${colors.reset}\n`);
    process.exit(1);
  }
}

// Main execution
console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}    Vercel Compatibility Validator${colors.reset}`);
console.log(`${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}`);

checkFileSystemOperations();
checkExecutionTime();
checkClientComponents();
checkEnvironmentVariables();
checkPackageJson();
checkVercelConfig();
printSummary();