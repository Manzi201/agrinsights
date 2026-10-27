// ---------------------------------------------------------------------------
// Cash Crops Service
//
// Fetches Coffee & Tea production data from the NISR PXWeb API:
// POST https://pxweb.statistics.gov.rw/api/v1/en/NISR Statistical Databases/
//       Agriculture/Cash Crops/cash_crop.px
//
// Also fetches the full yield table (all districts × crops × seasons) via:
// POST .../yield.px  with empty query (all data)
// ---------------------------------------------------------------------------

import { buildPxWebUrl } from '../config/api';

const CASH_CROP_TIMEOUT = 15000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashCropDataPoint {
  crop: 'Coffee' | 'Tea';
  year: number;
  productionTons: number;
}

// Yield table: all districts × crops × seasons from NISR 2023 data
export interface LiveYieldPoint {
  seasonCode: string;  // '0' = Season A, '1' = Season B
  districtCode: string;
  cropCode: string;
  yieldKgPerHa: number;
}

// Cash crop land area: total vs under-production area ('000 ha)
export interface CashCropAreaPoint {
  category: 'Total Coffee area' | 'Coffee under production' | 'Total tea area' | 'Tea area under production';
  crop: 'Coffee' | 'Tea';
  isUnderProduction: boolean;
  year: number;
  areaThousandHa: number | null; // null = data not available (..)
}

// ---------------------------------------------------------------------------
// PXWeb response types
// ---------------------------------------------------------------------------

interface PxWebRow {
  key: string[];
  values: string[];
}

interface PxWebResponse {
  columns: { code: string; text: string; type: string }[];
  data: PxWebRow[];
  metadata?: { updated: string; label: string; source: string }[];
}

// ---------------------------------------------------------------------------
// Hardcoded fallback data (from verified API call)
// ---------------------------------------------------------------------------

const CASH_CROP_FALLBACK: CashCropDataPoint[] = [
  { crop: 'Coffee', year: 2016, productionTons: 22009 },
  { crop: 'Coffee', year: 2017, productionTons: 19231 },
  { crop: 'Coffee', year: 2018, productionTons: 21548 },
  { crop: 'Coffee', year: 2019, productionTons: 23375 },
  { crop: 'Coffee', year: 2020, productionTons: 20334 },
  { crop: 'Coffee', year: 2021, productionTons: 19467 },
  { crop: 'Coffee', year: 2022, productionTons: 18945 },
  { crop: 'Tea',    year: 2016, productionTons: 25628 },
  { crop: 'Tea',    year: 2017, productionTons: 27887 },
  { crop: 'Tea',    year: 2018, productionTons: 31068 },
  { crop: 'Tea',    year: 2019, productionTons: 32127 },
  { crop: 'Tea',    year: 2020, productionTons: 33209 },
  { crop: 'Tea',    year: 2021, productionTons: 35626 },
  { crop: 'Tea',    year: 2022, productionTons: 38386 },
];

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function postPxWeb(url: string, body: object): Promise<PxWebResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASH_CROP_TIMEOUT);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`PXWeb ${resp.status}`);
    return (await resp.json()) as PxWebResponse;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Cash Crops: Coffee & Tea production
// ---------------------------------------------------------------------------

const CASH_CROP_URL_SEGMENTS = [
  'NISR Statistical Databases',
  'Agriculture',
  'Cash Crops',
  'cash_crop.px',
];

// crop code → name mapping
const CASH_CROP_MAP: Record<string, 'Coffee' | 'Tea'> = { '0': 'Coffee', '1': 'Tea' };
// year code → year
const YEAR_MAP: Record<string, number> = {
  '0': 2016, '1': 2017, '2': 2018, '3': 2019, '4': 2020, '5': 2021, '6': 2022,
};

