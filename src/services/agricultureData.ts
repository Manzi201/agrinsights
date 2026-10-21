import type { District, Crop, DataPoint, Season } from '../types/agriculture';

// ---------------------------------------------------------------------------
// Districts – all 30 districts of Rwanda with approximate coordinates
// ---------------------------------------------------------------------------

export const districts: District[] = [
  // Kigali
  { id: 'gasabo', name: 'Gasabo', province: 'Kigali', lat: -1.9366, lng: 30.1305 },
  { id: 'kicukiro', name: 'Kicukiro', province: 'Kigali', lat: -1.9989, lng: 30.1106 },
  { id: 'nyarugenge', name: 'Nyarugenge', province: 'Kigali', lat: -1.9537, lng: 30.0588 },
  // Eastern
  { id: 'bugesera', name: 'Bugesera', province: 'Eastern', lat: -2.0500, lng: 30.0500 },
  { id: 'gatsibo', name: 'Gatsibo', province: 'Eastern', lat: -1.6000, lng: 30.3500 },
  { id: 'kayonza', name: 'Kayonza', province: 'Eastern', lat: -1.8700, lng: 30.5200 },
  { id: 'kirehe', name: 'Kirehe', province: 'Eastern', lat: -1.7500, lng: 30.6500 },
  { id: 'ngoma', name: 'Ngoma', province: 'Eastern', lat: -2.1500, lng: 30.0000 },
  { id: 'nyagatare', name: 'Nyagatare', province: 'Eastern', lat: -1.3000, lng: 30.3300 },
  { id: 'rwamagana', name: 'Rwamagana', province: 'Eastern', lat: -1.9500, lng: 30.3000 },
  // Northern
  { id: 'burera', name: 'Burera', province: 'Northern', lat: -1.4900, lng: 29.8700 },
  { id: 'gakenke', name: 'Gakenke', province: 'Northern', lat: -1.7000, lng: 29.7500 },
  { id: 'gicumbi', name: 'Gicumbi', province: 'Northern', lat: -1.5800, lng: 30.1000 },
  { id: 'musanze', name: 'Musanze', province: 'Northern', lat: -1.5000, lng: 29.6500 },
  { id: 'rulindo', name: 'Rulindo', province: 'Northern', lat: -1.6500, lng: 29.8000 },
  // Southern
  { id: 'gisagara', name: 'Gisagara', province: 'Southern', lat: -2.3500, lng: 29.8000 },
  { id: 'huye', name: 'Huye', province: 'Southern', lat: -2.3500, lng: 29.7500 },
  { id: 'kamonyi', name: 'Kamonyi', province: 'Southern', lat: -2.0000, lng: 29.7500 },
  { id: 'muhanga', name: 'Muhanga', province: 'Southern', lat: -2.1000, lng: 29.7000 },
  { id: 'nyamagabe', name: 'Nyamagabe', province: 'Southern', lat: -2.4000, lng: 29.5000 },
  { id: 'nyanza', name: 'Nyanza', province: 'Southern', lat: -2.3500, lng: 29.7000 },
  { id: 'nyaruguru', name: 'Nyaruguru', province: 'Southern', lat: -2.5000, lng: 29.5000 },
  { id: 'ruhango', name: 'Ruhango', province: 'Southern', lat: -2.1000, lng: 29.8000 },
  // Western
  { id: 'karongi', name: 'Karongi', province: 'Western', lat: -2.0000, lng: 29.3500 },
  { id: 'ngororero', name: 'Ngororero', province: 'Western', lat: -1.8500, lng: 29.6000 },
  { id: 'nyabihu', name: 'Nyabihu', province: 'Western', lat: -1.6500, lng: 29.5000 },
  { id: 'nyamasheke', name: 'Nyamasheke', province: 'Western', lat: -2.2500, lng: 28.9000 },
  { id: 'rubavu', name: 'Rubavu', province: 'Western', lat: -1.6500, lng: 29.3500 },
  { id: 'rusizi', name: 'Rusizi', province: 'Western', lat: -2.4500, lng: 28.9000 },
  { id: 'rutsiro', name: 'Rutsiro', province: 'Western', lat: -1.9500, lng: 29.3000 },
];

