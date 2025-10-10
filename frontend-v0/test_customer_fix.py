#!/usr/bin/env python3
"""
Test script to validate GERDAU customer dashboard fix
"""

import asyncio
from playwright.async_api import async_playwright

async def test_customer_dashboard():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        print("🔍 Testing customer dashboard fix...")

        try:
            # Navigate to customer dashboard
            print("📱 Navigating to customer dashboard...")
            await page.goto("http://localhost:3003/dashboard/cliente")

            # Wait for page to load
            await page.wait_for_selector('input[placeholder*="Digite o nome"]', timeout=10000)
            print("✅ Page loaded successfully")

            # Search for GERDAU
            print("🔍 Searching for GERDAU customer...")
            await page.fill('input[placeholder*="Digite o nome"]', 'GERDAU')
            await page.click('button:has-text("Buscar")')

            # Wait for results
            await page.wait_for_timeout(3000)

            # Check if customer was found
            customer_info = await page.locator('h2:has-text("Informações do Cliente")').count()
            if customer_info > 0:
                print("✅ Customer found!")

                # Check customer name
                customer_name = await page.locator('text=GERDAU').first.text_content()
                print(f"📝 Customer name: {customer_name}")

                # Look for the order modal trigger
                await page.click('text=Ver histórico de pedidos')
                await page.wait_for_timeout(2000)

                # Check if modal opened
                modal_title = await page.locator('text=Histórico de Pedidos').count()
                if modal_title > 0:
                    print("✅ Order history modal opened!")

                    # Check order data
                    total_orders = await page.locator('text=Total de Pedidos').locator('..').locator('p.text-xl').text_content()
                    total_value = await page.locator('text=Valor Total').locator('..').locator('p.text-xl').text_content()

                    print(f"📊 Total de Pedidos: {total_orders}")
                    print(f"💰 Valor Total: {total_value}")

                    # Check if order data is not zero
                    if total_orders != '0' and 'R$ 0,00' not in total_value:
                        print("🎉 SUCCESS! Customer now shows order data!")
                        print(f"   - Orders: {total_orders}")
                        print(f"   - Value: {total_value}")

                        # Take screenshot of success
                        await page.screenshot(path='customer_fix_success.png')
                        print("📸 Screenshot saved as customer_fix_success.png")

                        return True
                    else:
                        print("❌ STILL SHOWING ZERO DATA")
                        print(f"   - Orders: {total_orders}")
                        print(f"   - Value: {total_value}")
                        return False
                else:
                    print("❌ Order history modal did not open")
                    return False
            else:
                print("❌ Customer not found")
                return False

        except Exception as e:
            print(f"❌ Error during test: {e}")
            return False
        finally:
            await browser.close()

async def main():
    print("🧪 Starting customer dashboard fix test...")
    success = await test_customer_dashboard()

    if success:
        print("\n🎉 TEST PASSED: Customer dashboard fix is working!")
        print("   GERDAU now shows order data instead of zeros")
    else:
        print("\n❌ TEST FAILED: Customer dashboard still shows zero data")
        print("   Further investigation needed")

if __name__ == "__main__":
    asyncio.run(main())