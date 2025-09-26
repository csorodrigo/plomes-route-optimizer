#!/usr/bin/env node

// Environment Configuration Verification Script
// Verifies that all required environment variables are properly configured for Vercel deployment

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Vercel environment configuration...\n');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function logSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// Critical environment variables that must be configured
const requiredVars = [
    {
        name: 'SUPABASE_URL',
        expectedValue: 'https://yxwokryybudwygtemfmu.supabase.co',
        description: 'Supabase project URL'
    },
    {
        name: 'SUPABASE_ANON_KEY',
        expectedStart: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        description: 'Supabase anonymous key for client-side operations'
    },
    {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        expectedStart: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        description: 'Supabase service role key for server-side operations'
    },
    {
        name: 'PLOOME_API_KEY',
        expectedStart: 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3',
        description: 'Ploome API key for CRM integration'
    },
    {
        name: 'PLOOMES_API_KEY',
        expectedStart: 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3',
        description: 'Alternative Ploome API key naming convention'
    },
    {
        name: 'PLOOMES_BASE_URL',
        expectedValue: 'https://public-api2.ploomes.com',
        description: 'Ploome API base URL'
    },
    {
        name: 'CLIENT_TAG_ID',
        expectedValue: '40006184',
        description: 'Ploome client tag ID for filtering customers'
    },
    {
        name: 'JWT_SECRET',
        minLength: 20,
        description: 'JWT secret for authentication token signing'
    },
    {
        name: 'GOOGLE_MAPS_API_KEY',
        expectedStart: 'AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV-7nuvHk',
        description: 'Google Maps API key for geocoding'
    }
];

// Optional environment variables
const optionalVars = [
    'JWT_EXPIRES_IN',
    'API_RATE_LIMIT_PER_MINUTE',
    'GEOCODING_DELAY_MS',
    'CACHE_TTL_CUSTOMERS',
    'CACHE_TTL_GEOCODING',
    'CACHE_TTL_ROUTES',
    'POSITIONSTACK_API_KEY',
    'OPENROUTE_API_KEY'
];

let hasErrors = false;
let hasWarnings = false;

// Read and verify vercel.json
try {
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');

    if (!fs.existsSync(vercelConfigPath)) {
        logError('vercel.json file not found');
        process.exit(1);
    }

    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    if (!vercelConfig.env) {
        logError('No env section found in vercel.json');
        process.exit(1);
    }

    logInfo('Checking required environment variables in vercel.json...\n');

    // Check required variables
    requiredVars.forEach(varConfig => {
        const value = vercelConfig.env[varConfig.name];

        if (!value) {
            logError(`${varConfig.name} is missing from vercel.json`);
            console.log(`   Description: ${varConfig.description}`);
            hasErrors = true;
        } else {
            // Validate the value
            let isValid = true;
            let validationMessage = '';

            if (varConfig.expectedValue && value !== varConfig.expectedValue) {
                isValid = false;
                validationMessage = `Expected: ${varConfig.expectedValue}`;
            } else if (varConfig.expectedStart && !value.startsWith(varConfig.expectedStart)) {
                isValid = false;
                validationMessage = `Should start with: ${varConfig.expectedStart.substring(0, 20)}...`;
            } else if (varConfig.minLength && value.length < varConfig.minLength) {
                isValid = false;
                validationMessage = `Should be at least ${varConfig.minLength} characters`;
            }

            if (isValid) {
                logSuccess(`${varConfig.name} is configured correctly`);
            } else {
                logError(`${varConfig.name} value is incorrect - ${validationMessage}`);
                hasErrors = true;
            }
        }
    });

    console.log();
    logInfo('Checking optional environment variables...\n');

    // Check optional variables
    optionalVars.forEach(varName => {
        const value = vercelConfig.env[varName];

        if (value) {
            logSuccess(`${varName} is configured`);
        } else {
            logWarning(`${varName} is not configured (optional)`);
            hasWarnings = true;
        }
    });

    console.log();
    logInfo('Verifying file structure for Vercel deployment...\n');

    // Check required files and directories
    const requiredFiles = [
        'package.json',
        'vercel.json',
        '.env.production',
        'api/customers.js',
        'api/statistics.js',
        'api/cep-[cep].js',
        'lib/supabase.js'
    ];

    requiredFiles.forEach(filePath => {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
            logSuccess(`${filePath} exists`);
        } else {
            logError(`${filePath} is missing`);
            hasErrors = true;
        }
    });

    // Check frontend build directory
    const frontendBuildPath = path.join(process.cwd(), 'frontend', 'build');
    if (fs.existsSync(frontendBuildPath)) {
        logSuccess('frontend/build directory exists');
    } else {
        logWarning('frontend/build directory not found - run npm run build in frontend directory');
        hasWarnings = true;
    }

    console.log();
    logInfo('Summary:\n');

    if (hasErrors) {
        logError('Configuration has critical errors that must be fixed before deployment');
        console.log('Please fix the above errors and run this script again.\n');
        process.exit(1);
    } else if (hasWarnings) {
        logWarning('Configuration has minor issues but is ready for deployment');
        logInfo('You may proceed with deployment, but consider addressing the warnings.\n');
    } else {
        logSuccess('🎉 All environment variables are correctly configured!');
        logSuccess('Your application is ready for Vercel deployment.\n');
    }

    // Display deployment summary
    console.log(`${colors.blue}=== DEPLOYMENT READY SUMMARY ===${colors.reset}`);
    console.log('✅ All required environment variables configured');
    console.log('✅ Supabase credentials properly set');
    console.log('✅ Ploome API integration configured');
    console.log('✅ Geocoding APIs configured');
    console.log('✅ JWT authentication system ready');
    console.log('✅ All serverless function files present');
    console.log('');
    console.log(`${colors.green}🚀 Ready to deploy! Run: ./deploy-to-vercel.sh${colors.reset}`);

} catch (error) {
    logError(`Error reading or parsing configuration: ${error.message}`);
    process.exit(1);
}