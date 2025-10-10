import asyncio
from playwright.async_api import async_playwright

async def test_pricing_modal():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        try:
            print("1. Navigating to customer detail page...")
            await page.goto('http://localhost:3003/dashboard/customers/401245927', wait_until='networkidle')
            await asyncio.sleep(2)
            
            print("2. Page loaded, waiting for products table...")
            await page.wait_for_selector('table', timeout=10000)
            await asyncio.sleep(1)
            
            print("3. Looking for first product row...")
            first_product = await page.query_selector('table tbody tr:first-child')
            if not first_product:
                print("❌ No product rows found")
                await browser.close()
                return False
            
            print("4. Clicking on first product...")
            await first_product.click()
            await asyncio.sleep(2)
            
            print("5. Waiting for modal to open...")
            modal = await page.wait_for_selector('[role="dialog"]', timeout=5000)
            if not modal:
                print("❌ Modal did not open")
                await browser.close()
                return False
            
            print("6. Modal opened! Verifying content...")
            modal_text = await modal.inner_text()
            print(f"\nModal content preview:\n{modal_text[:500]}...\n")
            
            checks = {
                'Preço Mínimo': False,
                'Preço Máximo': False,
                'Preço Médio': False,
                'Preço Atual': False,
                'R$ 1.000,00': False,
                'Histórico Detalhado': False
            }
            
            for key in checks.keys():
                if key in modal_text:
                    checks[key] = True
                    print(f"✅ Found: {key}")
                else:
                    print(f"❌ Missing: {key}")
            
            if 'R$ 0,00' in modal_text:
                print("❌ PROBLEM: Found R$ 0,00 in modal")
            else:
                print("✅ Good: No R$ 0,00 found")
            
            print("\n7. Checking history table...")
            history_rows = await page.query_selector_all('[role="dialog"] table tbody tr')
            row_count = len(history_rows)
            print(f"   Found {row_count} history rows")
            
            if row_count > 0:
                print("✅ History table has data")
                first_row_text = await history_rows[0].inner_text()
                print(f"   First row: {first_row_text[:100]}")
            else:
                print("❌ History table is empty")
            
            print("\n8. Taking final screenshot...")
            await page.screenshot(path='final_modal_test.png', full_page=True)
            print("✅ Screenshot saved")
            
            print("\n" + "="*60)
            print("TEST SUMMARY")
            print("="*60)
            all_passed = all(checks.values()) and row_count > 0 and 'R$ 0,00' not in modal_text
            
            if all_passed:
                print("✅ ALL CHECKS PASSED!")
            else:
                print("❌ SOME CHECKS FAILED")
                for key, passed in checks.items():
                    status = "✅" if passed else "❌"
                    print(f"   {status} {key}")
            
            await browser.close()
            return all_passed
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            await browser.close()
            return False

asyncio.run(test_pricing_modal())
