# 🚀 PLOMES ROTA CEP - Guia de Deploy para Vercel

## 📋 Resumo Executivo

Este documento fornece um guia completo para fazer deploy estável do PLOMES ROTA CEP no Vercel. Após as otimizações implementadas, o projeto está pronto para production com:

- ✅ **Next.js 15** com App Router
- ✅ **API Routes** serverless
- ✅ **Environment variables** validadas
- ✅ **Segurança** - sem secrets expostos
- ✅ **Integrações** Supabase + Ploome testadas

---

## 🏗️ Arquitetura do Deploy

```
📦 PLOMES-ROTA-CEP/
├── 🚀 vercel.json              # Configuração Vercel otimizada
├── 🔧 frontend-v0/             # Next.js App (porta 3003)
│   ├── src/app/api/            # API Routes serverless
│   ├── src/lib/env.*.ts        # Validação de env vars
│   ├── next.config.ts          # Configuração otimizada
│   └── .env.example            # Template seguro
└── 📚 README_DEPLOY.md         # Este guia
```

---

## 🔐 Configuração de Environment Variables

### 1. Variáveis Obrigatórias (CRITICAL)

```bash
# 🔑 Autenticação JWT (mín. 32 chars)
JWT_SECRET="your-super-secure-jwt-secret-key-at-least-32-characters-long"

# 🗄️ Supabase Database
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# 🏢 Ploome CRM
PLOOMES_API_KEY="your-ploome-api-key"
PLOOMES_BASE_URL="https://public-api2.ploomes.com"
CLIENT_TAG_ID="40006184"

# 🌐 Client-side (NEXT_PUBLIC_*)
NEXT_PUBLIC_API_URL="https://your-deployment-url.vercel.app"
```

### 2. Variáveis Opcionais (RECOMMENDED)

```bash
# 🗺️ Geocoding Services (pelo menos uma recomendada)
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
MAPBOX_API_KEY="your-mapbox-api-key"
POSITIONSTACK_API_KEY="your-positionstack-api-key"

# ⚙️ Configurações
NODE_ENV="production"
GEOCODING_DELAY_MS="500"
```

---

## 🚀 Processo de Deploy

### Passo 1: Preparação Local

```bash
# 1. Clone e acesse o diretório
cd PLOMES-ROTA-CEP/frontend-v0

# 2. Instale dependências
npm ci

# 3. Copie e configure environment variables
cp .env.example .env.local
# Edite .env.local com suas credenciais reais

# 4. Teste build local
npm run build:check
```

### Passo 2: Deploy no Vercel

#### Opção A: Via Vercel CLI (Recomendado)

```bash
# 1. Instale Vercel CLI
npm i -g vercel

# 2. Login no Vercel
vercel login

# 3. Deploy
vercel --prod

# 4. Configure environment variables via CLI
vercel env add JWT_SECRET
vercel env add SUPABASE_URL
# ... adicione todas as variáveis necessárias
```

#### Opção B: Via GitHub Integration

1. **Push para GitHub:**
   ```bash
   git add .
   git commit -m "🚀 Ready for Vercel deployment"
   git push origin main
   ```

2. **Configure no Vercel Dashboard:**
   - Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
   - Conecte seu repositório GitHub
   - Configure environment variables na interface

### Passo 3: Configuração de Environment Variables no Vercel

**Via Dashboard:**

1. Acesse seu projeto no Vercel Dashboard
2. Vá em **Settings > Environment Variables**
3. Adicione cada variável:

| Nome | Valor | Ambientes |
|------|-------|-----------|
| `JWT_SECRET` | `your-32-char-secret` | Production, Preview |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-key` | Production, Preview |
| `PLOOMES_API_KEY` | `your-ploome-key` | Production, Preview |
| `NEXT_PUBLIC_API_URL` | `https://your-app.vercel.app` | Production, Preview |

---

## ✅ Verificação Pós-Deploy

### 1. Health Checks Automáticos

```bash
# Teste básico de saúde
curl https://your-app.vercel.app/api/health

# Teste autenticação
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Teste customers API
curl https://your-app.vercel.app/api/customers
```

### 2. Scripts de Verificação

```bash
# Local (antes do deploy)
npm run deploy:verify

# Remoto (após deploy)
npm run health:check
npm run api:test
```

