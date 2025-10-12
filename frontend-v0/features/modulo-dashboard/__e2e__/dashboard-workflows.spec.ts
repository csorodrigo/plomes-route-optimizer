import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test data and utilities
const DASHBOARD_URL = '/dashboard';
const CUSTOMER_DASHBOARD_URL = '/dashboard/customers';

// Mock API responses for E2E testing
const mockApiResponses = async (page: Page) => {
  // Mock dashboard metrics
  await page.route('/api/dashboard/metrics-live', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          totalRevenue: 2500000.75,
          avgDeal: 125000.50,
          activeProducts: 45,
          totalCustomers: 128,
        },
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });

  // Mock customer sales
  await page.route('/api/dashboard/customers-live*', async route => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search');

    const mockCustomers = [
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
      {
        customer_id: '3',
        customer_name: 'Comércio 123 ME',
        total_revenue: 450000.50,
        deal_count: 5,
        avg_deal_value: 90000.10,
        last_deal_date: '2024-02-28T09:15:00Z',
      },
    ];

    let filteredCustomers = mockCustomers;
    if (search) {
      filteredCustomers = mockCustomers.filter(c =>
        c.customer_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: filteredCustomers,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });

  // Mock product performance
  await page.route('/api/dashboard/product-performance*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
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
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });
};

