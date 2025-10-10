# Dashboard Module Setup Guide

## Overview
The Dashboard module provides sales analytics and business intelligence features integrated with Ploomes CRM data.

## Architecture

```
frontend-v0/
├── features/modulo-dashboard/        # Dashboard module (isolated)
│   ├── components/                   # Dashboard-specific components
│   ├── hooks/                        # Custom React hooks
│   ├── types/                        # TypeScript types
│   └── page.tsx                      # Main dashboard page
├── src/app/dashboard/                # Next.js route integration
│   └── page.tsx                      # Route export (imports from features/)
├── src/lib/dashboard-api.ts          # API client for dashboard endpoints
└── scripts/sync-dashboard-data.js    # Data synchronization script
```

## Installation Steps

### 1. Verify TypeScript Configuration
The path alias `@/features/*` has been added to `tsconfig.json`:
```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@/features/*": ["./features/*"]
  }
}
```

### 2. Install Dependencies
All required dependencies are already in `package.json`:
- `@tanstack/react-query` - Data fetching and caching
- `recharts` - Chart components
- `axios` - HTTP client
- `tailwindcss` - Styling

### 3. Environment Variables
Ensure the following environment variables are configured:

**For Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**For Backend (.env):**
```bash
PLOOMES_API_KEY=your-ploomes-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### 4. Database Setup
Ensure the following Supabase tables exist:

**Products Table:**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ploomes_product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sales Table:**
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ploomes_deal_id TEXT NOT NULL,
  ploomes_product_id TEXT NOT NULL,
  ploomes_customer_id TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  sale_date TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. Initial Data Sync
Run the data sync script to populate the database:

```bash
cd frontend-v0
node scripts/sync-dashboard-data.js
```

This will:
1. Fetch products from Ploomes
2. Fetch won deals from Ploomes
3. Sync products to Supabase
4. Sync sales data to Supabase

### 6. Backend API Endpoints
Ensure the following API endpoints are implemented in your backend:

- `GET /api/dashboard/metrics` - Dashboard metrics summary
- `GET /api/dashboard/customer-sales` - Customer sales performance
- `GET /api/dashboard/product-performance` - Product performance data
- `GET /api/dashboard/time-series` - Time series revenue data
- `POST /api/dashboard/sync` - Manual data sync trigger

### 7. Access the Dashboard
Start the development server:
```bash
npm run dev
```

Navigate to: `http://localhost:3003/dashboard`

## Usage

### API Client
Use the typed API client for dashboard operations:

```typescript
import { dashboardApi, formatCurrency } from '@/lib/dashboard-api';

// Get metrics
const metrics = await dashboardApi.getMetrics({
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});

// Get customer sales
const { customers } = await dashboardApi.getCustomerSales();

// Format currency
const formatted = formatCurrency(1500.50); // "R$ 1.500,50"
```

### React Hooks
The dashboard module provides custom hooks:

```typescript
import { useDashboardMetrics } from '@/features/modulo-dashboard/hooks/useDashboardData';

function MyComponent() {
  const { metrics, isLoading } = useDashboardMetrics({ startDate, endDate });

  if (isLoading) return <div>Loading...</div>;

  return <div>Total Revenue: {metrics.totalRevenue}</div>;
}
```

## Features

### 1. Metrics Cards
- Total Revenue with percentage change
- Average Deal Value with trend
- Active Products count
- Total Customers count

### 2. Product Performance Chart
- Revenue by product visualization
- Quantity sold per product
- Interactive bar chart with tooltips

### 3. Customer Sales Table
- Top customers by revenue
- Deal count per customer
- Average deal value
- Last purchase date
- Sortable columns

### 4. Filters
- Date range selection
- Customer filtering
- Product filtering
- Real-time data updates

### 5. Actions
- Refresh data manually
- Export to PDF (in development)
- Auto-refresh option

## Maintenance

### Data Synchronization
Schedule the sync script to run periodically (e.g., via cron job):

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/frontend-v0 && node scripts/sync-dashboard-data.js
```

Or trigger manual sync from the UI using the refresh button.

### Monitoring
Check sync logs for errors:
- Script outputs detailed progress
- Backend API logs for endpoint performance
- Supabase logs for database operations

## Troubleshooting

### Dashboard not loading
1. Check if backend is running on port 3001
2. Verify environment variables are set
3. Check browser console for API errors
4. Verify authentication token is valid

### No data showing
1. Run the sync script: `node scripts/sync-dashboard-data.js`
2. Check Supabase tables have data
3. Verify API endpoints return data
4. Check date filters are not too restrictive

### Sync script fails
1. Verify Ploomes API key is valid
2. Check Supabase credentials
3. Ensure network connectivity
4. Check API rate limits

## Performance Optimization

### Caching
- React Query caches API responses
- Default stale time: 5 minutes
- Manual refresh available

### Pagination
- Customer sales table supports pagination
- Default page size: 10 rows
- Adjustable page size

### Lazy Loading
- Charts load on demand
- Images and components lazy loaded
- Optimized bundle splitting

## Security

### Authentication
- Dashboard requires authentication
- Uses `useRequireAuth` hook
- Redirects to login if not authenticated

### Authorization
- Backend should validate user permissions
- API endpoints protected by JWT
- Row-level security in Supabase

## Future Enhancements

- [ ] PDF export functionality
- [ ] Advanced filters and search
- [ ] More chart types (line, pie, area)
- [ ] Dashboard customization
- [ ] Real-time updates via websockets
- [ ] Mobile responsive improvements
- [ ] Drill-down reports
- [ ] Goal tracking and alerts

## Support
For issues or questions, contact the development team.