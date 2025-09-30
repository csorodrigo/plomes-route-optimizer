const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jjtgutjqrdqpbjjaxenf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sbp_581c923a5cf097d4652d24e27cfd57aa86449869';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupUser() {
    console.log('🚀 Creating user table and default user...');

    try {
        // First, create the table
        console.log('📝 Creating users table...');
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;

        const { error: tableError } = await supabase.rpc('exec_sql', {
            sql: createTableSQL
        });

        if (tableError && !tableError.message.includes('already exists')) {
            console.error('❌ Error creating table:', tableError);
        } else {
            console.log('✅ Users table created/verified');
        }

        // Create indexes
        const indexSQL = `
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = TRUE;
        `;

        await supabase.rpc('exec_sql', { sql: indexSQL });
        console.log('✅ Indexes created');

        // Enable RLS
        const rlsSQL = `
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "Service role can do everything on users" ON users;
            CREATE POLICY "Service role can do everything on users" ON users
                FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        `;

        await supabase.rpc('exec_sql', { sql: rlsSQL });
        console.log('✅ RLS policies created');

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', 'gustavo.canuto@ciaramaquinas.com.br')
            .single();

        if (existingUser) {
            console.log('✅ User already exists:', existingUser.email);
            return existingUser;
        }

        // Create the user
        console.log('👤 Creating default user...');
        const passwordHash = await bcrypt.hash('ciara123@', 12);

        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
                email: 'gustavo.canuto@ciaramaquinas.com.br',
                password_hash: passwordHash,
                name: 'Gustavo Canuto',
                is_active: true
            })
            .select()
            .single();

        if (userError) {
            console.error('❌ Error creating user:', userError);
            return null;
        }

        console.log('✅ User created successfully!');
        console.log('📧 Email: gustavo.canuto@ciaramaquinas.com.br');
        console.log('🔑 Password: ciara123@');

        // Test authentication
        const isValid = await bcrypt.compare('ciara123@', passwordHash);
        console.log('🧪 Password verification:', isValid ? '✅ Passed' : '❌ Failed');

        return newUser;

    } catch (error) {
        console.error('💥 Setup failed:', error);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    setupUser()
        .then((result) => {
            if (result) {
                console.log('🎉 Setup completed successfully!');
            } else {
                console.log('❌ Setup failed');
            }
            process.exit(result ? 0 : 1);
        });
}

module.exports = { setupUser };