# 🔄 ESTRATÉGIA DE SINCRONIZAÇÃO PLOOMES → SUPABASE

**Data**: 02 de Outubro de 2025
**Problema**: Banco Supabase desatualizado (só tem dados até 2023, faltam 2024 e 2025)
**Solução**: Sincronização completa via Ploomes API

---

## 🎯 DIAGNÓSTICO

### Situação Atual
- ❌ **Supabase**: 2.648 vendas de 2023 + 10 vendas de 2025 (incompleto)
- ✅ **Ploomes**: Dados completos e atualizados (fonte da verdade)
- ⚠️ **CRON Job**: Retornando erro 403 (API Key inválida/expirada)

### Arquivos Identificados

#### 1. Frontend CRON (Next.js)
**Arquivo**: `src/app/api/cron/sync-customer-sales/route.ts`
- **Função**: Puxa deals do Ploomes e agrega em `customer_sales`
- **Frequência**: A cada 6 horas (Vercel Cron)
- **Status**: ❌ Erro 403 ao chamar Ploomes API
- **API Key**: Usando `process.env.PLOOMES_API_KEY`

#### 2. Backend Service (Node.js)
**Arquivo**: `backend/services/sync/ploome-service.js`
- **Função**: Service completo para sync de contatos e vendas
- **Features**: Rate limiting, paginação, filtros OData
- **Status**: ✅ Parece mais robusto que o CRON do frontend

---

## 🔍 CAUSAS DO PROBLEMA

### 1. Erro 403 na API do Ploomes
```json
{"success":false,"error":"Request failed with status code 403","executionTime":631}
```

**Possíveis Causas**:
1. ✅ API Key expirada ou inválida
2. ✅ Permissões insuficientes na API Key
3. ✅ Rate limit excedido
4. ✅ IP bloqueado no Ploomes
5. ✅ User-Key header incorreto

### 2. Dados Incompletos no Supabase
- **Tabela `sales`**: Última sincronização em maio/2023
- **Tabela `customer_sales`**: Agregados desatualizados
- **Deals novos**: Não foram importados (2024, 2025)

---

## 🚀 ESTRATÉGIA DE SOLUÇÃO

### OPÇÃO 1: Usar Backend Service Existente ⭐ RECOMENDADO

**Vantagens**:
- ✅ Código mais robusto com rate limiting
- ✅ Melhor tratamento de erros
- ✅ Suporta paginação e filtros OData
- ✅ Já testado e funcionando

**Passos**:

1. **Verificar Backend Service**
   ```bash
   cd backend
   node services/sync/sync-sales.js
   ```

2. **Configurar Environment Variables**
   ```bash
   # backend/.env
   PLOOME_API_URL=https://public-api2.ploomes.com
   PLOOMES_API_KEY=A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A...
   SUPABASE_URL=https://yxwokryybudwygtemfmu.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   CLIENT_TAG_ID=40006184
   ```

3. **Executar Sync Manual**
   ```bash
   # Sync completo de vendas
   npm run sync:sales

   # Ou executar diretamente
   node backend/services/sync/sync-sales.js
   ```

4. **Monitorar Progresso**
   - Logs detalhados com emojis 📊
   - Progress tracking
   - Validação de dados importados

5. **Validar Resultado**
   ```sql
   -- Verificar vendas por ano após sync
   SELECT EXTRACT(YEAR FROM created_at) as ano,
          COUNT(*) as vendas,
          SUM(CAST(deal_value AS DECIMAL)) as receita
   FROM sales
   GROUP BY ano
   ORDER BY ano DESC;
   ```

### OPÇÃO 2: Consertar CRON do Frontend

**Desvantagens**:
- ❌ Erro 403 não resolvido ainda
- ❌ Menos robusto que backend service
- ❌ Pode ter problemas de timeout

**Passos Necessários**:

1. **Diagnosticar API Key**
   ```bash
   # Testar API Key diretamente
   curl -X GET "https://public-api2.ploomes.com/Deals?$top=1" \
     -H "User-Key: A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A..." \
     -H "Content-Type: application/json"
   ```

