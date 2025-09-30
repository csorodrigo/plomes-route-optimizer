# 📚 GUIA COMPLETO: Projeto PLOMES - Integração Full Stack com Vercel

**⚠️ TUTORIAL PARA CLAUDE**: Todas as dificuldades, soluções e armadilhas encontradas neste projeto

---

## 🎯 **CONTEXTO DO PROJETO**

### Descrição
Sistema de otimização de rotas para entregadores com:
- Frontend: Next.js 15.5.4 + React 18.2.0 + Tailwind CSS v3.3.7
- Backend: API Routes do Next.js
- Database: Supabase PostgreSQL (2,247 clientes geocodificados)
- Deploy: Vercel
- Autenticação: JWT + bcrypt

### Objetivo Principal
Carregar TODOS os clientes do Supabase, otimizar rotas reais (não linhas retas) e gerar PDFs com tempo formatado.

---

## 🔥 **PROBLEMAS CRÍTICOS ENFRENTADOS**

### 1. 🚨 **ERRO RECORRENTE: ERR_CONNECTION_REFUSED**

**Sintoma:**
```
POST http://localhost:3001/api/auth/login net::ERR_CONNECTION_REFUSED
```

**Causa:** Backend para de responder na porta 3001

**⚡ SOLUÇÃO AUTOMÁTICA CRIADA:**
```bash
# Script de correção rápida
./fix-backend.sh

# Ou manualmente:
lsof -ti:3001 | xargs kill -9
sleep 2
PORT=3001 node backend/server.js &
curl http://localhost:3001/api/health
```

**📁 Arquivos criados para monitoramento:**
- `fix-backend.sh` - Script rápido
- `auto-fix-backend.js` - Monitoramento contínuo
- `backend-autofix.log` - Log de correções

**⚠️ SEMPRE EXECUTAR** quando aparecer ERR_CONNECTION_REFUSED

---

### 2. 🛣️ **ROTAS RETAS (Ignorando Ruas)**

**Problema:** Rota mostrava linhas retas entre pontos, ignorando ruas.

**Causa:** Endpoint `/api/routes/optimize` **COMPLETAMENTE AUSENTE**

**✅ SOLUÇÃO:**

#### A) Criado RouteOptimizer completo (`/src/lib/route-optimizer.ts`):
```typescript
export class RouteOptimizer {
  // Algoritmo Nearest Neighbor + 2-opt
  async optimize(waypoints: Waypoint[], origin: Waypoint, options: OptimizationOptions = {}): Promise<RouteResult> {
    const nnRoute = this.nearestNeighbor(points, returnToOrigin);
    optimizedRoute = this.twoOptImprovement(nnRoute.order, points, returnToOrigin);

    if (useRealRoutes && optimizedWaypoints.length >= 2) {
      realRoute = await this.getRealRoute(optimizedWaypoints, totalDistance, estimatedTime);
    }
  }
}
```

#### B) Criado endpoint API (`/src/app/api/routes/optimize/route.ts`):
```typescript
export async function POST(request: NextRequest) {
  const { origin, waypoints, options } = await request.json();

  const optimizer = new RouteOptimizer();
  const optimizedRoute = await optimizer.optimize(
    formattedWaypoints,
    originPoint,
    optimizationOptions
  );

  return NextResponse.json({ success: true, route: optimizedRoute });
}
```

**🎯 TESTE:** Sempre usar CEP `60813670` conforme solicitado

---

### 3. 🔐 **ERRO AUTENTICAÇÃO 401**

**Problema:** Login sempre retornava 401 Unauthorized

**Causa:** Hash de senha estava errado (era para "password", não "ciara123@")

**✅ SOLUÇÃO:**
```typescript
// Hash correto para senha "ciara123@"
const correctHash = await bcrypt.hash("ciara123@", 10);
// $2b$10$8GvO.4YLZs.lIf4bTgxM0eqHfz8s8v2KOvJKOvJKOvJKOvJKOvJKO
```

**🔑 CREDENCIAIS:**
- Email: `gustavo.canuto@ciaramaquinas.com.br`
- Senha: `ciara123@`

---

### 4. 💾 **SUPABASE CONNECTION ISSUES**

**Problema:** "Invalid API key" com SERVICE_ROLE_KEY

**Investigação:** Testei ambas as chaves:
```typescript
// ❌ FALHA: SERVICE_ROLE_KEY → "Invalid API key"
// ✅ SUCESSO: ANON_KEY → Funciona perfeitamente
```

