'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardMetrics {
  totalRevenue: number;
  avgDealValue: number;
  activeProducts: number;
  totalCustomers: number;
  productPerformance: Array<{
    name: string;
    revenue: number;
    sales: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    sales: number;
    category: string;
  }>;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch metrics');
        return res.json();
      })
      .then(response => {
        // Handle wrapped response
        const data = response.data || response;

        // Transform the data to match our interface
        const transformedData: DashboardMetrics = {
          totalRevenue: data.totalRevenue,
          avgDealValue: data.avgDealValue,
          activeProducts: data.activeProducts,
          totalCustomers: data.totalCustomers,
          productPerformance: data.topProducts?.map((p: any) => ({
            name: p.productName,
            revenue: p.revenue,
            sales: p.dealCount
          })) || [],
          revenueByMonth: Object.entries(data.revenueByMonth || {}).map(([month, revenue]) => ({
            month,
            revenue: revenue as number
          })),
          topProducts: data.topProducts?.map((p: any) => ({
            name: p.productName,
            revenue: p.revenue,
            sales: p.dealCount,
            category: 'Lubrificantes' // Default category
          })) || []
        };

        setMetrics(transformedData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-container">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">Error loading dashboard: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  return (
    <div className="container mx-auto p-6" data-testid="dashboard-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link
          href="/dashboard/customers"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          📋 Ver Clientes
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Average Deal Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.avgDealValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalCustomers)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.productPerformance.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sales} sales</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.revenueByMonth.map((month, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{month.month}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(month.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  <th className="text-right py-3 px-4 font-medium">Sales</th>
                  <th className="text-right py-3 px-4 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProducts.map((product, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-3 px-4">{product.name}</td>
                    <td className="py-3 px-4">{product.category}</td>
                    <td className="py-3 px-4 text-right">{product.sales}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
