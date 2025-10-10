# 📋 Instruções: Atualizar Produtos no Supabase via Dashboard

## 📊 Resumo

Total de updates: **1,641 vendas**
Divididos em: **4 arquivos SQL**

- `DASHBOARD-batch-1of4.sql`: 496 updates
- `DASHBOARD-batch-2of4.sql`: 496 updates
- `DASHBOARD-batch-3of4.sql`: 496 updates
- `DASHBOARD-batch-4of4.sql`: 140 updates

---

## 🚀 Passo a Passo

### 1. Acessar o Dashboard do Supabase

Abra o navegador e vá para:
```
https://supabase.com/dashboard/project/yxwokryybudwygtemfmu
```

### 2. Ir para o SQL Editor

1. No menu lateral esquerdo, clique em **"SQL Editor"**
2. Clique em **"New query"** para criar uma nova consulta

### 3. Executar Batch 1/4

1. Abra o arquivo `DASHBOARD-batch-1of4.sql` no seu editor de texto
2. Copie **TODO** o conteúdo do arquivo (Cmd+A, Cmd+C)
3. Cole no SQL Editor do Supabase (Cmd+V)
4. Clique em **"Run"** (ou pressione Cmd+Enter)
5. ⏳ Aguarde a execução completar (pode levar 30-60 segundos)
6. ✅ Verifique que apareceu mensagem de sucesso

### 4. Executar Batch 2/4

1. Limpe o SQL Editor (selecione tudo e delete)
2. Abra o arquivo `DASHBOARD-batch-2of4.sql`
3. Copie **TODO** o conteúdo
4. Cole no SQL Editor
5. Clique em **"Run"**
6. ⏳ Aguarde completar
7. ✅ Verifique sucesso

### 5. Executar Batch 3/4

1. Limpe o SQL Editor
2. Abra o arquivo `DASHBOARD-batch-3of4.sql`
3. Copie **TODO** o conteúdo
4. Cole no SQL Editor
5. Clique em **"Run"**
6. ⏳ Aguarde completar
7. ✅ Verifique sucesso

### 6. Executar Batch 4/4 (ÚLTIMO)

1. Limpe o SQL Editor
2. Abra o arquivo `DASHBOARD-batch-4of4.sql`
3. Copie **TODO** o conteúdo
4. Cole no SQL Editor
5. Clique em **"Run"**
6. ⏳ Aguarde completar
7. ✅ Verifique sucesso

---

## 🔍 Verificação Final

Após executar todos os 4 batches, execute esta query de verificação:

```sql
-- Verificar quantas vendas têm produtos
SELECT
  COUNT(*) as total_com_produtos,
  COUNT(DISTINCT customer_id) as clientes_unicos
FROM sales
WHERE products IS NOT NULL
  AND jsonb_array_length(products) > 0;
```

### ✅ Resultado Esperado:
- `total_com_produtos`: deve ser **1,641**
- `clientes_unicos`: aproximadamente 500-800 clientes

### 📊 Ver Amostra de Produtos:

```sql
-- Ver 5 exemplos de vendas com produtos
SELECT
  id,
  customer_id,
  ploomes_deal_id,
  jsonb_array_length(products) as qtd_produtos,
  products->0->>'product_name' as primeiro_produto
FROM sales
WHERE products IS NOT NULL
  AND jsonb_array_length(products) > 0
LIMIT 5;
```

---

## ⚠️ Dicas Importantes

1. **Não feche o navegador** durante a execução de cada batch
2. **Aguarde a confirmação** de sucesso antes de passar para o próximo batch
3. **Se der erro**: Anote o número do batch que falhou e execute novamente
4. **Internet estável**: Os batches são grandes, certifique-se de ter conexão estável
5. **Paciência**: Cada batch pode levar 30-60 segundos para executar

---

## 🎯 Após Completar Todos os Batches

1. Execute a query de verificação acima
2. Se o total for 1,641, tudo certo! ✅
3. Vá ao dashboard da aplicação e verifique se os produtos aparecem
4. Se algo não funcionar, me avise e podemos investigar

---

## 📝 Troubleshooting

### Problema: Timeout durante execução
**Solução**: Execute o batch novamente. Os UPDATEs são idempotentes (pode executar múltiplas vezes sem problema)

### Problema: Erro de sintaxe SQL
**Solução**: Certifique-se de copiar TODO o conteúdo do arquivo, do início ao fim

### Problema: Não aparece resultado de sucesso
**Solução**: Verifique se você está logado no projeto correto (yxwokryybudwygtemfmu)

---

## 🎉 Sucesso!

Após completar todos os batches, os produtos estarão sincronizados no Supabase e aparecerão no dashboard da aplicação.

**Total sincronizado:**
- ✅ 1,641 vendas com produtos
- ✅ 15,191 produtos individuais
- ✅ Prontos para visualização no dashboard
