// ---------------------------------------------------------------------------
// API Configuration for NISR PXWeb, data.gov.rw, and Mistral AI
//
// All API calls go through the /api/* proxy:
// - In development: Vite dev server proxy (vite.config.ts)
// - In production: Express server proxy (server.js)
// The browser NEVER calls external APIs directly — always via same-origin proxy.
// ---------------------------------------------------------------------------

// PXWeb — always via proxy path (never direct to avoid CORS)
export const PXWEB_BASE = '/api/nisr/api/v1/en';

// PXWeb table paths
const CROP_TABLE_DIR = [
  'NISR Statistical Databases',
  'Agriculture',
  'Crop area, production and yield for major crops',
];

export const PXWEB_TABLES = {
  cropArea: {
    pathSegments: [...CROP_TABLE_DIR, '_crop_area.px'],
    seasonDim: 'Season',
    districtDim: 'District  (ha)',
    cropDim: 'Crop type',
  },
  yield: {
    pathSegments: [...CROP_TABLE_DIR, 'yield.px'],
    seasonDim: 'Season',
    districtDim: 'District',
    cropDim: 'Crop type',
  },
  harvest: {
    pathSegments: [...CROP_TABLE_DIR, 'havest.px'],
    seasonDim: 'Season',
    districtDim: 'District',
    cropDim: 'Crop type',
  },
} as const;

export const PXWEB_ADDITIONAL_TABLES = {
  landUse:       ['NISR Statistical Databases', 'Agriculture', 'Agricultural land use', 'land.px'],
  practices:     ['NISR Statistical Databases', 'Agriculture', 'Agricultural practices', 'pratice.px'],
  cashCrop:      ['NISR Statistical Databases', 'Agriculture', 'Cash Crops', 'cash_crop.px'],
  crops:         ['NISR Statistical Databases', 'Agriculture', 'Cash Crops', 'crops.px'],
  cashCropArea:  [...CROP_TABLE_DIR, '_cashcrop.px'],
  largeScale:    [...CROP_TABLE_DIR, 'Lager.px'],
  scoreArea:     [...CROP_TABLE_DIR, 'scro_area.px'],
  harvestedArea: [...CROP_TABLE_DIR, 'havest.px'],
} as const;

export const PXWEB_DATA_YEAR = 2023;

export function buildPxWebUrl(pathSegments: readonly string[]): string {
  const encoded = pathSegments.map(encodeURIComponent).join('/');
  return `${PXWEB_BASE}/${encoded}`;
}

// ---------------------------------------------------------------------------
// data.gov.rw — via proxy
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
// Mistral AI — via proxy
// ---------------------------------------------------------------------------

export const MISTRAL_API_URL = '/api/mistral/v1/chat/completions';

// ---------------------------------------------------------------------------
// PXWeb ↔ App mappings
// ---------------------------------------------------------------------------

export const PXWEB_CROP_MAP: Record<string, string> = {
  '0':  'maize',
  '1':  'sorghum',
  '2':  'rice',
  '3':  'wheat',
  '4':  'other-cereals',
  '5':  'cassava',
  '6':  'sweet-potato',
  '7':  'irish-potato',
  '8':  'yams-taro',
  '9':  'bananas',
  '10': 'cooking-banana',
  '11': 'dessert-banana',
  '12': 'banana-beer',
  '13': 'beans',
  '14': 'bush-bean',
  '15': 'climbing-bean',
  '16': 'pea',
  '17': 'groundnut',
  '18': 'soybean',
  '19': 'vegetables',
  '20': 'fruits',
  '21': 'fodder-crops',
  '22': 'other-crops',
  // '23' = Total developed land — skip (aggregate, not a crop)
};

export const PXWEB_DISTRICT_MAP: Record<string, string> = {
  '0': 'nyarugenge', '1': 'gasabo', '2': 'kicukiro',
  '3': 'nyanza', '4': 'gisagara', '5': 'nyaruguru',
  '6': 'huye', '7': 'nyamagabe', '8': 'ruhango',
  '9': 'muhanga', '10': 'kamonyi', '11': 'karongi',
  '12': 'rutsiro', '13': 'rubavu', '14': 'nyabihu',
  '15': 'ngororero', '16': 'rusizi', '17': 'nyamasheke',
  '18': 'rulindo', '19': 'gakenke', '20': 'musanze',
  '21': 'burera', '22': 'gicumbi', '23': 'rwamagana',
  '24': 'nyagatare', '25': 'gatsibo', '26': 'kayonza',
  '27': 'kirehe', '28': 'ngoma', '29': 'bugesera',
};

export const PXWEB_SEASON_MAP: Record<string, 'A' | 'B'> = { '0': 'A', '1': 'B' };

export const CROP_TO_PXWEB: Record<string, string> = Object.fromEntries(
  Object.entries(PXWEB_CROP_MAP).map(([k, v]) => [v, k]),
);

export const DISTRICT_TO_PXWEB: Record<string, string> = Object.fromEntries(
  Object.entries(PXWEB_DISTRICT_MAP).map(([k, v]) => [v, k]),
);
