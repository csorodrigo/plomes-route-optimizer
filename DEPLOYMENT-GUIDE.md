# Vercel Deployment Guide - Environment Configuration

This document provides a complete guide for deploying PLOMES-ROTA-CEP to Vercel with all environment variables properly configured.

## 🎯 Environment Configuration Status

### ✅ COMPLETED - All Required Variables Configured

All critical environment variables have been properly configured in `vercel.json` for Vercel deployment:

### 🏪 Supabase PostgreSQL Configuration
- **SUPABASE_URL**: `https://yxwokryybudwygtemfmu.supabase.co`
- **SUPABASE_ANON_KEY**: Configured (JWT token for client-side operations)
- **SUPABASE_SERVICE_ROLE_KEY**: Configured (JWT token for server-side operations)

### 🔌 Ploome API Configuration
- **PLOOME_API_KEY**: Configured (primary API key)
- **PLOOMES_API_KEY**: Configured (alternative naming convention)
- **PLOOMES_BASE_URL**: `https://public-api2.ploomes.com`
- **CLIENT_TAG_ID**: `40006184` (filters for Cliente tag)

### 🔐 Authentication Configuration
- **JWT_SECRET**: Configured (production-ready secret)
- **JWT_EXPIRES_IN**: `7d` (7 days token expiration)

### 🗺️ Geocoding APIs Configuration
- **GOOGLE_MAPS_API_KEY**: Configured (primary geocoding provider)
- **POSITIONSTACK_API_KEY**: Configured (backup geocoding provider)
- **OPENROUTE_API_KEY**: Configured (alternative geocoding provider)

### ⚡ Performance Configuration
- **API_RATE_LIMIT_PER_MINUTE**: `120`
- **GEOCODING_DELAY_MS**: `1000`
- **CACHE_TTL_CUSTOMERS**: `86400` (24 hours)
- **CACHE_TTL_GEOCODING**: `2592000` (30 days)
- **CACHE_TTL_ROUTES**: `3600` (1 hour)
- **DATABASE_PATH**: `./backend/cache/customers.db`

## 🚀 Quick Deployment

### 1. Verify Configuration
```bash
node verify-env-config.js
```

### 2. Deploy to Vercel
```bash
./deploy-to-vercel.sh
```

## 📁 File Structure

### Configuration Files
- `vercel.json` - Vercel deployment configuration with all environment variables
- `.env.production` - Production environment variables backup
- `deploy-to-vercel.sh` - Automated deployment script
- `verify-env-config.js` - Environment verification script

### API Endpoints (Serverless Functions)
- `api/customers.js` - Customer data API (Supabase + Ploome integration)
- `api/statistics.js` - Statistics and analytics API
- `api/cep-[cep].js` - CEP geocoding API

### Core Libraries
- `lib/supabase.js` - Supabase client configuration

## 🔧 Environment Variables Details

### Supabase Integration
The application uses Supabase PostgreSQL for persistent data storage:
- **Primary Database**: https://yxwokryybudwygtemfmu.supabase.co
- **Authentication**: Service role key for server-side operations
- **Tables**: customers, geocoding_stats, batch_logs

### Ploome CRM Integration
Direct integration with Ploome CRM system:
- **API Endpoint**: https://public-api2.ploomes.com
- **Authentication**: API key-based authentication
- **Filter**: Only contacts tagged with CLIENT_TAG_ID (40006184)

### Multi-Provider Geocoding
Three geocoding providers for maximum reliability:
1. **Google Maps API** (primary)
2. **PositionStack API** (backup)
3. **OpenRoute Service** (alternative)

## 🛠️ Troubleshooting

### Common Issues

#### 1. Environment Variables Not Loading
- **Solution**: Verify all variables are in `vercel.json` env section
- **Check**: Run `node verify-env-config.js` to verify configuration

#### 2. Supabase Connection Issues
- **Solution**: Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- **Check**: Test connection with Supabase dashboard

#### 3. Ploome API Authentication Errors
- **Solution**: Verify PLOOMES_API_KEY is valid and active
- **Check**: Test API key with Ploome API directly

#### 4. CORS Issues
- **Solution**: Vercel.json includes proper CORS headers for all API routes
- **Check**: Browser network tab for CORS-related errors

### Deployment Logs
```bash
# View deployment logs
vercel logs

# View specific function logs
vercel logs --function=api/customers
```

## 🔍 Verification Steps

1. **Pre-deployment**: `node verify-env-config.js`
2. **Deploy**: `./deploy-to-vercel.sh`
3. **Post-deployment**: Test all API endpoints
4. **Frontend**: Verify React app loads and login works
5. **Data Flow**: Check customer data loads from Supabase/Ploome

## 🎯 Success Criteria

✅ All environment variables configured in vercel.json
✅ Supabase PostgreSQL connection working
✅ Ploome API integration functional
✅ Geocoding APIs responding
✅ JWT authentication working
✅ Frontend builds and deploys
✅ API endpoints respond with correct data
✅ CORS headers configured properly

## 📊 Features Enabled

- **Real-time Data**: Live integration with Ploome CRM
- **Persistent Storage**: PostgreSQL via Supabase
- **Multi-provider Geocoding**: Fallback system for reliability
- **JWT Authentication**: Secure user sessions
- **Performance Optimization**: Caching and rate limiting
- **Error Handling**: Comprehensive error recovery
- **CORS Support**: Full frontend integration

---

**Status**: ✅ **READY FOR PRODUCTION DEPLOYMENT**

All environment variables are properly configured and the application is ready for Vercel deployment with full Supabase and Ploome integration.