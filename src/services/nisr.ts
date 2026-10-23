// ---------------------------------------------------------------------------
// nisr.ts — NISR Data Service
//
// ALL production/area/yield data comes from the NISR PXWeb API.
// There is NO mock/generated fallback data.
// If the API is unreachable, getAllData() returns [] and the UI shows
// a "Data unavailable" state rather than displaying fabricated figures.
// ---------------------------------------------------------------------------

import type { DataPoint, Filters, SummaryStats, Season } from '../types/agriculture';
import { getAllData, setAllData, years, getDistrictById, getCropById } from './agricultureData';
import {
  PXWEB_TABLES, buildPxWebUrl, PXWEB_DATA_YEAR,
  PXWEB_CROP_MAP, PXWEB_DISTRICT_MAP, PXWEB_SEASON_MAP,
  DATAGOV_BASE, DATAGOV_API_KEY,
} from '../config/api';

const API_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

export type ApiStatus = 'loading' | 'connected' | 'error';

let _apiStatus: ApiStatus = 'loading';
let _apiError: string | null = null;
let _lastFetched: string | null = null;

let _dataVersion = 0;
const _listeners = new Set<() => void>();

function notifyDataUpdate(): void {
  _dataVersion++;
  _listeners.forEach((l) => l());
}

export function subscribeToDataUpdates(callback: () => void): () => void {
  _listeners.add(callback);
  return () => { _listeners.delete(callback); };
}

export function getDataVersion(): number {
  return _dataVersion;
}

export function getApiStatus(): ApiStatus {
  return _apiStatus;
}

export function getApiError(): string | null {
  return _apiError;
}

