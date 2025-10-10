import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DateRange, DateRangePreset, DashboardFilters } from '../types/dashboard';

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const endDate = new Date();
  const startDate = new Date();

  switch (preset) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case 'custom':
      break;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function useDashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo<DashboardFilters>(() => {
    const preset = (searchParams.get('preset') as DateRangePreset) || '30d';
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    let dateRange: DateRange;

    if (preset === 'custom') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (startDate && endDate) {
        dateRange = { startDate, endDate };
      } else {
        dateRange = getDateRangeFromPreset('30d');
      }
    } else {
      dateRange = getDateRangeFromPreset(preset);
    }

    return {
      dateRange,
      preset,
      category,
      search,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (newFilters: Partial<DashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newFilters.preset !== undefined) {
        params.set('preset', newFilters.preset);

        if (newFilters.preset !== 'custom') {
          params.delete('startDate');
          params.delete('endDate');
        }
      }

      if (newFilters.dateRange !== undefined && newFilters.preset === 'custom') {
        params.set('startDate', newFilters.dateRange.startDate);
        params.set('endDate', newFilters.dateRange.endDate);
      }

      if (newFilters.category !== undefined) {
        if (newFilters.category) {
          params.set('category', newFilters.category);
        } else {
          params.delete('category');
        }
      }

      if (newFilters.search !== undefined) {
        if (newFilters.search) {
          params.set('search', newFilters.search);
        } else {
          params.delete('search');
        }
      }

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const setDateRangePreset = useCallback(
    (preset: DateRangePreset) => {
      setFilters({ preset });
    },
    [setFilters]
  );

  const setCustomDateRange = useCallback(
    (dateRange: DateRange) => {
      setFilters({ preset: 'custom', dateRange });
    },
    [setFilters]
  );

  const setCategory = useCallback(
    (category?: string) => {
      setFilters({ category });
    },
    [setFilters]
  );

  const setSearch = useCallback(
    (search?: string) => {
      setFilters({ search });
    },
    [setFilters]
  );

  const resetFilters = useCallback(() => {
    router.push(window.location.pathname);
  }, [router]);

  return {
    filters,
    setFilters,
    setDateRangePreset,
    setCustomDateRange,
    setCategory,
    setSearch,
    resetFilters,
  };
}