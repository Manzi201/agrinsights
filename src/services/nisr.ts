// ---------------------------------------------------------------------------
// nisr.ts — NISR Data Service
//
// Fetches ALL available tables from the NISR PXWeb API sequentially
// to avoid 429 rate-limiting. Core Season A+B data loads first so the
// Dashboard renders immediately; supplementary tables follow with delays.
// ---------------------------------------------------------------------------

import type { DataPoint, Filters, SummaryStats, Season } from '../types/agriculture';
import { getAllData, setAllData, getDistrictById, getCropById } from './agricultureData';
import {
  buildPxWebUrl, PXWEB_DATA_YEAR,
  PXWEB_CROP_MAP, PXWEB_DISTRICT_MAP, PXWEB_SEASON_MAP,
  DATAGOV_BASE, DATAGOV_API_KEY,
} from '../config/api';

const TIMEOUT = 20000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Connection state ─────────────────────────────────────────────────────────

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

// ─── HTTP helper ──────────────────────────────────────────────────────────────

interface PxRow  { key: string[]; values: string[]; }
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
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return (await r.json()) as PxResp;
  } finally { clearTimeout(t); }
}

function numVal(row: PxRow): number | null {
  const v = row.values[0];
  if (!v || v === '..' || v === '...') return null;
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? null : n;
}

// ─── Static path helpers ──────────────────────────────────────────────────────

const CROP_DIR  = ['NISR Statistical Databases', 'Agriculture', 'Crop area, production and yield for major crops'];
const CASH_DIR  = ['NISR Statistical Databases', 'Agriculture', 'Cash Crops'];
const LAND_DIR  = ['NISR Statistical Databases', 'Agriculture', 'Agricultural land use'];
const PRAC_DIR  = ['NISR Statistical Databases', 'Agriculture', 'Agricultural practices'];
const crop = (...f: string[]) => [...CROP_DIR, ...f];

// ─── Mapping tables ───────────────────────────────────────────────────────────

const DIST = PXWEB_DISTRICT_MAP;   // '0'→'nyarugenge' … '29'→'bugesera'
const SEAS = PXWEB_SEASON_MAP;     // '0'→'A', '1'→'B'
const CROP_MAP = PXWEB_CROP_MAP;   // '0'→'maize', '7'→'irish-potato' etc.

// Season C year codes
const SEASON_C_YEAR: Record<string, number> = { '0': 2022, '1': 2021 };

// scro_area.px crop codes (Season C subset)
const SCRO_CROP: Record<string, string> = {
  '0': 'sweet-potato', '1': 'irish-potato',
  '2': 'beans', '3': 'beans', '4': 'beans', '5': 'beans', '6': 'beans',
  '7': 'sorghum',
};

// crops.px (GVA) crop codes
const GVA_CROP_MAP: Record<string, string> = {
  '0': 'maize', '1': 'sorghum', '2': 'rice', '3': 'wheat',
  '4': 'cassava', '5': 'sweet-potato', '6': 'irish-potato',
  '7': 'cassava', '8': 'cassava', '9': 'cassava',
  '10': 'beans', '11': 'beans', '12': 'beans', '13': 'beans',
};
const GVA_YEAR: Record<string, number> = {
  '0': 2016, '1': 2017, '2': 2018, '3': 2019,
  '4': 2020, '5': 2021, '6': 2022, '7': 2023,
};

// Agricultural practices
const PRACTICE_MAP: Record<string, string> = {
  '0': 'Modern irrigated land', '1': 'Erosion control',
  '2': 'Agroforestry', '3': 'Inorganic fertilizer', '4': 'Organic fertilizer',
};

// Land use
const LAND_USE_MAP: Record<string, string> = {
  '0': 'Total land area', '1': 'Agricultural land', '2': '% agricultural land',
  '3': 'Arable land', '4': 'Physical cultivated land', '5': 'Seasonal crops area',
  '6': 'Permanent crops area', '7': 'Temporary fallow',
  '8': 'Meadow & pasture', '9': 'Permanent pasture',
};

// ─── Supplementary data stores ────────────────────────────────────────────────