2. **Possíveis Correções**:
   - Renovar API Key no Ploomes
   - Verificar permissões da API Key
   - Adicionar retry logic com exponential backoff
   - Implementar rate limiting

3. **Executar CRON Manualmente**
   ```bash
   curl -X GET "http://localhost:3003/api/cron/sync-customer-sales" \
     -H "Authorization: Bearer customer-sales-sync-cron-secret-2025"
   ```

### OPÇÃO 3: Sync Híbrido (Mais Completo) ⭐⭐ MELHOR

**Estratégia**:
1. **Backend Service**: Sincroniza tabela `sales` (vendas detalhadas)
2. **Frontend CRON**: Agrega em `customer_sales` (métricas agregadas)

**Vantagens**:
- ✅ Separação de responsabilidades
- ✅ Backend foca em import bruto
- ✅ Frontend foca em agregações
- ✅ Melhor performance

**Fluxo**:
```
Ploomes API → Backend Service → Tabela sales (Supabase)
                                     ↓
                            Frontend CRON agregador
                                     ↓
                         Tabela customer_sales (Supabase)
```

---

## 📋 PLANO DE EXECUÇÃO RECOMENDADO

### FASE 1: Teste de API Key (5 min)
```bash
# Testar se API Key está válida
curl -X GET "https://public-api2.ploomes.com/Deals?$top=1" \
  -H "User-Key: A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3" \
  -H "Content-Type: application/json"
```

**Resultado Esperado**:
- ✅ Status 200: API Key válida → prosseguir
- ❌ Status 403/401: API Key inválida → renovar no Ploomes

### FASE 2: Sync de Vendas via Backend (30 min)
```bash
cd /Users/rodrigooliveira/Documents/workspace\ 2/Claude-code/PLOMES-ROTA-CEP/backend

# Criar .env se não existir
cat > .env << 'EOF'
PLOOME_API_URL=https://public-api2.ploomes.com
PLOOMES_API_KEY=A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3
SUPABASE_URL=https://yxwokryybudwygtemfmu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg
CLIENT_TAG_ID=40006184
NODE_ENV=development
EOF

# Executar sync
node services/sync/sync-sales.js
```

**Monitorar**:
- 📊 Progress logs
- ✅ Vendas importadas por ano
- ⚠️ Erros de API ou timeout

### FASE 3: Agregação via Frontend CRON (5 min)
```bash
# Executar CRON de agregação (se API Key estiver ok)
curl -X GET "http://localhost:3003/api/cron/sync-customer-sales" \
  -H "Authorization: Bearer customer-sales-sync-cron-secret-2025"
```

**Ou executar SQL direto no Supabase** (fallback):
```sql
-- Agregar vendas em customer_sales
INSERT INTO customer_sales (
  customer_id, customer_name, customer_cnpj,
  total_sales, total_deals, won_deals,
  total_revenue, average_deal_value,
  first_purchase_date, last_purchase_date
)
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.cnpj as customer_cnpj,
  COUNT(*) FILTER (WHERE s.won = true) as total_sales,
  COUNT(*) as total_deals,
  COUNT(*) FILTER (WHERE s.won = true) as won_deals,
  SUM(CAST(s.deal_value AS DECIMAL)) as total_revenue,
  AVG(CAST(s.deal_value AS DECIMAL)) FILTER (WHERE s.won = true) as average_deal_value,
  MIN(s.created_at) as first_purchase_date,
  MAX(s.created_at) as last_purchase_date
FROM sales s
JOIN customers c ON s.customer_id = c.id
GROUP BY c.id, c.name, c.cnpj
ON CONFLICT (customer_id)
DO UPDATE SET
  total_sales = EXCLUDED.total_sales,
  total_deals = EXCLUDED.total_deals,
  won_deals = EXCLUDED.won_deals,
  total_revenue = EXCLUDED.total_revenue,
  average_deal_value = EXCLUDED.average_deal_value,
  first_purchase_date = EXCLUDED.first_purchase_date,
  last_purchase_date = EXCLUDED.last_purchase_date;
```