export async function fetchCashCropData(): Promise<CashCropDataPoint[]> {
  try {
    const url = buildPxWebUrl(CASH_CROP_URL_SEGMENTS);
    const data = await postPxWeb(url, {
      query: [
        { code: 'crops', selection: { filter: 'item', values: ['0', '1'] } },
        { code: 'Years', selection: { filter: 'item', values: ['0', '1', '2', '3', '4', '5', '6'] } },
      ],
      response: { format: 'json' },
    });

    const results: CashCropDataPoint[] = [];
    for (const row of data.data) {
      const cropCode = row.key[0];
      const yearCode = row.key[1];
      const rawValue = row.values[0];

      if (!rawValue || rawValue === '..' || rawValue === '...') continue;
      const production = parseFloat(rawValue);
      if (isNaN(production)) continue;

      const crop = CASH_CROP_MAP[cropCode];
      const year = YEAR_MAP[yearCode];
      if (!crop || !year) continue;

      results.push({ crop, year, productionTons: Math.round(production) });
    }

    return results.length > 0 ? results : CASH_CROP_FALLBACK;
  } catch {
    return CASH_CROP_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Full yield table (all districts × crops × seasons)
// POST with empty query = fetch all data
// ---------------------------------------------------------------------------

const YIELD_TABLE_SEGMENTS = [
  'NISR Statistical Databases',
  'Agriculture',
  'Crop area, production and yield for major crops',
  'yield.px',
];

export async function fetchFullYieldTable(): Promise<LiveYieldPoint[]> {
  try {
    const url = buildPxWebUrl(YIELD_TABLE_SEGMENTS);
    const data = await postPxWeb(url, {
      query: [],
      response: { format: 'json' },
    });

    const results: LiveYieldPoint[] = [];
    for (const row of data.data) {
      const rawValue = row.values[0];
      if (!rawValue || rawValue === '..' || rawValue === '...') continue;
      const yieldKg = parseFloat(rawValue);
      if (isNaN(yieldKg) || yieldKg <= 0) continue;

      results.push({
        seasonCode: row.key[0],
        districtCode: row.key[1],
        cropCode: row.key[2],
        yieldKgPerHa: yieldKg,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Derived statistics helpers
// ---------------------------------------------------------------------------

/** Returns Coffee and Tea trend data sorted by year. */
export function getCashCropTrend(
  data: CashCropDataPoint[],
  crop: 'Coffee' | 'Tea',
): { year: number; productionTons: number }[] {
  return data
    .filter((d) => d.crop === crop)
    .sort((a, b) => a.year - b.year);
}

/** Returns combined chart data for both crops side by side. */
export function getCashCropChartData(data: CashCropDataPoint[]): {
  year: string;
  Coffee: number;
  Tea: number;
}[] {
  const years = Array.from(new Set(data.map((d) => d.year))).sort();
  return years.map((y) => ({
    year: String(y),
    Coffee: data.find((d) => d.crop === 'Coffee' && d.year === y)?.productionTons ?? 0,
    Tea: data.find((d) => d.crop === 'Tea' && d.year === y)?.productionTons ?? 0,
  }));
}

/** Summary stats for a cash crop. */
export function getCashCropStats(
  data: CashCropDataPoint[],
  crop: 'Coffee' | 'Tea',
) {
  const sorted = getCashCropTrend(data, crop);
  if (sorted.length === 0) return null;
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const prev = sorted[sorted.length - 2];
  const totalGrowth = ((latest.productionTons - first.productionTons) / first.productionTons) * 100;
  const yoyChange = prev
    ? ((latest.productionTons - prev.productionTons) / prev.productionTons) * 100
    : 0;
  const peak = sorted.reduce((max, d) => d.productionTons > max.productionTons ? d : max, sorted[0]);
  return {
    latestYear: latest.year,
    latestProduction: latest.productionTons,
    totalGrowthPct: Math.round(totalGrowth * 10) / 10,
    yoyChangePct: Math.round(yoyChange * 10) / 10,
    peakYear: peak.year,
    peakProduction: peak.productionTons,
  };
}

// ---------------------------------------------------------------------------
// Cash Crop Land Area
// POST _cashcrop.px with empty query
// ---------------------------------------------------------------------------

const CASHCROP_AREA_SEGMENTS = [
  'NISR Statistical Databases',
  'Agriculture',
  'Crop area, production and yield for major crops',
  '_cashcrop.px',
];

// category code → metadata
const AREA_CATEGORY_MAP: Record<string, {
  category: CashCropAreaPoint['category'];
  crop: 'Coffee' | 'Tea';
  isUnderProduction: boolean;
}> = {
  '0': { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false },
  '1': { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true  },
  '2': { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false },
  '3': { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true  },
};

// year code → year
const AREA_YEAR_MAP: Record<string, number> = {
  '0': 2014, '1': 2015, '2': 2016, '3': 2017, '4': 2018, '5': 2019, '6': 2020,
};

// Hardcoded fallback (from verified API call 2024-06-10)
const CASHCROP_AREA_FALLBACK: CashCropAreaPoint[] = [
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2014, areaThousandHa: 55  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2015, areaThousandHa: 36  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2016, areaThousandHa: 38  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2017, areaThousandHa: 39  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2018, areaThousandHa: 40  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2019, areaThousandHa: 39  },
  { category: 'Total Coffee area',           crop: 'Coffee', isUnderProduction: false, year: 2020, areaThousandHa: 40  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2014, areaThousandHa: 38  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2015, areaThousandHa: 31  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2016, areaThousandHa: 31  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2017, areaThousandHa: 31  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2018, areaThousandHa: 33  },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2019, areaThousandHa: null },
  { category: 'Coffee under production',     crop: 'Coffee', isUnderProduction: true,  year: 2020, areaThousandHa: null },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2014, areaThousandHa: 25  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2015, areaThousandHa: 26  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2016, areaThousandHa: 27  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2017, areaThousandHa: 27  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2018, areaThousandHa: 23  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2019, areaThousandHa: 23  },
  { category: 'Total tea area',              crop: 'Tea',    isUnderProduction: false, year: 2020, areaThousandHa: 24  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2014, areaThousandHa: 17  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2015, areaThousandHa: 17  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2016, areaThousandHa: 19  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2017, areaThousandHa: 20  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2018, areaThousandHa: 20  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2019, areaThousandHa: 20  },
  { category: 'Tea area under production',   crop: 'Tea',    isUnderProduction: true,  year: 2020, areaThousandHa: 21  },
];

export async function fetchCashCropAreaData(): Promise<CashCropAreaPoint[]> {
  try {
    const url = buildPxWebUrl(CASHCROP_AREA_SEGMENTS);
    const resp = await postPxWeb(url, { query: [], response: { format: 'json' } });

    const results: CashCropAreaPoint[] = [];
    for (const row of resp.data) {
      const catCode = row.key[0];
      const yearCode = row.key[1];
      const rawValue = row.values[0];

      const meta = AREA_CATEGORY_MAP[catCode];
      const year = AREA_YEAR_MAP[yearCode];
      if (!meta || !year) continue;

      const areaThousandHa = rawValue === '..' || rawValue === '...' || rawValue === ''
        ? null
        : Math.round(parseFloat(rawValue));

      results.push({ ...meta, year, areaThousandHa });
    }

    return results.length > 0 ? results : CASHCROP_AREA_FALLBACK;
  } catch {
    return CASHCROP_AREA_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Land area chart helpers
// ---------------------------------------------------------------------------

/** Returns area chart data grouped by year for both crops. */
export function getCashCropAreaChartData(data: CashCropAreaPoint[], crop: 'Coffee' | 'Tea') {
  const years = Array.from(new Set(data.filter((d) => d.crop === crop).map((d) => d.year))).sort();
  return years.map((y) => {
    const total = data.find((d) => d.crop === crop && !d.isUnderProduction && d.year === y);
    const active = data.find((d) => d.crop === crop && d.isUnderProduction && d.year === y);
    const totalVal = total?.areaThousandHa ?? null;
    const activeVal = active?.areaThousandHa ?? null;
    const utilizationPct = totalVal && activeVal ? Math.round((activeVal / totalVal) * 100) : null;
    return {
      year: String(y),
      'Total area': totalVal,
      'Under production': activeVal,
      'Utilization %': utilizationPct,
    };
  });
}
