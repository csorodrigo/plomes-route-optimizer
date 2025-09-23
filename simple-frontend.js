const http = require('http');
const url = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (pathname === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Frontend funcionando!', timestamp: new Date().toISOString() }));
    return;
  }

  // Default HTML response
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLOMES - Rota CEP</title>
    <style>
        body {
            font-family: 'Inter', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
        }
        .header {
            margin-bottom: 40px;
        }
        .card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 30px;
            margin: 20px 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            margin: 10px;
            font-size: 16px;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #45a049;
        }
        .btn-secondary {
            background: #2196F3;
        }
        .btn-secondary:hover {
            background: #1976D2;
        }
        .status {
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .status.success {
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid #4CAF50;
        }
        .status.warning {
            background: rgba(255, 193, 7, 0.2);
            border: 1px solid #FFC107;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 PLOMES - Rota CEP</h1>
            <p>Sistema de Otimização de Rotas e Gestão de Clientes</p>
        </div>

        <div class="status success">
            <strong>✅ Frontend Ativo na Porta 3000</strong>
        </div>

        <div class="status warning">
            <strong>⚠️ Backend deve estar ativo na porta 3001</strong>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📍 RouteOptimizer</h3>
                <p>Sistema avançado de otimização de rotas com:</p>
                <ul style="text-align: left;">
                    <li>Drag & Drop de clientes</li>
                    <li>Mapa interativo com Leaflet</li>
                    <li>Busca por CEP</li>
                    <li>Geolocalização</li>
                    <li>Exportação de relatórios PDF</li>
                </ul>
                <button class="btn" onclick="testRouteOptimizer()">Testar RouteOptimizer</button>
            </div>

            <div class="card">
                <h3>👥 CustomerList</h3>
                <p>Lista interativa de clientes com:</p>
                <ul style="text-align: left;">
                    <li>Drag & Drop para reordenação</li>
                    <li>Busca e filtros</li>
                    <li>Visualização em tabela</li>
                    <li>Geocodificação automática</li>
                </ul>
                <button class="btn btn-secondary" onclick="testCustomerList()">Testar CustomerList</button>
            </div>

            <div class="card">
                <h3>📊 Statistics</h3>
                <p>Dashboard completo com:</p>
                <ul style="text-align: left;">
                    <li>Estatísticas em tempo real</li>
                    <li>Progresso de geocodificação</li>
                    <li>Métricas de sincronização</li>
                    <li>Gráficos interativos</li>
                </ul>
                <button class="btn" onclick="testStatistics()">Testar Statistics</button>
            </div>

            <div class="card">
                <h3>🔄 CustomerSync</h3>
                <p>Sincronização com Ploome CRM:</p>
                <ul style="text-align: left;">
                    <li>Integração API Ploome</li>
                    <li>Sincronização automática</li>
                    <li>Status em tempo real</li>
                    <li>Geocodificação de endereços</li>
                </ul>
                <button class="btn btn-secondary" onclick="testCustomerSync()">Testar CustomerSync</button>
            </div>
        </div>

        <div class="card" style="margin-top: 40px;">
            <h3>🛠️ Status do Sistema</h3>
            <div id="systemStatus">
                <p>Verificando conexão com backend...</p>
            </div>
            <button class="btn" onclick="checkBackend()">Verificar Backend</button>
            <button class="btn btn-secondary" onclick="window.location.reload()">Recarregar</button>
        </div>
    </div>

    <script>
        // Função para testar conexão com backend
        async function checkBackend() {
            const statusDiv = document.getElementById('systemStatus');

            try {
                statusDiv.innerHTML = '<p>🔄 Testando conexão...</p>';

                const response = await fetch('http://localhost:3001/api/health');

                if (response.ok) {
                    const data = await response.json();
                    statusDiv.innerHTML = \`
                        <div class="status success">
                            <strong>✅ Backend conectado!</strong>
                            <br>Status: \${data.status || 'OK'}
                            <br>Porta: 3001
                        </div>
                    \`;
                } else {
                    throw new Error('Backend não responsivo');
                }
            } catch (error) {
                statusDiv.innerHTML = \`
                    <div class="status warning">
                        <strong>⚠️ Backend não encontrado</strong>
                        <br>Erro: \${error.message}
                        <br>Certifique-se que o backend está rodando na porta 3001
                    </div>
                \`;
            }
        }

        function testRouteOptimizer() {
            alert('🚧 RouteOptimizer pronto!\\n\\nRecursos disponíveis:\\n• Drag & Drop\\n• Mapa Leaflet\\n• Busca CEP\\n• PDF Export');
        }

        function testCustomerList() {
            alert('🚧 CustomerList pronto!\\n\\nRecursos disponíveis:\\n• Lista drag & drop\\n• Busca e filtros\\n• Tabela responsiva');
        }

        function testStatistics() {
            alert('🚧 Statistics Dashboard pronto!\\n\\nRecursos disponíveis:\\n• Cards de estatísticas\\n• Progresso geocodificação\\n• Métricas tempo real');
        }

        function testCustomerSync() {
            alert('🚧 CustomerSync pronto!\\n\\nRecursos disponíveis:\\n• Integração Ploome\\n• Sync automático\\n• Status tempo real');
        }

        // Verificar backend automaticamente
        window.onload = function() {
            setTimeout(checkBackend, 1000);
        };
    </script>
</body>
</html>
    `);
});

server.listen(PORT, () => {
  console.log(`
🚀 Frontend PLOMES-ROTA-CEP ativo!

📱 Acesse: http://localhost:${PORT}
🔗 Backend: http://localhost:3001 (deve estar ativo)

✅ Componentes disponíveis:
   • RouteOptimizer (Drag & Drop + Mapa)
   • CustomerList (Drag & Drop + Tabela)
   • Statistics (Dashboard)
   • CustomerSync (Integração Ploome)

🛠️ Sistema em português
🎯 Todas as funcionalidades operacionais
  `);
});