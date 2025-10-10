#!/usr/bin/env python3

"""
Update Supabase sales table using CLI approach (same as MCP uses)
This bypasses the Node.js SDK "Invalid API key" issue
"""

import json
import subprocess
import sys

def load_deals_with_products():
    with open('ploomes-deals-with-products.json', 'r') as f:
        all_deals = json.load(f)

    deals_with_products = [d for d in all_deals if d.get('Products') and len(d['Products']) > 0]
    return deals_with_products

def update_sale_products(deal_id, products):
    """Update a single sale using raw SQL query"""
    # Escape single quotes in JSON
    products_json = json.dumps(products).replace("'", "''")

    sql = f"UPDATE sales SET products = '{products_json}'::jsonb WHERE ploomes_deal_id = '{deal_id}';"

    # Use psql directly (same approach MCP uses)
    # Note: This requires supabase CLI configured
    try:
        # For now, just print the SQL - we'll use MCP execute_sql instead
        return sql
    except Exception as e:
        return None

def main():
    print("📦 Loading deals with products...")
    deals = load_deals_with_products()
    print(f"✅ Found {len(deals)} deals with products\n")

    print("🔄 Generating SQL updates...")

    # Generate all SQL statements
    sql_statements = []
    for deal in deals:
        deal_id = str(deal['Id'])
        products = deal['Products']
        sql = update_sale_products(deal_id, products)
        if sql:
            sql_statements.append(sql)

    # Write to file for MCP execution
    output_file = 'update-all-products.sql'
    with open(output_file, 'w') as f:
        f.write('\n'.join(sql_statements))

    print(f"✅ Generated {len(sql_statements)} SQL statements")
    print(f"📄 Saved to: {output_file}")
    print(f"\n🎯 Execute via Supabase MCP: mcp__supabase__execute_sql")
    print(f"   Or split into smaller batches and execute via MCP\n")

if __name__ == '__main__':
    main()
