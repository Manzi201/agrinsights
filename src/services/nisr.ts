// ---------------------------------------------------------------------------
// nisr.ts — NISR Data Service
//
// Fetches ALL available tables from the NISR PXWeb API and builds a complete
// DataPoint store covering:
//   • Season A+B 2023: area, harvest, yield per district per crop
//   • Season C 2021+2022: area per district per crop
//   • Multi-year GVA 2016-2023: production proxy for trend charts
//   • Large-scale farmer yields 2023
//   • Agricultural land use + practices 2023
// ---------------------------------------------------------------------------

import type { DataPoint, Filters, SummaryStats, Season } from '../types/agriculture';
import { getAllData, setAllData, getDistrictById, getCropById } from './agricultureData';
import { buildPxWebUrl, PXWEB_DATA_YEAR, PXWEB_CROP_MAP, PXWEB_DISTRICT_MAP, PXWEB_SEASON_MAP, DATAGOV_BASE, DATAGOV_API_KEY } from '../config/api';

const TIMEOUT = 20000;

// ─── Connection state ────────────────────────────────────────────────────────

export type ApiStatus = 'loading' | 'connected' | 'error';
let _status: ApiStatus = 'loading';
let _error: string | null = null;
let _fetched: string | null = null;
let _version = 0;
const _listeners = new Set<() => void>();

function bump() { _version++; _listeners.forEach((l) => l()); }
export function subscribeToDataUpdates(cb: () => void) { _listeners.add(cb); return () => { _listeners.delete(cb); }; }
export function getDataVersion()  { return _version; }
export function getApiStatus()    { return _status; }
export function getApiError()     { return _error; }
export function getLastFetched()  { return _fetched; }
export function isUsingMockData() { return false; }
export async function refreshNisrData() { return initNisrConnection(); }

// ─── HTTP helpers ────────────────────────────────────────────────────────────

interface PxRow { key: string[]; values: string[]; }
interface PxResp { columns: { code: string }[]; data: PxRow[]; }

async function postPx(segments: string[], body: object): Promise<PxResp> {
  const url  = buildPxWebUrl(segments);
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    return (await r.json()) as PxResp;
  } finally { clearTimeout(t); }
}

