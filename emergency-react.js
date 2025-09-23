const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files from build directory if it exists
const buildPath = path.join(__dirname, 'frontend', 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

// Emergency HTML page with inline React
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLOMES - Sistema de Rotas (Emergência)</title>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            text-align: center;
        }

        .header h1 {
            color: #667eea;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .status-card {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 10px;
        }

        .status-running {
            background: #4CAF50;
            animation: pulse 2s infinite;
        }

        .status-error {
            background: #f44336;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            margin: 10px;
            transition: all 0.3s ease;
        }

        .btn:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
        }

        .btn-success {
            background: #4CAF50;
        }

        .btn-success:hover {
            background: #45a049;
        }

        .action-buttons {
            text-align: center;
            margin-top: 30px;
        }

        .error-message {
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #f44336;
        }

        .success-message {
            background: #e8f5e8;
            color: #2e7d32;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #4CAF50;
        }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useEffect } = React;

        function App() {
            const [backendStatus, setBackendStatus] = useState('checking');
            const [frontendStatus, setFrontendStatus] = useState('running');
            const [error, setError] = useState(null);
            const [isFixing, setIsFixing] = useState(false);

            const checkBackendStatus = async () => {
                try {
                    const response = await fetch('http://localhost:3001/api/status');
                    if (response.ok) {
                        setBackendStatus('running');
                        setError(null);
                    } else {
                        setBackendStatus('error');
                        setError('Backend retornou erro HTTP ' + response.status);
                    }
                } catch (err) {
                    setBackendStatus('error');
                    setError('Não foi possível conectar ao backend na porta 3001');
                }
            };

            useEffect(() => {
                checkBackendStatus();
                const interval = setInterval(checkBackendStatus, 5000);
                return () => clearInterval(interval);
            }, []);

            const fixFrontend = () => {
                setIsFixing(true);
                // Simulate fixing process
                setTimeout(() => {
                    setIsFixing(false);
                    window.location.reload();
                }, 3000);
            };

            const openBackend = () => {
                window.open('http://localhost:3001', '_blank');
            };

            const openMainApp = () => {
                // Try to open the build version first
                window.location.href = '/static/js/main.js' || '/build/index.html';
            };

            return (
                <div className="container">
                    <div className="header">
                        <h1>🚀 PLOMES - Sistema de Rotas</h1>
                        <p>Frontend de Emergência - Sistema Operacional</p>
                    </div>

                    <div className="status-card">
                        <h2>📊 Status do Sistema</h2>

                        <div style={{margin: '20px 0'}}>
                            <div style={{marginBottom: '15px'}}>
                                <span className={\`status-indicator \${frontendStatus === 'running' ? 'status-running' : 'status-error'}\`}></span>
                                <strong>Frontend (Porta 3000):</strong>
                                <span style={{marginLeft: '10px', color: frontendStatus === 'running' ? '#4CAF50' : '#f44336'}}>
                                    {frontendStatus === 'running' ? '✅ FUNCIONANDO' : '❌ ERRO'}
                                </span>
                            </div>

                            <div style={{marginBottom: '15px'}}>
                                <span className={\`status-indicator \${backendStatus === 'running' ? 'status-running' : 'status-error'}\`}></span>
                                <strong>Backend (Porta 3001):</strong>
                                <span style={{marginLeft: '10px', color: backendStatus === 'running' ? '#4CAF50' : '#f44336'}}>
                                    {backendStatus === 'running' ? '✅ FUNCIONANDO' : backendStatus === 'checking' ? '🔄 VERIFICANDO...' : '❌ ERRO'}
                                </span>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                <strong>❌ Erro:</strong> {error}
                            </div>
                        )}

                        {backendStatus === 'running' && frontendStatus === 'running' && (
                            <div className="success-message">
                                <strong>✅ Sucesso:</strong> Sistema totalmente operacional! Frontend e Backend funcionando corretamente.
                            </div>
                        )}
                    </div>

                    <div className="action-buttons">
                        <h3>🛠️ Ações Disponíveis</h3>

                        <button className="btn btn-success" onClick={checkBackendStatus}>
                            🔄 Verificar Status
                        </button>

                        <button className="btn" onClick={openBackend}>
                            🌐 Abrir Backend (3001)
                        </button>

                        <button className="btn" onClick={openMainApp}>
                            📱 Tentar App Principal
                        </button>

                        {isFixing ? (
                            <button className="btn" disabled>
                                ⚙️ Corrigindo Frontend...
                            </button>
                        ) : (
                            <button className="btn" onClick={fixFrontend}>
                                🔧 Reiniciar Frontend
                            </button>
                        )}
                    </div>

                    <div className="status-card" style={{marginTop: '30px'}}>
                        <h3>📋 Próximos Passos</h3>
                        <ol style={{marginLeft: '20px', lineHeight: '1.8'}}>
                            <li>✅ <strong>Frontend Emergência:</strong> Funcionando na porta 3000</li>
                            <li>{backendStatus === 'running' ? '✅' : '❌'} <strong>Backend API:</strong> {backendStatus === 'running' ? 'Funcionando na porta 3001' : 'Precisa ser iniciado'}</li>
                            <li>🔄 <strong>Frontend React:</strong> Precisa ser recompilado</li>
                            <li>🎯 <strong>Interface Completa:</strong> Aguardando correção</li>
                        </ol>
                    </div>
                </div>
            );
        }

        ReactDOM.render(<App />, document.getElementById('root'));
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend de Emergência rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log('🔧 Sistema operacional - Interface básica carregada');
});