export function getLastFetched(): string | null {
  return _lastFetched;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// PXWeb fetch helpers
// ---------------------------------------------------------------------------

interface PxWebColumn { code: string; text: string; type: string; }
interface PxWebDataRow { key: string[]; values: string[]; }
interface PxWebResponse {
  columns: PxWebColumn[];
  data: PxWebDataRow[];
  metadata?: { updated: string; label: string; source: string }[];
}

async function fetchPxWebTable(tableKey: 'cropArea' | 'yield'): Promise<PxWebResponse> {
  const table = PXWEB_TABLES[tableKey];
  const url = buildPxWebUrl(table.pathSegments);
  const body = {
    query: [
      { code: table.seasonDim,   selection: { filter: 'item', values: Object.keys(PXWEB_SEASON_MAP)   } },
      { code: table.districtDim, selection: { filter: 'item', values: Object.keys(PXWEB_DISTRICT_MAP) } },
      { code: table.cropDim,     selection: { filter: 'item', values: Object.keys(PXWEB_CROP_MAP)     } },
    ],
    response: { format: 'json' },
  };
  const resp = await fetchWithTimeout(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    API_TIMEOUT_MS,
  );
  if (!resp.ok) throw new Error(`NISR PXWeb returned ${resp.status} for ${tableKey}`);
  return (await resp.json()) as PxWebResponse;
}

function parsePxWebResponse(response: PxWebResponse, tableKey: 'cropArea' | 'yield'): Map<string, number> {
  const table = PXWEB_TABLES[tableKey];
  const cols = response.columns;
  const sIdx = Math.max(0, cols.findIndex((c) => c.code === table.seasonDim));
  const dIdx = Math.max(0, cols.findIndex((c) => c.code === table.districtDim)) || 1;
  const cIdx = Math.max(0, cols.findIndex((c) => c.code === table.cropDim)) || 2;
  const result = new Map<string, number>();
  for (const row of response.data) {
    const raw = row.values[0];
    if (!raw || raw === '..' || raw === '...') continue;
    const v = parseFloat(raw);
    if (isNaN(v)) continue;
    const season     = PXWEB_SEASON_MAP[row.key[sIdx]];
    const districtId = PXWEB_DISTRICT_MAP[row.key[dIdx]];
    const cropId     = PXWEB_CROP_MAP[row.key[cIdx]];
    if (!season || !districtId || !cropId) continue;
    result.set(`${season}|${districtId}|${cropId}`, v);
  }
  return result;
}

function combineAreaAndYield(
  areaMap: Map<string, number>,
  yieldMap: Map<string, number>,
): DataPoint[] {
  const points: DataPoint[] = [];
  for (const key of new Set([...areaMap.keys(), ...yieldMap.keys()])) {
    const [season, districtId, cropId] = key.split('|');
    const area = areaMap.get(key) ?? 0;
    const yieldKg = yieldMap.get(key) ?? 0;
    if (area === 0 || yieldKg === 0) continue;
    points.push({
      districtId,
      cropId,
      season: season as Season,
      year: PXWEB_DATA_YEAR,
      production: Math.round((area * yieldKg) / 1000),
      area: Math.round(area),
      yieldPerHa: Math.round((yieldKg / 1000) * 100) / 100,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// data.gov.rw helper (secondary)
// ---------------------------------------------------------------------------

export async function fetchDatagovDataset(datasetId: string, limit = 100): Promise<Record<string, unknown>[]> {
  const url = `${DATAGOV_BASE}/datasets/public/${datasetId}/download?format=json&page=1&limit=${limit}`;
  const resp = await fetchWithTimeout(url, { headers: { 'X-API-Key': DATAGOV_API_KEY } }, API_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`data.gov.rw returned ${resp.status}`);
  const json = (await resp.json()) as { data: Record<string, unknown>[] };
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Initialization — fetch from NISR, store result, no fallback
// ---------------------------------------------------------------------------

export async function initNisrConnection(): Promise<boolean> {
  _apiStatus = 'loading';
  _apiError = null;
  notifyDataUpdate();

  try {
    const [areaResp, yieldResp] = await Promise.all([
      fetchPxWebTable('cropArea'),
      fetchPxWebTable('yield'),
    ]);

    const areaMap  = parsePxWebResponse(areaResp,  'cropArea');
    const yieldMap = parsePxWebResponse(yieldResp, 'yield');
    const liveData = combineAreaAndYield(areaMap, yieldMap);

    if (liveData.length === 0) {
      throw new Error('NISR API returned empty data set');
    }

    setAllData(liveData);
    _apiStatus = 'connected';
    _lastFetched = new Date().toISOString();
    _apiError = null;
    notifyDataUpdate();
    return true;
  } catch (err) {
    _apiStatus = 'error';
    _apiError = err instanceof Error ? err.message : 'Unknown error';
    // Store remains empty — UI handles the empty state
    notifyDataUpdate();
    return false;
  }
}

/** Reload data from the NISR API (manual refresh). */
export async function refreshNisrData(): Promise<boolean> {
  return initNisrConnection();
}

export function isUsingMockData(): boolean {
  return false; // mock data no longer exists
}

// ---------------------------------------------------------------------------
// Data access — all return empty/zero when store is empty
// ---------------------------------------------------------------------------

export async function fetchAgricultureData(filters: Filters): Promise<DataPoint[]> {
  return getAllData().filter(
    (dp) => dp.cropId === filters.cropId && dp.season === filters.season && dp.year === filters.year,
  );
}

export async function fetchSummaryStats(filters: Filters): Promise<SummaryStats> {
  const filtered = await fetchAgricultureData(filters);
  const totalArea       = filtered.reduce((s, dp) => s + dp.area, 0);
  const totalProduction = filtered.reduce((s, dp) => s + dp.production, 0);
  const averageYield    = totalArea > 0 ? totalProduction / totalArea : 0;
  const cropCount       = new Set(filtered.map((dp) => dp.cropId)).size;

  // YoY: compare to same crop/season one year prior
  const prevData       = getAllData().filter(
    (dp) => dp.cropId === filters.cropId && dp.season === filters.season && dp.year === filters.year - 1,
  );
  const prevProduction = prevData.reduce((s, dp) => s + dp.production, 0);
  const yearChangePercent = prevProduction > 0
    ? ((totalProduction - prevProduction) / prevProduction) * 100
    : 0;

  return {
    totalArea:         Math.round(totalArea),
    totalProduction:   Math.round(totalProduction),
    averageYield:      Math.round(averageYield * 100) / 100,
    cropCount,
    yearChangePercent: Math.round(yearChangePercent * 10) / 10,
  };
}

export function getCropData(cropId: string): DataPoint[] {
  return getAllData().filter((dp) => dp.cropId === cropId);
}

export interface TrendPoint { year: string; production: number; area: number; yield: number; }

export function getProductionTrend(cropId: string, season: Season): TrendPoint[] {
  const data = getAllData();
  return years.map((year) => {
    const yd = data.filter((dp) => dp.cropId === cropId && dp.season === season && dp.year === year);
    const production = yd.reduce((s, dp) => s + dp.production, 0);
    const area       = yd.reduce((s, dp) => s + dp.area, 0);
    return {
      year: String(year),
      production: Math.round(production),
      area:        Math.round(area),
      yield: area > 0 ? Math.round((production / area) * 100) / 100 : 0,
    };
  });
}

export interface DistrictProduction { districtId: string; districtName: string; province: string; production: number; }

export function getTopDistricts(cropId: string, season: Season, year: number, limit = 10): DistrictProduction[] {
  const data = getAllData().filter(
    (dp) => dp.cropId === cropId && dp.season === season && dp.year === year,
  );
  const byDistrict = new Map<string, number>();
  for (const dp of data) byDistrict.set(dp.districtId, (byDistrict.get(dp.districtId) ?? 0) + dp.production);
  return Array.from(byDistrict.entries())
    .map(([id, production]) => {
      const d = getDistrictById(id);
      return { districtId: id, districtName: d?.name ?? id, province: d?.province ?? '', production: Math.round(production) };
    })
    .sort((a, b) => b.production - a.production)
    .slice(0, limit);
}

export interface CategoryShare { category: string; production: number; }

export function getCropShareByCategory(season: Season, year: number): CategoryShare[] {
  const data = getAllData().filter((dp) => dp.season === season && dp.year === year);
  const byCategory = new Map<string, number>();
  for (const dp of data) {
    const cat = getCropById(dp.cropId)?.category ?? 'Other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + dp.production);
  }
  return Array.from(byCategory.entries()).map(([category, production]) => ({ category, production: Math.round(production) }));
}
