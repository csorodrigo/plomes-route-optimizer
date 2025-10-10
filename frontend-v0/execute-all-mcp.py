#!/usr/bin/env python3

"""
Execute all SQL batches efficiently
Splits large batches into mini-batches of 10 statements for faster execution
"""

import os
import sys

def read_batch(batch_num):
    filename = f'DASHBOARD-batch-{batch_num}of4.sql'
    if not os.path.exists(filename):
        return None

    with open(filename, 'r') as f:
        content = f.read()

    statements = [s.strip() for s in content.split(';') if s.strip()]
    return statements

def create_mini_batches(statements, size=10):
    """Split statements into mini-batches"""
    mini_batches = []
    for i in range(0, len(statements), size):
        mini_batches.append(statements[i:i+size])
    return mini_batches

def main():
    print('🚀 Preparing SQL execution via MCP Supabase\n')
    print('='*70)

    all_mini_batches = []
    total_statements = 0

    # Read all 4 batches
    for batch_num in range(1, 5):
        statements = read_batch(batch_num)
        if statements is None:
            print(f'⚠️  Batch {batch_num} not found')
            continue

        mini_batches = create_mini_batches(statements, size=10)

        print(f'\n📦 Batch {batch_num}/4:')
        print(f'   Total statements: {len(statements)}')
        print(f'   Mini-batches (10 each): {len(mini_batches)}')

        for idx, mini_batch in enumerate(mini_batches, 1):
            all_mini_batches.append({
                'batch': batch_num,
                'mini_batch': idx,
                'total_mini_batches': len(mini_batches),
                'statements': mini_batch
            })

        total_statements += len(statements)

    print(f'\n{"="*70}')
    print(f'📊 Summary:')
    print(f'   Total statements: {total_statements}')
    print(f'   Total mini-batches: {len(all_mini_batches)}')
    print(f'   Statements per mini-batch: ~10')
    print(f'{"="*70}\n')

    # Create output files for each mini-batch
    os.makedirs('mini-batches', exist_ok=True)

    for mb in all_mini_batches:
        filename = f"mini-batches/batch-{mb['batch']}-{mb['mini_batch']}.sql"
        sql = ';\n'.join(mb['statements']) + ';'

        with open(filename, 'w') as f:
            f.write(sql)

    print(f'✅ Created {len(all_mini_batches)} mini-batch SQL files in mini-batches/')
    print(f'🎯 Claude can now execute these via MCP Supabase efficiently\n')

    # Create execution summary
    with open('mini-batches/EXECUTION-PLAN.txt', 'w') as f:
        f.write('SQL Execution Plan\n')
        f.write('='*70 + '\n\n')
        f.write(f'Total Statements: {total_statements}\n')
        f.write(f'Total Mini-Batches: {len(all_mini_batches)}\n')
        f.write(f'Statements per Mini-Batch: ~10\n\n')

        for mb in all_mini_batches:
            f.write(f"Batch {mb['batch']}.{mb['mini_batch']}: {len(mb['statements'])} statements\n")

    print('📄 Execution plan saved to mini-batches/EXECUTION-PLAN.txt')

if __name__ == '__main__':
    main()
