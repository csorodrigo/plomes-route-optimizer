# 🚀 Guia de Deploy - plomes-produtos-precos

## 📋 Status Atual

- ✅ Projeto criado no Vercel: `plomes-produtos-precos`
- ✅ Projeto ID: `prj_p67yLwIObBufyHtToBODY3Pip9ap`
- ❌ Nunca teve deployment
- ❌ Não está conectado ao GitHub
- ❌ Variáveis de ambiente não configuradas

## 🎯 Objetivo

Configurar o projeto `plomes-produtos-precos` separadamente do projeto `frontend-v0` funcionando, mantendo cada um com seu próprio deployment independente.

## 📝 Passos para Configuração

### 1. Configurar Variáveis de Ambiente no Vercel

Acesse: https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/settings/environment-variables

Configure as seguintes variáveis para **Production**, **Preview** e **Development**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yxwokryybudwygtemfmu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk

# JWT
JWT_SECRET=super-secret-jwt-key-for-production-please-change-this-in-real-deployment-123456789

# Ploomes
PLOOME_API_KEY=A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3
PLOOME_BASE_URL=https://public-api2.ploomes.com
CLIENT_TAG_ID=40006184

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV-7nuvHk

# Vercel Settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_OPTIMIZE_CSS=true
```

### 2. Conectar ao GitHub

Acesse: https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/settings/git

Configure a integração Git:
- **Repository**: `csorodrigo/plomes-route-optimizer`
- **Branch**: `main`
- **Root Directory**: `frontend-v0`

⚠️ **Importante**: Defina `frontend-v0` como Root Directory para que o Vercel saiba onde encontrar o código.

### 3. Configurar Build Settings

No dashboard do Vercel, verifique se as configurações de build estão corretas:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install --legacy-peer-deps
Node Version: 22.x
```

### 4. Fazer Deploy

Após conectar ao GitHub, você tem duas opções:

**Opção A - Deploy Automático via Git Push:**
```bash
cd /Users/rodrigooliveira/Documents/workspace\ 2/Claude-code/PLOMES-ROTA-CEP
git add .
git commit -m "Configure plomes-produtos-precos deployment"
git push origin main
```

**Opção B - Deploy Manual via Dashboard:**
- Acesse o dashboard do projeto
- Clique em "Deploy"
- Selecione a branch `main`
- Aguarde o build

### 5. Verificar Deployment

Após o deploy, verifique:

1. ✅ Build concluído com sucesso
2. ✅ Domínio gerado automaticamente
3. ✅ Aplicação acessível
4. ✅ Login funcionando
5. ✅ Dashboard carregando corretamente

## 🔧 Troubleshooting

### Build Travando Localmente

Se `npm run build` travar localmente, **não se preocupe**. O build será feito no servidor do Vercel. Apenas:
- Conecte ao GitHub
- Faça push
- Deixe o Vercel fazer o build remoto

### Erro "No Next.js version detected"

Certifique-se de que:
- Root Directory está configurado como `frontend-v0`
- O arquivo `package.json` está no diretório correto
- As dependências estão listadas corretamente

### Erro de Variáveis de Ambiente

Verifique que:
- Todas as variáveis estão configuradas
- Foram aplicadas para **Production**, **Preview** e **Development**
- Não há espaços extras nos valores

## 📊 Projetos Separados

Agora você terá dois projetos independentes:

### frontend-v0 (existente e funcionando)
- URL: https://frontend-v0-1aj1ax36v-csorodrigo-2569s-projects.vercel.app
- Deploy automático: Sim
- Status: ✅ Ativo

### plomes-produtos-precos (novo)
- URL: Será gerada após primeiro deploy
- Deploy automático: Após conectar ao GitHub
- Status: ⏳ Aguardando configuração

## ✅ Checklist Final

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Projeto conectado ao GitHub
- [ ] Root Directory definido como `frontend-v0`
- [ ] Build settings verificados
- [ ] Primeiro deploy realizado
- [ ] Aplicação testada e funcionando
- [ ] Domínio personalizado configurado (opcional)

## 🔗 Links Úteis

- [Dashboard do Projeto](https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos)
- [Configurações](https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/settings)
- [Deployments](https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/deployments)
- [Environment Variables](https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/settings/environment-variables)
- [Git Integration](https://vercel.com/csorodrigo-2569s-projects/plomes-produtos-precos/settings/git)
