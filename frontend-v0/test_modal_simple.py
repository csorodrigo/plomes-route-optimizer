import asyncio
from playwright.async_api import async_playwright

async def simple_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()
        
        try:
            print("Opening page...")
            await page.goto('http://localhost:3003/dashboard/customers/401245927', wait_until='domcontentloaded', timeout=30000)
            
            print("Waiting for content to load (15 seconds)...")
            await asyncio.sleep(15)
            
            print("Taking screenshot...")
            await page.screenshot(path='page_loaded.png', full_page=True)
            print("Screenshot saved: page_loaded.png")
            
            print("\nLooking for product tables...")
            tables = await page.query_selector_all('table')
            print(f"Found {len(tables)} tables")
            
            if len(tables) > 0:
                print("\nAttempting to click first product row...")
                try:
                    first_row = await page.query_selector('table tbody tr:first-child')
                    if first_row:
                        await first_row.click()
                        print("Clicked row, waiting for modal...")
                        await asyncio.sleep(3)
                        
                        await page.screenshot(path='modal_opened.png', full_page=True)
                        print("Screenshot saved: modal_opened.png")
                        
                        # Get modal text
                        modal = await page.query_selector('[role="dialog"]')
                        if modal:
                            text = await modal.inner_text()
                            print("\n=== MODAL CONTENT ===")
                            print(text)
                            print("===================")
                        else:
                            print("No modal found")
                    else:
                        print("No rows found in table")
                except Exception as e:
                    print(f"Error clicking row: {e}")
            
            print("\nTest complete")
            await browser.close()
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            await browser.close()

asyncio.run(simple_test())
