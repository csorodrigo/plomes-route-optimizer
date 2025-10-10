#!/usr/bin/env python3
"""
Execute ALL 1,641 SQL statements one by one
Outputs statements for Claude to execute via MCP
"""

import sys

# Read all statements
with open('FINAL-UPDATE-ALL.sql', 'r') as f:
    statements = [line.strip() for line in f if line.strip()]

total = len(statements)
print(f"📊 Total statements to execute: {total}\n")

# Output first batch of statements for Claude to execute
BATCH_SIZE = 5
batch_num = 1

for i in range(0, min(BATCH_SIZE, total)):
    stmt = statements[i]
    print(f"-- Statement {i+1}/{total}")
    print(stmt)
    print()

print(f"\n✅ First {min(BATCH_SIZE, total)} statements ready")
print(f"⏳ Remaining: {total - BATCH_SIZE}")
print("\nClaude: Execute each statement above via mcp__supabase__execute_sql")
print("Then run this script again to get next batch")
