const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3003;

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Basic HTML file for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Ploomes - Sistema de Rota CEP</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 40px;
            }
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header p {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }
            .card {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 15px;
                padding: 25px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
            .card h3 {
                margin-top: 0;
                font-size: 1.3rem;
                margin-bottom: 15px;
            }
            .card p {
                margin-bottom: 15px;
                opacity: 0.9;
            }
            .btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                text-decoration: none;
                display: inline-block;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }
            .status {
                background: rgba(0, 255, 0, 0.2);
                border: 1px solid rgba(0, 255, 0, 0.3);
                padding: 15px;
                border-radius: 10px;
                text-align: center;
                margin-bottom: 30px;
            }
            .feature-list {
                list-style: none;
                padding: 0;
            }
            .feature-list li {
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .feature-list li:before {
                content: "✓ ";
                color: #4CAF50;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Dashboard Ploomes</h1>
                <p>Sistema de Otimização de Rotas por CEP</p>
            </div>
            
            <div class="status">
                <h3>✅ Servidor Frontend Ativo</h3>
                <p>Sistema rodando na porta ${PORT} - Pronto para uso!</p>
            </div>
            
            <div class="dashboard-grid">
                <div class="card">
                    <h3>📍 Mapa de Clientes</h3>
                    <p>Visualize todos os seus clientes no mapa com geolocalização automática por CEP.</p>
                    <a href="#" class="btn">Abrir Mapa</a>
                </div>
                
                <div class="card">
                    <h3>🛣️ Otimização de Rotas</h3>
                    <p>Calcule as melhores rotas entre clientes para maximizar eficiência.</p>
                    <a href="#" class="btn">Otimizar Rotas</a>
                </div>
                
                <div class="card">
                    <h3>👥 Gestão de Clientes</h3>
                    <p>Integração completa com Ploomes CRM para sincronização de dados.</p>
                    <a href="#" class="btn">Ver Clientes</a>
                </div>
                
                <div class="card">
                    <h3>📊 Relatórios</h3>
                    <p>Análise de performance e relatórios detalhados de rotas.</p>
                    <a href="#" class="btn">Ver Relatórios</a>
                </div>
            </div>
            
            <div class="card">
                <h3>🔧 Funcionalidades Disponíveis</h3>
                <ul class="feature-list">
                    <li>Sincronização automática com Ploomes CRM</li>
                    <li>Geolocalização por CEP usando API ViaCEP</li>
                    <li>Otimização de rotas com Google Routes API</li>
                    <li>Interface responsiva e moderna</li>
                    <li>Dashboard em tempo real</li>
                    <li>Filtros avançados por região e tags</li>
                </ul>
            </div>
            
            <div class="card">
                <h3>📡 Status da API</h3>
                <p id="api-status">Verificando conexão com backend...</p>
                <button class="btn" onclick="checkAPIStatus()">Verificar Conexão</button>
            </div>
        </div>
        
        <script>
            function checkAPIStatus() {
                const statusEl = document.getElementById('api-status');
                statusEl.textContent = 'Verificando...';
                
                // Try to connect to backend API
                fetch('/api/health')
                    .then(response => {
                        if (response.ok) {
                            statusEl.textContent = '✅ API Backend conectada e funcionando';
                            statusEl.style.color = '#4CAF50';
                        } else {
                            statusEl.textContent = '⚠️ API Backend acessível mas com problemas';
                            statusEl.style.color = '#FF9800';
                        }
                    })
                    .catch(error => {
                        statusEl.textContent = '❌ API Backend não acessível (verifique se o servidor backend está rodando)';
                        statusEl.style.color = '#F44336';
                    });
            }
            
            // Check API status on load
            setTimeout(checkAPIStatus, 1000);
        </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Frontend server is running',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
🚀 Dashboard Ploomes Frontend Server
=====================================
🌐 Servidor rodando em: http://localhost:${PORT}
📁 Servindo arquivos estáticos de: frontend/public/
🔗 URL de acesso: http://localhost:${PORT}
=====================================
`);
});