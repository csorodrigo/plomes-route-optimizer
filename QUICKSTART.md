# 🚀 GUIA RÁPIDO - Sistema de Rotas Ploome

## ✅ Status do Sistema
- **Backend**: Rodando em http://localhost:3001
- **Frontend**: Rodando em http://localhost:3000
- **API Ploome**: Conectada e funcionando

## 📱 Como Usar o Sistema

### 1️⃣ Primeira Vez - Sincronizar Clientes do Ploome

1. Abra http://localhost:3000 no navegador
2. Clique no menu ☰ (canto superior esquerdo)
3. Selecione **"Sincronizar Clientes"**
4. Clique em **"Iniciar Sincronização"**
5. Aguarde o download dos clientes (pode demorar alguns minutos)

### 2️⃣ Criar uma Rota Otimizada

1. No menu, selecione **"Mapa e Rotas"**
2. Digite o **CEP de origem** (ex: onde você está hospedado)
3. Ajuste o **slider de distância** (0-100km)
4. O mapa mostrará os clientes dentro do raio
5. **Clique nos marcadores** para selecionar clientes
6. Clique em **"Traçar Rota Otimizada"**
7. A rota aparecerá no mapa com tempo e distância

### 3️⃣ Visualizar Estatísticas

1. No menu, selecione **"Dashboard"**
2. Veja:
   - Total de clientes
   - Clientes geocodificados
   - Rotas criadas
   - Última sincronização

## 🛠️ Comandos Úteis

### Terminal 1 - Backend
```bash
npm run dev:backend
```

### Terminal 2 - Frontend  
```bash
cd frontend && npm start
```

### Testar Conexão com Ploome
```bash
curl http://localhost:3001/api/test-connection
```

### Sincronizar Clientes (via CLI)
```bash
npm run sync:ploome
```

## 🔍 Solução de Problemas

### "Nenhum cliente encontrado"
- Execute a sincronização primeiro (menu → Sincronizar Clientes)

### "CEP não encontrado"
- Use formato: 00000-000 ou 00000000
- Certifique-se que é um CEP válido brasileiro

### "Erro ao traçar rota"
- Selecione pelo menos 1 cliente no mapa
- Verifique se o CEP de origem está correto

### "API key inválida"
1. Verifique o arquivo `.env`
2. Confirme que a chave está completa (128 caracteres)
3. Teste com: `curl http://localhost:3001/api/test-connection`

## 📍 Exemplos de CEPs para Teste

- São Paulo Centro: 01310-100
- Rio de Janeiro Centro: 20040-020
- Belo Horizonte Centro: 30190-050
- Curitiba Centro: 80010-000
- Porto Alegre Centro: 90010-000

## 🎯 Dicas de Uso

1. **Filtro de Distância**: Comece com raio pequeno (10-20km) e aumente gradualmente
2. **Seleção de Clientes**: Máximo 10-15 clientes por rota para melhor performance
3. **Horário**: Considere o trânsito ao planejar visitas
4. **Export**: Use o botão de export para salvar a rota

## 📞 Endpoints da API

- GET http://localhost:3001/api/health - Status do sistema
- GET http://localhost:3001/api/test-connection - Testar Ploome
- GET http://localhost:3001/api/customers - Listar clientes
- POST http://localhost:3001/api/routes/optimize - Otimizar rota
- GET http://localhost:3001/api/statistics - Estatísticas

## 🔄 Atualização de Dados

Os dados são sincronizados do Ploome e salvos localmente. Para atualizar:
1. Menu → Sincronizar Clientes → Iniciar Sincronização
2. Ou via terminal: `npm run sync:ploome`

---

**Sistema pronto para uso!** 🎉