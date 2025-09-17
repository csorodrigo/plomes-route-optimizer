const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    let filePath = './dashboard.html';
    
    // Handle different routes
    if (req.url === '/' || req.url === '/dashboard') {
        filePath = './dashboard.html';
    } else if (req.url.startsWith('/static/') || req.url.startsWith('/assets/')) {
        filePath = '.' + req.url;
    } else {
        filePath = './dashboard.html'; // Default to dashboard for all routes
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // File not found, serve dashboard.html instead
                fs.readFile('./dashboard.html', (error, content) => {
                    if (error) {
                        res.writeHead(500);
                        res.end('Error loading dashboard: ' + error.code);
                        return;
                    }
                    
                    res.writeHead(200, { 
                        'Content-Type': 'text/html',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(content, 'utf-8');
        }
    });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 DASHBOARD PLOOMES SERVIDOR');
    console.log('=================================');
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌐 URL do Dashboard: http://localhost:${PORT}`);
    console.log(`📊 Dashboard URL: http://localhost:${PORT}/dashboard`);
    console.log('=================================');
    console.log('📝 Pressione Ctrl+C para parar o servidor');
    console.log('=================================');
});

// Error handling for server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Porta ${PORT} já está em uso. Tentando porta ${PORT + 1}...`);
        setTimeout(() => {
            server.close();
            server.listen(PORT + 1);
        }, 1000);
    } else {
        console.error('❌ Erro no servidor:', err);
    }
});