// ---------------------------------------------------------------------------
// Crops – 8 main crops with Kinyarwanda names and yield ranges
// ---------------------------------------------------------------------------

export const crops: Crop[] = [
  { id: 'maize', name: 'Maize', nameKinyarwanda: 'Ibigori', category: 'Cereals', yieldLow: 1, yieldHigh: 4, color: '#f59e0b' },
  { id: 'beans', name: 'Beans', nameKinyarwanda: 'Ibishyimbo', category: 'Legumes', yieldLow: 0.5, yieldHigh: 1.5, color: '#8b5cf6' },
  { id: 'sorghum', name: 'Sorghum', nameKinyarwanda: 'Amasaka', category: 'Cereals', yieldLow: 0.8, yieldHigh: 2, color: '#ef4444' },
  { id: 'cassava', name: 'Cassava', nameKinyarwanda: 'Igikombe', category: 'Roots & Tubers', yieldLow: 5, yieldHigh: 12, color: '#14b8a6' },
  { id: 'irish-potato', name: 'Irish Potato', nameKinyarwanda: 'Ibirayi', category: 'Roots & Tubers', yieldLow: 8, yieldHigh: 18, color: '#6366f1' },
  { id: 'sweet-potato', name: 'Sweet Potato', nameKinyarwanda: 'Ibijumba', category: 'Roots & Tubers', yieldLow: 4, yieldHigh: 10, color: '#f97316' },
  { id: 'wheat', name: 'Wheat', nameKinyarwanda: 'Uburindi', category: 'Cereals', yieldLow: 1.5, yieldHigh: 3, color: '#eab308' },
  { id: 'rice', name: 'Rice', nameKinyarwanda: 'Umuceri', category: 'Cereals', yieldLow: 3, yieldHigh: 6, color: '#06b6d4' },
];

export const seasons: Season[] = ['A', 'B', 'C'];
export const years: number[] = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

// ---------------------------------------------------------------------------
// Deterministic pseudo-random generator for reproducible mock data
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Base cultivable area per district (hectares) – varies by district size
const districtBaseArea: Record<string, number> = {
  gasabo: 9000, kicukiro: 4500, nyarugenge: 4000,
  bugesera: 33000, gatsibo: 38000, kayonza: 27000, kirehe: 28000,
  ngoma: 22000, nyagatare: 55000, rwamagana: 25000,
  burera: 18000, gakenke: 20000, gicumbi: 28000, musanze: 16000, rulindo: 18000,
  gisagara: 22000, huye: 25000, kamonyi: 20000, muhanga: 18000,
  nyamagabe: 24000, nyanza: 18000, nyaruguru: 18000, ruhango: 18000,
  karongi: 24000, ngororero: 22000, nyabihu: 18000, nyamasheke: 26000,
  rubavu: 15000, rusizi: 28000, rutsiro: 20000,
};

// Crop preference factors per province (what fraction of area goes to each crop)
const provinceCropPreference: Record<string, Record<string, number>> = {
  Kigali:    { maize: 0.20, beans: 0.25, sorghum: 0.05, cassava: 0.10, 'irish-potato': 0.05, 'sweet-potato': 0.15, wheat: 0.05, rice: 0.05 },
  Eastern:   { maize: 0.30, beans: 0.10, sorghum: 0.15, cassava: 0.10, 'irish-potato': 0.02, 'sweet-potato': 0.08, wheat: 0.02, rice: 0.18 },
  Northern:  { maize: 0.10, beans: 0.20, sorghum: 0.03, cassava: 0.05, 'irish-potato': 0.30, 'sweet-potato': 0.05, wheat: 0.20, rice: 0.02 },
  Southern:  { maize: 0.15, beans: 0.20, sorghum: 0.10, cassava: 0.25, 'irish-potato': 0.05, 'sweet-potato': 0.15, wheat: 0.05, rice: 0.05 },
  Western:   { maize: 0.10, beans: 0.20, sorghum: 0.08, cassava: 0.15, 'irish-potato': 0.15, 'sweet-potato': 0.12, wheat: 0.05, rice: 0.12 },
};

