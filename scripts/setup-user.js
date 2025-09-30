#!/usr/bin/env node

/**
 * Setup default user for authentication
 * Creates the default user gustavo.canuto@ciaramaquinas.com.br with password ciara123@
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { join } = require('path');
const { readFileSync } = require('fs');

const path = require('path');
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jjtgutjqrdqpbjjaxenf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sbp_581c923a5cf097d4652d24e27cfd57aa86449869';

// Default user credentials
const DEFAULT_USER = {
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    password: 'ciara123@',
    name: 'Gustavo Canuto'
};

// Create Supabase client with service key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Creates the users table if it doesn't exist
 */
async function createUsersTable() {
    console.log('🔧 Creating users table...');

    try {
        // Read the SQL file
        const sqlPath = join(__dirname, '..', 'sql', 'create_users_table.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        // Split into individual statements
        const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`📝 Executing ${statements.length} SQL statements...`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: statement
                });

                if (error) {
                    if (error.message.includes('already exists')) {
                        console.log(`✅ Statement ${i + 1}: Already exists (expected)`);
                    } else {
                        console.error(`❌ Error in statement ${i + 1}:`, error.message);
                    }
                } else {
                    console.log(`✅ Statement ${i + 1}: Executed successfully`);
                }
            } catch (execError) {
                console.error(`💥 Exception in statement ${i + 1}:`, execError.message);
            }

            // Small delay between statements
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Users table setup completed');
        return true;

    } catch (error) {
        console.error('❌ Error creating users table:', error);
        return false;
    }
}

/**
 * Creates the default user
 */
async function createDefaultUser() {
    console.log('👤 Creating default user...');

    try {
        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', DEFAULT_USER.email)
            .single();

        if (existingUser) {
            console.log(`✅ User ${DEFAULT_USER.email} already exists`);
            return existingUser;
        }

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is expected
            console.error('❌ Error checking existing user:', checkError);
            return null;
        }

        // Hash the password
        console.log('🔐 Hashing password...');
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(DEFAULT_USER.password, saltRounds);

        // Insert the user
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                email: DEFAULT_USER.email,
                password_hash: passwordHash,
                name: DEFAULT_USER.name,
                is_active: true
            })
            .select()
            .single();

        if (insertError) {
            console.error('❌ Error creating user:', insertError);
            return null;
        }

        console.log(`✅ User created successfully: ${newUser.email}`);
        console.log(`📧 Email: ${DEFAULT_USER.email}`);
        console.log(`🔑 Password: ${DEFAULT_USER.password}`);
        console.log(`👤 Name: ${DEFAULT_USER.name}`);

        return newUser;

    } catch (error) {
        console.error('❌ Error in user creation:', error);
        return null;
    }
}

/**
 * Verifies the user can authenticate
 */
async function verifyUserAuthentication() {
    console.log('🧪 Testing user authentication...');

    try {
        // Get the user from database
        const { data: user, error: getUserError } = await supabase
            .from('users')
            .select('*')
            .eq('email', DEFAULT_USER.email)
            .single();

        if (getUserError) {
            console.error('❌ Error fetching user for verification:', getUserError);
            return false;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(DEFAULT_USER.password, user.password_hash);

        if (!isValidPassword) {
            console.error('❌ Password verification failed');
            return false;
        }

        console.log('✅ User authentication verification passed');
        console.log(`📊 User details:`);
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Name: ${user.name}`);
        console.log(`   - Active: ${user.is_active}`);
        console.log(`   - Created: ${user.created_at}`);

        return true;

    } catch (error) {
        console.error('❌ Error verifying authentication:', error);
        return false;
    }
}

/**
 * Main setup function
 */
async function setupUser() {
    console.log('🚀 Starting user setup...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log(`🎯 Target user: ${DEFAULT_USER.email}`);

    try {
        // Step 1: Create users table
        const tableCreated = await createUsersTable();
        if (!tableCreated) {
            throw new Error('Failed to create users table');
        }

        // Step 2: Create default user
        const user = await createDefaultUser();
        if (!user) {
            throw new Error('Failed to create default user');
        }

        // Step 3: Verify authentication
        const authVerified = await verifyUserAuthentication();
        if (!authVerified) {
            throw new Error('Failed to verify user authentication');
        }

        console.log('\n🎉 User setup completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Make sure environment variables are set in Vercel:');
        console.log(`   SUPABASE_URL=${SUPABASE_URL}`);
        console.log(`   SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}`);
        console.log('2. Deploy to Vercel');
        console.log('3. Test login with the credentials above');

        return true;

    } catch (error) {
        console.error('💥 Setup failed:', error);
        return false;
    }
}

// Run setup if called directly
if (require.main === module) {
    setupUser()
        .then((success) => {
            if (success) {
                console.log('✨ Setup completed successfully!');
                process.exit(0);
            } else {
                console.log('❌ Setup failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('💥 Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { setupUser, createDefaultUser, verifyUserAuthentication };