#!/usr/bin/env python3

"""
Execute SQL updates directly - outputs SQL to be executed by Claude via MCP
"""

import json

def main():
    # Load deals
    with open('ploomes-deals-with-products.json', 'r') as f:
        all_deals = json.load(f)

    deals_with_products = [d for d in all_deals if d.get('Products') and len(d['Products']) > 0]

    print(f'📊 Total updates to execute: {len(deals_with_products)}')
    print(f'🎯 Will execute in batches of 10 statements\n')

    # Generate batches of 10
    batch_size = 10
    for i in range(0, len(deals_with_products), batch_size):
        batch = deals_with_products[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(deals_with_products) + batch_size - 1) // batch_size

        print(f'📦 Batch {batch_num}/{total_batches} ({len(batch)} statements)')

        statements = []
        for deal in batch:
            deal_id = str(deal['Id'])
            products_json = json.dumps(deal['Products']).replace("'", "''")
            sql = f"UPDATE sales SET products = '{products_json}'::jsonb WHERE ploomes_deal_id = '{deal_id}';"
            statements.append(sql)

        # Save batch
        filename = f'mcp-batch-{batch_num:03d}.sql'
        with open(filename, 'w') as f:
            f.write('\n'.join(statements))

        print(f'   ✅ Saved to {filename}\n')

    print(f'\n📄 Created {total_batches} batch files')
    print(f'🚀 Execute each via: mcp__supabase__execute_sql\n')

if __name__ == '__main__':
    main()
