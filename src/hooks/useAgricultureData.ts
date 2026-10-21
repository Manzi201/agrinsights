import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Filters, SummaryStats, DataPoint } from '../types/agriculture';
import { fetchAgricultureData, fetchSummaryStats, subscribeToDataUpdates, getDataVersion } from '../services/nisr';

/**
 * Hook for loading filtered agricultural data from the data service.
 */
export function useAgricultureData(filters: Filters) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch when filters change OR when the data store is updated
  const dataVersion = useDataVersion();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchAgricultureData(filters), fetchSummaryStats(filters)])
      .then(([dataResult, statsResult]) => {
        if (cancelled) return;
        setData(dataResult);
        setStats(statsResult);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.cropId, filters.season, filters.year, dataVersion]);

  return { data, stats, loading, error };
}

/**
 * Hook that returns a version number that increments when the data store
 * is updated (e.g. after real NISR data is loaded). Use this in useMemo/useEffect
 * deps to trigger re-computation when the data source changes.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeToDataUpdates, getDataVersion, getDataVersion);
}

/**
 * Hook for managing filter state.
 */
export function useFilters(initial?: Partial<Filters>) {
  const [cropId, setCropId] = useState(initial?.cropId ?? 'maize');
  const [season, setSeason] = useState<Filters['season']>(initial?.season ?? 'A');
  const [year, setYear] = useState(initial?.year ?? 2024);

  const filters = useMemo(() => ({ cropId, season, year }), [cropId, season, year]);

  return { filters, cropId, season, year, setCropId, setSeason, setYear };
}
