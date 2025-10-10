import asyncio
from playwright.async_api import async_playwright

async def interactive_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        try:
            print("Opening page...")
            await page.goto('http://localhost:3003/dashboard/customers/401245927', wait_until='domcontentloaded', timeout=30000)
            
            print("Waiting for content to load...")
            await asyncio.sleep(15)
            
            print("\nLooking for clickable elements in Produtos Vendidos table...")
            # Try to find any clickable elements in the products table
            clickable_elements = await page.query_selector_all('table:nth-of-type(2) tbody tr button, table:nth-of-type(2) tbody tr [role="button"], table:nth-of-type(2) tbody tr a')
            print(f"Found {len(clickable_elements)} clickable elements")
            
            if len(clickable_elements) == 0:
                print("\nNo button/link found, trying to click the row itself...")
                row = await page.query_selector('table:nth-of-type(2) tbody tr:first-child')
                if row:
                    print("Found row, getting its HTML...")
                    html = await row.inner_html()
                    print(f"Row HTML: {html[:200]}...")
                    
                    print("\nClicking row...")
                    await row.click()
                    await asyncio.sleep(3)
                    
                    modal = await page.query_selector('[role="dialog"]')
                    if modal:
                        print("\n✅ MODAL OPENED!")
                        text = await modal.inner_text()
                        print("\n=== MODAL CONTENT ===")
                        print(text)
                        print("===================")
                        
                        await page.screenshot(path='modal_success.png', full_page=True)
                        print("\nScreenshot saved: modal_success.png")
                    else:
                        print("\n❌ No modal appeared after clicking row")
                        await page.screenshot(path='no_modal.png', full_page=True)
                        print("Screenshot saved: no_modal.png")
            else:
                print(f"\nFound {len(clickable_elements)} clickable elements, clicking first one...")
                await clickable_elements[0].click()
                await asyncio.sleep(3)
                
                modal = await page.query_selector('[role="dialog"]')
                if modal:
                    print("\n✅ MODAL OPENED!")
                    text = await modal.inner_text()
                    print("\n=== MODAL CONTENT ===")
                    print(text)
                    print("===================")
                    
                    await page.screenshot(path='modal_success.png', full_page=True)
                else:
                    print("\n❌ No modal appeared")
            
            print("\n\nKeeping browser open for 30 seconds for manual inspection...")
            await asyncio.sleep(30)
            
            await browser.close()
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            await browser.close()

asyncio.run(interactive_test())
