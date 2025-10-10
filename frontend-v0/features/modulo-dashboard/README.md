# Dashboard Module - Quick Start Guide

Complete guide for the Dashboard module with real-time metrics, analytics, and business intelligence features.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  Dashboard Page │  │  Components     │  │  React Query ││
│  │  /dashboard     │  │  - Charts       │  │  State Mgmt  ││
│  │                 │  │  - Metrics      │  │              ││
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘│
└───────────┼────────────────────┼───────────────────┼────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Serverless)                 │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ /api/dash/   │  │ /api/dash/  │  │ /api/dash/        │  │
│  │ metrics      │  │ customer-   │  │ product-          │  │
│  │              │  │ sales       │  │ performance       │  │
│  └──────┬───────┘  └──────┬──────┘  └─────┬─────────────┘  │
└─────────┼──────────────────┼────────────────┼────────────────┘
          │                  │                │
          ▼                  ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL Database                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐ │
│  │  sales   │  │ customers │  │ products │  │  pricing_  │ │
│  │          │  │           │  │          │  │  history   │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
          ▲
          │ Data Sync (Cron Job)
          │
┌─────────┴───────┐
│  Ploomes API    │
│  (CRM Source)   │
└─────────────────┘
```

## Features

### 1. Real-Time Metrics Dashboard
- Total revenue tracking
- Average deal value calculation
- Active products count
- Total customers metric
- Conversion rate analysis

### 2. Customer Sales Analytics
- Customer revenue ranking
- Deal count per customer
- Average deal size
- Customer activity status (active/inactive)
- Last sale date tracking

### 3. Product Performance Analysis
- Product revenue ranking
- Deal count per product
- Average deal size per product
- Revenue growth percentage
- Monthly revenue trends

### 4. Pricing History Tracking
- Historical pricing data
- Price variation analysis
- Average, min, max pricing
- Deal volume at different price points

## Installation

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- Supabase account
- Ploomes API access (optional, for data sync)

### Step 1: Clone and Install
```bash
cd frontend-v0
npm install
```

### Step 2: Environment Setup
```bash
# Copy environment example
cp .env.dashboard.example .env.local

# Edit .env.local with your credentials
nano .env.local
```

## Configuration

### Required Environment Variables

Create `.env.local` with these values:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ploomes (Required for sync)
PLOOME_API_KEY=your-ploomes-api-key
PLOOME_BASE_URL=https://public-api2.ploomes.com
CLIENT_TAG_ID=your-client-tag-id

# Application
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Database Setup

Ensure your Supabase database has these tables:

```sql
-- Sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY,
  deal_id VARCHAR,
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  amount DECIMAL,
  status_id INTEGER,
  created_at TIMESTAMP,
  closed_at TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  name VARCHAR,
  email VARCHAR,
  created_at TIMESTAMP
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR,
  description TEXT,
  created_at TIMESTAMP
);

-- Pricing history table
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  price DECIMAL,
  date TIMESTAMP,
  deal_count INTEGER
);
```

## Running Locally

### 1. Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Test API Endpoints
```bash
# Test all dashboard APIs
node scripts/test-dashboard-api.js
```

### 3. Access Dashboard
Open browser to:
```
http://localhost:3000/dashboard
```

### 4. Sync Data from Ploomes (Optional)
```bash
# Manual data sync
node scripts/sync-ploomes-data.js
```

## Deploying to Vercel

### Pre-Deployment Checklist

1. **Validate Code**
   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

2. **Check Vercel Compatibility**
   ```bash
   node scripts/validate-vercel-compat.js
   ```

3. **Test APIs Locally**
   ```bash
   node scripts/test-dashboard-api.js
   ```

### Deployment Steps

#### Option 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Option 2: GitHub Integration
1. Push code to GitHub
2. Connect repository to Vercel
3. Vercel will auto-deploy on push

### Environment Variables in Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL          (All environments)
NEXT_PUBLIC_SUPABASE_ANON_KEY     (All environments)
SUPABASE_SERVICE_ROLE_KEY         (Production only)
PLOOME_API_KEY                    (Production only)
PLOOME_BASE_URL                   (All environments)
CLIENT_TAG_ID                     (All environments)
NODE_ENV=production               (Production only)
```

### Post-Deployment Validation

1. **Test Production APIs**
   ```bash
   # Update BASE_URL in test script
   BASE_URL=https://your-app.vercel.app node scripts/test-dashboard-api.js
   ```

2. **Check Dashboard UI**
   - Open `https://your-app.vercel.app/dashboard`
   - Verify all metrics load
   - Test date filters
   - Check responsive design

3. **Monitor Logs**
   - Check Vercel function logs
   - Verify no timeout errors
   - Monitor API response times

## API Documentation

### 1. GET /api/dashboard/metrics

