'use client';

import { useState, useMemo } from 'react';
import { useCustomerSales } from '../hooks/useDashboardData';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import type { CustomerSale, SortState } from '../types/dashboard';

const ITEMS_PER_PAGE = 20;

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-b border-slate-200 p-4">
          <div className="flex gap-4">
            <div className="flex-1 h-4 bg-slate-200 rounded"></div>
            <div className="w-24 h-4 bg-slate-200 rounded"></div>
            <div className="w-16 h-4 bg-slate-200 rounded"></div>
            <div className="w-24 h-4 bg-slate-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomerSalesTable() {
  const { filters, setSearch } = useDashboardFilters();
  const { sales, isLoading, isError } = useCustomerSales(
    filters.dateRange,
    filters.search
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState<SortState>({
    column: 'totalRevenue',
    direction: 'desc',
  });
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const sortedSales = useMemo(() => {
    const sorted = [...sales].sort((a, b) => {
      const aValue = a[sortState.column as keyof CustomerSale];
      const bValue = b[sortState.column as keyof CustomerSale];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortState.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortState.direction === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [sales, sortState]);

  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedSales.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedSales, currentPage]);

  const totalPages = Math.ceil(sortedSales.length / ITEMS_PER_PAGE);

  const handleSort = (column: keyof CustomerSale) => {
    setSortState((prev) => ({
      column: column as string,
      direction:
        prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setSearch(value || undefined);
    setCurrentPage(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8 text-center">
        <div className="text-red-500 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          Erro ao carregar dados
        </h3>
        <p className="text-slate-600 mb-4">
          Não foi possível carregar as vendas por cliente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Vendas por Cliente
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <TableSkeleton />
        ) : paginatedSales.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Nenhuma venda encontrada
            </h3>
            <p className="text-slate-600">
              {filters.search
                ? 'Tente ajustar os filtros de busca.'
                : 'Não há vendas no período selecionado.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('customerName')}
                >
                  <div className="flex items-center gap-2">
                    Cliente
                    {sortState.column === 'customerName' && (
                      <svg
                        className={`w-4 h-4 transform ${
                          sortState.direction === 'asc' ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('totalRevenue')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Receita Total
                    {sortState.column === 'totalRevenue' && (
                      <svg
                        className={`w-4 h-4 transform ${
                          sortState.direction === 'asc' ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('dealCount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Vendas
                    {sortState.column === 'dealCount' && (
                      <svg
                        className={`w-4 h-4 transform ${
                          sortState.direction === 'asc' ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('avgDealSize')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Ticket Médio
                    {sortState.column === 'avgDealSize' && (
                      <svg
                        className={`w-4 h-4 transform ${
                          sortState.direction === 'asc' ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedSales.map((sale) => (
                <tr
                  key={sale.customerId}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {sale.customerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                    {formatCurrency(sale.totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">
                    {sale.dealCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">
                    {formatCurrency(sale.avgDealSize)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedSales.length)} de{' '}
            {sortedSales.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}