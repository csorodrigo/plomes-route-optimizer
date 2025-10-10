# Ploomes API 403 Error - Root Cause and Fix

## Problem Summary
The `/api/dashboard/customers` endpoint was returning a 403 "Your request has been forbidden" error when calling the Ploomes API, even though direct curl commands worked fine.

## Investigation Process

### Initial Findings
- ✅ curl commands worked perfectly
- ❌ axios/Next.js API calls failed with 403
- ✅ API key was loading correctly (`PLOOMES_API_KEY`)
- ✅ Simple axios requests (with minimal fields) worked
- ❌ Full field selection failed

### Root Cause Discovery

Through systematic testing, we discovered that the **field name `LastStageUpdate` does not exist** in the Ploomes API and causes a 403 error when included in the `$select` parameter.

#### Test Results:
```bash
# ✅ WORKS: Simple query
GET /Deals?$select=Id&$top=5

# ❌ FAILS: Query with LastStageUpdate
GET /Deals?$select=Id,ContactId,Amount,StageId,CreateDate,LastStageUpdate&$top=300
Response: 403 "Your request has been forbidden"

# ✅ WORKS: Query with LastUpdateDate instead
GET /Deals?$select=Id,ContactId,Amount,StageId,CreateDate,LastUpdateDate&$top=300
```

### Available Fields in Ploomes API

When requesting all fields (no `$select`), Ploomes returns:
- ✅ `LastUpdateDate` - The actual field name
- ❌ `LastStageUpdate` - Does NOT exist (causes 403)

## Solution

### File Changed
`/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/src/app/api/dashboard/customers/route.ts`

### Changes Made

1. **Updated interface:**
```typescript
interface Deal {
  Id: number;
  ContactId?: number;
  Amount?: number;
  StageId?: number;
  CreateDate?: string;
  LastUpdateDate?: string;  // Changed from LastStageUpdate
}
```

2. **Updated API query:**
```typescript
// Before (403 error):
const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,Amount,StageId,CreateDate,LastStageUpdate&$top=${PAGE_SIZE}&$skip=${skip}`;

// After (works):
const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,Amount,StageId,CreateDate,LastUpdateDate&$top=${PAGE_SIZE}&$skip=${skip}`;
```

3. **Updated date logic:**
```typescript
// Before:
const date = deal.LastStageUpdate || deal.CreateDate || new Date().toISOString();

// After:
const date = deal.LastUpdateDate || deal.CreateDate || new Date().toISOString();
```

## Result

✅ **API now works perfectly**
- Successfully fetches all deals with pagination (300 per page)
- Processes 9000+ deals in ~2 minutes
- Returns 200 status with full customer aggregation
- No more 403 errors

## Key Learnings

1. **Field Name Validation**: The Ploomes API returns 403 for invalid field names in `$select`, not a more descriptive error
2. **Testing Strategy**: Test with minimal fields first, then add fields incrementally to isolate the problem
3. **API Documentation**: The actual field name is `LastUpdateDate`, not `LastStageUpdate`
4. **Error Messages**: Ploomes returns a generic "Your request has been forbidden" message, which doesn't clearly indicate the issue is with field names

## Environment Variables

Correct configuration in `.env.local`:
```bash
# Both work (code checks both):
PLOOMES_API_KEY=<your-key>
PLOOME_API_KEY=<your-key>

PLOOMES_BASE_URL=https://public-api2.ploomes.com
```

## Testing

To verify the fix works:
```bash
# Test endpoint (should return 200)
curl http://localhost:3003/api/dashboard/customers

# Should see logs like:
[PLOOMES] ✅ Page 1 SUCCESS - Status: 200
[PLOOMES]    Fetched 300 deals (Total: 300)
```

## Date: 2025-10-01
## Status: ✅ RESOLVED
