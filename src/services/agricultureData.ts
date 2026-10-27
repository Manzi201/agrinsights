// ---------------------------------------------------------------------------
// agricultureData.ts
//
// STATIC reference data only:
//   - District coordinates (lat/lng for map — cannot come from a stats API)
//   - Color palette for crop display
//
// ALL crop names, district names, and production figures come from NISR APIs.
// Use getLiveCrops() and getLiveDistricts() from nisr.ts everywhere.
// ---------------------------------------------------------------------------

import type { DataPoint, Season } from '../types/agriculture';

// ---------------------------------------------------------------------------
// District coordinates — geographic only, names come from NISR API
// ---------------------------------------------------------------------------

export interface DistrictCoords {
  id: string;      // slug matching NISR district code → id mapping
  lat: number;
  lng: number;
}

export const districtCoords: DistrictCoords[] = [
  { id: 'nyarugenge', lat: -1.9537, lng: 30.0588 },
  { id: 'gasabo',     lat: -1.9366, lng: 30.1305 },
  { id: 'kicukiro',   lat: -1.9989, lng: 30.1106 },
  { id: 'nyanza',     lat: -2.3500, lng: 29.7000 },
  { id: 'gisagara',   lat: -2.3500, lng: 29.8000 },
  { id: 'nyaruguru',  lat: -2.5000, lng: 29.5000 },
  { id: 'huye',       lat: -2.3500, lng: 29.7500 },
  { id: 'nyamagabe',  lat: -2.4000, lng: 29.5000 },
  { id: 'ruhango',    lat: -2.1000, lng: 29.8000 },
  { id: 'muhanga',    lat: -2.1000, lng: 29.7000 },
  { id: 'kamonyi',    lat: -2.0000, lng: 29.7500 },
  { id: 'karongi',    lat: -2.0000, lng: 29.3500 },
  { id: 'rutsiro',    lat: -1.9500, lng: 29.3000 },
  { id: 'rubavu',     lat: -1.6500, lng: 29.3500 },
  { id: 'nyabihu',    lat: -1.6500, lng: 29.5000 },
  { id: 'ngororero',  lat: -1.8500, lng: 29.6000 },
  { id: 'rusizi',     lat: -2.4500, lng: 28.9000 },
  { id: 'nyamasheke', lat: -2.2500, lng: 28.9000 },
  { id: 'rulindo',    lat: -1.6500, lng: 29.8000 },
  { id: 'gakenke',    lat: -1.7000, lng: 29.7500 },
  { id: 'musanze',    lat: -1.5000, lng: 29.6500 },
  { id: 'burera',     lat: -1.4900, lng: 29.8700 },
  { id: 'gicumbi',    lat: -1.5800, lng: 30.1000 },
  { id: 'rwamagana',  lat: -1.9500, lng: 30.3000 },
  { id: 'nyagatare',  lat: -1.3000, lng: 30.3300 },
  { id: 'gatsibo',    lat: -1.6000, lng: 30.3500 },
  { id: 'kayonza',    lat: -1.8700, lng: 30.5200 },
  { id: 'kirehe',     lat: -1.7500, lng: 30.6500 },
  { id: 'ngoma',      lat: -2.1500, lng: 30.0000 },
  { id: 'bugesera',   lat: -2.0500, lng: 30.0500 },
];

// ---------------------------------------------------------------------------
// Crop color palette — matched by crop id, display only
// ---------------------------------------------------------------------------

export const CROP_COLORS: Record<string, string> = {
  'maize':           '#f59e0b',
  'sorghum':         '#ef4444',
  'rice':            '#06b6d4',
  'paddy-rice':      '#06b6d4',
  'wheat':           '#eab308',
  'other-cereals':   '#d97706',
  'cassava':         '#14b8a6',
  'sweet-potato':    '#f97316',
  'irish-potato':    '#6366f1',
  'yams-taro':       '#0891b2',
  'bananas':         '#fbbf24',
  'cooking-banana':  '#f59e0b',
  'dessert-banana':  '#fcd34d',
  'banana-beer':     '#d97706',
  'beans':           '#8b5cf6',
  'bush-bean':       '#7c3aed',
  'climbing-bean':   '#6d28d9',
  'pea':             '#a78bfa',
  'groundnut':       '#c084fc',
  'soybean':         '#e879f9',
  'vegetables':      '#22c55e',
  'fruits':          '#16a34a',
  'fodder-crops':    '#15803d',
  'other-crops':     '#64748b',
};

export function getCropColor(id: string): string {
  return CROP_COLORS[id] ?? '#6b7280';
}

// ---------------------------------------------------------------------------
// Live data store — populated exclusively from NISR API calls in nisr.ts
// ---------------------------------------------------------------------------

let _dataStore: DataPoint[] = [];