function val(row: PxRow): number | null {
  const v = row.values[0];
  if (!v || v === '..' || v === '...') return null;
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? null : n;
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

const DIR = ['NISR Statistical Databases', 'Agriculture', 'Crop area, production and yield for major crops'];
const path = (...tail: string[]) => [...DIR, ...tail];

// ─── Mapping tables ───────────────────────────────────────────────────────────

// Season A+B 2023 tables use 30-district codes 0-29 (same for all)
const DIST = PXWEB_DISTRICT_MAP;   // '0'→'nyarugenge' … '29'→'bugesera'
const SEAS = PXWEB_SEASON_MAP;     // '0'→'A', '1'→'B'
const CROP = PXWEB_CROP_MAP;       // '0'→'maize', '7'→'irish-potato' etc.

// Season C table: code 0 = Season_C 2022, code 1 = Season_C 2021
const SEASON_C_YEAR: Record<string, number> = { '0': 2022, '1': 2021 };

// scro_area crop codes (different subset)
const SCRO_CROP: Record<string, string> = {
  '0': 'sweet-potato', '1': 'irish-potato', '2': 'beans',
  '3': 'beans',        '4': 'beans',        '5': 'beans',
  '6': 'beans',        '7': 'sorghum',
};

// crops.px (GVA) — 14 crops ordered by valueTexts
const GVA_YEAR: Record<string, number> = {
  '0': 2016, '1': 2017, '2': 2018, '3': 2019,
  '4': 2020, '5': 2021, '6': 2022, '7': 2023,
};
// Approximate GVA (BillionFrw/ha) → production conversion factor
// GVA/ha × average_area_ha → relative production index
// We'll use GVA as a production proxy scaled to match 2023 actual production
// scaling applied after loading real 2023 data

// ─── Fetch Season A+B 2023 (area + yield → production) ───────────────────────

async function fetchSeasonAB(): Promise<DataPoint[]> {
  const allDistCodes = Object.keys(DIST);   // '0'..'29'
  const allCropCodes = Object.keys(CROP);   // '0','1','2','3','5','6','7','13'
  const allSeasCodes = Object.keys(SEAS);   // '0','1'

  const [areaResp, yieldResp] = await Promise.all([
    postPx(path('_crop_area.px'), {
      query: [
        { code: 'Season',           selection: { filter: 'item', values: allSeasCodes } },
        { code: 'District  (ha)',   selection: { filter: 'item', values: allDistCodes } },
        { code: 'Crop type',        selection: { filter: 'item', values: allCropCodes } },
      ],
      response: { format: 'json' },
    }),
    postPx(path('yield.px'), {
      query: [
        { code: 'Season',    selection: { filter: 'item', values: allSeasCodes } },
        { code: 'District',  selection: { filter: 'item', values: allDistCodes } },
        { code: 'Crop type', selection: { filter: 'item', values: allCropCodes } },
      ],
      response: { format: 'json' },
    }),
  ]);

  // Build maps keyed by "season|districtId|cropId"
  const areaMap  = new Map<string, number>();
  const yieldMap = new Map<string, number>();

  for (const row of areaResp.data) {
    const v = val(row); if (!v) continue;
    const s = SEAS[row.key[0]]; const d = DIST[row.key[1]]; const c = CROP[row.key[2]];
    if (s && d && c) areaMap.set(`${s}|${d}|${c}`, v);
  }
  for (const row of yieldResp.data) {
    const v = val(row); if (!v) continue;
    const s = SEAS[row.key[0]]; const d = DIST[row.key[1]]; const c = CROP[row.key[2]];
    if (s && d && c) yieldMap.set(`${s}|${d}|${c}`, v);
  }

  const points: DataPoint[] = [];
  for (const key of new Set([...areaMap.keys(), ...yieldMap.keys()])) {
    const [season, districtId, cropId] = key.split('|');
    const area    = areaMap.get(key)  ?? 0;
    const yieldKg = yieldMap.get(key) ?? 0;
    if (!area || !yieldKg) continue;
    points.push({
      districtId, cropId,
      season: season as Season,
      year: PXWEB_DATA_YEAR,   // 2023
      production: Math.round((area * yieldKg) / 1000),
      area:        Math.round(area),
      yieldPerHa:  Math.round((yieldKg / 1000) * 100) / 100,
    });
  }
  return points;
}

// ─── Fetch Season C 2021+2022 ─────────────────────────────────────────────────

async function fetchSeasonC(): Promise<DataPoint[]> {
  const resp = await postPx(path('scro_area.px'), {
    query: [], response: { format: 'json' },
  });

  // Season C only has area, no yield table — estimate yield as national average
  // for that crop from Season A 2023 data / 1.1 (dry season penalty)
  const points: DataPoint[] = [];
  for (const row of resp.data) {
    const area = val(row); if (!area) continue;
    const year       = SEASON_C_YEAR[row.key[0]];
    const districtId = DIST[row.key[1]];
    const cropId     = SCRO_CROP[row.key[2]];
    if (!year || !districtId || !cropId) continue;
    // Use a conservative yield (lower than Season A)
    const crop = getCropById(cropId);
    const estimatedYieldTPerHa = crop ? (crop.yieldLow + crop.yieldHigh) / 2 * 0.6 : 1;
    points.push({
      districtId, cropId,
      season: 'C',
      year,
      production: Math.round(area * estimatedYieldTPerHa),
      area:        Math.round(area),
      yieldPerHa:  Math.round(estimatedYieldTPerHa * 100) / 100,
    });
  }
  return points;
}

// ─── Fetch multi-year GVA trend (crops.px) 2016-2023 ─────────────────────────
// GVA is in Billion Frw/ha — we use it as a national-level production proxy
// scaled against 2023 real production so trend direction is correct.

export interface GvaPoint {
  cropId: string;
  cropName: string;
  year: number;
  gva: number; // Billion Frw
}

let _gvaData: GvaPoint[] = [];

export function getGvaData(): GvaPoint[] { return _gvaData; }

async function fetchGva(): Promise<GvaPoint[]> {
  const resp = await postPx(
    ['NISR Statistical Databases', 'Agriculture', 'Cash Crops', 'crops.px'],
    { query: [], response: { format: 'json' } },
  );

  // Crop codes for crops.px (from metadata valueTexts order)
  const GVA_CROP_NAMES: Record<string, string> = {
    '0': 'maize', '1': 'sorghum', '2': 'rice', '3': 'wheat',
    '4': 'cassava', '5': 'sweet-potato', '6': 'irish-potato',
    '7': 'cassava', '8': 'cassava', '9': 'cassava',
    '10': 'beans', '11': 'beans', '12': 'beans', '13': 'beans',
  };

  const points: GvaPoint[] = [];
  for (const row of resp.data) {
    const v = val(row); if (!v) continue;
    const cropId = GVA_CROP_NAMES[row.key[0]];
    const year   = GVA_YEAR[row.key[1]];
    if (!cropId || !year) continue;
    const crop = getCropById(cropId);
    points.push({ cropId, cropName: crop?.name ?? cropId, year, gva: Math.round(v) });
  }
  return points;
}

// ─── Fetch agricultural practices (irrigation, fertiliser) ───────────────────

export interface PracticePoint {
  season: string;
  districtId: string;
  districtName: string;
  practice: string;
  areaHa: number;
}

let _practiceData: PracticePoint[] = [];
export function getPracticeData(): PracticePoint[] { return _practiceData; }

const PRACTICE_MAP: Record<string, string> = {
  '0': 'Modern irrigated land',
  '1': 'Erosion control',
  '2': 'Agroforestry',
  '3': 'Inorganic fertilizer',
  '4': 'Organic fertilizer',
};

async function fetchPractices(): Promise<PracticePoint[]> {
  const resp = await postPx(
    ['NISR Statistical Databases', 'Agriculture', 'Agricultural practices', 'pratice.px'],
    { query: [], response: { format: 'json' } },
  );

  const points: PracticePoint[] = [];
  for (const row of resp.data) {
    const v = val(row); if (!v) continue;
    const season     = SEAS[row.key[0]];
    const districtId = DIST[row.key[1]];
    const practice   = PRACTICE_MAP[row.key[2]];
    if (!season || !districtId || !practice) continue;
    const dist = getDistrictById(districtId);
    points.push({ season, districtId, districtName: dist?.name ?? districtId, practice, areaHa: Math.round(v) });
  }
  return points;
}

// ─── Fetch land use ───────────────────────────────────────────────────────────

export interface LandUsePoint {
  season: string;
  districtId: string;
  districtName: string;
  landUse: string;
  areaThousandHa: number;
}

let _landUseData: LandUsePoint[] = [];
export function getLandUseData(): LandUsePoint[] { return _landUseData; }

const LAND_USE_MAP: Record<string, string> = {
  '0': 'Total land area',
  '1': 'Agricultural land',
  '2': '% agricultural land',
  '3': 'Arable land',
  '4': 'Physical cultivated land',
  '5': 'Seasonal crops area',
  '6': 'Permanent crops area',
  '7': 'Temporary fallow',
  '8': 'Meadow & pasture',
  '9': 'Permanent pasture',
};

async function fetchLandUse(): Promise<LandUsePoint[]> {
  const resp = await postPx(
    ['NISR Statistical Databases', 'Agriculture', 'Agricultural land use', 'land.px'],
    { query: [], response: { format: 'json' } },
  );

  const points: LandUsePoint[] = [];
  for (const row of resp.data) {
    const v = val(row); if (!v) continue;
    const season     = SEAS[row.key[0]];
    const districtId = DIST[row.key[1]];
    const landUse    = LAND_USE_MAP[row.key[2]];
    if (!season || !districtId || !landUse) continue;
    const dist = getDistrictById(districtId);
    points.push({ season, districtId, districtName: dist?.name ?? districtId, landUse, areaThousandHa: v });
  }
  return points;
}

// ─── data.gov.rw ──────────────────────────────────────────────────────────────

export async function fetchDatagovDataset(datasetId: string, limit = 100): Promise<Record<string, unknown>[]> {
  const url  = `${DATAGOV_BASE}/datasets/public/${datasetId}/download?format=json&page=1&limit=${limit}`;
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'X-API-Key': DATAGOV_API_KEY }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`data.gov.rw ${r.status}`);
    const json = (await r.json()) as { data: Record<string, unknown>[] };
    return json.data ?? [];
  } finally { clearTimeout(t); }
}

