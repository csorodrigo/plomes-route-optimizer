# Solução para Sincronização Ploomes → Supabase

## 🎯 Problema Identificado

### Root Cause
A API do Ploomes estava retornando **HTTP 403 Forbidden** quando chamada do Node.js devido a dois problemas principais:

1. **Conflito do Supabase SDK**: O pacote `@supabase/supabase-js` polui o fetch global através do `cross-fetch`, causando falhas em TODAS as requisições HTTP (fetch, axios, e até https nativo)

2. **Restrições de Permissão de Campos**: Alguns campos do endpoint `/Deals` requerem permissões especiais:
   - ✅ Campos que funcionam: `Id`, `ContactId`, `Amount`, `LastUpdateDate`, `Title`
   - ❌ Campos que causam 403: `Win`, `Lose`, `StageId`, `Products`

## 💡 Solução Implementada

### Abordagem de Dois Passos

Criamos um processo em duas etapas para isolar completamente a API do Ploomes do Supabase SDK:

#### **PASSO 1: Buscar Deals do Ploomes** (`step1-fetch-ploomes.js`)
- ✅ **SEM import do Supabase** - evita poluição do fetch
- ✅ Usa **https nativo do Node.js** - não depende de fetch
- ✅ Apenas campos com permissão - evita 403
- ✅ Rate limiting conservador - 50 deals/página, 1s de delay
- ✅ Salva em JSON - desacopla dos passos seguintes

**Campos buscados**:
```javascript
$select=Id,ContactId,Amount,LastUpdateDate,Title
```

#### **PASSO 2: Inserir no Supabase** (`step2-insert-supabase.js`)
- ✅ Carrega JSON do passo 1
- ✅ **PODE usar Supabase SDK** - não faz chamadas HTTP externas
- ✅ Agrega vendas por cliente
- ✅ Upsert em batches de 500

### Script Wrapper (`sync-ploomes-complete.sh`)
Executa os dois passos sequencialmente com tratamento de erros.

## 🔧 Como Usar

### Sincronização Completa
```bash
./sync-ploomes-complete.sh
```

### Passos Individuais
```bash
# Passo 1: Buscar do Ploomes
node step1-fetch-ploomes.js

# Passo 2: Inserir no Supabase
node step2-insert-supabase.js
```

## 📊 Performance

- **Tempo estimado**: ~3-4 minutos para buscar todos os deals
- **Rate limit**: 50 deals/página, 1 segundo de delay (60 req/min)
- **Máximo**: 10.000 deals (200 páginas × 50)
- **Batch upsert**: 500 registros por vez no Supabase

## ⚠️ Limitações Conhecidas

### Campos Não Disponíveis
Devido às restrições de permissão da API do Ploomes, os seguintes campos NÃO estão disponíveis:

- `Win` / `Lose` - Status de fechamento do deal
- `StageId` - Estágio atual do deal
- `Products` - Produtos vendidos no deal

### Impacto nos Dados
Como não temos `Win`/`Lose`, a agregação assume:
- **Won deals**: Todos os deals com `Amount > 0`
- **Open/Lost deals**: Não podemos determinar (ficam zerados)
- **Products**: Lista vazia (sem dados de produtos)

## 🔄 Próximos Passos

### Para Dados Completos
1. **Solicitar permissões adicionais** ao administrador do Ploomes para acessar:
   - Campo `Win` (booleano)
   - Campo `Lose` (booleano)
   - Campo `StageId` (número)
   - Campo `Products` (array com `$expand`)

2. **Atualizar queries** em `step1-fetch-ploomes.js`:
```javascript
// Quando permissões estiverem disponíveis:
$select=Id,ContactId,Amount,LastUpdateDate,Title,Win,Lose,StageId&$expand=Products
```

3. **Atualizar agregação** em `step2-insert-supabase.js` para usar campos Win/Lose reais

## 📁 Arquivos Criados

- `step1-fetch-ploomes.js` - Busca deals do Ploomes
- `step2-insert-supabase.js` - Insere no Supabase
- `sync-ploomes-complete.sh` - Script wrapper
- `ploomes-deals.json` - Cache dos deals (criado pelo passo 1)
- `ploomes-fetch.log` - Log do passo 1
- `SYNC_SOLUTION.md` - Este documento

## 🎉 Benefícios da Solução

1. ✅ **Funciona com API key atual** - sem necessidade de upgrades
2. ✅ **Contorna o bug do Supabase SDK** - isolamento completo
3. ✅ **Rate limiting adequado** - respeita limites de 120 req/min
4. ✅ **Escalável** - pode buscar até 10k deals
5. ✅ **Debugável** - logs claros, arquivos intermediários
6. ✅ **Reutilizável** - JSON pode ser reprocessado sem nova busca

## 📝 Notas Técnicas

### Por que Https Nativo?
- `fetch()` e `axios` falhavam mesmo sem Supabase import
- `https` nativo do Node.js é mais baixo nível
- Não é afetado por polyfills de bibliotecas

### Por que Dois Passos?
- Passo 1: Totalmente isolado, pode usar qualquer método HTTP
- Passo 2: Pode usar Supabase SDK sem riscos de conflito
- Facilita debug: pode re-rodar passo 2 sem re-fetch

### Descoberta do Campo Win
Testamos campo por campo:
- `Id, ContactId, Amount` ✅
- `+ LastUpdateDate` ✅
- `+ Title` ✅
- `+ Win` ❌ 403 FORBIDDEN

Conclusão: Campo `Win` requer permissões especiais na API key.
