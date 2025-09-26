# 🚀 Deployment Guide - Frontend v0

## API Configuration Fix Applied

This guide documents the hardcoded URL issue resolution and proper deployment practices.

## 🔧 **Issue Fixed**

**Problem**: API calls were going to hardcoded old deployment URLs despite configuration changes.

**Root Cause**: Incorrect API base URL detection logic that didn't properly handle SSR and environment variables.

## ✅ **Solution Implemented**

### 1. **Enhanced API Configuration** (`src/lib/api.ts`)
- ✅ Improved environment detection (SSR + client-side)
- ✅ Proper Vercel environment variable detection (`VERCEL=1`)
- ✅ Debug logging for development troubleshooting
- ✅ Fallback logic prioritizes environment variables

### 2. **Next.js Configuration** (`next.config.ts`)
- ✅ Explicit environment variable handling
- ✅ API route rewrites for development
- ✅ CORS headers configuration

### 3. **Deployment Validation** (`scripts/validate-deployment.js`)
- ✅ Pre-build validation script
- ✅ Hardcoded URL detection
- ✅ Environment configuration checks

## 🚀 **Deployment Instructions**

### **For Vercel (Production)**

1. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_API_URL=              # EMPTY for relative URLs
   NODE_ENV=production
   JWT_SECRET=your-production-secret
   ```

2. **Deploy Commands**:
   ```bash
   npm run build:safe  # Validates before building
   # or
   npm run validate-deployment  # Manual validation
   npm run build
   ```

### **For Development**

1. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001  # Backend server
   NODE_ENV=development
   ```

2. **Start Commands**:
   ```bash
   npm run dev  # Port 3003
   ```

## 🔍 **Validation & Debugging**

### **Check API Configuration**:
```bash
npm run validate-deployment
```

### **Debug API Calls** (Development):
Open browser console to see debug information:
```
🔧 API Configuration Debug: {
  NODE_ENV: "development",
  NEXT_PUBLIC_API_URL: "http://localhost:3001",
  VERCEL: undefined,
  hostname: "localhost",
  origin: "http://localhost:3003",
  calculatedBaseUrl: "http://localhost:3001"
}
```

## ⚠️ **Common Issues & Solutions**

### **Issue**: API calls still going to old URLs
**Solution**:
1. Clear browser cache and localStorage
2. Restart development server
3. Verify environment variables with `npm run validate-deployment`

### **Issue**: ERR_CONNECTION_REFUSED in development
**Solution**:
1. Ensure backend is running on port 3001
2. Run `./fix-backend.sh` if available
3. Check `NEXT_PUBLIC_API_URL` configuration

### **Issue**: Production deployment fails
**Solution**:
1. Ensure `NEXT_PUBLIC_API_URL=""` (empty) in production
2. Run `npm run build:safe` instead of `npm run build`
3. Check Vercel environment variables

## 📋 **Deployment Checklist**

- [ ] Environment variables configured correctly
- [ ] `npm run validate-deployment` passes
- [ ] No hardcoded URLs in source code
- [ ] Backend serverless functions deployed (`/api` folder)
- [ ] CORS headers configured in `next.config.ts`
- [ ] Authentication working with JWT tokens

## 🛡️ **Security Notes**

- JWT secrets should be unique for production
- CORS is configured for development (`*`) - restrict in production if needed
- Environment variables are properly scoped (`NEXT_PUBLIC_*` for client-side)

## 📊 **Performance Optimizations**

- API calls use 60-second timeout
- Axios interceptors handle authentication
- Relative URLs minimize DNS lookups in production
- Serverless functions provide instant scaling

---

**Last Updated**: 2025-09-26
**Issue Resolution**: Hardcoded URL detection and prevention system implemented