// ---------------------------------------------------------------------------
// agricultureData.ts
//
// Static reference data only — district coordinates, crop metadata, seasons.
// NO mock/generated production data.
// All production/area/yield data comes exclusively from NISR APIs via nisr.ts.
// ---------------------------------------------------------------------------

import type { District, Crop, DataPoint, Season } from '../types/agriculture';

// ---------------------------------------------------------------------------
// Districts — all 30 districts of Rwanda with coordinates
// ---------------------------------------------------------------------------

export const districts: District[] = [
  // Kigali
  { id: 'gasabo',     name: 'Gasabo',     province: 'Kigali',   lat: -1.9366, lng: 30.1305 },
  { id: 'kicukiro',   name: 'Kicukiro',   province: 'Kigali',   lat: -1.9989, lng: 30.1106 },
  { id: 'nyarugenge', name: 'Nyarugenge', province: 'Kigali',   lat: -1.9537, lng: 30.0588 },
  // Eastern
  { id: 'bugesera',  name: 'Bugesera',  province: 'Eastern', lat: -2.0500, lng: 30.0500 },
  { id: 'gatsibo',   name: 'Gatsibo',   province: 'Eastern', lat: -1.6000, lng: 30.3500 },
  { id: 'kayonza',   name: 'Kayonza',   province: 'Eastern', lat: -1.8700, lng: 30.5200 },
  { id: 'kirehe',    name: 'Kirehe',    province: 'Eastern', lat: -1.7500, lng: 30.6500 },
  { id: 'ngoma',     name: 'Ngoma',     province: 'Eastern', lat: -2.1500, lng: 30.0000 },
  { id: 'nyagatare', name: 'Nyagatare', province: 'Eastern', lat: -1.3000, lng: 30.3300 },
  { id: 'rwamagana', name: 'Rwamagana', province: 'Eastern', lat: -1.9500, lng: 30.3000 },
  // Northern
  { id: 'burera',   name: 'Burera',   province: 'Northern', lat: -1.4900, lng: 29.8700 },
  { id: 'gakenke',  name: 'Gakenke',  province: 'Northern', lat: -1.7000, lng: 29.7500 },
  { id: 'gicumbi',  name: 'Gicumbi',  province: 'Northern', lat: -1.5800, lng: 30.1000 },
  { id: 'musanze',  name: 'Musanze',  province: 'Northern', lat: -1.5000, lng: 29.6500 },
  { id: 'rulindo',  name: 'Rulindo',  province: 'Northern', lat: -1.6500, lng: 29.8000 },
  // Southern
  { id: 'gisagara',  name: 'Gisagara',  province: 'Southern', lat: -2.3500, lng: 29.8000 },
  { id: 'huye',      name: 'Huye',      province: 'Southern', lat: -2.3500, lng: 29.7500 },
  { id: 'kamonyi',   name: 'Kamonyi',   province: 'Southern', lat: -2.0000, lng: 29.7500 },
  { id: 'muhanga',   name: 'Muhanga',   province: 'Southern', lat: -2.1000, lng: 29.7000 },
  { id: 'nyamagabe', name: 'Nyamagabe', province: 'Southern', lat: -2.4000, lng: 29.5000 },
  { id: 'nyanza',    name: 'Nyanza',    province: 'Southern', lat: -2.3500, lng: 29.7000 },
  { id: 'nyaruguru', name: 'Nyaruguru', province: 'Southern', lat: -2.5000, lng: 29.5000 },
  { id: 'ruhango',   name: 'Ruhango',   province: 'Southern', lat: -2.1000, lng: 29.8000 },
  // Western
  { id: 'karongi',    name: 'Karongi',    province: 'Western', lat: -2.0000, lng: 29.3500 },
  { id: 'ngororero',  name: 'Ngororero',  province: 'Western', lat: -1.8500, lng: 29.6000 },
  { id: 'nyabihu',    name: 'Nyabihu',    province: 'Western', lat: -1.6500, lng: 29.5000 },
  { id: 'nyamasheke', name: 'Nyamasheke', province: 'Western', lat: -2.2500, lng: 28.9000 },
  { id: 'rubavu',     name: 'Rubavu',     province: 'Western', lat: -1.6500, lng: 29.3500 },
  { id: 'rusizi',     name: 'Rusizi',     province: 'Western', lat: -2.4500, lng: 28.9000 },
  { id: 'rutsiro',    name: 'Rutsiro',    province: 'Western', lat: -1.9500, lng: 29.3000 },
];

