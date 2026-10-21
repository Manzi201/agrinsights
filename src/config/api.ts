// ---------------------------------------------------------------------------
// API Configuration for NISR PXWeb and data.gov.rw
// ---------------------------------------------------------------------------

// PXWeb API (NISR Statistical Databases) — accessed via Vite proxy in dev
// Real URL: https://pxweb.statistics.gov.rw:443/api/v1/en/...
export const PXWEB_BASE = '/api/nisr/api/v1/en';

// PXWeb table paths
const CROP_TABLE_DIR = [
  'NISR Statistical Databases',
  'Agriculture',
  'Crop area, production and yield for major crops',
];

export const PXWEB_TABLES = {
  // 2023 Cultivated area by Season, District (ha) and Crop type
  cropArea: {
    pathSegments: [...CROP_TABLE_DIR, '_crop_area.px'],
    seasonDim: 'Season',
    districtDim: 'District  (ha)', // note: two spaces in PXWeb metadata
    cropDim: 'Crop type',
  },
  // Average yield (Kg/Ha) by Season, District and Crop type
  yield: {
    pathSegments: [...CROP_TABLE_DIR, 'yield.px'],
    seasonDim: 'Season',
    districtDim: 'District',
    cropDim: 'Crop type',
  },
  // 2023 Harvested area (ha) by Season, District and Crop type
  harvest: {
    pathSegments: [...CROP_TABLE_DIR, 'havest.px'],
    seasonDim: 'Season',
    districtDim: 'District',
    cropDim: 'Crop type',
  },
} as const;

// Additional PXWeb table directories (for future features)
const LAND_USE_DIR = ['NISR Statistical Databases', 'Agriculture', 'Agricultural land use'];
const PRACTICES_DIR = ['NISR Statistical Databases', 'Agriculture', 'Agricultural practices'];
const CASH_CROPS_DIR = ['NISR Statistical Databases', 'Agriculture', 'Cash Crops'];

// Additional PXWeb tables — available but not yet actively queried
export const PXWEB_ADDITIONAL_TABLES = {
  landUse: [...LAND_USE_DIR, 'land.px'],
  practices: [...PRACTICES_DIR, 'pratice.px'],
  cashCrop: [...CASH_CROPS_DIR, 'cash_crop.px'],
  crops: [...CASH_CROPS_DIR, 'crops.px'],
  cashCropArea: [...CROP_TABLE_DIR, '_cashcrop.px'],
  largeScaleYield: [...CROP_TABLE_DIR, 'Lager.px'],
  scoreArea: [...CROP_TABLE_DIR, 'scro_area.px'],
} as const;

// Year that PXWeb data covers
export const PXWEB_DATA_YEAR = 2023;

// Build a PXWeb URL from path segments (URL-encoding each segment)
export function buildPxWebUrl(pathSegments: readonly string[]): string {
  const encoded = pathSegments.map(encodeURIComponent).join('/');
  return `${PXWEB_BASE}/${encoded}`;
}

// ---------------------------------------------------------------------------
// data.gov.rw API
// ---------------------------------------------------------------------------

export const DATAGOV_BASE = '/api/datagov/api/v1';
export const DATAGOV_API_KEY = import.meta.env.VITE_DATAGOV_API_KEY ?? '';

export const DATAGOV_DATASETS = [
  '09ccfc64-867e-4aa0-b189-1bd094b58799',
  '14191c4f-9b3d-4ef5-85c3-49ffeafd50b9',
  '210d9061-89eb-4f5a-98c9-331af281041e',
  '22d2c879-f825-4a2c-94ad-a43cd5d182d7',
] as const;

// ---------------------------------------------------------------------------
// PXWeb → App mapping tables
// ---------------------------------------------------------------------------

// PXWeb crop type code → our crop ID
export const PXWEB_CROP_MAP: Record<string, string> = {
  '0': 'maize',       // Maize
  '1': 'sorghum',     // Sorghum
  '2': 'rice',        // Paddy rice
  '3': 'wheat',       // Wheat
  '5': 'cassava',     // Cassava
  '6': 'sweet-potato', // Sweet potato
  '7': 'irish-potato', // Irish potato
  '13': 'beans',      // Beans
};

// PXWeb district code (index) → our district ID
// Order matches PXWeb valueTexts: Nyarugenge, Gasabo, Kicukiro, Nyanza, ...
export const PXWEB_DISTRICT_MAP: Record<string, string> = {
  '0': 'nyarugenge',
  '1': 'gasabo',
  '2': 'kicukiro',
  '3': 'nyanza',
  '4': 'gisagara',
  '5': 'nyaruguru',
  '6': 'huye',
  '7': 'nyamagabe',
  '8': 'ruhango',
  '9': 'muhanga',
  '10': 'kamonyi',
  '11': 'karongi',
  '12': 'rutsiro',
  '13': 'rubavu',
  '14': 'nyabihu',
  '15': 'ngororero',
  '16': 'rusizi',
  '17': 'nyamasheke',
  '18': 'rulindo',
  '19': 'gakenke',
  '20': 'musanze',
  '21': 'burera',
  '22': 'gicumbi',
  '23': 'rwamagana',
  '24': 'nyagatare',
  '25': 'gatsibo',
  '26': 'kayonza',
  '27': 'kirehe',
  '28': 'ngoma',
  '29': 'bugesera',
};

// PXWeb season code → our Season
export const PXWEB_SEASON_MAP: Record<string, 'A' | 'B'> = {
  '0': 'A',
  '1': 'B',
};

// Reverse mappings for building PXWeb queries
export const CROP_TO_PXWEB: Record<string, string> = Object.fromEntries(
  Object.entries(PXWEB_CROP_MAP).map(([k, v]) => [v, k]),
);

export const DISTRICT_TO_PXWEB: Record<string, string> = Object.fromEntries(
  Object.entries(PXWEB_DISTRICT_MAP).map(([k, v]) => [v, k]),
);
