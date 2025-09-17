const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

class AuthService {
    constructor(databaseService) {
        this.db = databaseService;
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('🔐 Initializing auth service...');

            // RAILWAY FIX: Check if database is already initialized to avoid conflicts
            if (this.db && this.db.isInitialized) {
                console.log('✅ Database already initialized, skipping table creation');
                await this.createDefaultUser();
            } else {
                await this.createUsersTables();
                await this.createDefaultUser();
            }

            this.isInitialized = true;
            console.log('✅ Auth service initialization completed');
        } catch (error) {
            console.error('❌ Auth service initialization failed:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    async createUsersTables() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `;

        const createUserSessionsTable = `
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_agent TEXT,
                ip_address TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `;

        const createUserIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)'
        ];

        await this.db.run(createUsersTable);
        await this.db.run(createUserSessionsTable);
        
        for (const index of createUserIndexes) {
            await this.db.run(index);
        }
    }

    async createDefaultUser() {
        try {
            const defaultEmail = 'gustavo.canuto@ciaramaquinas.com.br';
            const defaultPassword = 'ciara123@';
            const defaultName = 'Gustavo Canuto';

            // Check if default user already exists
            const existingUser = await this.db.get(
                'SELECT id, password_hash FROM users WHERE email = ?',
                [defaultEmail]
            );

            if (existingUser) {
                // Check if password hash is in old bcrypt format (doesn't contain ':')
                if (!existingUser.password_hash.includes(':')) {
                    console.log('🔄 Updating user from bcrypt to SHA256 hash...');
                    
                    // Delete old user
                    await this.db.run('DELETE FROM users WHERE email = ?', [defaultEmail]);
                    
                    // Recreate with SHA256
                    const passwordHash = await this.hashPassword(defaultPassword);
                    await this.db.run(
                        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                        [defaultEmail, passwordHash, defaultName]
                    );
                    
                    console.log('✅ User updated to SHA256 hash:', defaultEmail);
                } else {
                    console.log('✅ Default user already exists with SHA256');
                }
                return;
            }

            // Create default user with SHA256
            const passwordHash = await this.hashPassword(defaultPassword);

            await this.db.run(
                'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                [defaultEmail, passwordHash, defaultName]
            );

            console.log('✅ Default user created with SHA256:', defaultEmail);
        } catch (error) {
            console.error('❌ Error creating/updating default user:', error);
        }
    }

    async hashPassword(password) {
        // Use SHA-256 with salt for password hashing
        const salt = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
        return salt + ':' + hash;
    }

    async verifyPassword(password, hash) {
        try {
            const [salt, storedHash] = hash.split(':');
            const testHash = crypto.createHash('sha256').update(password + salt).digest('hex');
            return testHash === storedHash;
        } catch (error) {
            return false;
        }
    }

    // Generate a fast hash for token storage (not for passwords)
    generateTokenHash(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name
        };

        const token = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: 'plomes-rota-cep',
            audience: 'plomes-rota-cep-users'
        });

        return token;
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret, {
                issuer: 'plomes-rota-cep',
                audience: 'plomes-rota-cep-users'
            });
            return decoded;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async login(email, password, userAgent = null, ipAddress = null) {
        try {
            // RAILWAY FIX: Ensure auth service is initialized with timeout protection
            if (!this.isInitialized) {
                console.log('🔄 Auth service not initialized, initializing now...');
                const initPromise = this.initialize();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout (15s)')), 15000)
                );
                await Promise.race([initPromise, timeoutPromise]);
            }

            // Input validation
            if (!email || !password) {
                return {
                    success: false,
                    error: 'Email and password are required'
                };
            }

            // Find user by email
            const user = await this.db.get(
                'SELECT * FROM users WHERE email = ? AND is_active = 1',
                [email.toLowerCase()]
            );

            if (!user) {
                return {
                    success: false,
                    error: 'Invalid email or password'
                };
            }

            // Verify password
            const validPassword = await this.verifyPassword(password, user.password_hash);
            if (!validPassword) {
                return {
                    success: false,
                    error: 'Invalid email or password'
                };
            }

            // Generate JWT token
            const token = await this.generateToken(user);

            // Create session record
            const tokenHash = this.generateTokenHash(token);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

            await this.db.run(
                'INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)',
                [user.id, tokenHash, expiresAt.toISOString(), userAgent, ipAddress]
            );

            // Update last login
            await this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    lastLogin: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'An error occurred during login'
            };
        }
    }

    async register(email, password, name, userAgent = null, ipAddress = null) {
        try {
            // RAILWAY FIX: Ensure auth service is initialized with timeout protection
            if (!this.isInitialized) {
                console.log('🔄 Auth service not initialized, initializing now...');
                const initPromise = this.initialize();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout (15s)')), 15000)
                );
                await Promise.race([initPromise, timeoutPromise]);
            }

            // Input validation
            if (!email || !password || !name) {
                return {
                    success: false,
                    error: 'Email, password, and name are required'
                };
            }

            if (!this.isValidEmail(email)) {
                return {
                    success: false,
                    error: 'Please provide a valid email address'
                };
            }

            if (!this.isValidPassword(password)) {
                return {
                    success: false,
                    error: 'Password must be at least 8 characters long and contain at least one letter and one number'
                };
            }

            // Check if user already exists
            const existingUser = await this.db.get(
                'SELECT id FROM users WHERE email = ?',
                [email.toLowerCase()]
            );

            if (existingUser) {
                return {
                    success: false,
                    error: 'An account with this email already exists'
                };
            }

            // Hash password
            const passwordHash = await this.hashPassword(password);

            // Create user
            const result = await this.db.run(
                'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                [email.toLowerCase(), passwordHash, name.trim()]
            );

            const newUser = {
                id: result.id,
                email: email.toLowerCase(),
                name: name.trim()
            };

            // Generate JWT token
            const token = await this.generateToken(newUser);

            // Create session record
            const tokenHash = this.generateTokenHash(token);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

            await this.db.run(
                'INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)',
                [newUser.id, tokenHash, expiresAt.toISOString(), userAgent, ipAddress]
            );

            return {
                success: true,
                token,
                user: {
                    ...newUser,
                    lastLogin: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: 'An error occurred during registration'
            };
        }
    }

    async logout(token) {
        try {
            // Decode token to get user info
            const decoded = await this.verifyToken(token);
            
            // Remove session from database
            const tokenHash = this.generateTokenHash(token);
            await this.db.run(
                'DELETE FROM user_sessions WHERE user_id = ? AND token_hash = ?',
                [decoded.id, tokenHash]
            );

            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: 'Failed to logout' };
        }
    }

    async validateTokenAndGetUser(token) {
        try {
            // RAILWAY FIX: Ensure auth service is initialized with timeout protection
            if (!this.isInitialized) {
                console.log('🔄 Auth service not initialized, initializing now...');
                const initPromise = this.initialize();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout (15s)')), 15000)
                );
                await Promise.race([initPromise, timeoutPromise]);
            }

            // Verify JWT token
            const decoded = await this.verifyToken(token);

            // Get user from database
            const user = await this.db.get(
                'SELECT id, email, name, last_login FROM users WHERE id = ? AND is_active = 1',
                [decoded.id]
            );

            if (!user) {
                throw new Error('User not found or inactive');
            }

            // For this simple implementation, we'll just verify the JWT is valid
            // In a production environment, you might want to track sessions more strictly
            // For now, if JWT is valid and user exists, allow access

            return user;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async cleanupExpiredSessions() {
        try {
            const result = await this.db.run(
                'DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP'
            );
            
            if (result.changes > 0) {
                console.log(`🧹 Cleaned up ${result.changes} expired sessions`);
            }
            
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            return 0;
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPassword(password) {
        // At least 8 characters, contains letters and numbers
        const minLength = password.length >= 8;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        
        return minLength && hasLetter && hasNumber;
    }

    // Get user by ID with optional password
    async getUserById(userId, includePassword = false) {
        try {
            const query = includePassword
                ? 'SELECT * FROM users WHERE id = ?'
                : 'SELECT id, email, name, is_active, created_at, updated_at, last_login FROM users WHERE id = ?';

            return await this.db.get(query, [userId]);
        } catch (error) {
            console.error('Error getting user by ID:', error);
            throw error;
        }
    }

    // Update user profile
    async updateUserProfile(userId, updates) {
        try {
            const { name } = updates;
            await this.db.run(
                'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [name, userId]
            );
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    // Change user password and invalidate sessions
    async changePassword(userId, newPasswordHash) {
        try {
            // Update password
            await this.db.run(
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPasswordHash, userId]
            );

            // Invalidate all existing sessions for security
            await this.db.run(
                'DELETE FROM user_sessions WHERE user_id = ?',
                [userId]
            );
        } catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    }

    // Get user statistics
    async getUserStats() {
        try {
            const totalUsers = await this.db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
            const activeSessions = await this.db.get('SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > CURRENT_TIMESTAMP');

            return {
                totalUsers: totalUsers.count,
                activeSessions: activeSessions.count
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return { totalUsers: 0, activeSessions: 0 };
        }
    }
}

module.exports = AuthService;