# Railway Environment Variables Setup

## Critical Production Environment Variables

These environment variables must be set in Railway's dashboard under "Variables" section for the application to work:

### Required Variables (Application will fail without these)

```bash
# Ploome API Configuration
PLOOME_API_KEY=A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3
PLOOME_API_URL=https://public-api2.ploomes.com

# Authentication (Generate a strong secret)
JWT_SECRET=your-super-secure-production-jwt-secret-key-minimum-64-characters-long
JWT_EXPIRES_IN=7d
```

### Important Variables (Recommended for production)

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# Database
DATABASE_PATH=./backend/cache/customers.db

# Rate Limiting
API_RATE_LIMIT_PER_MINUTE=120
GEOCODING_DELAY_MS=1000

# Cache TTL (in seconds)
CACHE_TTL_CUSTOMERS=86400
CACHE_TTL_GEOCODING=2592000
CACHE_TTL_ROUTES=3600
```

### Optional Variables (For enhanced functionality)

```bash
# Geocoding API Keys (Improves geocoding accuracy)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
POSITIONSTACK_API_KEY=your-positionstack-api-key
PENROUTE_API_KEY=your-penroute-api-key
```

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the "Variables" tab
4. Click "New Variable"
5. Add each variable name and value
6. Click "Deploy" to apply changes

## Critical Setup Steps

### 1. JWT Secret Generation
For production security, generate a strong JWT secret:
```bash
# Generate a secure 64-character random string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Ploome API Key
- Obtain your API key from Ploome dashboard
- Make sure the integration user has proper permissions

### 3. Database Path
- Use relative path: `./backend/cache/customers.db`
- Railway will create the necessary directories

## Validation

The application now includes automatic environment validation:
- ✅ Checks for required variables on startup
- ⚠️ Warns about missing optional variables
- 🔧 Sets sensible defaults where possible
- ❌ Fails fast with clear error messages

## Quick Deploy Checklist

- [ ] Set `PLOOME_API_KEY` in Railway Variables
- [ ] Generate and set `JWT_SECRET` in Railway Variables
- [ ] Set `PLOOME_API_URL=https://public-api2.ploomes.com`
- [ ] Set `NODE_ENV=production`
- [ ] Deploy and check logs for validation messages
- [ ] Test API endpoints after deployment

## Troubleshooting

### Common Issues

1. **Application won't start**: Check Railway logs for missing environment variables
2. **Database errors**: Ensure `DATABASE_PATH` is set correctly
3. **Ploome sync fails**: Verify `PLOOME_API_KEY` and `PLOOME_API_URL`
4. **Authentication issues**: Check `JWT_SECRET` is set

### Log Messages

- `✅ Environment variables loaded from .env file` - Local development
- `ℹ️ No .env file found - using environment variables directly (Railway mode)` - Production
- `✅ Environment validation passed` - All required variables present
- `❌ Missing critical environment variables` - Setup required

## Migration from Local to Railway

The application automatically detects Railway deployment and:
1. Skips .env file requirement
2. Uses environment variables directly
3. Sets production defaults
4. Validates configuration
5. Provides helpful error messages

No code changes needed - just set the environment variables in Railway dashboard.