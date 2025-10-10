#!/usr/bin/env python3
"""
Find which 2 of 1,641 deal IDs from SQL are missing products in database
"""

# Read all deal IDs from SQL file
with open('/tmp/sql_deal_ids.txt', 'r') as f:
    sql_deal_ids = set(line.strip() for line in f if line.strip())

print(f"📊 Deal IDs in SQL: {len(sql_deal_ids)}")

# These are the deal IDs that currently have products in DB (from previous query)
# We know 1,639 sales have products. Let's assume 1 existed before.
# So we need to find which 2 of the 1,641 SQL updates didn't apply.

# Create SQL to check which deals from our SQL file DON'T have products
sql_ids_list = "', '".join(sorted(sql_deal_ids))

query = f"""
SELECT ploomes_deal_id
FROM sales
WHERE ploomes_deal_id IN ('{sql_ids_list}')
AND (products IS NULL OR jsonb_array_length(products) = 0);
"""

print("\n📝 Execute this SQL via Supabase MCP to find missing updates:")
print(query)
