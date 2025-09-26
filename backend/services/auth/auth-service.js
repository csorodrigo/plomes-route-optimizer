const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthService {
    constructor(databaseService) {
        this.db = databaseService;
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.isInitialized = false;
    }

    async ensureInitialized() {
        if (this.isInitialized) return;
        await this.initialize();
    }

    async initialize() {
        try {
            await this.db.ensureInitialized();
            await this.db.ensureDefaultUser();
            this.isInitialized = true;
            console.log('✅ Auth service initialization completed');
        } catch (error) {
            this.isInitialized = false;
            console.error('❌ Auth service initialization failed:', error);
            throw error;
        }
    }

    async hashPassword(password) {
        const salt = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
        return `${salt}:${hash}`;
    }

    async verifyPassword(password, hash) {
        try {
            const [salt, storedHash] = hash.split(':');
            const testHash = crypto.createHash('sha256').update(password + salt).digest('hex');
            return testHash === storedHash;
        } catch (_) {
            return false;
        }
    }

    generateTokenHash(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: 'plomes-rota-cep',
            audience: 'plomes-rota-cep-users'
        });
    }

    async verifyToken(token) {
        return jwt.verify(token, this.jwtSecret, {
            issuer: 'plomes-rota-cep',
            audience: 'plomes-rota-cep-users'
        });
    }

    async login(email, password, userAgent = null, ipAddress = null) {
        try {
            await this.ensureInitialized();

            if (!email || !password) {
                return { success: false, error: 'Email and password are required' };
            }

            const user = await this.db.getUserByEmail(email.toLowerCase());
            if (!user || user.is_active === false) {
                return { success: false, error: 'Invalid email or password' };
            }

            const validPassword = await this.verifyPassword(password, user.password_hash);
            if (!validPassword) {
                return { success: false, error: 'Invalid email or password' };
            }

            const token = await this.generateToken(user);
            const tokenHash = this.generateTokenHash(token);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await this.db.createSession({
                userId: user.id,
                tokenHash,
                expiresAt,
                userAgent,
                ipAddress
            });

            await this.db.updateUserLogin(user.id);

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    lastLogin: expiresAt.toISOString()
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'An error occurred during login' };
        }
    }

    async register(email, password, name, userAgent = null, ipAddress = null) {
        try {
            await this.ensureInitialized();

            if (!email || !password || !name) {
                return { success: false, error: 'Email, password, and name are required' };
            }

            if (!this.isValidEmail(email)) {
                return { success: false, error: 'Please provide a valid email address' };
            }

            if (!this.isValidPassword(password)) {
                return {
                    success: false,
                    error: 'Password must be at least 8 characters long and contain at least one letter and one number'
                };
            }

            const existingUser = await this.db.getUserByEmail(email.toLowerCase());
            if (existingUser) {
                return { success: false, error: 'An account with this email already exists' };
            }

            const passwordHash = await this.hashPassword(password);
            const newUser = await this.db.createUser({ email, name, passwordHash });

            const token = await this.generateToken(newUser);
            const tokenHash = this.generateTokenHash(token);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await this.db.createSession({
                userId: newUser.id,
                tokenHash,
                expiresAt,
                userAgent,
                ipAddress
            });

            return {
                success: true,
                token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    lastLogin: expiresAt.toISOString()
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'An error occurred during registration' };
        }
    }

    async logout(token) {
        try {
            await this.ensureInitialized();
            const decoded = await this.verifyToken(token);
            const tokenHash = this.generateTokenHash(token);
            await this.db.deleteSession(decoded.id, tokenHash);
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: 'Failed to logout' };
        }
    }

    async validateTokenAndGetUser(token) {
        try {
            await this.ensureInitialized();
            const decoded = await this.verifyToken(token);
            const user = await this.db.getUserById(decoded.id);
            if (!user || user.is_active === false) {
                throw new Error('User not found or inactive');
            }
            return user;
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async cleanupExpiredSessions() {
        try {
            await this.ensureInitialized();
            return await this.db.cleanupExpiredSessions();
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
        const minLength = password.length >= 8;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        return minLength && hasLetter && hasNumber;
    }

    async getUserById(userId, includePassword = false) {
        await this.ensureInitialized();
        return this.db.getUserById(userId, { includePassword });
    }

    async updateUserProfile(userId, updates) {
        await this.ensureInitialized();
        const { name } = updates;
        await this.db.updateUserName(userId, name);
    }

    async changePassword(userId, newPasswordHash) {
        await this.ensureInitialized();
        await this.db.updateUserPassword(userId, newPasswordHash);
        await this.db.deleteSessionsByUser(userId);
    }

    async getUserStats() {
        await this.ensureInitialized();
        return this.db.getUserStatsSummary();
    }
}

module.exports = AuthService;
