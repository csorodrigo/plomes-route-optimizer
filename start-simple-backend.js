const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '2.1.4-pt-br',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
    });
});

// Test connection endpoint
app.get('/api/test-connection', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, (err) => {
    if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }

    console.log('\n🎉 ======= SIMPLE BACKEND STARTED =======');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=========================================\n');

    console.log('📝 Available endpoints:');
    console.log(`   GET  /api/health           - Health check`);
    console.log(`   GET  /api/test-connection  - Test connection`);
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🔄 SIGINT received, shutting down gracefully...');
    process.exit(0);
});