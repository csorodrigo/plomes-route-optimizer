const crypto = require('crypto');
const DatabaseService = require('./backend/services/sync/database-service');

async function resetDefaultUser() {
    const db = new DatabaseService();
    await db.initialize();
    
    // Create auth service to initialize tables
    const AuthService = require('./backend/services/auth/auth-service');
    const authService = new AuthService(db);
    await authService.initialize();
    
    // Hash password using new SHA-256 method
    const password = 'ciara123@';
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    const passwordHash = salt + ':' + hash;
    
    // Delete existing user
    await db.run('DELETE FROM users WHERE email = ?', ['gustavo.canuto@ciaramaquinas.com.br']);
    
    // Create new user with SHA-256 hash
    await db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        ['gustavo.canuto@ciaramaquinas.com.br', passwordHash, 'Gustavo Canuto']
    );
    
    console.log('✅ User reset with SHA-256 hash');
    process.exit(0);
}

resetDefaultUser().catch(error => {
    console.error('❌ Error resetting user:', error);
    process.exit(1);
});