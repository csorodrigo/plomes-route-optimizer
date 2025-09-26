const express = require('express');
const router = express.Router();

class AuthRoutes {
    constructor(authService, authMiddleware) {
        this.authService = authService;
        this.authMiddleware = authMiddleware;
        this.setupRoutes();
    }

    setupRoutes() {
        // Apply rate limiting to auth routes
        router.use(this.authMiddleware.applyAuthRateLimit());

        // Login endpoint
        router.post('/login', 
            this.authMiddleware.validateLoginInput,
            async (req, res) => {
                try {
                    const { email, password } = req.body;
                    const { userAgent, ipAddress } = this.authMiddleware.extractUserInfo(req);
                    
                    console.log(`🔐 Login attempt for: ${email}`);
                    
                    const result = await this.authService.login(email, password, userAgent, ipAddress);
                    
                    if (result.success) {
                        console.log(`✅ Login successful for: ${email}`);
                        res.json({
                            success: true,
                            message: 'Login successful',
                            token: result.token,
                            user: result.user
                        });
                    } else {
                        console.log(`❌ Login failed for: ${email} - ${result.error}`);
                        res.status(401).json({
                            success: false,
                            error: result.error
                        });
                    }
                } catch (error) {
                    console.error('Login endpoint error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred during login'
                    });
                }
            }
        );

        // Register endpoint
        router.post('/register',
            this.authMiddleware.validateRegisterInput,
            async (req, res) => {
                try {
                    const { email, password, name } = req.body;
                    const { userAgent, ipAddress } = this.authMiddleware.extractUserInfo(req);
                    
                    console.log(`📝 Registration attempt for: ${email}`);
                    
                    const result = await this.authService.register(email, password, name, userAgent, ipAddress);
                    
                    if (result.success) {
                        console.log(`✅ Registration successful for: ${email}`);
                        res.status(201).json({
                            success: true,
                            message: 'Registration successful',
                            token: result.token,
                            user: result.user
                        });
                    } else {
                        console.log(`❌ Registration failed for: ${email} - ${result.error}`);
                        res.status(400).json({
                            success: false,
                            error: result.error
                        });
                    }
                } catch (error) {
                    console.error('Registration endpoint error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred during registration'
                    });
                }
            }
        );

        // Logout endpoint
        router.post('/logout',
            this.authMiddleware.authenticate,
            async (req, res) => {
                try {
                    console.log(`🚪 Logout attempt for user: ${req.user.email}`);
                    
                    const result = await this.authService.logout(req.token);
                    
                    if (result.success) {
                        console.log(`✅ Logout successful for: ${req.user.email}`);
                        res.json({
                            success: true,
                            message: 'Logout successful'
                        });
                    } else {
                        res.status(400).json({
                            success: false,
                            error: result.error
                        });
                    }
                } catch (error) {
                    console.error('Logout endpoint error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred during logout'
                    });
                }
            }
        );

        // Verify token endpoint
        router.get('/verify',
            this.authMiddleware.authenticate,
            async (req, res) => {
                try {
                    // If we reach here, the token is valid (middleware passed)
                    res.json({
                        success: true,
                        message: 'Token is valid',
                        user: {
                            id: req.user.id,
                            email: req.user.email,
                            name: req.user.name,
                            lastLogin: req.user.last_login
                        }
                    });
                } catch (error) {
                    console.error('Token verification error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred during token verification'
                    });
                }
            }
        );

        // Get current user profile
        router.get('/profile',
            this.authMiddleware.authenticate,
            async (req, res) => {
                try {
                    res.json({
                        success: true,
                        user: {
                            id: req.user.id,
                            email: req.user.email,
                            name: req.user.name,
                            lastLogin: req.user.last_login
                        }
                    });
                } catch (error) {
                    console.error('Profile endpoint error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred while fetching profile'
                    });
                }
            }
        );

        // Update user profile
        router.put('/profile',
            this.authMiddleware.authenticate,
            async (req, res) => {
                try {
                    const { name } = req.body;
                    
                    if (!name || name.trim().length < 2) {
                        return res.status(400).json({
                            success: false,
                            error: 'Name must be at least 2 characters long'
                        });
                    }
                    
                    // Update user name in database
                    await this.authService.updateUserProfile(req.user.id, { name: name.trim() });
                    
                    console.log(`✅ Profile updated for user: ${req.user.email}`);
                    
                    res.json({
                        success: true,
                        message: 'Profile updated successfully',
                        user: {
                            id: req.user.id,
                            email: req.user.email,
                            name: name.trim(),
                            lastLogin: req.user.last_login
                        }
                    });
                } catch (error) {
                    console.error('Profile update error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred while updating profile'
                    });
                }
            }
        );

        // Change password endpoint
        router.put('/password',
            this.authMiddleware.authenticate,
            async (req, res) => {
                try {
                    const { currentPassword, newPassword } = req.body;
                    
                    if (!currentPassword || !newPassword) {
                        return res.status(400).json({
                            success: false,
                            error: 'Current password and new password are required'
                        });
                    }
                    
                    if (!this.authService.isValidPassword(newPassword)) {
                        return res.status(400).json({
                            success: false,
                            error: 'New password must be at least 8 characters long and contain at least one letter and one number'
                        });
                    }
                    
                    // Get current user with password hash
                    const user = await this.authService.getUserById(req.user.id, true);
                    
                    // Verify current password
                    const validPassword = await this.authService.verifyPassword(currentPassword, user.password_hash);
                    if (!validPassword) {
                        return res.status(400).json({
                            success: false,
                            error: 'Current password is incorrect'
                        });
                    }
                    
                    // Hash new password
                    const newPasswordHash = await this.authService.hashPassword(newPassword);
                    
                    // Update password in database
                    await this.authService.changePassword(req.user.id, newPasswordHash);
                    
                    console.log(`✅ Password changed for user: ${req.user.email}`);
                    
                    res.json({
                        success: true,
                        message: 'Password changed successfully. Please log in again.',
                        requireReauth: true
                    });
                } catch (error) {
                    console.error('Password change error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred while changing password'
                    });
                }
            }
        );

        // Admin endpoint - get user statistics
        router.get('/admin/stats',
            this.authMiddleware.authenticate,
            this.authMiddleware.requireAdmin,
            async (req, res) => {
                try {
                    const stats = await this.authService.getUserStats();
                    
                    res.json({
                        success: true,
                        stats
                    });
                } catch (error) {
                    console.error('Admin stats error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'An unexpected error occurred while fetching statistics'
                    });
                }
            }
        );

        // Health check for auth service
        router.get('/health', async (req, res) => {
            try {
                // Basic health check
                const stats = await this.authService.getUserStats();
                
                res.json({
                    success: true,
                    status: 'healthy',
                    service: 'auth-service',
                    timestamp: new Date().toISOString(),
                    stats
                });
            } catch (error) {
                console.error('Auth health check error:', error);
                res.status(500).json({
                    success: false,
                    status: 'unhealthy',
                    service: 'auth-service',
                    error: error.message
                });
            }
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = AuthRoutes;
