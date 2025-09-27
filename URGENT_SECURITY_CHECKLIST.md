# ⚡ CHECKLIST URGENTE DE SEGURANÇA - AÇÃO IMEDIATA NECESSÁRIA

## 🚨 STATUS: CRÍTICO - CREDENCIAIS EXPOSTAS EM PRODUÇÃO

### ✅ PROGRESSO ATUAL:
- [x] **IDENTIFICAÇÃO:** Credenciais expostas detectadas
- [x] **CONTENÇÃO:** Removidas do vercel.json (ambos arquivos)
- [x] **DOCUMENTAÇÃO:** Relatório de incidente criado
- [ ] **REVOGAÇÃO:** Credenciais ainda ativas e comprometidas
- [ ] **SUBSTITUIÇÃO:** Novas credenciais não configuradas
- [ ] **VALIDAÇÃO:** Sistema não testado com novas credenciais

---

## 🔥 AÇÕES URGENTES - EXECUTE AGORA (ORDEM CRÍTICA):

### 1. ⚠️ REVOGAR PLOOME API - **PRIORIDADE MÁXIMA**
```
⏰ TEMPO ESTIMADO: 2 minutos
🔗 URL: https://app.ploomes.com/
📍 CAMINHO: Configurações > Integrações > API
🎯 AÇÃO: Revogar chave: A7EEF49A41433800...FA1D3
📝 RESULTADO: Gerar nova chave API
```

### 2. ⚠️ REGENERAR SUPABASE KEYS - **PRIORIDADE MÁXIMA**
```
⏰ TEMPO ESTIMADO: 2 minutos
🔗 URL: https://supabase.com/dashboard/project/yxwokryybudwygtemfmu
📍 CAMINHO: Settings > API
🎯 AÇÃO: Regenerar Service Role Key
📝 RESULTADO: Nova chave service_role + anon
```

### 3. ⚠️ GERAR NOVO JWT SECRET - **PRIORIDADE MÁXIMA**
```
⏰ TEMPO ESTIMADO: 1 minuto
🔧 COMANDO: openssl rand -hex 64
📝 RESULTADO: Novo secret de 128 caracteres
⚠️ SUBSTITUIR: super-secret-jwt-key-for-production...
```

### 4. 🟠 REVOGAR GOOGLE MAPS API - **PRIORIDADE ALTA**
```
⏰ TEMPO ESTIMADO: 3 minutos
🔗 URL: https://console.cloud.google.com/apis/credentials
🎯 AÇÃO: Deletar chave: AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV-7nuvHk
📝 RESULTADO: Nova chave com restrições de domínio
```

### 5. 🟡 REVOGAR APIs TERCEIRAS - **PRIORIDADE MÉDIA**
```
POSITIONSTACK:
🔗 https://positionstack.com/dashboard
🎯 Revogar: af855cf79ef4194561e7ee8faf3f9dc4O

OPENROUTE:
🔗 https://openrouteservice.org/dev/
🎯 Revogar: eyJvcmciOiI1YjNj...cjY0In0=
```

---

## 🔧 CONFIGURAÇÃO VERCEL - APÓS REVOGAR

### MÉTODO 1: Via Dashboard Vercel (RECOMENDADO)
```
1. Acessar: https://vercel.com/dashboard
2. Selecionar: Projeto PLOMES-ROTA-CEP
3. Ir em: Settings > Environment Variables
4. Adicionar TODAS as variáveis:
```

| Variável | Valor | Ambiente |
|----------|--------|----------|
| `PLOOME_API_KEY` | [NOVA_CHAVE_PLOOME] | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | [NOVA_CHAVE_SUPABASE] | Production |
| `JWT_SECRET` | [NOVO_JWT_SECRET] | Production |
| `GOOGLE_MAPS_API_KEY` | [NOVA_CHAVE_GOOGLE] | Production |
| `POSITIONSTACK_API_KEY` | [NOVA_CHAVE_POSITION] | Production |
| `OPENROUTE_API_KEY` | [NOVA_CHAVE_OPENROUTE] | Production |

### MÉTODO 2: Via CLI (ALTERNATIVO)
```bash
# Instalar Vercel CLI se necessário
npm i -g vercel

# Fazer login
vercel login

# Adicionar cada variável (será solicitado o valor)
vercel env add PLOOME_API_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add JWT_SECRET
vercel env add GOOGLE_MAPS_API_KEY
vercel env add POSITIONSTACK_API_KEY
vercel env add OPENROUTE_API_KEY
```

---

## 🚀 REDEPLOY URGENTE

### APÓS CONFIGURAR VARIÁVEIS:
```bash
# Via CLI:
vercel --prod

# Ou via Dashboard:
# Deployments > Redeploy (última deployment)
```

---

## ✅ VALIDAÇÃO PÓS-CORREÇÃO

### TESTES OBRIGATÓRIOS:
1. **Login funcionando:** https://[SEU_DOMINIO]/login
2. **API Ploome conectada:** Sincronização de clientes
3. **Supabase funcionando:** Dados sendo salvos
4. **Geocoding ativo:** CEPs sendo convertidos
5. **Mapas carregando:** Google Maps renderizando

### SINAIS DE SUCESSO:
- ✅ Login realizado com sucesso
- ✅ Dados de clientes carregando
- ✅ Mapas sendo exibidos
- ✅ Rotas sendo calculadas
- ✅ Sem erros 401/403 nas APIs

### SINAIS DE FALHA:
- ❌ Erro de autenticação
- ❌ "Invalid API Key"
- ❌ Mapas não carregam
- ❌ Dados não sincronizam

---

## 📞 CONTATOS DE EMERGÊNCIA

### SE ALGO DER ERRADO:
1. **Reverter deployment anterior** via Vercel Dashboard
2. **Verificar logs** em Vercel > Functions
3. **Consultar** este relatório de incidente
4. **Documentar** novos problemas encontrados

---

## 🎯 RESUMO DE COMANDOS RÁPIDOS

```bash
# 1. Gerar novo JWT Secret
openssl rand -hex 64

# 2. Verificar se Vercel CLI está instalado
vercel --version

# 3. Fazer redeploy
vercel --prod

# 4. Verificar logs em caso de erro
vercel logs [deployment-url]
```

---

## ⏰ CRONÔMETRO DE EXECUÇÃO

### TEMPO TOTAL ESPERADO: 15-20 minutos
- **Revogação:** 5-8 minutos
- **Configuração Vercel:** 3-5 minutos
- **Redeploy:** 2-3 minutos
- **Validação:** 5-7 minutos

---

## 🔒 VERIFICAÇÃO FINAL

### ANTES DE CONCLUIR, CONFIRME:
- [ ] Todas as credenciais antigas foram revogadas
- [ ] Novas credenciais configuradas na Vercel
- [ ] Redeploy realizado com sucesso
- [ ] Sistema funcionando em produção
- [ ] Logs sem erros de autenticação
- [ ] Este checklist completamente executado

---

**🚨 NÃO PARE ATÉ TODOS OS ITENS ESTAREM MARCADOS! 🚨**

*Sistema permanece vulnerável até conclusão completa*

---
*Checklist gerado automaticamente - Execute na ordem indicada*
*Crítico: Não pule etapas - Cada item é essencial para a segurança*