export interface GvaPoint        { cropId: string; cropName: string; year: number; gva: number; }
export interface PracticePoint   { season: string; districtId: string; districtName: string; practice: string; areaHa: number; }
export interface LandUsePoint    { season: string; districtId: string; districtName: string; landUse: string; areaThousandHa: number; }
export interface HarvestPoint    { season: string; districtId: string; districtName: string; cropId: string; cropName: string; harvestedHa: number; cultivatedHa: number; harvestRatio: number; }
export interface LargeScaleYield { season: string; districtId: string; districtName: string; cropId: string; cropName: string; yieldKgPerHa: number; }
export interface CashAreaPoint   { category: string; crop: 'Coffee' | 'Tea'; isActive: boolean; year: number; areaThousandHa: number | null; }
export interface CashProdPoint   { crop: 'Coffee' | 'Tea'; year: number; productionTons: number; }

let _gvaData:        GvaPoint[]        = [];
let _practiceData:   PracticePoint[]   = [];
let _landUseData:    LandUsePoint[]    = [];
let _harvestData:    HarvestPoint[]    = [];
let _largeScaleData: LargeScaleYield[] = [];
let _cashAreaData:   CashAreaPoint[]   = [];
let _cashProdData:   CashProdPoint[]   = [];

export function getGvaData():        GvaPoint[]        { return _gvaData; }
export function getPracticeData():   PracticePoint[]   { return _practiceData; }
export function getLandUseData():    LandUsePoint[]    { return _landUseData; }
export function getHarvestData():    HarvestPoint[]    { return _harvestData; }
export function getLargeScaleData(): LargeScaleYield[] { return _largeScaleData; }
export function getCashAreaData():   CashAreaPoint[]   { return _cashAreaData; }
export function getCashProdData():   CashProdPoint[]   { return _cashProdData; }

// ─── Table fetchers ───────────────────────────────────────────────────────────

const allDistCodes = Object.keys(DIST);
const allCropCodes = Object.keys(CROP_MAP);
const allSeasCodes = Object.keys(SEAS);

async function fetchCultivatedArea(): Promise<PxResp> {
  return postPx(crop('_crop_area.px'), {
    query: [
      { code: 'Season',         selection: { filter: 'item', values: allSeasCodes } },
      { code: 'District  (ha)', selection: { filter: 'item', values: allDistCodes } },
      { code: 'Crop type',      selection: { filter: 'item', values: allCropCodes } },
    ],
    response: { format: 'json' },
  });
}

async function fetchYield(): Promise<PxResp> {
  return postPx(crop('yield.px'), {
    query: [
      { code: 'Season',    selection: { filter: 'item', values: allSeasCodes } },
      { code: 'District',  selection: { filter: 'item', values: allDistCodes } },
      { code: 'Crop type', selection: { filter: 'item', values: allCropCodes } },
    ],
    response: { format: 'json' },
  });
}

function combineAreaYield(areaResp: PxResp, yieldResp: PxResp): DataPoint[] {
  const areaMap  = new Map<string, number>();
  const yieldMap = new Map<string, number>();

  for (const row of areaResp.data) {
    const v = numVal(row); if (!v) continue;
    const s = SEAS[row.key[0]], d = DIST[row.key[1]], c = CROP_MAP[row.key[2]];
    if (s && d && c) areaMap.set(`${s}|${d}|${c}`, v);
  }
  for (const row of yieldResp.data) {
    const v = numVal(row); if (!v) continue;
    const s = SEAS[row.key[0]], d = DIST[row.key[1]], c = CROP_MAP[row.key[2]];
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
      year:       PXWEB_DATA_YEAR,
      production: Math.round((area * yieldKg) / 1000),
      area:        Math.round(area),
      yieldPerHa:  Math.round((yieldKg / 1000) * 100) / 100,
    });
  }
  return points;
}

