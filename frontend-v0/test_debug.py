#!/usr/bin/env python3
import requests
import time

print("🧪 Starting test request with DEBUG logging...")
print(f"⏰ Started at: {time.strftime('%H:%M:%S')}")

url = "http://localhost:3003/api/dashboard/customers"

try:
    response = requests.get(url, timeout=30)
    print(f"\n✅ Response received!")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Customers returned: {data['metadata']['totalCustomers']}")
    print(f"Source: {data['metadata']['source']}")
except requests.exceptions.Timeout:
    print("\n⏰ Request timed out after 30s (expected for full fetch)")
except Exception as e:
    print(f"\n❌ Error: {e}")

print(f"⏰ Ended at: {time.strftime('%H:%M:%S')}")
