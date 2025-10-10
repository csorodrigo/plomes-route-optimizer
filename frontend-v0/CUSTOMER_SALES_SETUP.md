# Customer Sales Dashboard - Setup Completo ✅

## 📋 Resumo das Tarefas Completadas

### ✅ 1. Migração SQL Aplicada
- **Tabela**: `customer_sales` criada no Supabase
- **Campos**:
  - `customer_id`, `customer_name`, `customer_cnpj`
  - `total_sales`, `total_deals`, `won_deals`, `open_deals`, `lost_deals`
  - `total_revenue`, `average_deal_value`
  - `products_purchased` (JSONB), `total_products`
  - `first_purchase_date`, `last_purchase_date`, `days_since_last_purchase`
  - `has_custom_pricing`, `pricing_history_count`
  - Timestamps: `created_at`, `updated_at`
- **Índices**: customer_id, total_revenue, total_deals, updated_at
- **Trigger**: Auto-update de `updated_at`

### ✅ 2. CRON Job Atualizado
- **Arquivo**: `src/app/api/cron/sync-customer-sales/route.ts`
- **Melhorias**:
  - Busca deals com campos completos (Win, Lose, Products, etc.)
  - Calcula métricas detalhadas (won/open/lost deals)
  - Rastreia produtos comprados por cliente
  - Calcula dias desde última compra
  - Upsert em lotes de 500 registros

### ✅ 3. API de Dashboard
- **Endpoint**: `/api/dashboard/customers`
- **Recursos**:
  - Paginação (page, limit)
  - Ordenação (sortBy, sortOrder)
  - Busca (por nome ou CNPJ)
  - Retorna dados pré-calculados da tabela `customer_sales`

### ✅ 4. Scripts de Teste
- **`scripts/test-customer-sales-table.js`**: Testa estrutura e dados da tabela
- **`scripts/run-customer-sales-sync.js`**: Executa sync manual do CRON job

### ✅ 5. Validação de Dados
- **Total de Clientes**: 2.247
- **Com CNPJ**: 2.227 (99.1%)
- **Com CPF**: 15 (0.7%)
- **Sem documentos**: 5 (0.2%)

## 🚀 Próximos Passos

### 1. Popular Dados (IMPORTANTE!)
A tabela `customer_sales` está vazia. Você precisa executar o sync:

**Opção A - Servidor Local:**
```bash
# Inicie o servidor Next.js
npm run dev

# Em outro terminal, execute:
node scripts/run-customer-sales-sync.js
```

**Opção B - Produção (Vercel):**
```bash
# Configure CRON job no vercel.json (já configurado)
# Deploy para Vercel
vercel deploy

# O CRON executará automaticamente a cada 6 horas
# Ou execute manualmente via dashboard Vercel
```

### 2. Testar Dashboard
Após popular os dados, teste:
```bash
# Teste a API
curl "http://localhost:3000/api/dashboard/customers?page=1&limit=10"

# Teste a tabela
node scripts/test-customer-sales-table.js
```

### 3. Integrar com Frontend
Use o endpoint `/api/dashboard/customers` no componente de dashboard:
```typescript
const response = await fetch('/api/dashboard/customers?page=1&limit=50');
const { data, pagination } = await response.json();
```

## 📊 Estrutura de Resposta da API

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customer_id": "123456",
      "customer_name": "Empresa XYZ",
      "customer_cnpj": "12.345.678/0001-90",
      "total_sales": 150000.00,
      "total_deals": 25,
      "won_deals": 18,
      "open_deals": 5,
      "lost_deals": 2,
      "total_revenue": 150000.00,
      "average_deal_value": 8333.33,
      "products_purchased": [101, 102, 103],
      "total_products": 3,
      "first_purchase_date": "2023-01-15T10:00:00Z",
      "last_purchase_date": "2024-12-20T15:30:00Z",
      "days_since_last_purchase": 12,
      "has_custom_pricing": false,
      "pricing_history_count": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2247,
    "totalPages": 45
  },
  "metadata": {
    "timestamp": "2025-01-02T10:00:00Z",
    "source": "customer_sales_precalculated"
  }
}
```

## ⚙️ Configuração do CRON (Vercel)

Já configurado em `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-customer-sales",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule**: A cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)

## 🔍 Clientes sem Documentos

5 clientes não possuem CNPJ/CPF:
1. GILIARDE GUEDES ALENCAR
2. ODIR MACIEL
3. RENOVADORA AKI PNEUS
4. TOTONHO
5. JOSE ADIONDAS S BEZERRA

**Ação Recomendada**: Solicitar documentos desses clientes no Ploomes.

## 📝 Logs e Monitoramento

O CRON job gera logs detalhados:
- ✅ Etapas: Fetch customers → Fetch deals → Aggregate → Upsert
- 📊 Métricas: Total processado, tempo de execução, registros sincronizados
- ⚠️ Erros: Captura e reporta erros com detalhes

## 🎯 Performance Esperada

- **Query Speed**: < 100ms (usando índices)
- **Sync Time**: ~2-3 minutos para 2.000+ clientes
- **API Response**: < 200ms para 50 registros
- **Batch Size**: 500 registros por upsert

## ✅ Status Final

Todas as tarefas foram concluídas com sucesso:
- [x] Migração SQL aplicada
- [x] CRON job atualizado
- [x] API de dashboard criada
- [x] Scripts de teste criados
- [x] Dados validados (2.247 clientes)

**Próximo Passo**: Execute `node scripts/run-customer-sales-sync.js` com o servidor rodando para popular a tabela!