async function fetchSeasonC(): Promise<DataPoint[]> {
  const resp = await postPx(crop('scro_area.px'), { query: [], response: { format: 'json' } });
  const pts: DataPoint[] = [];
  for (const row of resp.data) {
    const area = numVal(row); if (!area) continue;
    const year       = SEASON_C_YEAR[row.key[0]];
    const districtId = DIST[row.key[1]];
    const cropId     = SCRO_CROP[row.key[2]];
    if (!year || !districtId || !cropId) continue;
    const c = getCropById(cropId);
    const yEst = c ? (c.yieldLow + c.yieldHigh) / 2 * 0.6 : 1;
    pts.push({ districtId, cropId, season: 'C', year, production: Math.round(area * yEst), area: Math.round(area), yieldPerHa: Math.round(yEst * 100) / 100 });
  }
  return pts;
}

async function fetchGva(): Promise<GvaPoint[]> {
  const resp = await postPx([...CASH_DIR, 'crops.px'], { query: [], response: { format: 'json' } });
  const pts: GvaPoint[] = [];
  for (const row of resp.data) {
    const v = numVal(row); if (!v) continue;
    const cropId = GVA_CROP_MAP[row.key[0]];
    const year   = GVA_YEAR[row.key[1]];
    if (!cropId || !year) continue;
    const c = getCropById(cropId);
    pts.push({ cropId, cropName: c?.name ?? cropId, year, gva: Math.round(v) });
  }
  return pts;
}

// ─── Harvested area (havest.px) ───────────────────────────────────────────────

async function fetchHarvest(): Promise<HarvestPoint[]> {
  const resp = await postPx(crop('havest.px'), { query: [], response: { format: 'json' } });
  // Build a cultivated area lookup from the existing store for harvest ratio
  const cultivatedMap = new Map<string, number>();
  for (const dp of getAllData()) cultivatedMap.set(`${dp.season}|${dp.districtId}|${dp.cropId}`, dp.area);

  const pts: HarvestPoint[] = [];
  for (const row of resp.data) {
    const harvestedHa = numVal(row); if (!harvestedHa) continue;
    const season     = SEAS[row.key[0]];
    const districtId = DIST[row.key[1]];
    const cropId     = CROP_MAP[row.key[2]];
    if (!season || !districtId || !cropId) continue;
    const d = getDistrictById(districtId);
    const c = getCropById(cropId);
    const cultivatedHa = cultivatedMap.get(`${season}|${districtId}|${cropId}`) ?? 0;
    const harvestRatio = cultivatedHa > 0 ? Math.round((harvestedHa / cultivatedHa) * 1000) / 10 : 0;
    pts.push({ season, districtId, districtName: d?.name ?? districtId, cropId, cropName: c?.name ?? cropId, harvestedHa: Math.round(harvestedHa), cultivatedHa: Math.round(cultivatedHa), harvestRatio });
  }
  return pts;
}

// ─── Large-scale farmer yield (Lager.px) ─────────────────────────────────────

const LAGER_DIST: Record<string, string> = { ...DIST }; // same 30-district codes (0-29); positions 30,31,32 = LSF,National,SSF — skip

async function fetchLargeScale(): Promise<LargeScaleYield[]> {
  const resp = await postPx(crop('Lager.px'), { query: [], response: { format: 'json' } });
  const pts: LargeScaleYield[] = [];
  for (const row of resp.data) {
    const yieldKg = numVal(row); if (!yieldKg) continue;
    const season     = SEAS[row.key[0]];
    const districtId = LAGER_DIST[row.key[1]]; // skip codes 30-32 (LSF/National/SSF)
    const cropId     = CROP_MAP[row.key[2]];
    if (!season || !districtId || !cropId) continue;
    const d = getDistrictById(districtId);
    const c = getCropById(cropId);
    pts.push({ season, districtId, districtName: d?.name ?? districtId, cropId, cropName: c?.name ?? cropId, yieldKgPerHa: Math.round(yieldKg) });
  }
  return pts;
}

// ─── Cash crop land area (_cashcrop.px) ───────────────────────────────────────

