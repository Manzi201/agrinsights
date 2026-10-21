import type { DataPoint, Filters, SummaryStats, Season } from '../types/agriculture';
import { getAllData, setAllData, agricultureData, years, getDistrictById, getCropById } from './agricultureData';
import {
  PXWEB_TABLES, buildPxWebUrl, PXWEB_DATA_YEAR,
  PXWEB_CROP_MAP, PXWEB_DISTRICT_MAP, PXWEB_SEASON_MAP,
  DATAGOV_BASE, DATAGOV_API_KEY,
} from '../config/api';

// ---------------------------------------------------------------------------
// NISR Data Service
//
// Fetches agricultural data from the NISR PXWeb API (pxweb.statistics.gov.rw)
// and the data.gov.rw open data portal. Falls back to local mock data when
// the APIs are unreachable.
// ---------------------------------------------------------------------------

const API_TIMEOUT_MS = 15000;
let _usingMockData = true;

// ---------------------------------------------------------------------------
// Reactivity — allows React components to re-render when the data store
// is updated (e.g. after PXWeb data loads)
// ---------------------------------------------------------------------------

let _dataVersion = 0;
const _listeners = new Set<() => void>();

function notifyDataUpdate(): void {
  _dataVersion++;
  _listeners.forEach((l) => l());
}

export function subscribeToDataUpdates(callback: () => void): () => void {
  _listeners.add(callback);
  return () => {
    _listeners.delete(callback);
  };
}

export function getDataVersion(): number {
  return _dataVersion;
}

// ---------------------------------------------------------------------------
// PXWeb API types
// ---------------------------------------------------------------------------

interface PxWebColumn {
  code: string;
  text: string;
  type: string;
}

interface PxWebDataRow {
  key: string[];
  values: string[];
}

