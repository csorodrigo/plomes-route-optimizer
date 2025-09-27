- sempre teste com subagentes depois de concluir as tarefas, antes de me informar que está ok.

# 🔧 PROBLEMA RECORRENTE - BACKEND CONNECTION REFUSED
Este projeto tem um problema recorrente onde o backend para de responder e dá erro:
"POST http://localhost:3001/api/auth/login net::ERR_CONNECTION_REFUSED"

## ⚡ SOLUÇÃO AUTOMÁTICA CRIADA:

### Comando Rápido:
```bash
./fix-backend.sh
```

### Comando Manual:
```bash
# 1. Matar processos na porta 3001
lsof -ti:3001 | xargs kill -9

# 2. Esperar 2 segundos
sleep 2

# 3. Iniciar backend fresco
PORT=3001 node backend/server.js &

# 4. Verificar saúde
curl http://localhost:3001/api/health
```

### 📁 Arquivos de Monitoramento:
- `fix-backend.sh` - Script rápido de correção
- `auto-fix-backend.js` - Monitoramento automático contínuo
- `backend-autofix.log` - Log de correções automáticas

### ⚠️ SEMPRE USE QUANDO:
- ❌ Erro ERR_CONNECTION_REFUSED
- ❌ Frontend não consegue fazer login
- ❌ API não responde na porta 3001
- ❌ AuthContext mostra "Network Error"

### ✅ CONFIGURAÇÃO CORRETA:
- Backend: SEMPRE porta 3001
- Frontend: SEMPRE porta 3000
- Usar scripts de correção automática quando der problema

### 🚨 IMPORTANTE PARA CLAUDE:
Sempre que aparecer erro de conexão, execute automaticamente:
```bash
./fix-backend.sh
```

Este é um problema conhecido e recorrente do projeto que deve ser resolvido automaticamente.
- Sempre leia @GUIA_VERCEL.md antes de fazer o deploy no Vercel via MCP.
- sempre leia @GUIA_VERCEL.md antes de fazer o deploy no Vercel via MCP.
- sempre leia @GUIA_VERCEL.md antes de fazer o deploy no Vercel via MCP.
- SEMPRE USE OS SUBAGENTES ESPECIALISTAS