export function getAllData():                                DataPoint[]  { return _dataStore; }
export function hasData():                                  boolean      { return _dataStore.length > 0; }
export function setAllData(data: DataPoint[]):              void         { _dataStore = data; }
export function clearData():                                void         { _dataStore = []; }
export function getAgricultureData():                       DataPoint[]  { return _dataStore; }

// ---------------------------------------------------------------------------
// Dynamic year helpers — derived from live store, season-aware
// ---------------------------------------------------------------------------

export function getAvailableYears(cropId?: string, season?: string): number[] {
  if (_dataStore.length === 0) return [2023];
  let filtered = _dataStore;
  if (season)  filtered = filtered.filter((dp) => dp.season === season);
  if (cropId)  filtered = filtered.filter((dp) => dp.cropId === cropId);
  const yrs = Array.from(new Set(filtered.map((dp) => dp.year))).sort((a, b) => a - b);
  return yrs.length > 0 ? yrs : (season ? [] : [2023]);
}

export function getLatestYear(cropId?: string, season?: string): number {
  const yrs = getAvailableYears(cropId, season);
  return yrs.at(-1) ?? 2023;
}

// ---------------------------------------------------------------------------
// Season list — always static (NISR seasons are A, B, C)
// ---------------------------------------------------------------------------

export const seasons: Season[] = ['A', 'B', 'C'];

// Kept for backward compatibility — prefer getLiveCrops() / getLiveDistricts()
// from nisr.ts which return the actual NISR names
export const years: number[] = [2023];

// ---------------------------------------------------------------------------
// Live registry — built from NISR API at init time, not hardcoded
// These are set by nisr.ts after fetching metadata from the API.
// ---------------------------------------------------------------------------

export interface LiveDistrict {
  id: string;
  name: string;          // exact name from NISR valueTexts
  province: string;      // derived from position / known mapping
  lat: number;
  lng: number;
}

export interface LiveCrop {
  id: string;
  name: string;          // exact name from NISR valueTexts
  nameKinyarwanda: string;
  category: string;
  yieldLow: number;
  yieldHigh: number;
  color: string;
}

let _liveDistricts: LiveDistrict[] = [];
let _liveCrops: LiveCrop[] = [];

export function setLiveDistricts(d: LiveDistrict[]): void { _liveDistricts = d; }
export function setLiveCrops(c: LiveCrop[]): void { _liveCrops = c; }

/** Returns districts from NISR metadata, falling back to coordinate table if not yet loaded. */
export function getLiveDistricts(): LiveDistrict[] { return _liveDistricts; }
export function getLiveCrops(): LiveCrop[] { return _liveCrops; }

// Province lookup by district name (derived from known geography)
const DISTRICT_PROVINCE: Record<string, string> = {
  'Nyarugenge': 'Kigali', 'Gasabo': 'Kigali', 'Kicukiro': 'Kigali',
  'Nyanza': 'Southern', 'Gisagara': 'Southern', 'Nyaruguru': 'Southern',
  'Huye': 'Southern', 'Nyamagabe': 'Southern', 'Ruhango': 'Southern',
  'Muhanga': 'Southern', 'Kamonyi': 'Southern',
  'Karongi': 'Western', 'Rutsiro': 'Western', 'Rubavu': 'Western',
  'Nyabihu': 'Western', 'Ngororero': 'Western', 'Rusizi': 'Western',
  'Nyamasheke': 'Western',
  'Rulindo': 'Northern', 'Gakenke': 'Northern', 'Musanze': 'Northern',
  'Burera': 'Northern', 'Gicumbi': 'Northern',
  'Rwamagana': 'Eastern', 'Nyagatare': 'Eastern', 'Gatsibo': 'Eastern',
  'Kayonza': 'Eastern', 'Kirehe': 'Eastern', 'Ngoma': 'Eastern',
  'Bugesera': 'Eastern',
};

export function getProvinceForDistrict(name: string): string {
  return DISTRICT_PROVINCE[name] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Backwards-compat: 'districts' and 'crops' as mutable arrays
// Populated by nisr.ts after fetching NISR metadata.
// Components that import { districts, crops } will get empty arrays
// until NISR data loads — use useDataVersion() to re-render when ready.
// ---------------------------------------------------------------------------

export const districts: LiveDistrict[] = [];
export const crops: LiveCrop[] = [];

/** Called by nisr.ts after parsing API metadata. Mutates the exported arrays in-place. */
export function populateRegistries(d: LiveDistrict[], c: LiveCrop[]): void {
  districts.splice(0, districts.length, ...d);
  crops.splice(0, crops.length, ...c);
  _liveDistricts = districts;
  _liveCrops     = crops;
}

/** Lookup district by id from live registry. */
export function getDistrictById(id: string): LiveDistrict | undefined {
  return districts.find((d) => d.id === id);
}

/** Lookup crop by id from live registry. */
export function getCropById(id: string): LiveCrop | undefined {
  return crops.find((c) => c.id === id);
}
