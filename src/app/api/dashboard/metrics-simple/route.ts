import { NextRequest, NextResponse } from "next/server";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DashboardMetrics {
  totalRevenue: number;
  avgDealValue: number;
  activeProducts: number;
  totalCustomers: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    dealCount: number;
  }>;
  revenueByMonth: Record<string, number>;
  conversionRate: number;
}

/**
 * Simple metrics endpoint using Supabase CLI
 * This bypasses all authentication issues by using the CLI directly
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Dashboard Metrics API called (simple version)');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const statusFilter = searchParams.get('statusId');

    // Build SQL query
    let salesQuery = 'SELECT * FROM sales';
    const whereClauses: string[] = [];

    if (startDate) {
      whereClauses.push(`created_at >= '${startDate}'`);
    }
    if (endDate) {
      whereClauses.push(`created_at <= '${endDate}'`);
    }
    if (statusFilter) {
      whereClauses.push(`status = '${statusFilter}'`);
    }

    if (whereClauses.length > 0) {
      salesQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Execute SQL via Supabase CLI
    const { stdout: salesJson } = await execAsync(
      `npx supabase db query --json "${salesQuery}"`,
      { cwd: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0' }
    );

    const sales = JSON.parse(salesJson);

    // Get counts
    const { stdout: productsCount } = await execAsync(
      `npx supabase db query --json "SELECT COUNT(*) as count FROM products WHERE active = true"`,
      { cwd: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0' }
    );

    const { stdout: customersCount } = await execAsync(
      `npx supabase db query --json "SELECT COUNT(*) as count FROM customers"`,
      { cwd: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0' }
    );

    const activeProducts = JSON.parse(productsCount)[0]?.count || 0;
    const totalCustomers = JSON.parse(customersCount)[0]?.count || 0;

    // Calculate metrics
    const totalRevenue = sales.reduce((sum: number, sale: any) =>
      sum + (parseFloat(sale.deal_value) || 0), 0);
    const dealCount = sales.length;
    const avgDealValue = dealCount > 0 ? totalRevenue / dealCount : 0;

    // Calculate top products from JSONB products field
    const productRevenue = new Map<string, { name: string; revenue: number; dealCount: number }>();

    sales.forEach((sale: any) => {
      if (sale.products && Array.isArray(sale.products)) {
        sale.products.forEach((product: any) => {
          const productId = product.product_id?.toString() || 'unknown';
          const productName = product.product_name || 'Unknown Product';
          const productTotal = parseFloat(product.total) || 0;

          const existing = productRevenue.get(productId) || {
            name: productName,
            revenue: 0,
            dealCount: 0
          };
          existing.revenue += productTotal;
          existing.dealCount += 1;
          productRevenue.set(productId, existing);
        });
      }
    });

    const topProducts = Array.from(productRevenue.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        revenue: data.revenue,
        dealCount: data.dealCount
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate revenue by month
    const revenueByMonth: Record<string, number> = {};
    sales.forEach((sale: any) => {
      if (sale.created_at) {
        const month = new Date(sale.created_at).toISOString().slice(0, 7); // YYYY-MM
        revenueByMonth[month] = (revenueByMonth[month] || 0) + (parseFloat(sale.deal_value) || 0);
      }
    });

    // Calculate conversion rate (won deals / total deals)
    const wonDeals = sales.filter((s: any) => s.status === 'won').length;
    const conversionRate = dealCount > 0 ? (wonDeals / dealCount) * 100 : 0;

    const metrics: DashboardMetrics = {
      totalRevenue,
      avgDealValue,
      activeProducts: parseInt(activeProducts, 10),
      totalCustomers: parseInt(totalCustomers, 10),
      topProducts,
      revenueByMonth,
      conversionRate
    };

    console.log(`[METRICS API] ✅ Calculated metrics: ${totalRevenue} revenue, ${dealCount} deals`);

    return NextResponse.json({
      success: true,
      data: metrics,
      metadata: {
        source: 'supabase_cli',
        timestamp: new Date().toISOString(),
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          statusId: statusFilter || null
        },
        period: {
          dealCount,
          dataPoints: sales.length
        }
      }
    });

  } catch (error: unknown) {
    console.error('💥 Dashboard Metrics API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in dashboard metrics API',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
