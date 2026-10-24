# Agrinsights — Smart Agriculture Intelligence Rwanda

> **Track 1: Agricultural Productivity** · NISR Big data Hackathon 2026
> *Use data to develop innovative solutions that address real agricultural challenges facing Rwanda.*

[![Live Demo](https://img.shields.io/badge/Live-agrinsights.onrender.com-16a34a?style=flat-square)](https://agrinsights.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Manzi201%2Fagrinsights-gray?style=flat-square&logo=github)](https://github.com/Manzi201/agrinsights)

---

## Overview

**Agrinsights** is a data intelligence platform that transforms raw NISR agricultural statistics into actionable insights for farmers, agricultural planners, and policymakers across Rwanda's 30 districts.

Every figure, chart, and recommendation is derived exclusively from **live NISR PXWeb API data** — no hardcoded or sample numbers. The platform auto-refreshes from the official statistical source so decisions are always based on the latest published data.

---

## Track 1 Challenge Areas Addressed

| Challenge Area | How Agrinsights Addresses It |
|---|---|
| **Small-scale irrigation** | Maps modern irrigated land area per district from NISR practice data; flags districts with low yield but no irrigation as priority investment targets |
| **Soil conservation & fertility** | Shows erosion control, agroforestry, and fertiliser coverage per district; correlates with yield trends |
| **Post-harvest collection & storage** | Calculates harvest efficiency ratio (harvested ÷ cultivated area) per district and crop; low ratios signal post-harvest losses |
| **Agricultural productivity & value addition** | Compares large-scale vs small-scale farmer yields (Kg/Ha) by district; GVA trend charts 2016–2023 |
| **Export market opportunities** | Ranks top districts for export crops (Irish Potato, Wheat, Rice); tracks Coffee and Tea production trends 2016–2022 |

---

## Features

### Pages

| Page | Description |
|------|-------------|
| **Dashboard** | KPI cards (area, production, yield, harvest efficiency, irrigation coverage), production trend chart (2016–2023 via GVA), top 10 districts, crop share, harvest efficiency per crop, agricultural practices summary |
| **Agricultural Map** | Interactive Leaflet map of Rwanda; choropleth by production or irrigation coverage; popup with district stats per click |
| **Crop Comparison** | Compare up to 4 crops × 4 districts; grouped bar chart, year-over-year trend lines, summary table |
| **Insights** | Auto-generated data insights + **Track 1 Impact Analysis** (irrigation opportunity alerts, post-harvest loss flags, intensification targets, export leaders) |
| **Solutions** | 6-tab solution framework driven by NISR data: Irrigation, Soil & Fertility, Post-Harvest, Productivity, Export Markets, Smart Tools |
| **Cash Crops** | Coffee & Tea production trends (2016–2022), land area under production, yield analysis — live from NISR |
| **Reports** | Configurable export reports with harvest ratio table, practices coverage, land use; PDF and CSV export |

### Smart Tools (Solutions page)

- **Prediction Simulator** — Model impact of yield improvements and area expansion on future production
- **Supply Gap Finder** — Identify districts with surplus vs deficit for any crop; nearest supply routes
- **Opportunity Finder** — Scan all 30 districts for improvement, investment, intensification, and risk signals
- **Regional Supply Routing** — Find the nearest high-production hub for each low-production district (Haversine distances)

---

## Data Sources

All data is fetched live from the **National Institute of Statistics of Rwanda (NISR)** via their PXWeb API:

| Endpoint | Data | Coverage |
|----------|------|----------|
| `_crop_area.px` | Cultivated area (ha) | Season A+B, 2023 |
| `yield.px` | Average yield (Kg/Ha) | Season A+B, 2023 |
| `havest.px` | Harvested area (ha) | Season A+B, 2023 |
| `scro_area.px` | Season C cultivated area | 2021, 2022 |
| `Lager.px` | Large-scale farmer yield | Season A+B, 2023 |
| `crops.px` | GVA by crop (Billion Frw) | 2016–2023 |
| `cash_crop.px` | Coffee & Tea production (tons) | 2016–2022 |
| `_cashcrop.px` | Coffee & Tea land area ('000 ha) | 2014–2020 |
| `pratice.px` | Agricultural practices area | Season A+B, 2023 |
| `land.px` | Land use categories | Season A+B, 2023 |

**API base:** `https://pxweb.statistics.gov.rw/api/v1/en/NISR Statistical Databases/Agriculture/`

Additional AI-powered analysis uses the **Mistral AI** API for district-level agricultural recommendations.

---

## Architecture

```
Browser → agrinsights.onrender.com
            ├── /api/nisr/*   → Express proxy → pxweb.statistics.gov.rw (CORS-free)
            ├── /api/datagov/* → Express proxy → api.data.gov.rw
            ├── /api/mistral/* → Express proxy → api.mistral.ai
            └── /*            → dist/ (Vite build, SPA)
```

The Express `server.js` acts as a same-origin proxy, allowing the browser to call all external APIs without CORS restrictions.

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 (dark mode) |
| Charts | Recharts |
| Map | Leaflet + React-Leaflet |
| Routing | React Router v7 |
| Server | Express 5 (proxy + static) |
| AI | Mistral AI (`mistral-small-latest`) |
| PDF Export | jsPDF + html2canvas |
| Icons | Lucide React |

---

## Running Locally

```bash
# 1. Clone
git clone https://github.com/Manzi201/agrinsights.git
cd agrinsights

# 2. Install
npm install

# 3. Environment variables
cp .env.example .env
# Edit .env and add:
# VITE_DATAGOV_API_KEY=your_key_here
# VITE_MISTRAL_API_KEY=your_key_here

# 4. Start dev server (with Vite proxy)
npm run dev
# → http://localhost:5173

# 5. Or build + run production server
npm run build
node server.js
# → http://localhost:10000
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_DATAGOV_API_KEY` | Optional | data.gov.rw API key for supplementary datasets |
| `VITE_MISTRAL_API_KEY` | Optional | Mistral AI key for district analysis |

NISR PXWeb API requires no authentication key.

---

## Project Structure

```
├── server.js                 # Express production server + API proxy
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main KPI dashboard
│   │   ├── AgriMap.tsx       # Interactive Rwanda map
│   │   ├── CropComparison.tsx
│   │   ├── Insights.tsx      # Auto insights + Track 1 impact analysis
│   │   ├── Solutions.tsx     # 6-tab solutions framework
│   │   ├── CashCrops.tsx     # Coffee & Tea analytics
│   │   └── Reports.tsx       # Configurable PDF/CSV reports
│   ├── services/
│   │   ├── nisr.ts           # NISR API client + data store
│   │   ├── agricultureData.ts # Static reference data + live store
│   │   ├── cashCrops.ts      # Cash crop specific fetchers
│   │   └── mistral.ts        # AI analysis with retry + fallback
│   ├── components/
│   │   ├── charts/           # Recharts wrappers (dark mode aware)
│   │   ├── layout/           # Sidebar, Header, Layout
│   │   ├── map/              # RwandaMap with irrigation overlay
│   │   └── ui/               # StatCard, FilterBar, InsightCard, etc.
│   ├── utils/
│   │   ├── calculations.ts   # Data aggregation + insight generation
│   │   └── exportUtils.ts    # PDF/CSV export
│   ├── hooks/
│   │   └── useAgricultureData.ts  # Data fetching + filter state
│   └── context/
│       └── ThemeContext.tsx   # Dark/light mode persistence
├── public/
│   └── favicon.svg           # Agrinsights logo
└── render.yaml               # Render deployment config
```

---

## Key Design Decisions

**No mock data.** The app starts with an empty store. If NISR is unreachable, a clear error screen with a retry button is shown. No fabricated numbers are ever displayed.

**Sequential API fetching.** NISR PXWeb has rate limits. Core data (area + yield) loads first, enabling the Dashboard to render. Supplementary tables (practices, land use, harvest, etc.) load sequentially with 500–600 ms delays.

**Dynamic year selector.** The year dropdown only shows years that actually exist in the store for the selected crop+season combination. When NISR publishes 2024 data, it appears automatically — no code change needed.

**Server-side proxy.** All external API calls are routed through the Express server to avoid CORS issues in production. The same `/api/*` paths work in both Vite dev (Vite proxy) and production (Express proxy).

---

## Deployment

The app is deployed on **Render** as a Node.js web service:

- **Build command:** `npm install && npm run build`
- **Start command:** `node server.js`
- **Port:** 10000 (auto-detected via `process.env.PORT`)

Live URL: **https://agrinsights.onrender.com**

---

## Team

Built for the **NISR Agricultural Big Data Hackathon 2026** — Track 1: Agricultural Productivity.

Data source: [National Institute of Statistics of Rwanda](https://www.statistics.gov.rw/)