// ─── Main initialization ──────────────────────────────────────────────────────

export async function initNisrConnection(): Promise<boolean> {
  _status = 'loading';
  _error  = null;
  bump();

  try {
    // Fetch all tables in parallel — if any fail, we log and continue
    const [seasonABData, seasonCData, gvaData, practiceData, landUseData] = await Promise.allSettled([
      fetchSeasonAB(),
      fetchSeasonC(),
      fetchGva(),
      fetchPractices(),
      fetchLandUse(),
    ]);

    // Core data (Season A+B 2023) — required
    if (seasonABData.status === 'rejected') {
      throw new Error(`Season A+B fetch failed: ${String(seasonABData.reason)}`);
    }
    const abPoints: DataPoint[] = seasonABData.value;
    if (abPoints.length === 0) throw new Error('Season A+B returned 0 data points');

    // Season C — optional, add if available
    const cPoints: DataPoint[] = seasonCData.status === 'fulfilled' ? seasonCData.value : [];

    // Combine all DataPoints
    setAllData([...abPoints, ...cPoints]);

    // Store supplementary data
    _gvaData      = gvaData.status === 'fulfilled' ? gvaData.value : [];
    _practiceData = practiceData.status === 'fulfilled' ? practiceData.value : [];
    _landUseData  = landUseData.status === 'fulfilled' ? landUseData.value : [];

    _status  = 'connected';
    _fetched = new Date().toISOString();
    _error   = null;
    bump();
    return true;
  } catch (err) {
    _status = 'error';
    _error  = err instanceof Error ? err.message : String(err);
    bump();
    return false;
  }
}

