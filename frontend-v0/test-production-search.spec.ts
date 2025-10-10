import { test, expect } from '@playwright/test';

test.describe('Production Search Test', () => {
  test('check current GERDAU search behavior', async ({ page }) => {
    // Go to the current production site
    await page.goto('https://claudeplomes-frontend.vercel.app/dashboard/cliente');

    await page.waitForLoadState('networkidle');

    // Fill in GERDAU search
    const searchInput = page.locator('input[placeholder*="Digite o nome"]');
    await searchInput.fill('GERDAU');

    // Click search
    const searchButton = page.locator('button:has-text("Buscar")');
    await searchButton.click();

    // Wait for response
    await page.waitForTimeout(5000);

    // Take screenshot to see current behavior
    await page.screenshot({
      path: 'current-production-gerdau-search.png',
      fullPage: true
    });

    // Check what we get
    const hasMultipleResults = await page.locator(':has-text("Resultados da Busca")').isVisible();
    const hasSingleCustomer = await page.locator(':has-text("Informações do Cliente")').isVisible();
    const hasError = await page.locator('.text-red-500, .bg-red-50').isVisible();

    console.log(`Multiple results section visible: ${hasMultipleResults}`);
    console.log(`Single customer info visible: ${hasSingleCustomer}`);
    console.log(`Error visible: ${hasError}`);

    if (hasError) {
      const errorText = await page.locator('.text-red-500, .bg-red-50').textContent();
      console.log(`Error message: ${errorText}`);
    }

    if (hasMultipleResults) {
      console.log('✅ Multiple results are being shown!');
      const resultsText = await page.locator(':has-text("Encontrados")').textContent();
      console.log(`Results text: ${resultsText}`);
    } else if (hasSingleCustomer) {
      console.log('ℹ️ Single customer being shown (current behavior)');
    } else {
      console.log('❌ Unexpected state');
    }
  });
});