interface PxWebResponse {
  columns: PxWebColumn[];
  data: PxWebDataRow[];
  metadata?: { updated: string; label: string; source: string }[];
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// PXWeb API — fetch crop area and yield tables
// ---------------------------------------------------------------------------

async function fetchPxWebTable(tableKey: 'cropArea' | 'yield'): Promise<PxWebResponse> {
  const table = PXWEB_TABLES[tableKey];
  const url = buildPxWebUrl(table.pathSegments);

  const body = {
    query: [
      { code: table.seasonDim, selection: { filter: 'item', values: Object.keys(PXWEB_SEASON_MAP) } },
      { code: table.districtDim, selection: { filter: 'item', values: Object.keys(PXWEB_DISTRICT_MAP) } },
      { code: table.cropDim, selection: { filter: 'item', values: Object.keys(PXWEB_CROP_MAP) } },
    ],
    response: { format: 'json' },
  };

  const resp = await fetchWithTimeout(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    API_TIMEOUT_MS,
  );

  if (!resp.ok) throw new Error(`PXWeb API error: ${resp.status}`);
  return (await resp.json()) as PxWebResponse;
}

/**
 * Parse a PXWeb response into a Map keyed by "season|districtId|cropId".
 * The value is converted via the provided converter function.
 */
function parsePxWebResponse(response: PxWebResponse, tableKey: 'cropArea' | 'yield'): Map<string, number> {
  const table = PXWEB_TABLES[tableKey];
  const columns = response.columns;

  // Find dimension indices by column code
  const seasonIdx = columns.findIndex((c) => c.code === table.seasonDim);
  const districtIdx = columns.findIndex((c) => c.code === table.districtDim);
  const cropIdx = columns.findIndex((c) => c.code === table.cropDim);

  // Fall back to positional if codes don't match
  const sIdx = seasonIdx >= 0 ? seasonIdx : 0;
  const dIdx = districtIdx >= 0 ? districtIdx : 1;
  const cIdx = cropIdx >= 0 ? cropIdx : 2;

  const result = new Map<string, number>();

  for (const row of response.data) {
    const seasonCode = row.key[sIdx];
    const districtCode = row.key[dIdx];
    const cropCode = row.key[cIdx];
    const rawValue = row.values[0];

    // Skip missing data
    if (rawValue === '..' || rawValue === '...' || rawValue === '' || rawValue === null) continue;

    const season = PXWEB_SEASON_MAP[seasonCode];
    const districtId = PXWEB_DISTRICT_MAP[districtCode];
    const cropId = PXWEB_CROP_MAP[cropCode];

    if (!season || !districtId || !cropId) continue;

    const value = parseFloat(rawValue);
    if (isNaN(value)) continue;

    const key = `${season}|${districtId}|${cropId}`;
    result.set(key, value);
  }

  return result;
}

/**
 * Combine area (ha) and yield (Kg/ha) data to produce DataPoints.
 * Production (tons) = Area (ha) × Yield (Kg/ha) / 1000.
 */
function combineAreaAndYield(
  areaMap: Map<string, number>,
  yieldMap: Map<string, number>,
): DataPoint[] {
  const points: DataPoint[] = [];
  const allKeys = new Set([...areaMap.keys(), ...yieldMap.keys()]);

  for (const key of allKeys) {
    const [season, districtId, cropId] = key.split('|');
    const area = areaMap.get(key) ?? 0;
    const yieldKgPerHa = yieldMap.get(key) ?? 0;

    if (area === 0 || yieldKgPerHa === 0) continue;

    const yieldPerHa = Math.round((yieldKgPerHa / 1000) * 100) / 100; // Kg/ha → t/ha
    const production = Math.round((area * yieldKgPerHa) / 1000); // tons

    points.push({
      districtId,
      cropId,
      season: season as Season,
      year: PXWEB_DATA_YEAR,
      production,
      area: Math.round(area),
      yieldPerHa,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// data.gov.rw API (secondary — for future use)
// ---------------------------------------------------------------------------

export async function fetchDatagovDataset(datasetId: string, limit = 100): Promise<Record<string, unknown>[]> {
  const url = `${DATAGOV_BASE}/datasets/public/${datasetId}/download?format=json&page=1&limit=${limit}`;
  const resp = await fetchWithTimeout(
    url,
    { headers: { 'X-API-Key': DATAGOV_API_KEY } },
    API_TIMEOUT_MS,
  );
  if (!resp.ok) throw new Error(`data.gov.rw API error: ${resp.status}`);
  const json = (await resp.json()) as { data: Record<string, unknown>[] };
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch real agricultural data from the NISR PXWeb API.
 * On success, replaces the mock data store with combined real + mock data.
 * On failure, keeps the mock data.
 * Call this once on app start.
 */
export async function initNisrConnection(): Promise<boolean> {
  try {
    const [areaResp, yieldResp] = await Promise.all([
      fetchPxWebTable('cropArea'),
      fetchPxWebTable('yield'),
    ]);

    const areaMap = parsePxWebResponse(areaResp, 'cropArea');
    const yieldMap = parsePxWebResponse(yieldResp, 'yield');

    const realData = combineAreaAndYield(areaMap, yieldMap);

    if (realData.length === 0) throw new Error('No data received from PXWeb');

    // Combine: real PXWeb data for 2023 + mock data for other years
    const mockOtherYears = agricultureData.filter((dp) => dp.year !== PXWEB_DATA_YEAR);
    const combined = [...mockOtherYears, ...realData];

    setAllData(combined);
    _usingMockData = false;
    notifyDataUpdate();
    return true;
  } catch {
    // API unreachable — continue with mock data
    _usingMockData = true;
    return false;
  }
}

export function isUsingMockData(): boolean {
  return _usingMockData;
}

// ---------------------------------------------------------------------------
// Data access functions
// ---------------------------------------------------------------------------

/**
 * Returns all agricultural data points for the given filters.
 */
export async function fetchAgricultureData(filters: Filters): Promise<DataPoint[]> {
  const data = getAllData();
  return data.filter(
    (dp) =>
      dp.cropId === filters.cropId &&
      dp.season === filters.season &&
      dp.year === filters.year,
  );
}

/**
 * Returns summary stats for the given filters.
 */
export async function fetchSummaryStats(filters: Filters): Promise<SummaryStats> {
  const data = getAllData();

  const filtered = data.filter(
    (dp) =>
      dp.cropId === filters.cropId &&
      dp.season === filters.season &&
      dp.year === filters.year,
  );

  const totalArea = filtered.reduce((sum, dp) => sum + dp.area, 0);
  const totalProduction = filtered.reduce((sum, dp) => sum + dp.production, 0);
  const averageYield = totalArea > 0 ? totalProduction / totalArea : 0;
  const cropCount = new Set(filtered.map((dp) => dp.cropId)).size;

  // Year-over-year change
  const prevData = data.filter(
    (dp) =>
      dp.cropId === filters.cropId &&
      dp.season === filters.season &&
      dp.year === filters.year - 1,
  );
  const prevProduction = prevData.reduce((sum, dp) => sum + dp.production, 0);
  const yearChangePercent =
    prevProduction > 0 ? ((totalProduction - prevProduction) / prevProduction) * 100 : 0;

  return {
    totalArea: Math.round(totalArea),
    totalProduction: Math.round(totalProduction),
    averageYield: Math.round(averageYield * 100) / 100,
    cropCount,
    yearChangePercent: Math.round(yearChangePercent * 10) / 10,
  };
}

/**
 * Get all data for a specific crop across all districts, seasons, and years.
 */
export function getCropData(cropId: string): DataPoint[] {
  return getAllData().filter((dp) => dp.cropId === cropId);
}

export interface TrendPoint {
  year: string;
  production: number;
  area: number;
  yield: number;
}

/**
 * Production trend for a crop across years (for a given season, all districts aggregated).
 */
export function getProductionTrend(cropId: string, season: Season): TrendPoint[] {
  const data = getAllData();
  return years.map((year) => {
    const yearData = data.filter(
      (dp) => dp.cropId === cropId && dp.season === season && dp.year === year,
    );
    const production = yearData.reduce((sum, dp) => sum + dp.production, 0);
    const area = yearData.reduce((sum, dp) => sum + dp.area, 0);
    return {
      year: String(year),
      production: Math.round(production),
      area: Math.round(area),
      yield: area > 0 ? Math.round((production / area) * 100) / 100 : 0,
    };
  });
}

export interface DistrictProduction {
  districtId: string;
  districtName: string;
  province: string;
  production: number;
}

/**
 * Top districts by production for a given crop, season, and year.
 */
export function getTopDistricts(
  cropId: string,
  season: Season,
  year: number,
  limit = 10,
): DistrictProduction[] {
  const data = getAllData();
  const filtered = data.filter(
    (dp) => dp.cropId === cropId && dp.season === season && dp.year === year,
  );

  const byDistrict = new Map<string, number>();
  for (const dp of filtered) {
    byDistrict.set(dp.districtId, (byDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  return Array.from(byDistrict.entries())
    .map(([districtId, production]) => {
      const district = getDistrictById(districtId);
      return {
        districtId,
        districtName: district?.name ?? districtId,
        province: district?.province ?? '',
        production: Math.round(production),
      };
    })
    .sort((a, b) => b.production - a.production)
    .slice(0, limit);
}

export interface CategoryShare {
  category: string;
  production: number;
}

/**
 * Production share by crop category for a given season and year.
 */
export function getCropShareByCategory(season: Season, year: number): CategoryShare[] {
  const data = getAllData();
  const filtered = data.filter((dp) => dp.season === season && dp.year === year);

  const byCategory = new Map<string, number>();
  for (const dp of filtered) {
    const crop = getCropById(dp.cropId);
    const category = crop?.category ?? 'Other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + dp.production);
  }

  return Array.from(byCategory.entries()).map(([category, production]) => ({
    category,
    production: Math.round(production),
  }));
}