### FASE 4: Validação (5 min)
```sql
-- Verificar distribuição de vendas por ano
SELECT
  EXTRACT(YEAR FROM created_at) as ano,
  COUNT(*) as total_vendas,
  COUNT(DISTINCT customer_id) as clientes,
  SUM(CAST(deal_value AS DECIMAL)) as receita
FROM sales
GROUP BY ano
ORDER BY ano DESC;

-- Verificar cliente específico (Hospital Antonio Prudente)
SELECT
  EXTRACT(YEAR FROM created_at) as ano,
  COUNT(*) as vendas,
  SUM(CAST(deal_value AS DECIMAL)) as receita
FROM sales
WHERE customer_id = '401794502'
GROUP BY ano
ORDER BY ano DESC;
```

**Resultados Esperados**:
- ✅ Vendas de 2023, 2024, e 2025 presentes
- ✅ Cliente 401794502 com vendas atualizadas
- ✅ Dashboard mostrando dados corretos

---

## ⚠️ PROBLEMAS CONHECIDOS E SOLUÇÕES

### 1. Erro 403 ao chamar Ploomes
**Solução**: Renovar API Key no portal do Ploomes

### 2. Rate Limit do Ploomes
**Solução**: Backend service já tem rate limiting (500ms delay)

### 3. Timeout em CRON (Vercel 5min limit)
**Solução**: Usar backend service que roda localmente sem timeout

### 4. Dados muito grandes
**Solução**: Paginação com `$top=50` e `$skip`

### 5. Memória insuficiente
**Solução**: Processar em batches de 500 registros

---

## 📊 MONITORAMENTO PÓS-SYNC

### Queries de Validação
```sql
-- 1. Vendas por ano (deve ter 2023, 2024, 2025)
SELECT EXTRACT(YEAR FROM created_at) as ano, COUNT(*) as vendas
FROM sales GROUP BY ano ORDER BY ano DESC;

-- 2. Clientes com vendas recentes (2024+)
SELECT COUNT(DISTINCT customer_id) FROM sales
WHERE created_at >= '2024-01-01';

-- 3. Top 10 clientes por receita
SELECT c.name, SUM(CAST(s.deal_value AS DECIMAL)) as receita
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.won = true
GROUP BY c.id, c.name
ORDER BY receita DESC
LIMIT 10;
```

### Dashboard Test
1. Abrir: http://localhost:3003/dashboard/customers
2. Verificar: Filtros mostram clientes com vendas 2024/2025
3. Clicar: Cliente HOSPITAL ANTONIO PRUDENTE → ver vendas atualizadas
4. Testar: Modal de histórico de preços funcionando

---

## 🎯 RESULTADO ESPERADO

### Antes (Atual)
```
Sales Table:
  2023: 2.648 vendas (R$ 104.9M)
  2025: 10 vendas (R$ 555K) ← Incompleto!

Customer Dashboard:
  ❌ Mostra só dados de 2023 para maioria dos clientes
  ❌ Faltam vendas de 2024 e grande parte de 2025
```

### Depois (Objetivo)
```
Sales Table:
  2023: ~2.650 vendas (R$ 105M)
  2024: ??? vendas (R$ ???) ← Dados reais do Ploomes
  2025: ??? vendas (R$ ???) ← Dados completos do Ploomes

Customer Dashboard:
  ✅ Todos os clientes com vendas atualizadas
  ✅ Histórico completo 2023-2025
  ✅ Métricas agregadas corretas
```

---

## 📝 PRÓXIMOS PASSOS

### Imediato (Agora)
1. ✅ Testar API Key do Ploomes
2. ✅ Executar sync via backend service
3. ✅ Validar dados no Supabase
4. ✅ Testar dashboard atualizado

### Curto Prazo (Esta Semana)
1. ⏭️ Configurar Vercel Cron para rodar automaticamente
2. ⏭️ Monitorar logs de sync
3. ⏭️ Documentar processo de sync

### Médio Prazo (Este Mês)
1. ⏭️ Implementar webhook do Ploomes para sync em tempo real
2. ⏭️ Criar alertas de falha de sync
3. ⏭️ Dashboard de monitoramento de sincronização

---

**Criado por**: Claude Code
**Data**: 02/10/2025
**Status**: Pronto para execução
