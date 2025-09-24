# Migração para Supabase PostgreSQL

## ✅ MIGRAÇÃO COMPLETA - Sistema KV → Supabase PostgreSQL

Este documento descreve a migração completa do sistema temporário de KV (Key-Value) para Supabase PostgreSQL permanente.

## 🎯 Objetivos Alcançados

- ✅ **Substituição completa do sistema KV** por Supabase PostgreSQL
- ✅ **Persistência permanente** dos 1,390+ clientes geocodificados
- ✅ **Compatibilidade com Vercel** serverless functions
- ✅ **APIs modificadas** para usar Supabase
- ✅ **Scripts de migração** e configuração criados

## 📁 Arquivos Modificados/Criados

### Principais Modificações

1. **`lib/supabase.js`** - Nova biblioteca Supabase (substitui `lib/kv.js`)
2. **`api/geocoding/batch.js`** - Modificado para usar Supabase
3. **`api/customers.js`** - Modificado para usar Supabase
4. **`.env.example`** - Adicionadas configurações Supabase

### Novos Arquivos

1. **`sql/supabase_schema.sql`** - Schema completo do banco
2. **`scripts/setup-supabase.js`** - Script de configuração inicial
3. **`scripts/migrate-kv-to-supabase.js`** - Script de migração de dados
4. **`test-supabase-integration.js`** - Teste de integração

## 🔧 Configuração Necessária

### 1. Variáveis de Ambiente (Vercel)

Configure essas variáveis na Vercel:

```env
SUPABASE_URL=https://jjtgutjqrdqpbjjaxenf.supabase.co
SUPABASE_SERVICE_KEY=sbp_581c923a5cf097d4652d24e27cfd57aa86449869

# Ploome (existentes)
PLOOMES_API_KEY=sua_chave_aqui
PLOOMES_BASE_URL=https://public-api2.ploomes.com
CLIENT_TAG_ID=40006184
```

### 2. Setup do Banco de Dados

Execute o script de configuração:

```bash
npm run supabase:setup
```

### 3. Migração dos Dados Existentes (se houver)

Se você tem dados no sistema KV antigo:

```bash
npm run supabase:migrate-kv
```

### 4. Teste da Integração

```bash
node test-supabase-integration.js
```

## 🏗️ Estrutura do Banco

### Tabelas Principais

1. **`customers`** - Dados dos clientes e geocodificação
   - `id`, `name`, `email`, `phone`, `address`, `cep`
   - `latitude`, `longitude`, `geocoding_status`
   - `ploome_person_id`, `created_at`, `updated_at`

2. **`geocoding_stats`** - Estatísticas globais
   - `total_processed`, `total_geocoded`, `total_failed`
   - `last_updated`

3. **`batch_logs`** - Logs dos processamentos
   - `batch_id`, `completed_at`, `batch_size`
   - `processed`, `geocoded`, `failed`, `skipped`

4. **`key_value_store`** - Compatibilidade genérica
   - `key`, `value`, `created_at`, `expires_at`

## 🚀 APIs Atualizadas

### `/api/geocoding/batch`
- ✅ Salva clientes geocodificados no Supabase
- ✅ Mantém estatísticas atualizadas
- ✅ Suporte a processamento em lote

### `/api/customers`
- ✅ Serve dados do Supabase PostgreSQL
- ✅ Filtros por busca e status de geocodificação
- ✅ Paginação eficiente
- ✅ Fallback para Ploome se necessário

## ⚡ Vantagens da Migração

### Performance
- **Consultas SQL nativas** em vez de key-value simples
- **Índices otimizados** para busca e filtros
- **Agregações eficientes** para estatísticas

### Escalabilidade
- **PostgreSQL robusto** suporta milhões de registros
- **Concurrent connections** para múltiplas funções Vercel
- **Backup automático** e replicação

### Funcionalidades
- **Buscas complexas** por nome, CEP, cidade
- **Filtros avançados** (geocodificados, pendentes)
- **Relatórios** e estatísticas em tempo real

## 🔄 Processo de Deploy

### 1. Deploy na Vercel

As APIs já estão modificadas e prontas. Apenas faça deploy normalmente:

```bash
vercel --prod
```

### 2. Configure Variáveis

Na dashboard da Vercel, configure as variáveis do Supabase.

### 3. Execute Setup (Uma vez)

Após o deploy, execute uma vez:

```bash
# Via função serverless ou script local
npm run supabase:setup
```

### 4. Migração de Dados (Se necessário)

Se houver dados existentes para migrar:

```bash
npm run supabase:migrate-kv
```

## 🧪 Testando a Migração

### 1. Teste das APIs

```bash
# Teste básico de customers
curl https://seu-app.vercel.app/api/customers

# Teste de geocodificação em lote
curl -X POST https://seu-app.vercel.app/api/geocoding/batch
```

### 2. Verificar Dados

```bash
# Execute o teste de integração
node test-supabase-integration.js
```

## 📊 Monitoramento

### Dashboard Supabase
- Acesse https://supabase.com/dashboard
- Monitore tabelas, queries e performance

### Logs Vercel
- Verifique logs das funções serverless
- Monitore erros de conexão

## 🛠️ Troubleshooting

### Erro de Conexão
```
Error: Failed to connect to Supabase
```
**Solução:** Verifique se as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` estão configuradas corretamente na Vercel.

### Tabelas Não Encontradas
```
Error: relation "customers" does not exist
```
**Solução:** Execute o script de setup: `npm run supabase:setup`

### Dados Não Aparecem
```
No customers found in database
```
**Solução:**
1. Execute a migração: `npm run supabase:migrate-kv`
2. Ou execute geocodificação: `POST /api/geocoding/batch`

## 🎉 Resultado Final

- **✅ 1,390+ clientes** podem ser persistidos permanentemente
- **✅ Sistema robusto** com PostgreSQL
- **✅ APIs funcionais** na Vercel
- **✅ Backup automático** e alta disponibilidade
- **✅ Escalabilidade** para crescimento futuro

A migração está **COMPLETA** e o sistema está pronto para produção! 🚀