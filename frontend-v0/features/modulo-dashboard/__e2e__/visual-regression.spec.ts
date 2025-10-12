import { test, expect, Page } from '@playwright/test';

// Mock data for consistent visual testing
const mockDashboardData = {
  metrics: {
    totalRevenue: 2500000.75,
    avgDeal: 125000.50,
    activeProducts: 45,
    totalCustomers: 128,
  },
  customers: [
    {
      customer_id: '1',
      customer_name: 'Empresa ABC Ltda',
      total_revenue: 850000.25,
      deal_count: 12,
      avg_deal_value: 70833.35,
      last_deal_date: '2024-03-15T10:30:00Z',
    },
    {
      customer_id: '2',
      customer_name: 'Indústria XYZ S.A.',
      total_revenue: 1200000.00,
      deal_count: 8,
      avg_deal_value: 150000.00,
      last_deal_date: '2024-03-10T14:20:00Z',
    },
  ],
  products: [
    {
      productId: 'P001',
      productName: 'Equipamento Industrial A',
      revenue: 450000.75,
      unitsSold: 15,
      avgPrice: 30000.05,
      category: 'Industrial',
    },
    {
      productId: 'P002',
      productName: 'Sistema de Controle B',
      revenue: 320000.00,
      unitsSold: 8,
      avgPrice: 40000.00,
      category: 'Automação',
    },
  ],
};

// Helper function to setup consistent API mocks
const setupConsistentMocks = async (page: Page) => {
  // Mock metrics
  await page.route('/api/dashboard/metrics-live*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockDashboardData.metrics,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: '2024-03-15T12:00:00Z', // Fixed timestamp for consistency
        },
      }),
    });
  });

  // Mock customers
  await page.route('/api/dashboard/customers-live*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockDashboardData.customers,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: '2024-03-15T12:00:00Z',
        },
      }),
    });
  });

  // Mock products
  await page.route('/api/dashboard/product-performance*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockDashboardData.products,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: '2024-03-15T12:00:00Z',
        },
      }),
    });
  });

  // Disable animations for consistent screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
};

