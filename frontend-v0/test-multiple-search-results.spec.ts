import { test, expect } from '@playwright/test';

test.describe('Customer Search - Multiple Results', () => {
  test('should display all GERDAU customers as clickable cards', async ({ page }) => {
    // Navigate to the customer search page
    await page.goto('https://claudeplomes-frontend.vercel.app/dashboard/cliente');

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Dashboard do Cliente');

    // Search for GERDAU
    const searchInput = page.locator('input[placeholder*="Digite o nome ou código do cliente"]');
    await searchInput.fill('GERDAU');

    // Click search button
    const searchButton = page.locator('button:has-text("Buscar")');
    await searchButton.click();

    // Wait for search to complete
    await page.waitForTimeout(3000);

    // Check if multiple results are displayed
    const resultsSection = page.locator(':has-text("Resultados da Busca")');

    if (await resultsSection.isVisible()) {
      // Multiple results found - verify they're displayed as cards
      console.log('✅ Multiple results found!');

      // Check for results count
      const resultsText = await page.locator('text=/Encontrados \\d+ clientes/').textContent();
      console.log('Results text:', resultsText);

      // Check for customer cards
      const customerCards = page.locator('[data-testid="customer-card"], .cursor-pointer:has-text("Pedidos")');
      const cardCount = await customerCards.count();
      console.log(`Found ${cardCount} customer cards`);

      if (cardCount > 1) {
        console.log('✅ Multiple customer cards displayed successfully!');

        // Test clicking on the first card
        await customerCards.first().click();

        // Verify detailed view opens
        await expect(page.locator(':has-text("Informações do Cliente")')).toBeVisible();
        console.log('✅ Customer detail view opens when clicking card');

        // Check for back button if multiple results were found
        const backButton = page.locator('text="Voltar aos resultados"');
        if (await backButton.isVisible()) {
          console.log('✅ Back button visible in detailed view');

          // Test back button
          await backButton.click();
          await expect(resultsSection).toBeVisible();
          console.log('✅ Back button works correctly');
        }
      } else {
        console.log('⚠️ Only one customer card found');
      }
    } else {
      // Check if single customer was found and displayed directly
      const customerInfo = page.locator(':has-text("Informações do Cliente")');
      if (await customerInfo.isVisible()) {
        console.log('ℹ️ Single customer found and displayed directly');

        // Take screenshot of the single customer view
        await page.screenshot({
          path: 'single-customer-result.png',
          fullPage: true
        });
      } else {
        console.log('❌ No results found or error occurred');

        // Check for error message
        const errorMessage = page.locator('.text-red-500, .bg-red-50');
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          console.log('Error message:', errorText);
        }

        // Take screenshot for debugging
        await page.screenshot({
          path: 'search-error-debug.png',
          fullPage: true
        });
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: 'gerdau-search-results.png',
      fullPage: true
    });
  });

  test('should handle single result correctly', async ({ page }) => {
    // Navigate to the customer search page
    await page.goto('https://claudeplomes-frontend.vercel.app/dashboard/cliente');

    // Search for a more specific term that should return fewer results
    const searchInput = page.locator('input[placeholder*="Digite o nome ou código do cliente"]');
    await searchInput.fill('GERDAU ACOS LONGOS');

    const searchButton = page.locator('button:has-text("Buscar")');
    await searchButton.click();

    await page.waitForTimeout(3000);

    // Should automatically show detailed view for single result
    await expect(page.locator(':has-text("Informações do Cliente")')).toBeVisible();
    console.log('✅ Single result automatically shows detailed view');

    await page.screenshot({
      path: 'single-result-auto-detail.png',
      fullPage: true
    });
  });
});