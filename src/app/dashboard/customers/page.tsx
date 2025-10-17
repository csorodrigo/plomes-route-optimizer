'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, Database } from 'lucide-react';
import { useCustomerSales, useCustomers } from '@/features/modulo-dashboard';
import { formatCurrency, formatDate, formatDocument } from '@/lib/ploomes-dashboard-api';

interface CustomerWithSales {
  customer_id: string;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_type: 'company' | 'person';
  total_revenue: number;
  deal_count: number;
  avg_deal_value: number;
  last_deal_date: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithSales, setShowOnlyWithSales] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithSales[]>([]);

  // Use new Ploomes hooks for real-time data
  const {
    sales: customerSales,
    summary,
    isLoading: salesLoading,
    isError: salesError,
    refresh: refreshSales,
    source: salesSource,
    timestamp: salesTimestamp
  } = useCustomerSales();

  const {
    customers: allCustomers,
    isLoading: customersLoading,
    isError: customersError,
    refresh: refreshCustomers,
    source: customersSource
  } = useCustomers(undefined, true); // Get active customers only

  // Filter customers based on search and sales filter
  useEffect(() => {
    let filtered = customerSales;

    // Apply search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        (customer.customer_name && customer.customer_name.toLowerCase().includes(term)) ||
        (customer.customer_document && customer.customer_document.toLowerCase().includes(term)) ||
        (customer.customer_email && customer.customer_email.toLowerCase().includes(term))
      );
    }

    // Note: showOnlyWithSales filter is not needed since customerSales already contains only customers with sales
    // But we can combine with allCustomers if needed to show customers without sales

    // Sort by last deal date (most recent first), then by revenue
    filtered = filtered.sort((a, b) => {
      // Sort by date descending (most recent first)
      const dateA = new Date(a.last_deal_date).getTime();
      const dateB = new Date(b.last_deal_date).getTime();
      if (dateB !== dateA) return dateB - dateA;

      // Same date - sort by revenue
      return b.total_revenue - a.total_revenue;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, customerSales, showOnlyWithSales]);

  // Refresh all data
  const handleRefresh = async () => {
    await Promise.all([refreshSales(), refreshCustomers()]);
  };

  const handleRowClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`);
  };

  // Calculate loading and error states
  const isLoading = salesLoading || customersLoading;
  const hasError = salesError || customersError;
  const customersWithSalesCount = customerSales.length;
  const totalCustomersCount = allCustomers.length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Clientes</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-10 w-full max-w-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Clientes</h1>
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-red-500 font-semibold">Erro ao carregar dados do Ploomes:</p>
              {salesError && <p className="text-red-500 text-sm">Vendas: {salesError.message}</p>}
              {customersError && <p className="text-red-500 text-sm">Clientes: {customersError.message}</p>}
              <button
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="inline-block w-4 h-4 mr-2" />
                Tentar Novamente
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <div className="flex items-center gap-4">
          {/* Data Source Indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Ploomes API</span>
            {salesTimestamp && (
              <span className="text-xs">
                ({new Date(salesTimestamp).toLocaleTimeString('pt-BR')})
              </span>
            )}
          </div>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`inline-block w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes com Vendas</CardTitle>
          {summary && (
            <div className="text-sm text-gray-600 mb-4">
              Total: {summary.totalCustomers} clientes • {formatCurrency(summary.totalRevenue)} em vendas •
              {summary.totalDeals} negócios • Ticket médio: {formatCurrency(summary.avgRevenuePerCustomer)}
            </div>
          )}
          <div className="mt-4 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por nome, CNPJ/CPF ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Info Display */}
            <div className="flex gap-2 text-sm">
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded">
                Com vendas: {customersWithSalesCount}
              </div>
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded">
                Total cadastrados: {totalCustomersCount}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Nome</th>
                  <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">CNPJ/CPF</th>
                  <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Email</th>
                  <th className="text-right py-3 px-4 font-medium">Receita Total</th>
                  <th className="text-right py-3 px-4 font-medium hidden lg:table-cell">Nº Vendas</th>
                  <th className="text-right py-3 px-4 font-medium hidden lg:table-cell">Ticket Médio</th>
                  <th className="text-right py-3 px-4 font-medium hidden xl:table-cell">Última Venda</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente com vendas encontrado'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.customer_id}
                      onClick={() => handleRowClick(customer.customer_id)}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">
                        <div>
                          <div className="font-semibold">{customer.customer_name}</div>
                          <div className="text-xs text-gray-500 uppercase">
                            {customer.customer_type === 'company' ? 'Empresa' : 'Pessoa'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-gray-600">
                        {formatDocument(customer.customer_document) || '-'}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-gray-600 text-sm">
                        {customer.customer_email || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-700">
                        {formatCurrency(customer.total_revenue)}
                      </td>
                      <td className="py-3 px-4 text-right hidden lg:table-cell text-gray-600">
                        {customer.deal_count}
                      </td>
                      <td className="py-3 px-4 text-right hidden lg:table-cell text-gray-600">
                        {formatCurrency(customer.avg_deal_value)}
                      </td>
                      <td className="py-3 px-4 text-right hidden xl:table-cell text-gray-600 text-sm">
                        {customer.last_deal_date ? formatDate(customer.last_deal_date) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length > 0 && (
            <div className="mt-4 text-sm text-gray-600 flex justify-between items-center">
              <span>
                Mostrando {filteredCustomers.length} de {customersWithSalesCount} clientes com vendas
              </span>
              <div className="text-xs">
                Fonte: {salesSource} • Última atualização: {salesTimestamp ? new Date(salesTimestamp).toLocaleString('pt-BR') : 'Carregando...'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
