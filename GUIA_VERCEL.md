# 🤖 Claude Code - Guia Rápido Vercel (Anti-Erros)

## ⚡ REGRAS CRÍTICAS - SEMPRE VERIFICAR

### 1. 🔴 NUNCA ESQUECER O NEXT.JS NO PACKAGE.JSON
```json
{
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0", 
    "react-dom": "^18.2.0"
  }
}
```
**⚠️ SEM ISSO = BUILD FALHA 100%**

### 2. 🔴 VERCEL.JSON - CONFIGURAÇÃO MÍNIMA
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```
**⚠️ NÃO ADICIONE `functions` com runtimes customizados sem necessidade!**

### 3. 🔴 MIDDLEWARE - SEMPRE IGNORAR /api/*
```typescript
// middleware.ts
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)'
}
```
**⚠️ MIDDLEWARE BLOQUEANDO API = 404 EM PRODUÇÃO**

---

## 📁 ESTRUTURA DE ARQUIVOS CORRETAS

### ✅ Para Pages Router (RECOMENDADO para APIs):
```
/pages/api/customers.js         ✅
/pages/api/geocoding/cep/[cep].js  ✅
```

### ❌ EVITAR MISTURAR:
```
/pages/api/customers.js    ❌
/app/api/customers/route.js   ❌
```
**ESCOLHA UM E USE APENAS ELE!**

---

## 🎯 COMANDOS ESSENCIAIS

### Antes de Fazer Commit:
```bash
# 1. SEMPRE teste o build local
npm run build

# 2. Se falhar, limpe tudo
rm -rf .next node_modules
npm install
npm run build

# 3. Teste as APIs
npm run dev
# Em outro terminal:
curl http://localhost:3000/api/customers
```

### Ao Configurar Projeto Novo:
```bash
# 1. Instalar dependências base
npm install next@latest react@latest react-dom@latest

# 2. Instalar outras necessárias
npm install @supabase/supabase-js axios

# 3. Criar estrutura base
mkdir -p pages/api
touch pages/api/health.js
echo "export default function handler(req, res) { res.status(200).json({ status: 'ok' }) }" > pages/api/health.js

# 4. Testar
npm run dev
curl http://localhost:3000/api/health
```

---

## 🔧 SNIPPETS PRONTOS PARA COPIAR

### API Endpoint Básico (Pages Router):
```javascript
// pages/api/exemplo.js
export default async function handler(req, res) {
  // CORS headers (se necessário)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Seu código aqui
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### API com Supabase:
```javascript
// pages/api/customers.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(100);
      
    if (error) throw error;
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🚨 ERROS COMUNS E SOLUÇÕES RÁPIDAS

| Erro | Solução Rápida |
|------|----------------|
| `No Next.js version detected` | Adicione `"next": "^14.1.0"` no package.json |
| `Function Runtimes must have valid version` | Remova configurações de `functions` do vercel.json |
| `404 em /api/*` | Verifique middleware.ts - está bloqueando APIs? |
| `Cannot find module` | `rm -rf node_modules && npm install` |
| `Build failed` | `npm run build` localmente primeiro |
| `Environment variables undefined` | Configure no dashboard Vercel |

---

## ✅ CHECKLIST ANTES DO DEPLOY

```markdown
- [ ] package.json tem "next" nas dependencies
- [ ] vercel.json está simples (sem functions customizadas)
- [ ] middleware.ts ignora /api/*
- [ ] npm run build funciona localmente
- [ ] APIs testadas com curl/Postman
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Escolhido APENAS Pages Router OU App Router
```

---

## 🔥 COMANDO MÁGICO DE EMERGÊNCIA

```bash
# Se NADA funcionar, execute isso:
cat > fix-vercel.sh << 'EOF'
#!/bin/bash
echo "🔧 Corrigindo projeto para Vercel..."

# 1. Garantir Next.js instalado
npm install next@latest react@latest react-dom@latest --save

# 2. Criar vercel.json mínimo
echo '{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}' > vercel.json

# 3. Criar API de teste
mkdir -p pages/api
echo 'export default function handler(req, res) {
  res.status(200).json({ status: "API Working!", timestamp: new Date() })
}' > pages/api/test.js

# 4. Limpar e rebuildar
rm -rf .next node_modules package-lock.json
npm install
npm run build

echo "✅ Correções aplicadas! Teste com: npm run dev"
EOF

chmod +x fix-vercel.sh
./fix-vercel.sh
```

---

## 📋 TEMPLATE PARA REPORTAR ERRO

Quando encontrar um erro novo, documente assim:

```markdown
### ERRO: [Nome do erro]
**Mensagem:** `[Copie a mensagem exata]`
**Contexto:** [O que estava fazendo]
**Solução:** [O que funcionou]
**Prevenção:** [Como evitar no futuro]
```

---

## 🎯 REGRA DE OURO

> **"Se funciona local, deve funcionar na Vercel. Se não funciona, é configuração!"**

1. SEMPRE teste local primeiro: `npm run build && npm run start`
2. Se der erro local, CORRIJA antes de fazer deploy
3. Se funciona local mas falha na Vercel = variáveis de ambiente ou vercel.json

---

*Use este documento como referência rápida ao trabalhar com Vercel no Claude Code*  
*Atualizado: 26/01/2025*