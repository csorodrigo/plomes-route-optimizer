#!/usr/bin/env python3
"""Debug script to see what's on the customers page"""

from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    print("Loading page...")
    page.goto('http://localhost:3003/dashboard/customers', wait_until='domcontentloaded')

    # Wait a bit for React to render
    time.sleep(3)

    # Take screenshot
    screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/debug-initial.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")

    # Check for error messages
    error_selectors = [
        '.text-red-500',
        '[class*="error"]',
        'text="Erro"',
        'text="Error"'
    ]

    print("\nChecking for errors...")
    for selector in error_selectors:
        elements = page.locator(selector)
        count = elements.count()
        if count > 0:
            print(f"Found {count} elements with selector: {selector}")
            for i in range(count):
                text = elements.nth(i).text_content()
                print(f"  - {text}")

    # Check what's in the card
    print("\nChecking card content...")
    card_content = page.locator('.container').text_content()
    print(f"Card content:\n{card_content[:500]}...")

    # Check for loading state
    print("\nChecking for skeleton loaders...")
    skeletons = page.locator('[class*="skeleton"]')
    print(f"Skeleton elements: {skeletons.count()}")

    # Check for table
    print("\nChecking for table...")
    tables = page.locator('table')
    print(f"Tables found: {tables.count()}")

    if tables.count() > 0:
        tbody = page.locator('table tbody')
        print(f"Tbody elements: {tbody.count()}")

        rows = page.locator('table tbody tr')
        print(f"Table rows: {rows.count()}")

        if rows.count() > 0:
            first_row = rows.first().text_content()
            print(f"First row content: {first_row}")

    # Wait longer and take another screenshot
    print("\nWaiting 5 more seconds...")
    time.sleep(5)

    screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/debug-after-wait.png'
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved: {screenshot_path}")

    # Check again
    rows = page.locator('table tbody tr')
    print(f"Table rows after wait: {rows.count()}")

    # Keep browser open for manual inspection
    print("\nBrowser will stay open for 30 seconds for inspection...")
    time.sleep(30)

    browser.close()
    print("Done!")
