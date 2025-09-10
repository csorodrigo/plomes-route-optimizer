# 🚀 Production Deployment Instructions

## ✅ Changes Deployed
- **OpenRouteService Integration**: Added as free fallback for route generation (2,500 requests/day)
- **Fixed Customer Filtering**: Removed broken ploome-service file that was importing ALL contacts
- **Database Cleanup Script**: Added tool to remove non-customer contacts

## 📝 Required Railway Configuration

### 1. Add OpenRouteService API Key
Go to your Railway project settings and add this environment variable:
```
OPENROUTE_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwNGUyY2U5NmY3MDRkYzA4OTZlODliYzRlNDgzMTRhIiwiaCI6Im11cm11cjY0In0=
```

### 2. After Deployment Completes
Run these commands in Railway console:

```bash
# 1. Sync with Ploomes to get only customers with "Cliente" tag
npm run sync:ploome

# 2. (Optional) Clean database if still showing 4240 contacts
node backend/scripts/clean-database.js
```

## 🧪 Testing the Fixes

### 1. Verify Customer Filtering
- Open the application
- Check customer count - should be **< 2,500** (not 4,240)
- Only contacts with "Cliente" tag should appear
- No FORNECEDORES, TRANSPORTADORAS, or FUNCIONARIOS

### 2. Test Route Generation
- Select multiple customer points
- Click "Otimizar Rota"
- Routes should follow **real streets**, not straight lines
- Console will show:
  - "🗺️ Trying OpenRouteService API (free alternative)..." 
  - "✅ OpenRouteService route obtained successfully"

## 🔍 How the Fix Works

### Customer Filtering Fix
The broken `ploome-service 2.js` file was missing the `hasClientTag()` function, causing ALL 4,240 contacts to be imported. We:
1. Deleted the broken file
2. Fixed the main service to properly filter by TagId 40006184 ("Cliente")
3. Added database cleanup script to remove non-customers

### Route Generation Fix
Routes now use a fallback system:
1. **Primary**: Google Maps API (if configured and working)
2. **Fallback**: OpenRouteService (free, 2,500 requests/day)
3. **Last Resort**: Straight lines between points

## ⚠️ Important Notes
- OpenRouteService has a daily limit of 2,500 requests
- Each route optimization counts as 1 request
- The API automatically falls back if Google Maps fails
- Database sync now properly filters customers by tag

## 📊 Expected Results
- Customer count: ~2,000-2,500 (not 4,240)
- Routes: Following real streets via OpenRouteService
- Performance: Fast route calculation with caching