// ---------------------------------------------------------------------------
// Crops — names, categories, and display colors only
// ---------------------------------------------------------------------------

export const crops: Crop[] = [
  { id: 'maize',        name: 'Maize',        nameKinyarwanda: 'Ibigori',   category: 'Cereals',        yieldLow: 1,   yieldHigh: 4,  color: '#f59e0b' },
  { id: 'beans',        name: 'Beans',        nameKinyarwanda: 'Ibishyimbo',category: 'Legumes',        yieldLow: 0.5, yieldHigh: 1.5,color: '#8b5cf6' },
  { id: 'sorghum',      name: 'Sorghum',      nameKinyarwanda: 'Amasaka',   category: 'Cereals',        yieldLow: 0.8, yieldHigh: 2,  color: '#ef4444' },
  { id: 'cassava',      name: 'Cassava',      nameKinyarwanda: 'Imyumbati',  category: 'Roots & Tubers', yieldLow: 5,   yieldHigh: 12, color: '#14b8a6' },
  { id: 'irish-potato', name: 'Irish Potato', nameKinyarwanda: 'Ibirayi',   category: 'Roots & Tubers', yieldLow: 8,   yieldHigh: 18, color: '#6366f1' },
  { id: 'sweet-potato', name: 'Sweet Potato', nameKinyarwanda: 'Ibijumba',  category: 'Roots & Tubers', yieldLow: 4,   yieldHigh: 10, color: '#f97316' },
  { id: 'wheat',        name: 'Wheat',        nameKinyarwanda: 'Ingano',    category: 'Cereals',        yieldLow: 1.5, yieldHigh: 3,  color: '#eab308' },
  { id: 'rice',         name: 'Rice',         nameKinyarwanda: 'Umuceri',   category: 'Cereals',        yieldLow: 3,   yieldHigh: 6,  color: '#06b6d4' },
];

// Seasons: A+B from 2023 API, C from 2021/2022 API
export const seasons: Season[] = ['A', 'B', 'C'];

// Static fallback years — real available years are derived dynamically
// from the live store via getAvailableYears() below
export const years: number[] = [2023];

// ---------------------------------------------------------------------------
// Live data store — populated exclusively from NISR API calls in nisr.ts
// Starts empty; app shows loading/unavailable state until API responds.
// ---------------------------------------------------------------------------

let _dataStore: DataPoint[] = [];

/** Returns the current live dataset from NISR APIs. Empty until loaded. */
export function getAllData(): DataPoint[] {
  return _dataStore;
}

/** Returns the distinct years present in the live store, sorted ascending. */
export function getAvailableYears(): number[] {
  if (_dataStore.length === 0) return [2023];
  return [...new Set(_dataStore.map((dp) => dp.year))].sort((a, b) => a - b);
}

/** Returns the most recent year in the store. */
export function getLatestYear(): number {
  const yrs = getAvailableYears();
  return yrs[yrs.length - 1] ?? 2023;
}

/** True when at least one API fetch has populated the store. */
export function hasData(): boolean {
  return _dataStore.length > 0;
}

/** Replaces the data store with fresh API data. */
export function setAllData(data: DataPoint[]): void {
  _dataStore = data;
}

/** Clears the store (e.g. when an API is removed). */
export function clearData(): void {
  _dataStore = [];
}

// Backward-compat alias
export function getAgricultureData(): DataPoint[] { return _dataStore; }

// ---------------------------------------------------------------------------
// Reference lookups
// ---------------------------------------------------------------------------

export function getDistrictById(id: string): District | undefined {
  return districts.find((d) => d.id === id);
}

export function getCropById(id: string): Crop | undefined {
  return crops.find((c) => c.id === id);
}