**Description:** Retrieves overall dashboard metrics

**Query Parameters:**
- `startDate` (optional): Filter start date (ISO 8601)
- `endDate` (optional): Filter end date (ISO 8601)
- `statusId` (optional): Filter by deal status

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 123456.78,
    "avgDealValue": 5432.10,
    "activeProducts": 45,
    "totalCustomers": 234,
    "topProducts": [...],
    "revenueByMonth": {...},
    "conversionRate": 23.5
  },
  "metadata": {
    "source": "supabase_postgresql",
    "timestamp": "2025-01-15T10:30:00Z",
    "filters": {...}
  }
}
```

### 2. GET /api/dashboard/customer-sales

**Description:** Retrieves customer sales analytics

**Query Parameters:**
- `limit` (optional, default: 50): Number of results
- `sortBy` (optional, default: revenue): Sort by "revenue" or "deals"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "customerId": "uuid",
      "customerName": "Company Name",
      "totalRevenue": 50000.00,
      "dealCount": 12,
      "avgDealSize": 4166.67,
      "lastSaleDate": "2025-01-10T15:30:00Z",
      "status": "active"
    }
  ],
  "summary": {
    "totalCustomersWithSales": 234,
    "activeCustomers": 189,
    "totalRevenue": 1234567.89,
    "totalDeals": 1567,
    "avgRevenuePerCustomer": 5276.18
  }
}
```

### 3. GET /api/dashboard/product-performance

**Description:** Retrieves product performance metrics

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "productName": "Product A",
      "totalRevenue": 75000.00,
      "dealCount": 45,
      "avgDealSize": 1666.67,
      "revenueGrowth": 15.3,
      "monthlyRevenue": [...]
    }
  ]
}
```

### 4. GET /api/dashboard/pricing-history

**Description:** Retrieves pricing history for products

**Query Parameters:**
- `productId` (optional): Filter by specific product
- `startDate` (optional): Start date for history
- `endDate` (optional): End date for history

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-01",
      "price": 1500.00,
      "dealCount": 5
    }
  ],
  "summary": {
    "avgPrice": 1450.00,
    "minPrice": 1200.00,
    "maxPrice": 1800.00,
    "totalDeals": 45
  }
}
```

## Troubleshooting

### Common Issues

#### 1. API Returns 503 "Database not configured"
**Solution:**
- Check Supabase environment variables are set
- Verify Supabase URL and keys are correct
- Test connection: `curl https://your-project.supabase.co`

#### 2. Empty Dashboard / No Data
**Solution:**
- Check if database tables exist
- Verify data sync has run
- Run manual sync: `node scripts/sync-ploomes-data.js`
- Check API responses: `node scripts/test-dashboard-api.js`

#### 3. Vercel Deployment Timeout
**Solution:**
- Check API route execution time
- Optimize database queries with indexes
- Reduce data fetch batch size
- Consider pagination for large datasets

#### 4. Environment Variables Not Working
**Solution:**
- Verify variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after changing variables
- For client variables, ensure `NEXT_PUBLIC_` prefix

#### 5. CORS Errors
**Solution:**
- Check API routes have OPTIONS handler
- Verify CORS headers are set correctly
- Ensure Supabase RLS policies allow access

### Debug Mode

Enable detailed logging:
```env
ENABLE_API_LOGGING=true
LOG_LEVEL=debug
```

Then check logs:
- Local: Terminal where `npm run dev` is running
- Vercel: Functions tab in Vercel dashboard

### Performance Issues

If dashboard is slow:
1. Check Supabase query performance
2. Add database indexes on frequently queried columns
3. Enable caching in API routes
4. Consider pagination for large datasets
5. Monitor Vercel function execution time

### Getting Help

- Check [Vercel Documentation](https://vercel.com/docs)
- Check [Next.js Documentation](https://nextjs.org/docs)
- Check [Supabase Documentation](https://supabase.com/docs)
- Review `DASHBOARD_DEPLOYMENT_CHECKLIST.md`
- Run validation: `node scripts/validate-vercel-compat.js`

## Best Practices

### Development
- Use TypeScript for type safety
- Write API tests for all endpoints
- Test with production-like data volumes
- Use React Query for data fetching
- Implement proper error handling

### Deployment
- Always run validation before deploying
- Test in preview environment first
- Use environment-specific variables
- Monitor function execution times
- Set up error tracking (Sentry, etc.)

### Data Management
- Schedule regular Ploomes syncs
- Monitor database size growth
- Archive old data periodically
- Maintain database indexes
- Use connection pooling

### Security
- Never expose service role keys in client code
- Use RLS policies in Supabase
- Validate all API inputs
- Implement rate limiting
- Use HTTPS in production

## License

Copyright © 2025 - Internal use only