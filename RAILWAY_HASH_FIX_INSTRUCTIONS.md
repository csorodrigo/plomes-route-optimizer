# Instruções para Correção do Hash de Senha no Railway

## Problema Identificado
O banco de dados no Railway contém um usuário com hash bcrypt antigo que precisa ser convertido para SHA256.

## Solução Implementada

### 1. Sistema Automático de Migração
O código já possui um sistema automático que detecta e migra hashes bcrypt para SHA256 automaticamente. O arquivo `/backend/services/auth/auth-service.js` nas linhas 72-90 contém esta funcionalidade.

### 2. Script de Correção Manual
Criamos um script `/backend/scripts/fix-password-hash.js` que força a migração dos hashes.

## Como Executar no Railway

### Opção 1: Deploy Simples (Recomendado)
1. Faça um novo deploy da aplicação no Railway
2. O sistema irá automaticamente detectar e migrar o hash durante a inicialização
3. Verifique os logs do deploy para confirmar a migração

### Opção 2: Executar Script Manualmente via Railway CLI
Se você tiver acesso ao Railway CLI configurado:

```bash
# Conectar ao projeto
railway link [PROJECT_ID]

# Executar o script de correção
railway run node scripts/fix-password-hash.js
```

### Opção 3: Criar um Deploy One-Time Job
1. Adicione um comando no `package.json`:
```json
{
  "scripts": {
    "fix-hash": "node scripts/fix-password-hash.js"
  }
}
```

2. No Railway, crie um serviço temporário com o comando `npm run fix-hash`

### Opção 4: Usar Railway Console (se disponível)
1. Acesse o console do Railway para seu projeto
2. Execute: `node scripts/fix-password-hash.js`

## Verificação da Correção

O script irá mostrar saídas como:
```
🔄 Updating user from bcrypt to SHA256 hash...
✅ User updated to SHA256 hash: gustavo.canuto@ciaramaquinas.com.br
```

## Credenciais do Usuário Padrão
- **Email**: gustavo.canuto@ciaramaquinas.com.br
- **Senha**: ciara123@
- **Nome**: Gustavo Canuto

## Informações Técnicas

### Como Funciona a Migração
1. O sistema verifica se o hash da senha contém ':' (formato SHA256)
2. Se não contém, considera que é um hash bcrypt antigo
3. Deleta o usuário antigo e recria com hash SHA256
4. Usa a senha padrão conhecida para o usuário específico

### Arquivos Envolvidos
- `/backend/services/auth/auth-service.js` - Serviço principal com migração automática
- `/backend/scripts/fix-password-hash.js` - Script para execução manual
- `/backend/services/sync/database-service.js` - Serviço de banco de dados

## Status da Implementação
✅ Sistema automático de migração implementado  
✅ Script manual de correção criado e testado  
✅ Funcionamento verificado localmente  
⏳ Aguardando execução no Railway  

## Próximos Passos
1. Execute qualquer uma das opções acima no Railway
2. Verifique os logs para confirmar a migração
3. Teste o login com as credenciais do usuário padrão
4. O problema estará resolvido automaticamente

---
*Gerado automaticamente para correção de problema crítico no Railway*