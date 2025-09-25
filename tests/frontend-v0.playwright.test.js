const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.FRONTEND_V0_URL || 'http://localhost:3003';

const notificationLocator = (page) =>
  page.locator('div').filter({ hasText: /Dados carregados|Rota otimizada/i }).first();

test.describe('Frontend v0 Route Optimizer', () => {
  test('carrega dados, exibe mapa e lista de clientes', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Otimizador de Rotas/i })).toBeVisible();
    await expect(page.getByPlaceholder(/CEP de origem/i)).toBeVisible();

    const carregarButton = page.getByRole('button', { name: /Carregar/i });
    await carregarButton.click();

    const infoToast = notificationLocator(page);
    await expect(infoToast).toBeVisible({ timeout: 30000 });

    await expect(page.locator('.leaflet-container')).toBeVisible();

    await expect(page.locator('text=/Clientes Selecionados/i')).toBeVisible();

    const otimizarButton = page.getByRole('button', { name: /Otimizar/i });
    await otimizarButton.click();

    await expect(notificationLocator(page)).toBeVisible({ timeout: 45000 });

    await expect(page.locator('text=/Distância Total|Resumo da Rota|Tempo Estimado/i')).toBeVisible();
  });
});
