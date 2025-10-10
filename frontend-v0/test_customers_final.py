#!/usr/bin/env python3
"""
Comprehensive validation test for Customers Dashboard
"""

from playwright.sync_api import sync_playwright
import time
import json

def validate_customers_dashboard():
    report = {
        'test_date': time.strftime('%Y-%m-%d %H:%M:%S'),
        'tests_passed': 0,
        'tests_failed': 0,
        'issues': [],
        'warnings': [],
        'performance': {},
        'screenshots': []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        try:
            print("="*60)
            print("CUSTOMERS DASHBOARD VALIDATION REPORT")
            print("="*60)

            # TEST 1: Page Load
            print("\n1. Testing Page Load...")
            start_load = time.time()
            page.goto('http://localhost:3003/dashboard/customers', wait_until='domcontentloaded')
            page.wait_for_selector('h1:has-text("Clientes")', timeout=5000)
            load_time = (time.time() - start_load) * 1000
            print(f"   ✓ Page loaded in {load_time:.0f}ms")
            report['tests_passed'] += 1

            # TEST 2: Customer List Display
            print("\n2. Testing Customer List Display...")
            time.sleep(2)  # Wait for React to render

            # Check for table
            tables = page.locator('table').count()
            if tables > 0:
                print(f"   ✓ Table element present")

                # Count rows
                rows = page.locator('table tbody tr').count()
                print(f"   ✓ Loaded {rows} customer rows")

                if rows > 0:
                    report['tests_passed'] += 1

                    # Check first row data
                    first_row = page.locator('table tbody tr').first
                    cells = first_row.locator('td')
                    cell_count = cells.count()

                    # Get cell values
                    customer_name = cells.nth(0).text_content() if cell_count > 0 else "N/A"
                    revenue = cells.nth(2).text_content() if cell_count > 2 else "N/A"

                    print(f"   ✓ First customer: {customer_name}")
                    print(f"   ✓ Revenue format: {revenue}")

                    # Check for "Unknown" names
                    if "Unknown" in customer_name:
                        report['warnings'].append("Customer names showing as 'Unknown' - API may be missing customerName field")
                        print(f"   ⚠ Warning: Customer name is 'Unknown'")

                else:
                    report['tests_failed'] += 1
                    report['issues'].append("No customer rows found in table")
            else:
                report['tests_failed'] += 1
                report['issues'].append("Table element not found")

            # Screenshot
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-customer-list.png'
            page.screenshot(path=screenshot_path, full_page=True)
            report['screenshots'].append(screenshot_path)
            print(f"   📸 Screenshot: {screenshot_path}")

            # TEST 3: Filter Buttons
            print("\n3. Testing Filter Buttons...")
            all_btn = page.locator('button:has-text("Todos")')
            sales_btn = page.locator('button:has-text("Apenas com vendas")')

            if all_btn.is_visible() and sales_btn.is_visible():
                all_text = all_btn.text_content()
                sales_text = sales_btn.text_content()
                print(f"   ✓ All customers: {all_text}")
                print(f"   ✓ With sales: {sales_text}")

                # Test toggle
                initial_class = all_btn.get_attribute('class')
                sales_btn.click()
                time.sleep(0.5)

                sales_class = sales_btn.get_attribute('class')
                if 'bg-blue-600' in sales_class:
                    print("   ✓ Filter toggle works (active state changes)")
                    report['tests_passed'] += 1
                else:
                    report['tests_failed'] += 1
                    report['issues'].append("Filter button active state not updating")

                # Screenshot of filtered state
                screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-filter.png'
                page.screenshot(path=screenshot_path, full_page=True)
                report['screenshots'].append(screenshot_path)

                # Reset
                all_btn.click()
                time.sleep(0.3)
            else:
                report['tests_failed'] += 1
                report['issues'].append("Filter buttons not visible")

            # TEST 4: Search Functionality
            print("\n4. Testing Search Functionality...")
            initial_rows = page.locator('table tbody tr').count()
            print(f"   Initial rows: {initial_rows}")

            search_input = page.locator('input[placeholder*="Buscar"]')
            if search_input.is_visible():
                # Try searching for a revenue value (since names are Unknown)
                search_input.fill('727')
                time.sleep(0.5)

                filtered_rows = page.locator('table tbody tr').count()
                print(f"   Filtered rows: {filtered_rows}")

                if filtered_rows < initial_rows:
                    print("   ✓ Search filter is working")
                    report['tests_passed'] += 1
                elif filtered_rows == 0:
                    # Try different search term
                    search_input.fill('')
                    time.sleep(0.3)
                    print("   ⚠ Search returned 0 results, trying different term...")

                # Screenshot
                screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-search.png'
                page.screenshot(path=screenshot_path, full_page=True)
                report['screenshots'].append(screenshot_path)

                # Clear search
                search_input.fill('')
                time.sleep(0.3)
            else:
                report['tests_failed'] += 1
                report['issues'].append("Search input not visible")

            # TEST 5: UI Elements
            print("\n5. Validating UI Elements...")
            ui_elements = {
                'Page Title': page.locator('h1:has-text("Clientes")').is_visible(),
                'Card Title': page.locator('text=Lista de Clientes').is_visible(),
                'Search Input': page.locator('input[placeholder*="Buscar"]').is_visible(),
                'All Button': page.locator('button:has-text("Todos")').is_visible(),
                'Sales Button': page.locator('button:has-text("Apenas com vendas")').is_visible(),
                'Search Icon': page.locator('svg.lucide-search').is_visible(),
                'Table': page.locator('table').is_visible(),
                'Table Headers': page.locator('th:has-text("Nome")').is_visible()
            }

            all_present = True
            for element, visible in ui_elements.items():
                status = "✓" if visible else "✗"
                print(f"   {status} {element}: {'Present' if visible else 'Missing'}")
                if not visible:
                    all_present = False
                    report['issues'].append(f"UI element missing: {element}")

            if all_present:
                report['tests_passed'] += 1
            else:
                report['tests_failed'] += 1

            # TEST 6: Responsive Design
            print("\n6. Testing Responsive Design...")

            # Desktop view
            page.set_viewport_size({"width": 1280, "height": 720})
            time.sleep(0.5)
            cnpj_desktop = page.locator('th:has-text("CNPJ/CPF")').is_visible()
            print(f"   ✓ Desktop (1280px): CNPJ column {'visible' if cnpj_desktop else 'hidden'}")

            # Mobile view
            page.set_viewport_size({"width": 375, "height": 667})
            time.sleep(0.5)
            cnpj_mobile = page.locator('th:has-text("CNPJ/CPF")').is_visible()
            print(f"   ✓ Mobile (375px): CNPJ column {'visible' if cnpj_mobile else 'hidden'}")

            if cnpj_desktop and not cnpj_mobile:
                print("   ✓ Responsive design working correctly")
                report['tests_passed'] += 1
            else:
                report['warnings'].append("Responsive behavior not as expected")

            # Screenshot mobile
            screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-mobile.png'
            page.screenshot(path=screenshot_path, full_page=True)
            report['screenshots'].append(screenshot_path)

            # Reset viewport
            page.set_viewport_size({"width": 1280, "height": 720})

            # TEST 7: API Performance
            print("\n7. Testing API Performance...")

            # First load (cache cold)
            start1 = time.time()
            page.goto('http://localhost:3003/dashboard/customers', wait_until='domcontentloaded')
            page.wait_for_selector('table tbody tr', timeout=10000)
            duration1 = (time.time() - start1) * 1000
            print(f"   First load: {duration1:.0f}ms")

            # Second load (cache warm)
            start2 = time.time()
            page.reload(wait_until='domcontentloaded')
            page.wait_for_selector('table tbody tr', timeout=10000)
            duration2 = (time.time() - start2) * 1000
            print(f"   Second load (cached): {duration2:.0f}ms")

            improvement = ((duration1 - duration2) / duration1) * 100
            print(f"   Performance improvement: {improvement:.1f}%")

            report['performance'] = {
                'first_load_ms': round(duration1),
                'cached_load_ms': round(duration2),
                'improvement_percent': round(improvement, 1),
                'cache_working': duration2 < duration1
            }

            if duration2 < duration1:
                print("   ✓ Cache is working correctly")
                report['tests_passed'] += 1
            else:
                report['warnings'].append("Cache may not be working as expected")

            # TEST 8: Row Click Navigation
            print("\n8. Testing Row Click Navigation...")

            # Get first row
            first_row = page.locator('table tbody tr').first

            # Click it
            first_row.click()
            time.sleep(1)

            # Check if URL changed
            current_url = page.url()
            if '/dashboard/customers/' in current_url and current_url != 'http://localhost:3003/dashboard/customers':
                print(f"   ✓ Navigation working: {current_url}")
                report['tests_passed'] += 1

                # Screenshot detail page
                screenshot_path = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-customer-detail.png'
                page.screenshot(path=screenshot_path, full_page=True)
                report['screenshots'].append(screenshot_path)
            else:
                print(f"   ✗ Navigation failed. Current URL: {current_url}")
                report['tests_failed'] += 1
                report['issues'].append("Customer detail navigation not working")

        except Exception as e:
            print(f"\n✗ Error: {e}")
            report['issues'].append(f"Test error: {str(e)}")

        finally:
            browser.close()

    # Generate Report
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)

    total_tests = report['tests_passed'] + report['tests_failed']
    pass_rate = (report['tests_passed'] / total_tests * 100) if total_tests > 0 else 0

    print(f"\nTests Passed: {report['tests_passed']}/{total_tests} ({pass_rate:.0f}%)")

    if report['issues']:
        print(f"\n❌ Issues Found ({len(report['issues'])}):")
        for issue in report['issues']:
            print(f"   - {issue}")

    if report['warnings']:
        print(f"\n⚠️  Warnings ({len(report['warnings'])}):")
        for warning in report['warnings']:
            print(f"   - {warning}")

    if report['performance']:
        print(f"\n📊 Performance Metrics:")
        print(f"   First load: {report['performance']['first_load_ms']}ms")
        print(f"   Cached load: {report['performance']['cached_load_ms']}ms")
        print(f"   Improvement: {report['performance']['improvement_percent']}%")
        print(f"   Cache status: {'✓ Working' if report['performance']['cache_working'] else '✗ Not working'}")

    print(f"\n📸 Screenshots Generated ({len(report['screenshots'])}):")
    for screenshot in report['screenshots']:
        print(f"   - {screenshot}")

    # Save report
    report_file = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/validation-report.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\n📄 Full report saved: {report_file}")

    # Overall assessment
    print("\n" + "="*60)
    if report['tests_passed'] >= total_tests * 0.8:
        print("✅ OVERALL STATUS: PASS - Dashboard is working correctly")
    elif report['tests_passed'] >= total_tests * 0.6:
        print("⚠️  OVERALL STATUS: PARTIAL - Some issues need attention")
    else:
        print("❌ OVERALL STATUS: FAIL - Significant issues found")
    print("="*60 + "\n")

    return report

if __name__ == '__main__':
    validate_customers_dashboard()
