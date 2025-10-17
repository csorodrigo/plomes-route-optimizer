# Guia de Configuração Vercel - plomes-mapa-clientes

## Problema Identificado

O projeto está dando 404 em produção porque o Vercel está tentando fazer deploy do root do repositório, mas o aplicativo Next.js está em `frontend-v0/`.

## Solução: Configurar Root Directory no Vercel

### Passo 1: Acessar Configurações do Projeto

1. Acesse: https://vercel.com/csorodrigo-2569s-projects/plomes-mapa-clientes
2. Clique em **"Settings"** no menu superior
3. Clique em **"General"** no menu lateral

### Passo 2: Configurar Root Directory

Na seção **"Root Directory"**:

1. Click em **"Edit"**
2. Digite: `frontend-v0`
3. Click em **"Save"**

### Passo 3: Verificar Build Settings

Na seção **"Build & Development Settings"**:

- **Framework Preset**: Next.js (deve ser detectado automaticamente)
- **Build Command**: `npm run build` (padrão)
- **Output Directory**: `.next` (padrão)
- **Install Command**: `npm install` (padrão)

### Passo 4: Fazer Redeploy

1. Vá para a aba **"Deployments"**
2. Click no deployment mais recente com status **"Ready"**
3. Click no botão **"Redeploy"**
4. Selecione **"Redeploy"** (não "Redeploy with existing Build Cache")

## Verificação

Após o redeploy, a aplicação deve estar acessível em:
- URL de produção: https://plomes-mapa-clientes-git-main-csorodrigo-2569s-projects.vercel.app

### Testes a Realizar

1. **Homepage**: Deve redirecionar para `/rota-cep`
2. **Rota /rota-cep**: Deve carregar o mapa interativo
3. **API /api/geocoding/reverse**: Deve funcionar

## Estrutura do Projeto

```
PLOMES-ROTA-CEP/
├── frontend-v0/           ← APLICAÇÃO NEXT.JS (Root Directory)
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── next.config.js
├── backend/               ← Backend Node.js (não usado no Vercel)
├── vercel.json            ← Configuração mínima
└── package.json           ← Ignorar (root)
```

## Notas Importantes

- O `vercel.json` no root está vazio intencionalmente
- Toda configuração deve ser feita via painel do Vercel
- O backend não está sendo deployado no Vercel (apenas frontend)
- As APIs são serverless functions dentro de `frontend-v0/app/api/`

## Troubleshooting

### Se ainda der 404 após configurar:

1. Verificar se Root Directory está realmente configurado como `frontend-v0`
2. Fazer um novo commit vazio para forçar rebuild:
   ```bash
   git commit --allow-empty -m "chore: trigger vercel rebuild"
   git push origin main
   ```
3. Verificar logs de build no Vercel Dashboard

### Se o build falhar:

1. Verificar se `frontend-v0/package.json` existe
2. Verificar se todas as dependências estão listadas
3. Verificar variáveis de ambiente no Vercel (se necessário)

## Status Atual

- ❌ Deployment falhando por Root Directory não configurado
- ✅ Código funcional localmente
- ⏳ Aguardando configuração manual no painel Vercel
