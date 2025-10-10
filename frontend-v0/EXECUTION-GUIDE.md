# SQL Products Update Execution Guide

## Overview
This guide explains how to execute the 1,641 UPDATE statements to populate the `products` JSONB column in the `sales` table with data from Ploomes.

## Files
- **FINAL-UPDATE-ALL.sql** - Contains 1,641 UPDATE statements (2.9MB)
- **VERIFY-PRODUCTS.sql** - Verification query to confirm successful execution

## Recommended Execution Methods

### Method 1: Supabase SQL Editor (RECOMMENDED)

1. Access Supabase Dashboard:
   - URL: https://iwwujqwkigrxqqsxobyz.supabase.co
   - Navigate to: SQL Editor

2. Execute the SQL:
   - Click "New Query"
   - Copy entire contents of `FINAL-UPDATE-ALL.sql`
   - Paste into editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. Monitor execution:
   - Should complete in 30-60 seconds for 1,641 updates
   - Success message will show number of rows affected

4. Verify results:
   - Copy contents of `VERIFY-PRODUCTS.sql`
   - Run in new query
   - Expected result: 1,641 records with products

### Method 2: psql Command Line

If you have PostgreSQL client tools:

```bash
# Set connection string
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.iwwujqwkigrxqqsxobyz.supabase.co:5432/postgres"

# Execute SQL file
psql "$DATABASE_URL" -f FINAL-UPDATE-ALL.sql

# Verify
psql "$DATABASE_URL" -f VERIFY-PRODUCTS.sql
```

### Method 3: Node.js Script (if Supabase credentials are configured)

```bash
# Export Supabase key
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-key-here"

# Run execution script
node execute-products-update.js
```

## What the Updates Do

Each UPDATE statement:
1. Targets a specific sale by `ploomes_deal_id`
2. Sets the `products` column to a JSON array containing:
   - Product ID and name
   - Quantity, unit price, total
   - Discount applied
   - Source (quote or order)
   - Related quote/order ID

Example:
```sql
UPDATE sales
SET products = '[{
  "product_id": "400186344",
  "product_name": "CIA_LOC_COMP",
  "quantity": 0,
  "unit_price": 0,
  "total": 0,
  "discount": 0,
  "source": "quote",
  "quote_id": 402059512
}]'::jsonb
WHERE ploomes_deal_id = '400873662';
```

## Expected Results

After successful execution:
- **Total records updated**: 1,641
- **Records with products**: 1,641
- **Unique customers affected**: ~300-500 (to be verified)

## Verification Query

```sql
SELECT
  COUNT(*) as total_com_produtos,
  COUNT(DISTINCT customer_id) as clientes_unicos
FROM sales
WHERE products IS NOT NULL
  AND jsonb_array_length(products) > 0;
```

## Performance Notes

- File size: 2.9MB
- Statements: 1,641
- Estimated execution time: 30-90 seconds
- Database: Supabase PostgreSQL
- Table: sales
- Column updated: products (JSONB)

## Troubleshooting

### If execution fails:
1. Check database connection
2. Verify table exists: `SELECT COUNT(*) FROM sales;`
3. Check for syntax errors in SQL
4. Try executing in smaller batches (split file)

### If verification shows fewer records:
1. Check for SQL execution errors
2. Review error logs in Supabase dashboard
3. Re-run failed statements

## Next Steps After Execution

1. Run verification query
2. Test dashboard with real product data
3. Verify pricing history modal functionality
4. Check customer sales table displays correctly

## Support

If issues occur:
- Check Supabase logs: Dashboard > Logs
- Review SQL Editor history
- Contact database administrator if permissions are insufficient