// Season weight (what fraction of annual production comes from each season)
const seasonWeight: Record<Season, number> = { A: 0.50, B: 0.35, C: 0.15 };

// District-specific yield multiplier (some districts have better soil/weather)
const districtYieldBonus: Record<string, number> = {
  musanze: 1.35, burera: 1.25, nyabihu: 1.20, rubavu: 1.15,
  rusizi: 1.20, nyamasheke: 1.10, kayonza: 1.05, nyagatare: 1.10,
  huye: 1.05, gicumbi: 1.10, rwamagana: 1.00, kirehe: 0.95,
  bugesera: 1.00, gatsibo: 1.00, ngoma: 0.95, gakenke: 1.00,
  rulindo: 1.05, gisagara: 0.95, kamonyi: 1.00, muhanga: 1.00,
  nyamagabe: 0.90, nyanza: 0.95, nyaruguru: 0.85, ruhango: 1.00,
  karongi: 1.00, ngororero: 0.95, rutsiro: 0.95,
  gasabo: 0.95, kicukiro: 0.80, nyarugenge: 0.80,
};

function generateData(): DataPoint[] {
  const rng = seededRandom(42);
  const points: DataPoint[] = [];

  for (const district of districts) {
    const baseArea = districtBaseArea[district.id] ?? 15000;
    const provincePrefs = provinceCropPreference[district.province];
    const yieldBonus = districtYieldBonus[district.id] ?? 1.0;

    for (const crop of crops) {
      const pref = provincePrefs[crop.id] ?? 0.05;

      for (const season of seasons) {
        const sw = seasonWeight[season];

        for (const year of years) {
          // Yearly variation: slight upward trend + noise (some bad years)
          const yearIdx = years.indexOf(year);
          const trend = 1 + yearIdx * 0.015; // ~1.5% growth per year
          const yearNoise = 0.85 + rng() * 0.3; // ±15% noise
          // 2020 was a slightly bad year (COVID disruption)
          const covidFactor = year === 2020 ? 0.92 : 1.0;

          const area = Math.round(
            baseArea * pref * sw * trend * yearNoise * covidFactor
          );

          if (area < 10) continue; // skip negligible data points

          // Yield per ha: within crop range, adjusted by district bonus and noise
          const yieldBase = crop.yieldLow + rng() * (crop.yieldHigh - crop.yieldLow);
          const yieldNoise = 0.85 + rng() * 0.3;
          const yieldPerHa = Math.round(yieldBase * yieldBonus * yieldNoise * 100) / 100;

          const production = Math.round(area * yieldPerHa);

          points.push({
            districtId: district.id,
            cropId: crop.id,
            season,
            year,
            production,
            area,
            yieldPerHa,
          });
        }
      }
    }
  }

  return points;
}

// Mutable data store — initialized with mock data, can be replaced with real API data
let _dataStore: DataPoint[] = generateData();

/** Returns the current agricultural dataset (mock or real). */
export function getAllData(): DataPoint[] {
  return _dataStore;
}

/** Replaces the entire dataset (called after fetching from NISR API). */
export function setAllData(data: DataPoint[]): void {
  _dataStore = data;
}

// Keep for backward compatibility — use getAllData() in new code
export const agricultureData: DataPoint[] = _dataStore;

// ---------------------------------------------------------------------------
// Helper lookup functions
// ---------------------------------------------------------------------------

export function getDistrictById(id: string): District | undefined {
  return districts.find((d) => d.id === id);
}

export function getCropById(id: string): Crop | undefined {
  return crops.find((c) => c.id === id);
}
