# 🚀 PLOMES-ROTA-CEP - Guia de Deployment

## 📋 Status do Projeto

**✅ SISTEMA COMPLETAMENTE FUNCIONAL**

- **Versão**: v2.1.4-PT-BR
- **Interface**: 100% em português
- **Backend**: Rodando na porta 3001
- **Banco de dados**: SQLite com cache otimizado
- **Funcionalidades**: Todas operacionais

### 🔧 Funcionalidades Implementadas

- ✅ Interface em português (PT-BR)
- ✅ Drag and drop nos componentes
- ✅ Sistema de exportação de relatórios
- ✅ Autenticação funcionando
- ✅ Integração com Ploome
- ✅ Geocodificação
- ✅ Otimização de rotas
- ✅ Banco SQLite com cache
- ✅ Docker multi-stage otimizado

## 🚀 Deployment Rápido

### 1. Script Automático
```bash
./deploy.sh
```

### 2. Railway (Recomendado)
```bash
# Login no Railway
railway login

# Deploy (se já configurado)
railway up

# Ou criar novo projeto
railway init
railway up
```

### 3. Docker
```bash
# Build da imagem
docker build -t plomes-app .

# Executar container
docker run -p 3001:3001 \
  -e PLOOME_API_KEY=sua_chave_aqui \
  -e JWT_SECRET=seu_jwt_secret \
  plomes-app
```

## 🔑 Variáveis de Ambiente

### Obrigatórias
- `PLOOME_API_KEY`: Chave da API Ploome
- `JWT_SECRET`: Chave secreta para JWT (gerada automaticamente se não definida)

### Opcionais
- `PORT`: Porta do servidor (padrão: 3001)
- `NODE_ENV`: Ambiente (padrão: production)
- `DATABASE_PATH`: Caminho do banco SQLite
- `GOOGLE_MAPS_API_KEY`: Chave do Google Maps
- `POSITIONSTACK_API_KEY`: Chave alternativa de geocodificação

## 📁 Estrutura de Deployment

```
PLOMES-ROTA-CEP/
├── backend/
│   ├── server.js           # Servidor principal
│   ├── cache/              # Banco SQLite
│   └── ...
├── frontend/
│   ├── build/              # Frontend buildado (produção)
│   └── src/                # Código fonte React
├── Dockerfile              # Container Docker otimizado
├── railway.toml            # Configuração Railway
├── deploy.sh               # Script de deployment
└── package.json            # Dependências principais
```

## 🌐 URLs de Acesso

### Railway
- URL será gerada automaticamente no formato:
  `https://[projeto]-production.up.railway.app`

### Local
- Frontend: `http://localhost:3001`
- API Health: `http://localhost:3001/api/health`
- API Docs: `http://localhost:3001/api`

## 🔍 Verificação de Deployment

### Health Check
```bash
curl https://seu-dominio.railway.app/api/health
```

**Resposta esperada:**
```json
{
  "status": "OK",
  "message": "Servidor funcionando",
  "timestamp": "2025-09-18T09:00:00.000Z",
  "version": "v2.1.4-PT-BR"
}
```

### Teste de Funcionalidades
1. Acesse a URL principal
2. Faça login com credenciais teste
3. Teste drag and drop dos componentes
4. Verifique integração Ploome
5. Teste exportação de relatórios

## 🛠️ Troubleshooting

### Railway não funciona?
1. Verifique se está logado: `railway login`
2. Confirme as variáveis de ambiente no dashboard
3. Monitore os logs: `railway logs`

### Docker não inicia?
1. Verifique se as variáveis estão definidas
2. Confirme se a porta 3001 está livre
3. Execute com logs: `docker logs container_id`

### Build falha?
1. Execute o script de limpeza: `./deploy.sh`
2. Reinstale dependências: `npm install`
3. Rebuild frontend: `cd frontend && npm run build`

## 📞 Suporte

Sistema desenvolvido e otimizado com:
- **Claude Code** (Anthropic)
- **Railway** para deployment
- **Docker** para containerização
- **React** + **Node.js** + **SQLite**

---

**🎉 Sistema pronto para produção!**

Última atualização: 18/09/2025 - v2.1.4-PT-BR