// Setup Supabase Database Schema
// Run this script to create the necessary tables and functions in Supabase

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jjtgutjqrdqpbjjaxenf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sbp_581c923a5cf097d4652d24e27cfd57aa86449869';

// Create Supabase client with service key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupDatabase() {
    try {
        console.log('🚀 Setting up Supabase database schema...');

        // Read the SQL schema file
        const schemaPath = join(__dirname, '..', 'sql', 'supabase_schema.sql');
        const schemaSql = readFileSync(schemaPath, 'utf8');

        console.log('📄 Read schema SQL file successfully');

        // Split SQL into individual statements (basic splitting on semicolons)
        const statements = schemaSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`🔧 Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            try {
                console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);

                // Use raw SQL execution for schema creation
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: statement
                });

                if (error) {
                    // Some statements might fail if they already exist (like CREATE TABLE IF NOT EXISTS)
                    // Log as warning instead of error for these cases
                    if (error.message.includes('already exists') || error.message.includes('does not exist')) {
                        console.log(`⚠️  Statement ${i + 1}: ${error.message} (expected)`);
                    } else {
                        console.error(`❌ Error in statement ${i + 1}:`, error.message);
                        errorCount++;
                    }
                } else {
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                    successCount++;
                }
            } catch (execError) {
                console.error(`💥 Exception in statement ${i + 1}:`, execError.message);
                errorCount++;
            }

            // Small delay between statements
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\n📊 Schema setup results:');
        console.log(`✅ Successful statements: ${successCount}`);
        console.log(`❌ Failed statements: ${errorCount}`);

        // Test the setup by creating initial records
        console.log('\n🧪 Testing database setup...');

        try {
            // Test customers table
            const { data: customerTest, error: customerError } = await supabase
                .from('customers')
                .select('count(*)')
                .single();

            if (customerError) {
                console.error('❌ Customers table test failed:', customerError);
            } else {
                console.log('✅ Customers table is accessible');
            }

            // Test geocoding_stats table
            const { data: statsTest, error: statsError } = await supabase
                .from('geocoding_stats')
                .select('*')
                .eq('id', 'global');

            if (statsError) {
                console.error('❌ Geocoding stats table test failed:', statsError);
            } else {
                console.log('✅ Geocoding stats table is accessible');
            }

            // Test RPC functions
            const { data: funcTest, error: funcError } = await supabase
                .rpc('get_customer_statistics');

            if (funcError) {
                console.error('❌ RPC functions test failed:', funcError);
            } else {
                console.log('✅ RPC functions are working');
                console.log('📊 Current customer stats:', funcTest);
            }

        } catch (testError) {
            console.error('💥 Database test failed:', testError);
        }

        console.log('\n🎉 Supabase database setup completed!');
        console.log('🔑 Make sure to set these environment variables in Vercel:');
        console.log(`SUPABASE_URL=${SUPABASE_URL}`);
        console.log(`SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}`);

    } catch (error) {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

// Create a simple exec_sql function if it doesn't exist
async function createExecSqlFunction() {
    const execSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS text AS $$
BEGIN
    EXECUTE sql;
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$ LANGUAGE plpgsql;
`;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: execSqlFunction });
        if (error) {
            console.log('⚠️  exec_sql function may not exist, will try direct execution');
        }
    } catch (e) {
        console.log('⚠️  Will try to execute SQL statements directly');
    }
}

// Run setup
if (import.meta.url === `file://${process.argv[1]}`) {
    await createExecSqlFunction();
    await setupDatabase();
}