---

## 🐛 Troubleshooting Comum

### Problema: Build Failures

**Sintoma:** Build falha no Vercel
```
Error: Cannot resolve module '@/lib/env.server'
```

**Solução:**
```bash
# 1. Verifique paths no tsconfig.json
# 2. Execute build local primeiro
npm run build:check

# 3. Se local funciona, verifique env vars no Vercel
```

### Problema: Environment Variables

**Sintoma:** API retorna 500 - "Invalid environment variables"
```json
{"success": false, "error": "SUPABASE_URL is required in production"}
```

**Solução:**
1. Verifique no Vercel Dashboard > Settings > Environment Variables
2. Certifique-se que todas as vars obrigatórias estão definidas
3. Redeploy após configurar: `vercel --prod`

### Problema: API Routes 404

**Sintoma:** `/api/customers` retorna 404
```
This page could not be found.
```

**Solução:**
```bash
# 1. Verifique se as rotas estão em frontend-v0/src/app/api/
# 2. Confirme vercel.json aponta para frontend-v0
# 3. Redeploy
```

### Problema: Database Connection

**Sintoma:** Timeout ao conectar Supabase
```json
{"error": "connect ECONNREFUSED"}
```

**Solução:**
1. Teste conexão direta ao Supabase
2. Verifique SUPABASE_SERVICE_ROLE_KEY
3. Confirme região/URL do projeto Supabase

---

## 📊 Monitoramento & Performance

### Métricas Importantes

- **Build Time:** < 2 minutos
- **Cold Start:** < 1 segundo
- **API Response:** < 3 segundos
- **Bundle Size:** < 500KB (otimizado)

### Logs e Debug

```bash
# Ver logs do Vercel
vercel logs [deployment-url]

# Debug local
DEBUG=true npm run dev

# Análise do bundle
npm run build && npx @next/bundle-analyzer
```

---

## 🔄 CI/CD & Automation

### GitHub Actions (Opcional)

Crie `.github/workflows/vercel.yml`:

```yaml
name: Vercel Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
          cache-dependency-path: frontend-v0/package-lock.json
      - run: cd frontend-v0 && npm ci
      - run: cd frontend-v0 && npm run build:check
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend-v0
```

---

## 🎯 Próximos Passos

### Após Deploy Bem-sucedido

1. **Configure domínio customizado** (se necessário)
2. **Configure monitoramento** (Sentry, LogRocket)
3. **Teste funcionalidades críticas:**
   - Login/Auth
   - Sync customers
   - Geocoding CEP
   - Route optimization
4. **Configure backups** do Supabase
5. **Documente APIs** (OpenAPI/Swagger)

### Melhorias Futuras

- [ ] Implementar Redis para cache
- [ ] Adicionar rate limiting
- [ ] Configurar CDN para assets
- [ ] Implementar health monitoring
- [ ] Adicionar testes E2E

---

## 📞 Suporte

### Em caso de problemas:

1. **Primeiro:** Consulte este README
2. **Logs:** `vercel logs [url]`
3. **Debug local:** `npm run dev` com environment vars
4. **Community:** Vercel Discord/Forum
5. **Docs:** [vercel.com/docs](https://vercel.com/docs)

### Comandos de Emergency

```bash
# Rollback rápido
vercel rollback [deployment-url]

# Redeploy forçado
vercel --force --prod

# Reset environment vars
vercel env rm JWT_SECRET
vercel env add JWT_SECRET
```

---

## 📄 Checklist Final

**Antes do Deploy:**
- [ ] Environment variables configuradas
- [ ] Build local funcionando (`npm run build:check`)
- [ ] Secrets removidos do código
- [ ] Dependencies atualizadas
- [ ] Tests passando

**Após o Deploy:**
- [ ] Health check funcionando
- [ ] APIs respondendo corretamente
- [ ] Frontend carregando
- [ ] Autenticação funcionando
- [ ] Integrações (Supabase/Ploome) ativas
- [ ] Performance satisfatória

---

**🎉 Deploy Completo! Seu PLOMES ROTA CEP está rodando em produção no Vercel.**

---

*Gerado em: $(date)*
*Versão: 1.0*
*Autor: Claude Code - Platform Engineer*