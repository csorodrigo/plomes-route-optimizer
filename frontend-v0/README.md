# PLOMES Route Optimizer (v0 UI)

Interface criada a partir do design gerado no Vercel v0, integrada à API existente do projeto. O app roda em Next.js 15 com Tailwind e componentes do shadcn/ui.

## Requisitos

- Node.js 18+
- Dependências instaladas com `npm install`
- Backend ativo em `http://localhost:3001` (ou configure `NEXT_PUBLIC_API_URL`)

## Desenvolvimento

```bash
cd frontend-v0
cp .env.example .env.local   # ajuste se necessário
npm run dev                  # inicia em http://localhost:3003
```

## Build de produção

```bash
npm run build
npm run start  # também usa a porta 3003 por padrão
```

## Funcionalidades integradas

- Consulta de clientes via `/api/customers`
- Geocodificação de origem com `/api/geocoding/cep/:cep`
- Otimização de rota com `/api/routes/optimize`
- Exibição do mapa com Leaflet/OSM, mantendo a logo original da CIA Máquinas
- Filtro por raio e seleção/ordenamento de clientes para a rota

Os dados carregados, otimização e feedbacks são exibidos diretamente na interface com o novo layout.
