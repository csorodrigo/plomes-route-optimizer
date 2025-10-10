'use client';

import {
  DashboardLayout,
  MetricCard,
  CustomerSalesTable,
  ProductPerformanceChart,
  useDashboardMetrics,
  useDashboardFilters,
  useRefreshAll
} from '@/features/modulo-dashboard';
import { useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {

  const { filters } = useDashboardFilters();
  const { metrics, isLoading: metricsLoading } = useDashboardMetrics(filters.dateRange);
  const { refreshAll } = useRefreshAll();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAll();
    setIsRefreshing(false);
  };

  const handleExport = () => {
    alert('Exportação para PDF em desenvolvimento');
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <DashboardLayout
      onRefresh={handleRefresh}
      onExport={handleExport}
      refreshing={isRefreshing}
    >
      {/* Navigation Link */}
      <div className="flex justify-end mb-6">
        <Link
          href="/dashboard/customers"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          📋 Ver Clientes
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Receita Total"
          value={formatCurrency(metrics?.totalRevenue)}
          loading={metricsLoading}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />

        <MetricCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.avgDeal)}
          loading={metricsLoading}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          }
        />

        <MetricCard
          title="Produtos Ativos"
          value={metrics?.activeProducts || 0}
          loading={metricsLoading}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          }
        />

        <MetricCard
          title="Total de Clientes"
          value={metrics?.totalCustomers || 0}
          loading={metricsLoading}
          icon={
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
        />
      </div>

      {/* Charts Section */}
      <div className="space-y-8">
        {/* Product Performance Chart */}
        <ProductPerformanceChart />

        {/* Customer Sales Table */}
        <CustomerSalesTable />
      </div>
    </DashboardLayout>
  );
}
