const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'database.sqlite');

// Function to create SHA256 hash with salt
function hashPasswordSHA256(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    return salt + ':' + hash;
}

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

// Default user credentials
const defaultEmail = 'gustavo.canuto@ciaramaquinas.com.br';
const defaultPassword = 'ciara123@';
const defaultName = 'Gustavo Canuto';

// Create new password hash
const newPasswordHash = hashPasswordSHA256(defaultPassword);

console.log('Resetting default user...');
console.log('Email:', defaultEmail);
console.log('New hash format: SHA256 with salt');

// Delete existing user
db.run('DELETE FROM users WHERE email = ?', [defaultEmail], function(err) {
    if (err) {
        console.error('Error deleting existing user:', err);
        db.close();
        process.exit(1);
    }
    
    console.log('Existing user deleted (if existed)');
    
    // Insert user with new hash
    db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [defaultEmail, newPasswordHash, defaultName],
        function(err) {
            if (err) {
                console.error('Error creating user:', err);
                db.close();
                process.exit(1);
            }
            
            console.log('✅ Default user recreated with SHA256 hash');
            console.log('User ID:', this.lastID);
            
            // Verify the user was created
            db.get('SELECT * FROM users WHERE email = ?', [defaultEmail], (err, row) => {
                if (err) {
                    console.error('Error verifying user:', err);
                } else if (row) {
                    console.log('✅ User verified in database:');
                    console.log('  - ID:', row.id);
                    console.log('  - Email:', row.email);
                    console.log('  - Name:', row.name);
                    console.log('  - Hash format: SHA256');
                } else {
                    console.error('❌ User not found after creation');
                }
                
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                });
            });
        }
    );
});