#!/usr/bin/env python3
"""
Simple: Output first 3 SQL statements for Claude to execute via MCP
"""

with open('FINAL-UPDATE-ALL.sql', 'r') as f:
    lines = f.readlines()

# Print first 3 statements
for i, line in enumerate(lines[:3], 1):
    print(f"-- Statement {i}/{len(lines)}")
    print(line.strip())
    print()

print(f"\nTotal statements remaining: {len(lines)}")