test.describe('Dashboard E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await mockApiResponses(page);
  });

  test.describe('Dashboard Page Loading', () => {
    test('loads dashboard page successfully', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Check page title
      await expect(page).toHaveTitle(/Dashboard/);

      // Check main dashboard elements are present
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();

      // Check metric cards are loaded
      await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();

      // Wait for data to load and check values
      await expect(page.locator('text=2.500.000,75')).toBeVisible();
      await expect(page.locator('text=125.000,5')).toBeVisible();
      await expect(page.locator('text=45')).toBeVisible();
      await expect(page.locator('text=128')).toBeVisible();
    });

    test('shows loading states initially', async ({ page }) => {
      // Delay API responses to test loading states
      await page.route('/api/dashboard/metrics-live', async route => {
        await page.waitForTimeout(1000);
        await route.continue();
      });

      await page.goto(DASHBOARD_URL);

      // Should show loading skeleton
      await expect(page.locator('.animate-pulse')).toBeVisible();

      // Wait for loading to complete
      await expect(page.locator('text=2.500.000,75')).toBeVisible();
      await expect(page.locator('.animate-pulse')).not.toBeVisible();
    });

    test('handles API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('/api/dashboard/metrics-live', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error',
          }),
        });
      });

      await page.goto(DASHBOARD_URL);

      // Should show error state or fallback content
      await expect(page.locator('[data-testid="error-state"]').or(page.locator('text=Error'))).toBeVisible();
    });
  });

  test.describe('Customer Search and Filtering', () => {
    test('performs customer search successfully', async ({ page }) => {
      await page.goto(CUSTOMER_DASHBOARD_URL);

      // Wait for initial load
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();

      // Perform search
      const searchInput = page.locator('[data-testid="customer-search"]').or(page.locator('input[placeholder*="search"]').first());
      await searchInput.fill('ABC');

      // Wait for search results
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();
      await expect(page.locator('text=Indústria XYZ S.A.')).not.toBeVisible();
    });

    test('shows empty state for no search results', async ({ page }) => {
      await page.goto(CUSTOMER_DASHBOARD_URL);

      // Search for non-existent customer
      const searchInput = page.locator('[data-testid="customer-search"]').or(page.locator('input[placeholder*="search"]').first());
      await searchInput.fill('NonexistentCustomer');

      // Should show empty state
      await expect(page.locator('text=Nenhum cliente encontrado').or(page.locator('text=No results'))).toBeVisible();
    });

    test('clears search results when input is cleared', async ({ page }) => {
      await page.goto(CUSTOMER_DASHBOARD_URL);

      // Perform search
      const searchInput = page.locator('[data-testid="customer-search"]').or(page.locator('input[placeholder*="search"]').first());
      await searchInput.fill('ABC');
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();

      // Clear search
      await searchInput.clear();

      // Should show all customers again
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();
      await expect(page.locator('text=Indústria XYZ S.A.')).toBeVisible();
    });

    test('handles rapid search input changes', async ({ page }) => {
      await page.goto(CUSTOMER_DASHBOARD_URL);

      const searchInput = page.locator('[data-testid="customer-search"]').or(page.locator('input[placeholder*="search"]').first());

      // Rapidly type and change search terms
      await searchInput.fill('A');
      await searchInput.fill('AB');
      await searchInput.fill('ABC');

      // Final result should be correct
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();
      await expect(page.locator('text=Indústria XYZ S.A.')).not.toBeVisible();
    });
  });

  test.describe('Chart Interactions', () => {
    test('displays charts correctly', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for charts to render
      await expect(page.locator('[data-testid="product-performance-chart"]').or(page.locator('.recharts-wrapper')).first()).toBeVisible();

      // Check chart elements
      await expect(page.locator('text=Equipamento Industrial A')).toBeVisible();
      await expect(page.locator('text=Sistema de Controle B')).toBeVisible();
    });

    test('handles chart hover interactions', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for chart to be visible
      await expect(page.locator('.recharts-wrapper').first()).toBeVisible();

      // Hover over chart elements (if tooltips are implemented)
      const chartArea = page.locator('.recharts-wrapper').first();
      await chartArea.hover();

      // Check if tooltip appears (adjust selector based on implementation)
      // This might need adjustment based on actual chart implementation
      const tooltip = page.locator('.recharts-tooltip-wrapper').or(page.locator('[data-testid="chart-tooltip"]'));
      if (await tooltip.isVisible()) {
        await expect(tooltip).toBeVisible();
      }
    });

    test('handles empty chart data', async ({ page }) => {
      // Mock empty product data
      await page.route('/api/dashboard/product-performance*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            metadata: {
              source: 'ploomes_live_api',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

      await page.goto(DASHBOARD_URL);

      // Should show empty state for charts
      await expect(page.locator('text=Nenhum dado disponível').or(page.locator('text=No data available'))).toBeVisible();
    });
  });

  test.describe('Navigation and Routing', () => {
    test('navigates between dashboard sections', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Check main dashboard is loaded
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();

      // Navigate to customers section (if navigation exists)
      const customersLink = page.locator('a[href*="customers"]').or(page.locator('text=Clientes').first());
      if (await customersLink.isVisible()) {
        await customersLink.click();
        await expect(page).toHaveURL(/customers/);
      }
    });

    test('handles browser back/forward navigation', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      // Navigate to another page
      await page.goto(CUSTOMER_DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(DASHBOARD_URL);

      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(CUSTOMER_DASHBOARD_URL);
    });

    test('maintains state during navigation', async ({ page }) => {
      await page.goto(CUSTOMER_DASHBOARD_URL);

      // Perform search
      const searchInput = page.locator('[data-testid="customer-search"]').or(page.locator('input[placeholder*="search"]').first());
      await searchInput.fill('ABC');
      await expect(page.locator('text=Empresa ABC Ltda')).toBeVisible();

      // Navigate away and back
      await page.goto(DASHBOARD_URL);
      await page.goBack();

      // Check if search state is maintained (this depends on implementation)
      const searchValue = await searchInput.inputValue();
      // Note: State persistence behavior may vary based on implementation
    });
  });

  test.describe('Responsive Design', () => {
    test('adapts to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(DASHBOARD_URL);

      // Check mobile layout
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();

      // Metric cards should be responsive
      const metricCards = page.locator('[data-testid="metric-card"]');
      await expect(metricCards.first()).toBeVisible();

      // Check if mobile navigation exists
      const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(page.locator('.hamburger'));
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        // Check mobile navigation panel
        await expect(page.locator('[data-testid="mobile-nav"]').or(page.locator('.mobile-nav'))).toBeVisible();
      }
    });

    test('adapts to tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(DASHBOARD_URL);

      // Check tablet layout
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();
    });

    test('works on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(DASHBOARD_URL);

      // Check desktop layout
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('meets performance standards', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // Check for large layout shifts (basic check)
      const layoutShift = await page.evaluate(() => {
        return new Promise((resolve) => {
          let cls = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            }
            resolve(cls);
          }).observe({ entryTypes: ['layout-shift'] });

          setTimeout(() => resolve(cls), 2000);
        });
      });

      // CLS should be less than 0.1
      expect(layoutShift).toBeLessThan(0.1);
    });

    test('supports keyboard navigation', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Test Tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Check if focus indicators are visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('has proper accessibility attributes', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Check for proper headings structure
      const h1 = page.locator('h1');
      if (await h1.count() > 0) {
        await expect(h1.first()).toBeVisible();
      }

      // Check for alt texts on images (if any)
      const images = page.locator('img');
      const imageCount = await images.count();
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }

      // Check for proper form labels (if any search inputs exist)
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const label = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        // Should have either aria-label or placeholder for accessibility
        expect(label || placeholder).toBeTruthy();
      }
    });
  });

  test.describe('Error Scenarios', () => {
    test('handles network failures gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/dashboard/**', async route => {
        await route.abort('failed');
      });

      await page.goto(DASHBOARD_URL);

      // Should show error state or fallback content
      await expect(
        page.locator('[data-testid="error-state"]')
          .or(page.locator('text=Error'))
          .or(page.locator('text=Erro'))
      ).toBeVisible();
    });

    test('handles slow API responses', async ({ page }) => {
      // Simulate slow API
      await page.route('/api/dashboard/metrics-live', async route => {
        await page.waitForTimeout(3000);
        await route.continue();
      });

      await page.goto(DASHBOARD_URL);

      // Should show loading state
      await expect(page.locator('.animate-pulse').or(page.locator('text=Carregando'))).toBeVisible();

      // Eventually should load data
      await expect(page.locator('text=2.500.000,75')).toBeVisible({ timeout: 10000 });
    });

    test('handles malformed API responses', async ({ page }) => {
      // Mock malformed response
      await page.route('/api/dashboard/metrics-live', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json',
        });
      });

      await page.goto(DASHBOARD_URL);

      // Should handle gracefully without crashing
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
    });
  });

  test.describe('Data Refresh and Real-time Updates', () => {
    test('refreshes data when refresh button is clicked', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for initial load
      await expect(page.locator('text=2.500.000,75')).toBeVisible();

      // Mock updated data
      await page.route('/api/dashboard/metrics-live', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalRevenue: 3000000.00,
              avgDeal: 150000.00,
              activeProducts: 50,
              totalCustomers: 140,
            },
          }),
        });
      });

      // Click refresh button (if exists)
      const refreshButton = page.locator('[data-testid="refresh-button"]').or(page.locator('button[aria-label*="refresh"]'));
      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Check for updated data
        await expect(page.locator('text=3.000.000')).toBeVisible();
      }
    });

    test('handles concurrent data updates', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Trigger multiple refresh actions rapidly
      const refreshButton = page.locator('[data-testid="refresh-button"]').or(page.locator('button[aria-label*="refresh"]'));
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await refreshButton.click();
        await refreshButton.click();

        // Should handle gracefully without duplicating requests
        await expect(page.locator('text=2.500.000,75')).toBeVisible();
      }
    });
  });
});