const CASH_AREA_CAT: Record<string, { label: string; crop: 'Coffee' | 'Tea'; isActive: boolean }> = {
  '0': { label: 'Total Coffee area',         crop: 'Coffee', isActive: false },
  '1': { label: 'Coffee under production',   crop: 'Coffee', isActive: true  },
  '2': { label: 'Total tea area',            crop: 'Tea',    isActive: false },
  '3': { label: 'Tea area under production', crop: 'Tea',    isActive: true  },
};
const CASH_AREA_YEAR: Record<string, number> = { '0': 2014, '1': 2015, '2': 2016, '3': 2017, '4': 2018, '5': 2019, '6': 2020 };

async function fetchCashCropArea(): Promise<CashAreaPoint[]> {
  const resp = await postPx(crop('_cashcrop.px'), { query: [], response: { format: 'json' } });
  const pts: CashAreaPoint[] = [];
  for (const row of resp.data) {
    const meta = CASH_AREA_CAT[row.key[0]];
    const year = CASH_AREA_YEAR[row.key[1]];
    if (!meta || !year) continue;
    const raw = row.values[0];
    const area: number | null = (!raw || raw === '..' || raw === '...') ? null : parseFloat(raw);
    pts.push({ category: meta.label, crop: meta.crop, isActive: meta.isActive, year, areaThousandHa: area });
  }
  return pts;
}

// ─── Cash crop production (cash_crop.px) ──────────────────────────────────────

const CASH_PROD_CROP: Record<string, 'Coffee' | 'Tea'> = { '0': 'Coffee', '1': 'Tea' };
const CASH_PROD_YEAR: Record<string, number> = { '0': 2016, '1': 2017, '2': 2018, '3': 2019, '4': 2020, '5': 2021, '6': 2022 };

async function fetchCashCropProd(): Promise<CashProdPoint[]> {
  const resp = await postPx([...CASH_DIR, 'cash_crop.px'], {
    query: [
      { code: 'crops', selection: { filter: 'item', values: ['0', '1'] } },
      { code: 'Years', selection: { filter: 'item', values: Object.keys(CASH_PROD_YEAR) } },
    ],
    response: { format: 'json' },
  });
  const pts: CashProdPoint[] = [];
  for (const row of resp.data) {
    const v = numVal(row); if (!v) continue;
    const c = CASH_PROD_CROP[row.key[0]];
    const y = CASH_PROD_YEAR[row.key[1]];
    if (!c || !y) continue;
    pts.push({ crop: c, year: y, productionTons: Math.round(v) });
  }
  return pts;
}

async function fetchPractices(): Promise<PracticePoint[]> {
  const resp = await postPx([...PRAC_DIR, 'pratice.px'], { query: [], response: { format: 'json' } });
  const pts: PracticePoint[] = [];
  for (const row of resp.data) {
    const v = numVal(row); if (!v) continue;
    const season     = SEAS[row.key[0]];
    const districtId = DIST[row.key[1]];
    const practice   = PRACTICE_MAP[row.key[2]];
    if (!season || !districtId || !practice) continue;
    const d = getDistrictById(districtId);
    pts.push({ season, districtId, districtName: d?.name ?? districtId, practice, areaHa: Math.round(v) });
  }
  return pts;
}

