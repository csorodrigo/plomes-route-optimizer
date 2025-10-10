// Main exports for dashboard module
export { DashboardLayout } from './components/DashboardLayout';
export { MetricCard } from './components/MetricCard';
export { CustomerSalesTable } from './components/CustomerSalesTable';
export { ProductPerformanceChart } from './components/ProductPerformanceChart';
export { PricingHistoryView } from './components/PricingHistoryView';

// Chart components
export {
  BarChart,
  LineChart,
  PieChart,
  AreaChart,
} from './components/charts';

export type {
  BarChartData,
  LineChartData,
  PieChartData,
  AreaChartData,
} from './components/charts';

// Hooks
export {
  useDashboardMetrics,
  useCustomerSales,
  useProductPerformance,
  usePricingHistory,
  useCustomers,
  useDeals,
  useCustomerDealProducts,
  useRefreshAll,
} from './hooks/useDashboardData';

export { useDashboardFilters } from './hooks/useDashboardFilters';

// Types
export type {
  DashboardMetrics,
  CustomerSale,
  ProductPerformance,
  PricingHistoryEntry,
  RegionalSale,
  DateRange,
  DateRangePreset,
  DashboardFilters,
  PaginationState,
  SortState,
  ApiResponse,
} from './types/dashboard';

// Default dashboard page component
export { default as DashboardModulePage } from './page';