# Dashboard Quick Reference Card

Fast reference for common dashboard development and deployment tasks.

## 🚀 Quick Commands

### Development
```bash
npm run dev                    # Start dev server (port 3003)
npm run test:dashboard         # Test all dashboard APIs
npm run validate:vercel        # Check Vercel compatibility
npm run predeploy             # Full pre-deployment validation
```

### Testing
```bash
# Test with custom URL
BASE_URL=https://your-app.vercel.app npm run test:dashboard

# Test specific port
BASE_URL=http://localhost:3003 npm run test:dashboard
```

### Deployment
```bash
npm run predeploy             # Validate before deploying
vercel                        # Deploy to preview
vercel --prod                 # Deploy to production
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `scripts/test-dashboard-api.js` | API testing script |
| `scripts/validate-vercel-compat.js` | Vercel compatibility checker |
| `DASHBOARD_DEPLOYMENT_CHECKLIST.md` | Deployment checklist |
| `.env.dashboard.example` | Environment variables template |
| `features/modulo-dashboard/README.md` | Complete guide |
| `VALIDATION_REPORT.md` | Testing & validation report |

## 🔧 Environment Variables

### Required
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
PLOOME_API_KEY=A7EEF...
PLOOME_BASE_URL=https://public-api2.ploomes.com
CLIENT_TAG_ID=40006184
```

### Optional
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3003
DASHBOARD_AUTO_SYNC=true
```

## 🔍 API Endpoints

| Endpoint | Purpose | Query Params |
|----------|---------|--------------|
| `/api/dashboard/metrics` | Overall metrics | startDate, endDate, statusId |
| `/api/dashboard/customer-sales` | Customer analytics | limit, sortBy |
| `/api/dashboard/product-performance` | Product metrics | - |
| `/api/dashboard/pricing-history` | Pricing data | productId, startDate, endDate |

## ✅ Pre-Deployment Checklist

```bash
□ npm run validate:vercel          # Check compatibility
□ npm run test:dashboard           # Test APIs
□ npm run build                    # Verify build
□ Review DASHBOARD_DEPLOYMENT_CHECKLIST.md
□ Verify environment variables in Vercel
□ Check database tables exist
□ Run initial data sync
```

## 🐛 Quick Troubleshooting

### API Returns 503
**Issue:** Database not configured
**Fix:** Check Supabase environment variables

### Empty Dashboard
**Issue:** No data in database
**Fix:** Run `node scripts/sync-ploomes-data.js`

### Test Script Fails
**Issue:** Server not running
**Fix:** Run `npm run dev` first

### Vercel Build Fails
**Issue:** TypeScript errors
**Fix:** Run `npm run type-check` and fix errors

## 📊 Performance Targets

| Metric | Local | Production |
|--------|-------|------------|
| Metrics API | < 500ms | < 2s |
| Customer Sales | < 800ms | < 3s |
| Product Performance | < 800ms | < 3s |
| Pricing History | < 600ms | < 2s |

## 🔐 Security Reminders

- ✅ Never commit `.env.local`
- ✅ Use `NEXT_PUBLIC_` prefix only for client-safe vars
- ✅ Keep service role keys server-side only
- ✅ Rotate API keys regularly

## 📚 Documentation Links

- [Complete Guide](features/modulo-dashboard/README.md)
- [Deployment Checklist](DASHBOARD_DEPLOYMENT_CHECKLIST.md)
- [Validation Report](VALIDATION_REPORT.md)
- [Environment Setup](.env.dashboard.example)

## 🆘 Getting Help

1. Check troubleshooting in [Complete Guide](features/modulo-dashboard/README.md)
2. Review [Deployment Checklist](DASHBOARD_DEPLOYMENT_CHECKLIST.md)
3. Run validation scripts for diagnostics
4. Check Vercel function logs

---

**Last Updated:** 2025-09-30
**Module Version:** 1.0.0