test.describe('Dashboard Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupConsistentMocks(page);
  });

  test.describe('Desktop Views', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('main dashboard layout - desktop', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for all content to load
      await expect(page.locator('text=2.500.000,75')).toBeVisible();
      await expect(page.locator('text=125.000,5')).toBeVisible();

      // Take full page screenshot
      await expect(page).toHaveScreenshot('dashboard-main-desktop.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('metric cards section - desktop', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for metrics to load
      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Screenshot just the metrics section
      const metricsSection = page.locator('[data-testid="metrics-section"]').or(
        page.locator('.metric-cards').first()
      ).or(
        page.locator('[data-testid="metric-card"]').first().locator('xpath=..')
      );

      if (await metricsSection.isVisible()) {
        await expect(metricsSection).toHaveScreenshot('metrics-cards-desktop.png', {
          animations: 'disabled',
        });
      } else {
        // Fallback: screenshot the top section of the page
        await expect(page.locator('body')).toHaveScreenshot('metrics-section-desktop.png', {
          clip: { x: 0, y: 0, width: 1920, height: 400 },
          animations: 'disabled',
        });
      }
    });

    test('product performance chart - desktop', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for chart to render
      await expect(page.locator('text=Equipamento Industrial A')).toBeVisible();

      // Find and screenshot the chart
      const chartContainer = page.locator('[data-testid="product-performance-chart"]').or(
        page.locator('.recharts-wrapper').first()
      ).or(
        page.locator('text=Equipamento Industrial A').locator('xpath=ancestor::div[contains(@class, "chart") or contains(@class, "recharts")]').first()
      );

      if (await chartContainer.isVisible()) {
        await expect(chartContainer).toHaveScreenshot('product-chart-desktop.png', {
          animations: 'disabled',
        });
      }
    });

    test('customer sales table - desktop', async ({ page }) => {
      await page.goto('/dashboard/customers');
      await page.waitForLoadState('networkidle');

      // Wait for customer data to load
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();

      // Screenshot the customers section
      const customersTable = page.locator('[data-testid="customers-table"]').or(
        page.locator('text=Empresa ABC Ltda').locator('xpath=ancestor::table').first()
      ).or(
        page.locator('text=Empresa ABC Ltda').locator('xpath=ancestor::div[contains(@class, "table") or contains(@class, "grid")]').first()
      );

      if (await customersTable.isVisible()) {
        await expect(customersTable).toHaveScreenshot('customers-table-desktop.png', {
          animations: 'disabled',
        });
      } else {
        // Fallback: screenshot the main content area
        await expect(page.locator('body')).toHaveScreenshot('customers-section-desktop.png', {
          clip: { x: 0, y: 100, width: 1920, height: 800 },
          animations: 'disabled',
        });
      }
    });
  });

  test.describe('Tablet Views', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
    });

    test('main dashboard layout - tablet', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      await expect(page).toHaveScreenshot('dashboard-main-tablet.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('metric cards responsive layout - tablet', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Screenshot the metrics section
      await expect(page.locator('body')).toHaveScreenshot('metrics-responsive-tablet.png', {
        clip: { x: 0, y: 0, width: 768, height: 400 },
        animations: 'disabled',
      });
    });

    test('chart responsiveness - tablet', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Equipamento Industrial A')).toBeVisible();

      // Chart should adapt to tablet width
      const chartArea = page.locator('.recharts-wrapper').first().or(
        page.locator('text=Equipamento Industrial A').locator('xpath=..')
      );

      if (await chartArea.isVisible()) {
        await expect(chartArea).toHaveScreenshot('chart-responsive-tablet.png', {
          animations: 'disabled',
        });
      }
    });
  });

  test.describe('Mobile Views', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('main dashboard layout - mobile', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      await expect(page).toHaveScreenshot('dashboard-main-mobile.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('metric cards stack vertically - mobile', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // On mobile, metric cards should stack vertically
      await expect(page.locator('body')).toHaveScreenshot('metrics-stack-mobile.png', {
        clip: { x: 0, y: 0, width: 375, height: 600 },
        animations: 'disabled',
      });
    });

    test('chart adapts to mobile width', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Equipamento Industrial A')).toBeVisible();

      // Chart should be properly sized for mobile
      const chartArea = page.locator('.recharts-wrapper').first().or(
        page.locator('text=Equipamento Industrial A').locator('xpath=..')
      );

      if (await chartArea.isVisible()) {
        await expect(chartArea).toHaveScreenshot('chart-mobile.png', {
          animations: 'disabled',
        });
      }
    });

    test('navigation adapts to mobile', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check if mobile navigation menu exists
      const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
        page.locator('.hamburger').or(
          page.locator('button[aria-label*="menu"]')
        )
      );

      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();

        // Screenshot mobile navigation
        await expect(page).toHaveScreenshot('mobile-navigation.png', {
          animations: 'disabled',
        });
      }
    });
  });

  test.describe('State Variations', () => {
    test('loading states', async ({ page }) => {
      // Mock delayed responses to capture loading states
      await page.route('/api/dashboard/metrics-live*', async route => {
        await page.waitForTimeout(2000);
        await route.continue();
      });

      await page.goto('/dashboard');

      // Capture loading skeleton
      await expect(page.locator('.animate-pulse')).toBeVisible();
      await expect(page.locator('.animate-pulse')).toHaveScreenshot('loading-skeleton.png', {
        animations: 'disabled',
      });
    });

    test('empty states', async ({ page }) => {
      // Mock empty data responses
      await page.route('/api/dashboard/customers-live*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            metadata: { source: 'ploomes_live_api', timestamp: '2024-03-15T12:00:00Z' },
          }),
        });
      });

      await page.route('/api/dashboard/product-performance*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            metadata: { source: 'ploomes_live_api', timestamp: '2024-03-15T12:00:00Z' },
          }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for empty states to appear
      await expect(page.locator('text=Nenhum dado disponível').or(page.locator('text=No data available'))).toBeVisible();

      await expect(page).toHaveScreenshot('empty-state.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('error states', async ({ page }) => {
      // Mock API errors
      await page.route('/api/dashboard/metrics-live*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error',
          }),
        });
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Wait for error state to appear
      await expect(
        page.locator('[data-testid="error-state"]').or(
          page.locator('text=Error').or(
            page.locator('text=Erro')
          )
        )
      ).toBeVisible();

      await expect(page).toHaveScreenshot('error-state.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('search states', async ({ page }) => {
      await page.goto('/dashboard/customers');
      await page.waitForLoadState('networkidle');

      // Initial state
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();
      await expect(page).toHaveScreenshot('search-initial.png', {
        animations: 'disabled',
      });

      // Search with results
      const searchInput = page.locator('[data-testid="customer-search"]').or(
        page.locator('input[placeholder*="search"]').first()
      );

      if (await searchInput.isVisible()) {
        await searchInput.fill('ABC');
        await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();
        await expect(page).toHaveScreenshot('search-with-results.png', {
          animations: 'disabled',
        });

        // Search with no results
        await searchInput.fill('NonexistentCustomer');
        await expect(
          page.locator('text=Nenhum cliente encontrado').or(
            page.locator('text=No results')
          )
        ).toBeVisible();
        await expect(page).toHaveScreenshot('search-no-results.png', {
          animations: 'disabled',
        });
      }
    });
  });

  test.describe('Component Variations', () => {
    test('metric card variations', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Screenshot individual metric cards if they have data-testid
      const metricCards = page.locator('[data-testid="metric-card"]');
      const cardCount = await metricCards.count();

      for (let i = 0; i < Math.min(cardCount, 4); i++) {
        const card = metricCards.nth(i);
        if (await card.isVisible()) {
          await expect(card).toHaveScreenshot(`metric-card-${i}.png`, {
            animations: 'disabled',
          });
        }
      }
    });

    test('chart color themes', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Equipamento Industrial A')).toBeVisible();

      // Test different chart configurations if they exist
      const charts = page.locator('.recharts-wrapper');
      const chartCount = await charts.count();

      for (let i = 0; i < Math.min(chartCount, 3); i++) {
        const chart = charts.nth(i);
        if (await chart.isVisible()) {
          await expect(chart).toHaveScreenshot(`chart-${i}.png`, {
            animations: 'disabled',
          });
        }
      }
    });

    test('data table variations', async ({ page }) => {
      await page.goto('/dashboard/customers');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();

      // Test table with different data configurations
      const tableRows = page.locator('tr, [data-testid="customer-row"]').or(
        page.locator('text=Empresa ABC Ltda').locator('xpath=ancestor::*[1]')
      );

      const rowCount = await tableRows.count();
      if (rowCount > 0) {
        // Screenshot first few rows to show data variation
        for (let i = 0; i < Math.min(rowCount, 3); i++) {
          const row = tableRows.nth(i);
          if (await row.isVisible()) {
            await expect(row).toHaveScreenshot(`table-row-${i}.png`, {
              animations: 'disabled',
            });
          }
        }
      }
    });
  });

  test.describe('Theme and Styling Consistency', () => {
    test('color scheme consistency', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Test primary color scheme
      await expect(page).toHaveScreenshot('color-scheme-primary.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('typography consistency', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Focus on text elements for typography testing
      await expect(page.locator('body')).toHaveScreenshot('typography-test.png', {
        clip: { x: 0, y: 0, width: 1200, height: 600 },
        animations: 'disabled',
      });
    });

    test('spacing and layout consistency', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Test consistent spacing between elements
      await expect(page).toHaveScreenshot('spacing-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});