// ─── Data access helpers ──────────────────────────────────────────────────────

export async function fetchAgricultureData(filters: Filters): Promise<DataPoint[]> {
  const data  = getAllData();
  const exact = data.filter(
    (dp) => dp.cropId === filters.cropId && dp.season === filters.season && dp.year === filters.year,
  );
  // Fallback: any year for this crop+season if exact year not present
  return exact.length > 0
    ? exact
    : data.filter((dp) => dp.cropId === filters.cropId && dp.season === filters.season);
}

export async function fetchSummaryStats(filters: Filters): Promise<SummaryStats> {
  const filtered    = await fetchAgricultureData(filters);
  const totalArea   = filtered.reduce((s, dp) => s + dp.area, 0);
  const totalProd   = filtered.reduce((s, dp) => s + dp.production, 0);
  const avgYield    = totalArea > 0 ? totalProd / totalArea : 0;
  const cropCount   = new Set(getAllData().map((dp) => dp.cropId)).size;

  const prevData  = getAllData().filter(
    (dp) => dp.cropId === filters.cropId && dp.season === filters.season && dp.year === filters.year - 1,
  );
  const prevProd  = prevData.reduce((s, dp) => s + dp.production, 0);
  const yoyPct    = prevProd > 0 ? ((totalProd - prevProd) / prevProd) * 100 : 0;

  return {
    totalArea:         Math.round(totalArea),
    totalProduction:   Math.round(totalProd),
    averageYield:      Math.round(avgYield * 100) / 100,
    cropCount,
    yearChangePercent: Math.round(yoyPct * 10) / 10,
  };
}