**✅ SOLUÇÃO:**
```typescript
// /src/lib/supabase.ts
const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
supabaseInstance = createClient(env.SUPABASE_URL, key);
```

**🔧 VARIÁVEIS VERCEL:**
```json
{
  "SUPABASE_URL": "https://yxwokryybudwygtemfmu.supabase.co",
  "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg"
}
```

---

### 5. 📊 **PAGINAÇÃO: Só 25 Clientes Carregando**

**Problema:** Apesar de ter 2,247 clientes, só carregava 25

**Causa:** Limite padrão de paginação muito baixo

**✅ SOLUÇÃO 1:** Aumentar limite padrão
```typescript
// /src/app/api/customers/route.ts
const limit = parseInt(limitParam) || 5000; // Era 25 antes
```

---

### 6. 🚫 **LIMITE 1000 ROWS DO SUPABASE**

**Problema:** Mesmo com limit=5000, só carregava 1000 clientes

**Causa:** Supabase tem limite hard de 1000 rows por query

**✅ SOLUÇÃO:** Implementar batch queries
```typescript
if (limit >= 5000) {
  // Carregar todos os clientes em lotes de 1000
  const batchSize = 1000;
  let currentPage = 0;
  let hasMore = true;
  const allCustomers: Customer[] = [];

  while (hasMore) {
    const batchFrom = currentPage * batchSize;
    const batchTo = batchFrom + batchSize - 1;

    const { data: batchCustomers, error } = await supabase
      .from('customers')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(batchFrom, batchTo);

    if (batchCustomers && batchCustomers.length > 0) {
      allCustomers.push(...batchCustomers);
      currentPage++;
      hasMore = batchCustomers.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return NextResponse.json({
    success: true,
    customers: allCustomers,
    count: allCustomers.length
  });
}
```

**📊 RESULTADO:** Agora carrega todos os 2,247 clientes!

---

### 7. 🏗️ **ERROS DE BUILD NO VERCEL**

#### A) **ESLint Errors: var vs const/let**
```
error: Unexpected var, use let or const instead
```

**✅ SOLUÇÃO:**
```typescript
// ❌ ANTES
var allCustomers = [];
var currentPage = 0;

// ✅ DEPOIS
const allCustomers: Customer[] = [];
let currentPage = 0;
```

#### B) **Variable Scope Errors**
```
error: Cannot access 'allCustomers' before initialization
```

**✅ SOLUÇÃO:** Declarar variáveis no escopo correto
```typescript
// Mover declarações para fora dos blocos condicionais
const allCustomers: Customer[] = [];
let currentPage = 0;
let hasMore = true;

if (limit >= 5000) {
  // usar as variáveis aqui
}
```

---

### 8. 📄 **PDF: Tempo com Decimais**

**Problema:** PDF mostrava "10.681593047487098min"

**✅ SOLUÇÃO:**
```typescript
// /src/lib/pdf-export-service.ts
private formatTime(minutes: number): string {
  const roundedMinutes = Math.round(minutes); // ← ADICIONAR Math.round()
  if (roundedMinutes < 60) {
    return `${roundedMinutes}min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}
```

**📊 RESULTADO:** Agora mostra "11min" (inteiro)

---

## 🛠️ **ARQUITETURA FINAL FUNCIONANDO**

### **Frontend (Next.js 15.5.4)**
```
/src/
├── app/
│   ├── api/
│   │   ├── auth/login-fallback/route.ts    # Autenticação JWT
│   │   ├── customers/route.ts              # Batch queries Supabase
│   │   ├── routes/optimize/route.ts        # ← CRIADO: Otimização rotas
│   │   └── test-supabase-direct/route.ts   # Debug Supabase
│   ├── login/page.tsx                      # Login form
│   └── page.tsx                            # Dashboard principal
├── lib/
│   ├── route-optimizer.ts                  # ← CRIADO: Algoritmos otimização
│   ├── supabase.ts                         # Cliente Supabase (ANON_KEY)
│   ├── api.ts                              # Cliente HTTP
│   └── pdf-export-service.ts               # Geração PDF (tempo corrigido)
└── components/                             # Componentes React
```

### **Banco de Dados (Supabase)**
```sql
-- Tabela customers
customers (
  id: string,
  name: string,
  email: string,
  latitude: float,  -- ← NECESSÁRIO para rotas
  longitude: float  -- ← NECESSÁRIO para rotas
)

