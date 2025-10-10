#!/usr/bin/env python3
"""
Split FINAL-UPDATE-ALL.sql into small batches based on character size
Target: ~10KB per batch to fit MCP token limits
"""

import os

# Read all statements
with open('FINAL-UPDATE-ALL.sql', 'r') as f:
    statements = [line.strip() for line in f if line.strip()]

print(f"📊 Total statements: {len(statements)}\n")

# Create output directory
os.makedirs('mcp-batches', exist_ok=True)

# Target size: 10KB = 10,000 characters
TARGET_SIZE = 10000
current_batch = []
current_size = 0
batch_num = 1

for stmt in statements:
    stmt_size = len(stmt)

    # If adding this statement exceeds target, save current batch
    if current_size + stmt_size > TARGET_SIZE and current_batch:
        filename = f'mcp-batches/batch-{batch_num:03d}.sql'
        with open(filename, 'w') as f:
            f.write('\n'.join(current_batch))

        print(f"✅ Batch {batch_num}: {len(current_batch)} statements, {current_size:,} chars")

        # Reset for next batch
        current_batch = []
        current_size = 0
        batch_num += 1

    # Add statement to current batch
    current_batch.append(stmt)
    current_size += stmt_size + 1  # +1 for newline

# Save last batch
if current_batch:
    filename = f'mcp-batches/batch-{batch_num:03d}.sql'
    with open(filename, 'w') as f:
        f.write('\n'.join(current_batch))

    print(f"✅ Batch {batch_num}: {len(current_batch)} statements, {current_size:,} chars")

print(f"\n📦 Total batches created: {batch_num}")
print(f"📁 Location: mcp-batches/")
print(f"🎯 Claude can now execute these batches via MCP Supabase")