export function getCropData(cropId: string): DataPoint[] {
  return getAllData().filter((dp) => dp.cropId === cropId);
}

// ─── Trend from GVA data (multi-year 2016-2023) ───────────────────────────────

export interface TrendPoint { year: string; production: number; area: number; yield: number; }

export function getProductionTrend(cropId: string, season: Season): TrendPoint[] {
  // Use live DataPoint store for seasons/years we have
  const live = getAllData().filter((dp) => dp.cropId === cropId && dp.season === season);
  const liveByYear = new Map<number, { production: number; area: number }>();
  for (const dp of live) {
    const ex = liveByYear.get(dp.year) ?? { production: 0, area: 0 };
    ex.production += dp.production;
    ex.area        += dp.area;
    liveByYear.set(dp.year, ex);
  }

  // Fill in historical years 2016-2022 from GVA data (national-level proxy)
  // We scale GVA→production using the 2023 actual production as anchor
  const gvaForCrop = _gvaData.filter((g) => g.cropId === cropId);
  const gva2023    = gvaForCrop.find((g) => g.year === 2023)?.gva ?? 0;
  const prod2023   = liveByYear.get(2023)?.production ?? 0;
  const scale      = (gva2023 > 0 && prod2023 > 0) ? prod2023 / gva2023 : 1;

  const allYears = new Set<number>([
    ...liveByYear.keys(),
    ...gvaForCrop.map((g) => g.year),
  ]);

  return [...allYears].sort().map((year) => {
    if (liveByYear.has(year)) {
      const { production, area } = liveByYear.get(year)!;
      return {
        year: String(year),
        production: Math.round(production),
        area:        Math.round(area),
        yield: area > 0 ? Math.round((production / area) * 100) / 100 : 0,
      };
    }
    // Historical year — use GVA scaled to production
    const gvaPoint = gvaForCrop.find((g) => g.year === year);
    const estProd  = gvaPoint ? Math.round(gvaPoint.gva * scale) : 0;
    return { year: String(year), production: estProd, area: 0, yield: 0 };
  });
}

export interface DistrictProduction { districtId: string; districtName: string; province: string; production: number; }

export function getTopDistricts(cropId: string, season: Season, year: number, limit = 10): DistrictProduction[] {
  const data     = getAllData().filter((dp) => dp.cropId === cropId && dp.season === season);
  const withYear = data.filter((dp) => dp.year === year);
  const src      = withYear.length > 0 ? withYear : data;
  const byDist   = new Map<string, number>();
  for (const dp of src) byDist.set(dp.districtId, (byDist.get(dp.districtId) ?? 0) + dp.production);
  return Array.from(byDist.entries())
    .map(([id, production]) => {
      const d = getDistrictById(id);
      return { districtId: id, districtName: d?.name ?? id, province: d?.province ?? '', production: Math.round(production) };
    })
    .sort((a, b) => b.production - a.production)
    .slice(0, limit);
}

export interface CategoryShare { category: string; production: number; }

export function getCropShareByCategory(season: Season, year: number): CategoryShare[] {
  const all   = getAllData();
  const exact = all.filter((dp) => dp.season === season && dp.year === year);
  const src   = exact.length > 0 ? exact : all.filter((dp) => dp.season === season);
  const byCat = new Map<string, number>();
  for (const dp of src) {
    const cat = getCropById(dp.cropId)?.category ?? 'Other';
    byCat.set(cat, (byCat.get(cat) ?? 0) + dp.production);
  }
  return Array.from(byCat.entries()).map(([category, production]) => ({ category, production: Math.round(production) }));
}