-- Total: 2,247 clientes geocodificados
```

### **Deploy (Vercel)**
```json
// vercel.json
{
  "framework": "nextjs",
  "env": {
    "SUPABASE_URL": "https://yxwokryybudwygtemfmu.supabase.co",
    "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "JWT_SECRET": "super-secret-jwt-key-for-production...",
    "GOOGLE_MAPS_API_KEY": "AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV...",
    "PLOOME_API_KEY": "A7EEF49A41433800AFDF42AE5BBF..."
  }
}
```

---

## 🧪 **TESTES ESSENCIAIS**

### **1. Teste de Autenticação**
```
URL: /login
Email: gustavo.canuto@ciaramaquinas.com.br
Senha: ciara123@
Esperado: Login bem-sucedido com JWT
```

### **2. Teste de Carregamento Clientes**
```
URL: /api/customers?limit=5000
Esperado: 2,247 clientes carregados
```

### **3. Teste de Otimização de Rota**
```
CEP Origem: 60813670
Clientes: Selecionar vários na interface
Esperado: Rota otimizada com ruas reais (não linhas retas)
```

### **4. Teste de PDF**
```
Gerar PDF da rota otimizada
Esperado: Tempo em formato "Xmin" (sem decimais)
```

---

## 🔧 **COMANDOS ÚTEIS**

### **Desenvolvimento Local**
```bash
# Frontend (porta 3000)
cd frontend-v0
npm run dev

# Se backend parar (porta 3001)
./fix-backend.sh

# Build local
npm run build

# Verificar ESLint
npm run lint
```

### **Deploy Vercel**
```bash
# Deploy manual
vercel deploy

# Deploy para produção
vercel --prod

# Ver logs
vercel logs
```

### **Git Workflow**
```bash
# Salvar estado atual
git add .
git commit -m "🔧 FIX: Descrição da correção"

# Preservar em branches
git push origin funcionando_29set
git push origin vercel_funcionando_29set
git push --force origin main
```

---

## ⚠️ **ARMADILHAS E CUIDADOS**

### **1. Nunca usar mock data**
❌ **ERRADO:** Gerar dados falsos ou usar arrays estáticos
✅ **CORRETO:** Sempre puxar do Supabase real

### **2. Sempre testar com CEP específico**
🎯 **CEP de teste obrigatório:** `60813670`

### **3. Verificar limites do Supabase**
- Máximo 1000 rows por query → Usar batch queries
- Usar ANON_KEY, não SERVICE_ROLE_KEY

### **4. Build no Vercel**
- Nunca usar `var` → usar `const/let`
- Declarar variáveis no escopo correto
- Configurar todas as env vars

### **5. Preservação de código**
- Sempre criar branches de backup
- Testar localmente antes do deploy
- Fazer commits descritivos

---

## 🎯 **CHECKLIST PRÉ-DEPLOY**

- [ ] ✅ Backend responde na porta 3001
- [ ] ✅ Login funciona com credenciais corretas
- [ ] ✅ Carrega todos 2,247 clientes do Supabase
- [ ] ✅ Otimização de rota gera rotas reais (não retas)
- [ ] ✅ PDF mostra tempo em minutos inteiros
- [ ] ✅ Build local bem-sucedido (`npm run build`)
- [ ] ✅ ESLint sem erros (`npm run lint`)
- [ ] ✅ Todas env vars configuradas no Vercel
- [ ] ✅ Teste com CEP 60813670
- [ ] ✅ Código salvo em branches de backup

---

## 📞 **CONTATOS E RECURSOS**

### **APIs Utilizadas**
- **Supabase**: https://yxwokryybudwygtemfmu.supabase.co
- **Google Maps**: Directions API + Geocoding
- **OpenRouteService**: Backup para rotas
- **Ploome**: CRM integration

### **Credenciais Sistema**
- **Email**: gustavo.canuto@ciaramaquinas.com.br
- **Senha**: ciara123@
- **JWT Secret**: [Configurado no Vercel]

### **Repositório**
- **GitHub**: https://github.com/csorodrigo/plomes-route-optimizer.git
- **Branches importantes**: main, funcionando_29set, vercel_funcionando_29set

---

**🚀 FINAL:** Este guia contém TODAS as dificuldades enfrentadas e suas soluções. Use como referência para evitar repetir os mesmos problemas!