async function fetchLandUse(): Promise<LandUsePoint[]> {
  const resp = await postPx([...LAND_DIR, 'land.px'], { query: [], response: { format: 'json' } });
  const pts: LandUsePoint[] = [];
  for (const row of resp.data) {
    const v = numVal(row); if (!v) continue;
    const season     = SEAS[row.key[0]];
    const districtId = DIST[row.key[1]];
    const landUse    = LAND_USE_MAP[row.key[2]];
    if (!season || !districtId || !landUse) continue;
    const d = getDistrictById(districtId);
    pts.push({ season, districtId, districtName: d?.name ?? districtId, landUse, areaThousandHa: v });
  }
  return pts;
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

// ─── Main initialization — sequential to avoid 429 ───────────────────────────

export async function initNisrConnection(): Promise<boolean> {
  _status = 'loading';
  _error  = null;
  bump();

  try {
    // ── Step 1: Cultivated area (required)
    const areaResp = await fetchCultivatedArea();
    await sleep(500);

    // ── Step 2: Yield (required)
    const yieldResp = await fetchYield();

    // Combine and store core data — Dashboard renders now
    const abPoints = combineAreaYield(areaResp, yieldResp);
    if (abPoints.length === 0) throw new Error('NISR returned 0 data points (area × yield)');

    setAllData(abPoints);
    _status  = 'connected';
    _fetched = new Date().toISOString();
    bump(); // ← Dashboard renders here

    // ── Steps 3-6: Supplementary tables — failures tolerated, delays between calls
    await sleep(600);
    try {
      const cPoints = await fetchSeasonC();
      if (cPoints.length > 0) setAllData([...getAllData(), ...cPoints]);
    } catch { /* Season C non-critical */ }

    await sleep(600);
    try { _gvaData = await fetchGva(); } catch { /* GVA non-critical */ }

    await sleep(600);
    try { _practiceData = await fetchPractices(); } catch { /* practices non-critical */ }

    await sleep(600);
    try { _landUseData = await fetchLandUse(); } catch { /* land use non-critical */ }

    await sleep(600);
    try { _harvestData = await fetchHarvest(); } catch { /* harvest non-critical */ }

    await sleep(600);
    try { _largeScaleData = await fetchLargeScale(); } catch { /* large scale non-critical */ }

    await sleep(600);
    try { _cashAreaData = await fetchCashCropArea(); } catch { /* cash area non-critical */ }

    await sleep(600);
    try { _cashProdData = await fetchCashCropProd(); } catch { /* cash prod non-critical */ }

    bump(); // final update with all supplementary data
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
  return exact.length > 0
    ? exact
    : data.filter((dp) => dp.cropId === filters.cropId && dp.season === filters.season);
}

export async function fetchSummaryStats(filters: Filters): Promise<SummaryStats> {
  const filtered  = await fetchAgricultureData(filters);
  const totalArea = filtered.reduce((s, dp) => s + dp.area, 0);
  const totalProd = filtered.reduce((s, dp) => s + dp.production, 0);
  const avgYield  = totalArea > 0 ? totalProd / totalArea : 0;
  const cropCount = new Set(getAllData().map((dp) => dp.cropId)).size;

  const prevData = getAllData().filter(
    (dp) => dp.cropId === filters.cropId && dp.season === filters.season && dp.year === filters.year - 1,
  );
  const prevProd = prevData.reduce((s, dp) => s + dp.production, 0);
  const yoyPct   = prevProd > 0 ? ((totalProd - prevProd) / prevProd) * 100 : 0;

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

export interface TrendPoint { year: string; production: number; area: number; yield: number; }

export function getProductionTrend(cropId: string, season: Season): TrendPoint[] {
  // Use live store for seasons+years we actually have
  const live       = getAllData().filter((dp) => dp.cropId === cropId && dp.season === season);
  const liveByYear = new Map<number, { production: number; area: number }>();
  for (const dp of live) {
    const ex = liveByYear.get(dp.year) ?? { production: 0, area: 0 };
    ex.production += dp.production;
    ex.area        += dp.area;
    liveByYear.set(dp.year, ex);
  }

  // Fill historical years from GVA data scaled to 2023 production
  const gvaForCrop = _gvaData.filter((g) => g.cropId === cropId);
  const gva2023    = gvaForCrop.find((g) => g.year === PXWEB_DATA_YEAR)?.gva ?? 0;
  const prod2023   = liveByYear.get(PXWEB_DATA_YEAR)?.production ?? 0;
  const scale      = gva2023 > 0 && prod2023 > 0 ? prod2023 / gva2023 : 0;

  const allYears = new Set<number>([
    ...liveByYear.keys(),
    ...gvaForCrop.map((g) => g.year),
  ]);

  return [...allYears].sort().map((year) => {
    if (liveByYear.has(year)) {
      const { production, area } = liveByYear.get(year)!;
      return { year: String(year), production: Math.round(production), area: Math.round(area), yield: area > 0 ? Math.round((production / area) * 100) / 100 : 0 };
    }
    const gp = gvaForCrop.find((g) => g.year === year);
    const est = scale > 0 && gp ? Math.round(gp.gva * scale) : 0;
    return { year: String(year), production: est, area: 0, yield: 0 };
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
