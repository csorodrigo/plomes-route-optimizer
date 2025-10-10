# Dashboard Deployment Checklist

Complete checklist for deploying the Dashboard module to Vercel production environment.

## Pre-Deployment Checks

### 1. Environment Variables Validation
- [ ] Verify all required environment variables are set in Vercel dashboard
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (for sync scripts)
  - [ ] `PLOOME_API_KEY`
  - [ ] `PLOOME_BASE_URL`
  - [ ] `CLIENT_TAG_ID`
  - [ ] `NODE_ENV=production`

- [ ] Verify environment variables in all Vercel environments:
  - [ ] Production
  - [ ] Preview
  - [ ] Development (if applicable)

### 2. Database Readiness
- [ ] Confirm Supabase database is accessible from Vercel
- [ ] Verify all required tables exist:
  - [ ] `sales`
  - [ ] `customers`
  - [ ] `products`
  - [ ] `pricing_history`

- [ ] Test database connections:
  ```bash
  # Run locally against production Supabase
  NEXT_PUBLIC_SUPABASE_URL=<prod-url> npm run dev
  ```

- [ ] Verify Row Level Security (RLS) policies are configured
- [ ] Check database indexes are optimized for dashboard queries

### 3. Dependencies Check
- [ ] Run `npm audit` and fix critical vulnerabilities
- [ ] Verify all package versions are compatible:
  ```bash
  npm install
  npm run build
  ```
- [ ] Check for peer dependency warnings
- [ ] Ensure no dev dependencies are used in production code

### 4. Code Quality
- [ ] Run linter: `npm run lint`
- [ ] Run type checker: `npm run type-check`
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors
- [ ] No console.error or console.warn in production code

### 5. API Routes Testing
- [ ] Test all dashboard API endpoints locally:
  ```bash
  npm run dev
  node scripts/test-dashboard-api.js
  ```
- [ ] Verify API response times are acceptable (<3s)
- [ ] Test with production-like data volumes
- [ ] Verify error handling for edge cases

## Vercel-Specific Considerations

### 1. Serverless Function Limits
- [ ] Confirm API routes execute in <10 seconds (Vercel Hobby limit)
- [ ] Check memory usage is within limits (1024MB on Hobby)
- [ ] Verify no file system operations in API routes
- [ ] Ensure no stateful operations (use database instead)

### 2. Build Configuration
- [ ] Verify `vercel.json` configuration:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": ".next",
    "framework": "nextjs"
  }
  ```
- [ ] Check build time is reasonable (<15 minutes)
- [ ] Verify no build-time API calls to external services

### 3. Route Configuration
- [ ] Confirm API routes are under `/app/api/`
- [ ] Check for proper CORS headers if needed
- [ ] Verify OPTIONS requests are handled
- [ ] Test API routes with Vercel's edge runtime

### 4. Performance Optimization
- [ ] Enable Next.js Image Optimization
- [ ] Configure proper cache headers
- [ ] Use React.memo for expensive components
- [ ] Implement data fetching best practices (SWR/React Query)

## Database Migration Steps

### 1. Schema Validation
- [ ] Review current schema in Supabase
- [ ] Ensure all required columns exist
- [ ] Verify foreign key relationships
- [ ] Check for proper indexing on query columns

### 2. Data Sync Setup
- [ ] Configure Ploomes API sync schedule
- [ ] Test sync script locally:
  ```bash
  node scripts/sync-ploomes-data.js
  ```
- [ ] Verify data transformation is correct
- [ ] Check for duplicate prevention logic

### 3. Initial Data Load
- [ ] Run full data sync from Ploomes to Supabase
- [ ] Verify data integrity
- [ ] Check for any sync errors
- [ ] Validate data counts match expectations

### 4. Ongoing Sync Schedule
- [ ] Set up Vercel Cron Job for data sync:
  ```json
  {
    "crons": [{
      "path": "/api/sync-ploomes",
      "schedule": "0 */6 * * *"
    }]
  }
  ```
- [ ] Test cron job execution
- [ ] Set up monitoring for sync failures
- [ ] Configure error notifications

## Post-Deployment Validation

### 1. API Endpoint Testing
- [ ] Test each dashboard API in production:
  ```bash
  # Update BASE_URL in test script to production URL
  node scripts/test-dashboard-api.js
  ```
- [ ] Verify response times in production
- [ ] Check error logs in Vercel dashboard
- [ ] Test with different query parameters

### 2. Frontend Validation
- [ ] Load dashboard page in production
- [ ] Verify all metrics display correctly
- [ ] Check charts and graphs render properly
- [ ] Test filters and date range selectors
- [ ] Verify mobile responsiveness

### 3. Performance Monitoring
- [ ] Check Vercel Analytics for page load times
- [ ] Monitor API route execution times
- [ ] Verify no memory leaks or timeouts
- [ ] Check for any error spikes

### 4. Error Handling
- [ ] Test API with invalid parameters
- [ ] Verify graceful degradation on database errors
- [ ] Check error messages are user-friendly
- [ ] Verify error logging is working

### 5. Security Validation
- [ ] Confirm API keys are not exposed in client code
- [ ] Verify CORS settings are appropriate
- [ ] Check authentication/authorization if applicable
- [ ] Test rate limiting if configured

## Rollback Procedure

### If Issues Occur Post-Deployment

1. **Immediate Actions**
   - [ ] Check Vercel deployment logs for errors
   - [ ] Review Supabase logs for database issues
   - [ ] Check error monitoring dashboard

2. **Quick Rollback**
   - [ ] Navigate to Vercel dashboard
   - [ ] Go to Deployments tab
   - [ ] Find last known good deployment
   - [ ] Click "Promote to Production"
   - [ ] Verify rollback was successful

3. **Data Recovery**
   - [ ] If data sync caused issues, restore from backup
   - [ ] Check Supabase backup/restore options
   - [ ] Verify data integrity after restore

4. **Post-Rollback**
   - [ ] Document what went wrong
   - [ ] Create fix plan for next deployment
   - [ ] Update this checklist with lessons learned

## Monitoring Setup

### 1. Vercel Monitoring
- [ ] Enable Vercel Analytics
- [ ] Set up error alerts
- [ ] Configure performance budgets
- [ ] Set up uptime monitoring

### 2. Database Monitoring
- [ ] Enable Supabase monitoring
- [ ] Set up query performance alerts
- [ ] Configure connection pool monitoring
- [ ] Track database size growth

### 3. Custom Monitoring
- [ ] Implement custom error tracking
- [ ] Set up dashboard usage analytics
- [ ] Monitor API endpoint success rates
- [ ] Track data sync reliability

## Final Sign-Off

- [ ] All pre-deployment checks completed
- [ ] Environment variables configured
- [ ] Database ready and synced
- [ ] API tests passing
- [ ] Frontend validated
- [ ] Monitoring configured
- [ ] Rollback procedure documented
- [ ] Team notified of deployment

**Deployed By:** _________________
**Date:** _________________
**Deployment URL:** _________________
**Notes:** _________________