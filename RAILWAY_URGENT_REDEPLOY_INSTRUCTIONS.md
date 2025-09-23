# 🚨 RAILWAY URGENT REDEPLOY INSTRUCTIONS

## PROBLEMA IDENTIFICADO

❌ **CRITICAL**: Railway project está retornando 404/Not Found em todas as URLs
❌ **API**: Railway API retorna "Not Found" para o project ID
❌ **Status**: Projeto pode ter sido removido ou desativado

## SITUAÇÃO ATUAL

✅ **Local**: Build funciona perfeitamente com 131 traduções PT-BR
✅ **Código**: Commit feito e pushed para GitHub
✅ **Build**: frontend/build contém versão correta com logo CIA MÁQUINAS
❌ **Railway**: Projeto não responde - requer redeploy completo

## URLs TESTADAS (TODAS RETORNAM 404)

- https://plomes-rota-cep-production.up.railway.app
- https://web-production-799c.up.railway.app
- https://production-799c5228.up.railway.app
- https://ploomes-rota-cep.up.railway.app
- https://plomes-route-optimizer.up.railway.app

## AÇÃO URGENTE NECESSÁRIA

### OPÇÃO 1: VERIFICAR DASHBOARD RAILWAY
1. Acesse: https://railway.app/project/799c5228-83f4-4c93-ba9e-9794f1f169be
2. Verifique se projeto ainda existe
3. Check status dos deployments
4. Verifique domínios configurados

### OPÇÃO 2: REDEPLOY COMPLETO (RECOMENDADO)
1. **Acesse Railway Dashboard**
2. **Delete projeto atual** (se ainda existir)
3. **Criar novo projeto**:
   - Connect GitHub repo: `csorodrigo/plomes-route-optimizer`
   - Branch: `main`
   - Root directory: `/` (raiz)

4. **Configurar Build Commands**:
   ```
   Build Command: npm install && cd frontend && npm install && npm run build && cd ..
   Start Command: node backend/server.js
   ```

5. **Environment Variables** (CRÍTICO):
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-here
   PORT=3000
   ```

6. **Deploy Settings**:
   - Auto-deploy: ✅ Enabled
   - Health check path: `/api/health`
   - Region: US East

### OPÇÃO 3: DEPLOY ALTERNATIVO

Se Railway continuar com problemas, considere:
- **Render.com**: Deploy gratuito
- **Vercel**: Para frontend + backend
- **Heroku**: Tradicional
- **DigitalOcean App Platform**: Confiável

## ARQUIVOS DE CONFIGURAÇÃO PRONTOS

### railway.toml (atualizado)
```toml
[build]
builder = "NIXPACKS"
buildCommand = "echo '🚀 URGENT BUILD: Forcing PT-BR v2.1.4 at: '$(date) && rm -rf node_modules frontend/node_modules && npm cache clean --force && npm install && echo '✅ Root dependencies installed' && cd frontend && npm cache clean --force && npm install && echo '✅ Frontend dependencies installed' && DISABLE_ESLINT_PLUGIN=true CI=false npm run build && ls -la build/ && echo '📄 Built files:' && find build/ -name '*.js' -o -name '*.html' && echo '🌍 Checking PT-BR content:' && grep -c 'Bem-vindo\\|CIA MÁQUINAS\\|Otimizador' build/static/js/*.js || echo 'WARNING: PT-BR content check failed' && cd .. && echo '✅ URGENT PT-BR BUILD v2.1.4 COMPLETED'"

[deploy]
startCommand = "NODE_ENV=production node backend/server.js"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"

[env]
NODE_ENV = "production"
```

### package.json (verificado)
```json
{
  "name": "plomes-rota-cep-v2-fixed",
  "version": "2.1.4-pt-br",
  "scripts": {
    "start": "node backend/server.js",
    "build": "npm run install-frontend && npm run build-frontend",
    "build-frontend": "cd frontend && npm run build",
    "install-frontend": "cd frontend && npm ci"
  }
}
```

## VALIDAÇÃO PÓS-DEPLOY

Após redeploy, verificar:

1. **Health Check**: `curl https://NEW-URL/api/health`
2. **Interface PT-BR**: Página deve conter:
   - `<html lang="pt-BR">`
   - "Bem-vindo de volta" no login
   - Logo "CIA MÁQUINAS"
   - Títulos em português

3. **Funcionalidades**:
   - Login/Register funcionando
   - Drag and drop de arquivos
   - Exportação PDF
   - Otimização de rotas

## CONTATOS DE EMERGÊNCIA

- **Railway Support**: se precisar reativar projeto
- **GitHub Repo**: https://github.com/csorodrigo/plomes-route-optimizer
- **Última versão working**: Commit 8ad8855

---

## STATUS ATUAL: 🔴 CRÍTICO - RAILWAY OFFLINE

**Ação requerida**: Redeploy completo do zero
**Prioridade**: MÁXIMA
**Tempo estimado**: 10-15 minutos para novo deploy

✅ **Código pronto e funcionando localmente**
❌ **Railway project precisa ser recriado**