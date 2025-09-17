# 🗺️ Sistema de Otimização de Rotas Comerciais - Integração Ploome

Sistema completo para otimização de rotas comerciais integrado com Ploome CRM. Permite sincronizar clientes, geocodificar endereços e traçar rotas otimizadas para vendedores.

## ✨ Funcionalidades

- 🔄 **Sincronização com Ploome**: Importa automaticamente todos os clientes cadastrados
- 📍 **Geolocalização Gratuita**: Usa APIs open-source (Nominatim, ViaCEP) sem custo
- 🗺️ **Mapa Interativo**: Visualização com Leaflet/OpenStreetMap
- 📏 **Filtro por Distância**: Slider para filtrar clientes por proximidade (0-100km)
- 🛣️ **Otimização de Rotas**: Algoritmo TSP com nearest-neighbor e 2-opt
- 💾 **Cache Local**: SQLite para armazenamento eficiente
- 📊 **Dashboard**: Estatísticas e métricas em tempo real
- 📱 **Responsivo**: Funciona em desktop e mobile

## 🚀 Instalação Rápida

### Pré-requisitos
- Node.js 16+ 
- NPM ou Yarn
- Chave API do Ploome

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd PLOMES-ROTA-CEP
```

### 2. Configure as variáveis de ambiente
Edite o arquivo `.env` com sua chave API do Ploome:
```env
PLOOME_API_KEY=sua_chave_api_aqui
```

### 3. Instale as dependências
```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 4. Inicie o sistema
```bash
# Modo desenvolvimento (backend + frontend)
npm run dev
```

O sistema estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 📋 Como Usar

### 1️⃣ Primeira Sincronização
1. Acesse o menu lateral (☰)
2. Clique em "Sincronizar Clientes"
3. Clique em "Iniciar Sincronização"
4. Aguarde o download e geocodificação

### 2️⃣ Criar uma Rota
1. Vá para "Mapa e Rotas"
2. Digite o CEP de origem (ex: seu hotel)
3. Ajuste o slider de distância (km)
4. Clique nos marcadores para selecionar clientes
5. Clique em "Traçar Rota Otimizada"

### 3️⃣ Visualizar Estatísticas
1. Acesse "Dashboard" no menu
2. Veja métricas de clientes, rotas e sistema

## 🛠️ Comandos Úteis

```bash
# Sincronizar clientes via CLI
npm run sync:ploome

# Iniciar apenas o backend
npm run dev:backend

# Iniciar apenas o frontend
npm run dev:frontend

# Build para produção
npm run build
```

## 📁 Estrutura do Projeto

```
PLOMES-ROTA-CEP/
├── backend/
│   ├── api/
│   │   ├── ploome/      # Integração com Ploome
│   │   └── geocoding/   # Serviços de geolocalização
│   ├── cache/
│   │   └── customers.db # Banco SQLite
│   ├── services/
│   │   ├── sync/        # Sincronização de dados
│   │   └── route/       # Otimização de rotas
│   └── server.js        # Servidor Express
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RouteOptimizer.jsx  # Mapa principal
│   │   │   ├── CustomerSync.jsx    # Sincronização
│   │   │   └── Statistics.jsx      # Dashboard
│   │   ├── services/
│   │   │   └── api.js              # Cliente API
│   │   └── App.js                  # App principal
│   └── public/
└── .env                 # Configurações
```

## 🔌 API Endpoints

### Clientes
- `POST /api/sync/customers` - Sincronizar com Ploome
- `GET /api/customers` - Listar clientes
- `GET /api/customers?lat=X&lng=Y&radius=Z` - Filtrar por distância

### Geocodificação
- `POST /api/geocode/batch` - Geocodificar em lote
- `POST /api/geocode/address` - Geocodificar endereço único

### Rotas
- `POST /api/routes/optimize` - Otimizar rota
- `GET /api/routes` - Listar rotas salvas

### Sistema
- `GET /api/statistics` - Estatísticas do sistema
- `GET /api/health` - Status de saúde

## 🎯 Algoritmos de Otimização

O sistema usa uma combinação de algoritmos para otimização:

1. **Nearest Neighbor**: Solução inicial rápida
2. **2-opt**: Melhorias iterativas na rota
3. **Haversine**: Cálculo preciso de distâncias

## 🗺️ APIs de Geolocalização

APIs gratuitas utilizadas:
- **Nominatim** (OpenStreetMap): Geocodificação principal
- **ViaCEP**: Busca por CEP brasileiro
- **AwesomeAPI**: Fallback para CEPs

## 🔧 Configurações Avançadas

### Rate Limiting
```env
API_RATE_LIMIT_PER_MINUTE=120
GEOCODING_DELAY_MS=1000
```

### Cache TTL
```env
CACHE_TTL_CUSTOMERS=86400      # 24 horas
CACHE_TTL_GEOCODING=2592000    # 30 dias
CACHE_TTL_ROUTES=3600          # 1 hora
```

## 🐛 Troubleshooting

### Erro de conexão com Ploome
- Verifique a chave API no arquivo `.env`
- Confirme que a chave tem permissão de leitura

### Geocodificação falhando
- APIs públicas tem limite de requisições
- O sistema respeita rate limits automaticamente
- Tente novamente após alguns minutos

### Mapa não carregando
- Verifique conexão com internet
- Limpe cache do navegador
- Confirme que porta 3000 está livre

## 📊 Métricas de Performance

- Sincronização: ~100 clientes/minuto
- Geocodificação: 1 endereço/segundo
- Otimização: <5s para 50 pontos
- Cache hit rate: >80%

## 🔒 Segurança

- Chave API armazenada em variáveis de ambiente
- Rate limiting implementado
- Sanitização de inputs
- CORS configurado

## 📝 Licença

MIT

## 👥 Suporte

Para dúvidas ou problemas:
1. Verifique a seção Troubleshooting
2. Consulte os logs em `backend/logs/`
3. Abra uma issue no repositório

---

**Desenvolvido com ❤️ para otimizar rotas comerciais**