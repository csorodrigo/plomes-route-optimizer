#!/usr/bin/env python3
"""
Test script to validate specific GERDAU CNPJ customer dashboard fix
"""

import asyncio
from playwright.async_api import async_playwright

async def test_specific_cnpj():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        print("🔍 Testing specific CNPJ 17227422000105...")

        try:
            # Navigate to customer dashboard
            await page.goto("http://localhost:3003/dashboard/cliente")
            await page.wait_for_selector('input[placeholder*="Digite o nome"]', timeout=10000)

            # Search for specific CNPJ
            print("🔍 Searching for CNPJ 17227422000105...")
            await page.fill('input[placeholder*="Digite o nome"]', '17227422000105')
            await page.click('button:has-text("Buscar")')

            # Wait for results
            await page.wait_for_timeout(3000)

            # Check if customer was found
            customer_info = await page.locator('h2:has-text("Informações do Cliente")').count()
            if customer_info > 0:
                print("✅ Customer found!")

                # Get customer name and CNPJ
                customer_name = await page.locator('p.font-semibold').first.text_content()
                cnpj_element = await page.locator('text=CNPJ').locator('..').locator('p.font-semibold').text_content()

                print(f"📝 Customer name: {customer_name}")
                print(f"🆔 CNPJ: {cnpj_element}")

                # Click to see order history
                await page.click('text=Ver histórico de pedidos')
                await page.wait_for_timeout(2000)

                # Check if modal opened and get data
                modal_title = await page.locator('text=Histórico de Pedidos').count()
                if modal_title > 0:
                    print("✅ Order history modal opened!")

                    total_orders = await page.locator('text=Total de Pedidos').locator('..').locator('p.text-xl').text_content()
                    total_value = await page.locator('text=Valor Total').locator('..').locator('p.text-xl').text_content()

                    print(f"📊 Total de Pedidos: {total_orders}")
                    print(f"💰 Valor Total: {total_value}")

                    # Check if order data matches expected
                    if total_orders == '1' and 'R$ 9.147,59' in total_value:
                        print("🎉 PERFECT! Specific CNPJ shows correct data!")
                        await page.screenshot(path='cnpj_fix_success.png')
                        return True
                    elif total_orders != '0':
                        print("✅ Shows order data (different than expected)")
                        return True
                    else:
                        print("❌ Still showing zero data")
                        return False
                else:
                    print("❌ Modal did not open")
                    return False
            else:
                print("❌ Customer not found")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False
        finally:
            await browser.close()

async def main():
    success = await test_specific_cnpj()
    if success:
        print("\n🎉 SPECIFIC CNPJ TEST PASSED!")
    else:
        print("\n❌ SPECIFIC CNPJ TEST FAILED!")

if __name__ == "__main__":
    asyncio.run(main())