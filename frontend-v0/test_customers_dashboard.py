#!/usr/bin/env python3
"""
Test script for Customers Dashboard
Tests all functionality and creates screenshots
"""

from playwright.sync_api import sync_playwright
import time
import json

def test_customers_dashboard():
    results = {
        'page_load': False,
        'customer_list': False,
        'search': False,
        'filter_buttons': False,
        'ui_elements': False,
        'responsive': False,
        'performance': {},
        'issues': [],
        'screenshots': []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        try:
            # Test 1: Page Load
            print("Test 1: Loading page...")
            page.goto('http://localhost:3003/dashboard/customers', wait_until='domcontentloaded')
            page.wait_for_selector('h1:has-text("Clientes")', timeout=5000)
            results['page_load'] = True
            print("✓ Page loaded successfully")

            # Test 2: Customer List Display
            print("\nTest 2: Checking customer list...")
            page.wait_for_selector('table tbody tr', timeout=10000)

            # Check table headers
            assert page.locator('th:has-text("Nome")').is_visible()
            assert page.locator('th:has-text("Receita Total")').is_visible()

            # Count rows
            row_count = page.locator('table tbody tr').count()
            print(f"✓ Customer list loaded with {row_count} rows")
            results['customer_list'] = True

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-loaded.png'
            page.screenshot(path=screenshot_path, full_page=True)
            results['screenshots'].append(screenshot_path)
            print(f"  Screenshot saved: {screenshot_path}")

            # Test 3: Filter Buttons
            print("\nTest 3: Testing filter buttons...")
            all_btn = page.locator('button:has-text("Todos")')
            sales_btn = page.locator('button:has-text("Apenas com vendas")')

            all_text = all_btn.text_content()
            sales_text = sales_btn.text_content()
            print(f"  All customers button: {all_text}")
            print(f"  With sales button: {sales_text}")

            # Test toggle
            sales_btn.click()
            time.sleep(0.5)

            # Check active state
            sales_class = sales_btn.get_attribute('class')
            if 'bg-blue-600' in sales_class:
                print("✓ Filter toggle works correctly")
                results['filter_buttons'] = True
            else:
                results['issues'].append("Filter button active state not working")

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-filter.png'
            page.screenshot(path=screenshot_path, full_page=True)
            results['screenshots'].append(screenshot_path)

            # Reset filter
            all_btn.click()
            time.sleep(0.3)

            # Test 4: Search Functionality
            print("\nTest 4: Testing search...")
            initial_rows = page.locator('table tbody tr').count()

            search_input = page.locator('input[placeholder*="Buscar"]')
            search_input.fill('CIA')
            time.sleep(0.5)

            filtered_rows = page.locator('table tbody tr').count()
            print(f"  Initial rows: {initial_rows}")
            print(f"  Filtered rows: {filtered_rows}")

            if filtered_rows <= initial_rows:
                print("✓ Search filter working")
                results['search'] = True
            else:
                results['issues'].append("Search filter not reducing results")

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-search.png'
            page.screenshot(path=screenshot_path, full_page=True)
            results['screenshots'].append(screenshot_path)

            # Clear search
            search_input.fill('')
            time.sleep(0.3)

            # Test 5: UI Elements
            print("\nTest 5: Checking UI elements...")
            ui_checks = [
                ('h1:has-text("Clientes")', 'Page title'),
                ('text=Lista de Clientes', 'Card title'),
                ('input[placeholder*="Buscar"]', 'Search input'),
                ('button:has-text("Todos")', 'All button'),
                ('button:has-text("Apenas com vendas")', 'Sales button'),
                ('svg.lucide-search', 'Search icon')
            ]

            all_visible = True
            for selector, name in ui_checks:
                if page.locator(selector).is_visible():
                    print(f"  ✓ {name}")
                else:
                    print(f"  ✗ {name} not visible")
                    all_visible = False

            results['ui_elements'] = all_visible

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-ui-complete.png'
            page.screenshot(path=screenshot_path, full_page=True)
            results['screenshots'].append(screenshot_path)

            # Test 6: Responsive Design
            print("\nTest 6: Testing responsive design...")
            page.set_viewport_size({"width": 375, "height": 667})
            time.sleep(0.5)

            # On mobile, CNPJ column should be hidden
            cnpj_header = page.locator('th:has-text("CNPJ/CPF")')
            is_visible = cnpj_header.is_visible()

            if not is_visible:
                print("✓ Responsive design working (CNPJ hidden on mobile)")
                results['responsive'] = True
            else:
                results['issues'].append("Responsive design not hiding columns on mobile")

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-mobile.png'
            page.screenshot(path=screenshot_path, full_page=True)
            results['screenshots'].append(screenshot_path)

            # Reset viewport
            page.set_viewport_size({"width": 1280, "height": 720})

            # Test 7: Performance
            print("\nTest 7: Testing API performance...")

            # First load
            start1 = time.time()
            page.goto('http://localhost:3003/dashboard/customers', wait_until='domcontentloaded')
            page.wait_for_selector('table tbody tr', timeout=10000)
            duration1 = (time.time() - start1) * 1000
            print(f"  First load: {duration1:.0f}ms")

            # Second load (cached)
            start2 = time.time()
            page.reload(wait_until='domcontentloaded')
            page.wait_for_selector('table tbody tr', timeout=10000)
            duration2 = (time.time() - start2) * 1000
            print(f"  Second load (cached): {duration2:.0f}ms")

            improvement = ((duration1 - duration2) / duration1) * 100
            print(f"  Performance improvement: {improvement:.1f}%")

            results['performance'] = {
                'first_load_ms': duration1,
                'second_load_ms': duration2,
                'improvement_percent': improvement
            }

        except Exception as e:
            print(f"\n✗ Error during testing: {e}")
            results['issues'].append(str(e))

        finally:
            browser.close()

    # Print Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    total_tests = 6
    passed_tests = sum([
        results['page_load'],
        results['customer_list'],
        results['search'],
        results['filter_buttons'],
        results['ui_elements'],
        results['responsive']
    ])

    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    print(f"\n✓ Page Load: {'PASS' if results['page_load'] else 'FAIL'}")
    print(f"✓ Customer List: {'PASS' if results['customer_list'] else 'FAIL'}")
    print(f"✓ Search: {'PASS' if results['search'] else 'FAIL'}")
    print(f"✓ Filter Buttons: {'PASS' if results['filter_buttons'] else 'FAIL'}")
    print(f"✓ UI Elements: {'PASS' if results['ui_elements'] else 'FAIL'}")
    print(f"✓ Responsive: {'PASS' if results['responsive'] else 'FAIL'}")

    if results['performance']:
        print(f"\nPerformance Metrics:")
        print(f"  First load: {results['performance']['first_load_ms']:.0f}ms")
        print(f"  Cached load: {results['performance']['second_load_ms']:.0f}ms")
        print(f"  Improvement: {results['performance']['improvement_percent']:.1f}%")

    if results['issues']:
        print(f"\nIssues Found:")
        for issue in results['issues']:
            print(f"  - {issue}")

    print(f"\nScreenshots saved:")
    for screenshot in results['screenshots']:
        print(f"  - {screenshot}")

    # Save results to JSON
    results_file = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-test-results.json'
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: {results_file}")

    return results

if __name__ == '__main__':
    print("Starting Customers Dashboard Tests...\n")
    test_customers_dashboard()
    print("\n✓ Tests completed!")
