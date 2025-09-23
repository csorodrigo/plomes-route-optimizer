const rateLimit = require('express-rate-limit');

class AuthMiddleware {
    constructor(authService) {
        this.authService = authService;
        
        // Rate limiting for auth endpoints
        this.authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 attempts per window - increased for production
            message: {
                success: false,
                error: 'Too many authentication attempts. Please try again in 15 minutes.'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        
        this.generalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: {
                success: false,
                error: 'Too many requests. Please try again later.'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    // Middleware to authenticate JWT tokens
    authenticate = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    error: 'Access token required'
                });
            }

            const token = authHeader.startsWith('Bearer ') 
                ? authHeader.slice(7)
                : authHeader;

            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token format'
                });
            }

            // Validate token and get user
            const user = await this.authService.validateTokenAndGetUser(token);
            
            // Add user to request object
            req.user = user;
            req.token = token;
            
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
    };

    // Optional authentication - doesn't fail if no token
    optionalAuth = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (authHeader) {
                const token = authHeader.startsWith('Bearer ') 
                    ? authHeader.slice(7)
                    : authHeader;

                if (token) {
                    try {
                        const user = await this.authService.validateTokenAndGetUser(token);
                        req.user = user;
                        req.token = token;
                    } catch (error) {
                        // Ignore errors in optional auth
                        console.log('Optional auth failed:', error.message);
                    }
                }
            }
            
            next();
        } catch (error) {
            // Don't fail on optional auth errors
            next();
        }
    };

    // Extract user info from request
    extractUserInfo = (req) => {
        const userAgent = req.get('User-Agent') || '';
        const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        
        return { userAgent, ipAddress };
    };

    // Rate limiting middleware
    applyAuthRateLimit = () => {
        return this.authLimiter;
    };

    applyGeneralRateLimit = () => {
        return this.generalLimiter;
    };

    // CORS middleware for authentication
    corsOptions = {
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, etc.)
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001'
            ];
            
            // In production, add your production domain
            if (process.env.NODE_ENV === 'production') {
                allowedOrigins.push(process.env.FRONTEND_URL);
            }
            
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };

    // Error handler for authentication errors
    errorHandler = (error, req, res, next) => {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }
        
        if (error.message === 'Not allowed by CORS') {
            return res.status(403).json({
                success: false,
                error: 'CORS policy violation'
            });
        }
        
        next(error);
    };

    // Validation middleware for auth endpoints
    validateLoginInput = (req, res, next) => {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        if (!this.authService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address'
            });
        }
        
        next();
    };

    validateRegisterInput = (req, res, next) => {
        const { email, password, name } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required'
            });
        }
        
        if (!this.authService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address'
            });
        }
        
        if (!this.authService.isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long and contain at least one letter and one number'
            });
        }
        
        if (name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Name must be at least 2 characters long'
            });
        }
        
        next();
    };

    // Security headers middleware
    securityHeaders = (req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Remove server header
        res.removeHeader('X-Powered-By');
        
        next();
    };

    // Check if user is admin (extend this based on your user roles)
    requireAdmin = (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // For now, treat the default user as admin
        // You can extend this with proper role management
        if (req.user.email !== 'gustavo.canuto@ciaramaquinas.com.br') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }
        
        next();
    };
}

module.exports = AuthMiddleware;