# PLOMES-ROTA-CEP Vercel Deployment Guide

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)
```bash
./deploy-to-vercel.sh
```

### Option 2: Manual Deployment
```bash
# 1. Login to Vercel
vercel login

# 2. Deploy to production
vercel --prod
```

## 📋 Pre-Deployment Checklist

### ✅ Local Setup Verification
- [x] Frontend builds successfully (`npm run build`)
- [x] Backend dependencies installed
- [x] Vercel.json configuration exists
- [x] Environment variables documented

### 🔧 Project Configuration

#### Frontend (React)
- **Build Directory**: `frontend/build`
- **Port**: 3000 (development)
- **Framework**: Create React App

#### Backend (Node.js)
- **Entry Point**: `backend/server.js`
- **Runtime**: Node.js 18.x
- **Memory**: 1024MB
- **Max Duration**: 30 seconds

## 🌐 Vercel Configuration Details

### Routes Configuration
- `/api/*` → Backend serverless function
- Static assets → Cached with immutable headers
- SPA routing → All routes serve `index.html`

### Performance Optimizations
- Static asset caching (1 year)
- Optimized serverless function configuration
- CORS headers for API endpoints

## 🔐 Environment Variables Setup

### Required Environment Variables (Set in Vercel Dashboard)

```bash
# Ploome CRM Integration
PLOOMES_API_KEY=your_ploome_api_key_here
PLOOMES_BASE_URL=https://ciaedmaquinas.ploomes.com/api/v2
CLIENT_TAG_ID=40006184

# Security
JWT_SECRET=your_secure_jwt_secret_here
SESSION_SECRET=your_secure_session_secret_here

# APIs (Optional but recommended)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MAPBOX_API_KEY=your_mapbox_api_key
POSITIONSTACK_API_KEY=your_positionstack_api_key

# Database
DATABASE_URL=sqlite:./tmp/app.db

# Environment
NODE_ENV=production
```

### Setting Environment Variables

1. **Via Vercel Dashboard**:
   - Go to Project Settings → Environment Variables
   - Add each variable with appropriate scope (Production/Preview/Development)

2. **Via Vercel CLI**:
   ```bash
   vercel env add PLOOMES_API_KEY production
   vercel env add JWT_SECRET production
   vercel env add SESSION_SECRET production
   ```

## 🏗️ Build Process

### Build Steps
1. Install root dependencies (`npm install`)
2. Install frontend dependencies (`cd frontend && npm install`)
3. Build React app (`npm run build`)
4. Deploy backend as serverless function

### Build Configuration
- **Install Command**: `npm install`
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/build`

## 🔍 Testing Deployment

### Health Check Endpoints
- **Frontend**: `https://your-app.vercel.app/`
- **Backend Health**: `https://your-app.vercel.app/api/health`
- **API Base**: `https://your-app.vercel.app/api/`

### Test Scenarios
1. **Frontend Loading**: Verify React app loads correctly
2. **API Connectivity**: Check `/api/health` returns 200
3. **Authentication**: Test login functionality
4. **Route Optimization**: Test core functionality

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
- **Frontend build errors**: Check React dependencies and build logs
- **Memory issues**: Increase function memory in vercel.json
- **Timeout issues**: Optimize heavy operations

#### Runtime Issues
- **Database connection**: SQLite uses `/tmp` directory in serverless
- **Environment variables**: Verify all required vars are set
- **CORS errors**: Check API headers configuration

#### Performance Issues
- **Cold starts**: Expected for serverless functions
- **Static asset loading**: Verify caching headers
- **API response times**: Monitor function duration

### Debug Commands
```bash
# Check deployment status
vercel list

# View function logs
vercel logs your-deployment-url

# Check environment variables
vercel env ls
```

## 🔄 CI/CD Integration

### GitHub Integration
1. Connect repository to Vercel
2. Enable automatic deployments
3. Configure branch protection rules
4. Set up environment variables

### Automatic Deployments
- **Production**: Deploys from `main` branch
- **Preview**: Deploys from feature branches
- **Environment**: Separate env vars per environment

## 📊 Monitoring & Maintenance

### Vercel Analytics
- Function performance metrics
- Error tracking
- Usage statistics

### Recommended Monitoring
- API response times
- Error rates
- Build success rates
- User engagement metrics

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://vercel.com/docs/concepts/next.js/overview)
- [Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 📝 Deployment Checklist

- [ ] Local build successful
- [ ] Vercel CLI authenticated
- [ ] Environment variables configured
- [ ] Production deployment completed
- [ ] Health checks passing
- [ ] Core functionality tested
- [ ] Performance verified