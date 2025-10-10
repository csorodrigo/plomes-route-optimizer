#!/usr/bin/env python3

"""
FINAL: Direct update via Supabase MCP
Reads JSON directly and generates correct SQL for MCP execution
"""

import json

def main():
    # Load deals with products
    with open('ploomes-deals-with-products.json', 'r') as f:
        all_deals = json.load(f)

    deals_with_products = [d for d in all_deals if d.get('Products') and len(d['Products']) > 0]

    print(f'📦 Deals with products: {len(deals_with_products)}')
    print(f'🎯 Creating consolidated SQL file for MCP execution\n')

    # Generate SQL
    updates = []
    for deal in deals_with_products:
        deal_id = str(deal['Id'])
        products_json = json.dumps(deal['Products']).replace("'", "''")
        sql = f"UPDATE sales SET products = '{products_json}'::jsonb WHERE ploomes_deal_id = '{deal_id}';"
        updates.append(sql)

    # Write to single file
    output_file = 'FINAL-UPDATE-ALL.sql'
    with open(output_file, 'w') as f:
        f.write('\n'.join(updates))

    print(f'✅ Generated SQL file: {output_file}')
    print(f'📊 Total UPDATE statements: {len(updates)}')
    print(f'🎯 Execute via: cat {output_file} | supabase db execute\n')

    # Also create a verification query
    verify_sql = """
-- Verify products were updated
SELECT
  COUNT(*) as total_com_produtos,
  COUNT(DISTINCT customer_id) as clientes_unicos
FROM sales
WHERE products IS NOT NULL
  AND jsonb_array_length(products) > 0;
"""

    with open('VERIFY-PRODUCTS.sql', 'w') as f:
        f.write(verify_sql)

    print('✅ Created verification query: VERIFY-PRODUCTS.sql\n')

if __name__ == '__main__':
    main()
