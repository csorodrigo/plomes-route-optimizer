'use client';

import type { ReactNode } from 'react';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import type { DateRangePreset } from '../types/dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  onRefresh?: () => void;
  onExport?: () => void;
  refreshing?: boolean;
}

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function DashboardLayout({
  children,
  onRefresh,
  onExport,
  refreshing,
}: DashboardLayoutProps) {
  const { filters, setDateRangePreset, setCustomDateRange } = useDashboardFilters();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handlePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset);
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
    if (filters.preset === 'custom') {
      setCustomDateRange({
        ...filters.dateRange,
        [field]: value,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Dashboard de Vendas
              </h1>
              <p className="text-slate-600">
                Visão geral do desempenho de vendas e produtos
              </p>
            </div>

            {/* User Menu */}
            {user && (
              <div className="relative mt-4 sm:mt-0">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900">
                      {user.user_metadata?.name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      showUserMenu ? 'rotate-180' : ''
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
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await signOut();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Período:
                </label>
                <select
                  value={filters.preset}
                  onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DATE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Date Inputs */}
              {filters.preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.startDate}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-500">até</span>
                  <input
                    type="date"
                    value={filters.dateRange.endDate}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Atualizar
                </button>
              )}

              {onExport && (
                <button
                  onClick={onExport}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Exportar PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}