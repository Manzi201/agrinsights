# Implementation Plan — Solutions Page Tabbed Rebuild

## Context Discovered

- **File to replace:** `src/pages/Solutions.tsx` — currently one long scroll of 5 `<SolutionArea>` cards + a data-foundation card. All 5 data hooks (`useIrrigationData`, `useSoilData`, `usePostHarvestData`, `useProductivityData`, `useExportData`) live in the same file and already compute exactly the data needed for tabs 1–5.
- **Data source:** `getAllData()` from `src/services/agricultureData.ts` returns a cached `DataPoint[]`. `districts` array carries `lat/lng` on every entry. `crops` array has `color` used for recharts fills.
- **Recharts pattern:** `ComparisonChart.tsx` shows the exact idiom — `useTheme()` from `ThemeContext`, then compute `grid`/`axis`/`tt` colors, wrap in `<ResponsiveContainer>`.
- **Dark-mode:** Tailwind `darkMode: 'class'` on `<html>`. Every `dark:` variant works. Use `dark:bg-gray-800 dark:text-gray-100` etc. consistently (same pattern as the existing `SolutionArea` component already does).
- **Tab routing:** Do NOT change `App.tsx` or the router. The `/solutions` route already renders `<Solutions>`. Tab state is local `useState` inside `Solutions`.
- **No new libraries:** recharts `^3.10.1`, lucide-react `^1.61.0`, React 19 built-ins only.
- **Build command:** `npm run build` (`tsc && vite build`). TypeScript must pass.
- **`useDataVersion()`** is already exported from `src/hooks/useAgricultureData.ts` and used in the current Solutions page. Keep this pattern.
- **Haversine** must be a pure function in the file — no new utility files required (it's a one-off).

---

## Component Breakdown

```
src/pages/Solutions.tsx          ← entire implementation lives here
  Solutions()                    ← orchestrator; holds activeTab state
    <TabBar>                     ← inline component; renders 6 tab buttons
    <IrrigationTab>              ← refactored from existing useIrrigationData
    <SoilTab>                    ← refactored from existing useSoilData
    <PostHarvestTab>             ← refactored from existing usePostHarvestData
    <ProductivityTab>            ← refactored from existing useProductivityData
    <ExportMarketsTab>           ← refactored from existing useExportData
    <SmartToolsTab>              ← new; holds activeSmartTool state
      <PredictionSimulator>      ← sub-tool A
      <SupplyGapFinder>          ← sub-tool B
      <OpportunityFinder>        ← sub-tool C
      <RegionalSupplyRouting>    ← sub-tool D
```

All components are co-located in `src/pages/Solutions.tsx`. No separate files. This keeps the change to a single file (as the task requires) and matches the existing pattern where the whole page is self-contained.

---

## Types (all local to Solutions.tsx — no changes to agriculture.ts)

```ts
type TabId = 'irrigation' | 'soil' | 'postharvest' | 'productivity' | 'export' | 'smarttools';
type SmartToolId = 'prediction' | 'supply-gap' | 'opportunity' | 'routing';

interface OpportunityCard {
  districtName: string;
  cropName: string;
  cropColor: string;
  season: Season;
  tag: 'Improvement Opportunity' | 'Investment Opportunity' | 'Risk Alert' | 'Intensification Opportunity';
  tagColor: string;   // Tailwind bg class
  detail: string;
}

interface RoutingRow {
  lowDistrict: string;
  nearestHub: string;
  distanceKm: number;
  productionGap: number;
}
```

---

## Algorithms

### Haversine formula (pure, inline in file)
```ts
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
```

### Supply Gap proxy (Tool B)
- Population estimate: `districtBaseArea[districtId] * 0.3` — `districtBaseArea` is NOT exported from `agricultureData.ts`. **Decision:** re-derive the population proxy as `area_ha * 0.3` where `area_ha` is the district's total cultivated area across all crops for the selected crop's latest year. This avoids importing an internal constant. Alternatively, define a local `DISTRICT_POP_PROXY` record mirroring `districtBaseArea` values directly in Solutions.tsx.
- **Chosen approach:** copy the `districtBaseArea` values into a local `const DISTRICT_POP: Record<string, number>` inside Solutions.tsx. This is the simplest approach that avoids changing the service file. Population estimate = `DISTRICT_POP[districtId] * 0.3`.
- Demand = `populationEstimate * 100` kg/person/year = `populationEstimate * 0.1` tons.
- Surplus = `production - demand`. Positive → Surplus, negative → Deficit.
- Nearest 2 neighbors: iterate all other districts, compute haversineKm, sort ascending, take first 2.

### Consecutive-growth detection (Tool C — Investment Opportunity)
```ts
// For each (district, crop) pair, get yearly production for season 'A' years 2018..2024
// sorted ascending. Count the longest run of year-over-year increases.
// If longestRun >= 2 consecutive increases → "Investment Opportunity"
```

### Opportunity classification (Tool C)
Process all `DataPoint[]` once at the top of the `useOpportunityData` hook:
1. Compute national average yield per crop across all districts for year 2023, season A.
2. For each `(district, crop)` pair:
   - **Improvement Opportunity:** `yieldPerHa < nationalAvgYield[cropId] * 0.70`
   - **Investment Opportunity:** 2+ consecutive years of production growth (season A, 2018–2024 window)
   - **Risk Alert:** national total production for the crop dropped from 2022→2023 (season A)
   - **Intensification Opportunity:** area in top 40% nationally AND yield in bottom 40% nationally
3. One card per classification hit. Cap total cards at 50 to avoid rendering 240+ items.

---

## Plan Steps

- [ ] 1. Add the `DISTRICT_POP` constant and `haversineKm` helper at the top of `Solutions.tsx`.
      `DISTRICT_POP` is a `Record<string, number>` mirroring the `districtBaseArea` values (all 30 districts). `haversineKm` is the pure function above.  
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — TypeScript compiles with no errors.

- [ ] 2. Define local TypeScript types at the top of `Solutions.tsx`: `TabId`, `SmartToolId`, `OpportunityCard`, `RoutingRow`.  
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 3. Refactor the 5 existing data hooks (`useIrrigationData`, `useSoilData`, `usePostHarvestData`, `useProductivityData`, `useExportData`) to remain in the file unchanged in logic but wrapped in `useMemo` inside their respective tab components instead of in the top-level `Solutions()` function. This avoids calling hooks conditionally when only one tab is visible.  
      **Decision:** each tab component calls its own hook at the top level (always called, regardless of active tab) — this is the React-safe way. The `Solutions()` function calls all 5 data hooks and passes results as props to the tab components. This matches the existing code structure.  
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no errors.

- [ ] 4. Build the **`TabBar`** inline component.  
      Props: `activeTab: TabId`, `onChange: (t: TabId) => void`.  
      Renders a horizontally scrollable `<div>` (mobile: `overflow-x-auto`, `flex`, `gap-1`, `pb-1`). Each tab is a `<button>` with:
      - Icon from lucide-react + label text.
      - Active state: `border-b-2 border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30`.
      - Inactive state: `text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800`.
      
      Tab definitions (in order):
      | id | label | Icon |
      |---|---|---|
      | `irrigation` | Irrigation | `Droplets` |
      | `soil` | Soil & Fertility | `Leaf` |
      | `postharvest` | Post-Harvest | `Package` |
      | `productivity` | Productivity | `TrendingUp` |
      | `export` | Export Markets | `Globe` |
      | `smarttools` | Smart Tools | `Wrench` |
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 5. Build tab content components for tabs 1–5 by refactoring the existing `SolutionArea` cards into dedicated components.  
      **`IrrigationTab`** — receives `irrigationGap` prop, renders the existing irrigation `SolutionArea` card but now as a full-width layout with:
      - An introductory text panel (existing challenge/solution/recommendations text).
      - A recharts `BarChart` (horizontal orientation preferred via `layout="vertical"`) showing Season A vs Season C production for the top 10 districts with the largest gap. X-axis is production in tons, Y-axis is district names. Two bars per district: Season A (blue `#3b82f6`) and Season C (sky `#0ea5e9`). Uses `useTheme()` for dark-mode axis/grid colors (same pattern as `ComparisonChart.tsx`).
      
      **`SoilTab`** — receives `soilDistricts` prop. Same card layout as existing, plus a recharts `BarChart` comparing yield2019 vs yield2023 for all districts (not just 5). Two bars per district: 2019 (amber `#f59e0b`) and 2023 (green `#22c55e`).
      
      **`PostHarvestTab`** — receives `cropSummary` prop. Same card layout as existing, plus a recharts `BarChart` showing production by crop (all 8), colored by `c.color`.
      
      **`ProductivityTab`** — receives `cropGrowth` prop. Same card as existing, plus a recharts `BarChart` showing yield2019 vs yield2023 per crop.
      
      **`ExportMarketsTab`** — receives `topExportDistricts` prop. Same card plus a recharts `BarChart` showing top 10 (expand from 5) export districts by production.
      
      All charts: `height: 280`, `<ResponsiveContainer width="100%" height="100%">`, dark-mode colors via `useTheme()`. No new imports beyond what is already in the file plus recharts (already imported via `ComparisonChart` pattern).
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 6. Build the **4 Smart Tool data hooks** — all called from `SmartToolsTab`:

      **`usePredictionData(districtId, cropId, season, yieldImprovePct, areaExpandPct)`**  
      - Reads `getAllData()`, filters to the selected `(districtId, cropId, season)` for year 2024 (most recent).  
      - `currentProduction` = sum of `production` for matching rows.  
      - `currentArea` = sum of `area`.  
      - `projectedArea` = `currentArea * (1 + areaExpandPct / 100)`.  
      - `projectedYield` = `(currentProduction / currentArea) * (1 + yieldImprovePct / 100)` (t/ha).  
      - `projectedProduction` = `projectedArea * projectedYield`.  
      - Returns `{ currentProduction, projectedProduction, currentArea, projectedArea, currentYield, projectedYield }`.

      **`useSupplyGapData(cropId)`**  
      - Filter `getAllData()` for `(cropId, all seasons combined, year 2023)`.  
      - Aggregate `production` by `districtId`.  
      - For each district: `demand = DISTRICT_POP[districtId] * 0.3 * 0.1` (tons: pop_proxy * 100 kg/person = * 0.1 for tons).  
      - `surplus = production - demand`. Round to integer tons.  
      - Sort by surplus ascending (biggest deficits first).  
      - For each deficit district: find nearest 2 surplus districts by `haversineKm`. Attach them as `neighbors: [{name, distanceKm}]`.  
      - Returns `{ rows: SupplyGapRow[] }` where `SupplyGapRow = { districtId, districtName, production, demand, surplus, isSurplus, neighbors }`.

      **`useOpportunityData()`**  
      - Runs once on mount (no filters). Computes up to 50 `OpportunityCard` objects.  
      - Step 1: national average yield per cropId for season A year 2023 from `getAllData()`.  
      - Step 2: per-district yield for season A year 2023 per cropId.  
      - Step 3: Improvement Opportunity — yield < 70% of national avg.  
      - Step 4: consecutive growth — for each `(districtId, cropId)`, production for season A years 2018–2024 in order; count max run of consecutive year-over-year increases; if ≥ 2 → Investment Opportunity.  
      - Step 5: Risk Alert — for each cropId, compare national total production season A 2022 vs 2023; if 2023 < 2022 → Risk Alert for that crop (applied to ALL districts producing it, but de-duplicated to 1 card per crop to keep the list clean).  
      - Step 6: Intensification Opportunity — district's area for crop > median area for that crop nationally AND district's yield < median yield. (Use median, not 40th percentile, for simplicity in implementation.)  
      - Cap total to 50 cards. Priority order: Risk Alert first, then Improvement, then Intensification, then Investment.  
      - Returns `{ cards: OpportunityCard[] }`.  
      Tag colors: Risk Alert → `bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`, Improvement Opportunity → `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`, Investment Opportunity → `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`, Intensification Opportunity → `bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`.

      **`useRoutingData(cropId)`**  
      - Filter `getAllData()` for `(cropId, season A, year 2023)`, aggregate production by districtId.  
      - Sort districts by production descending.  
      - Top 5 = "Supply Hubs" (green). Bottom 5 = "Needs Supply" (red).  
      - For each bottom-5 district: find the nearest top-5 district by `haversineKm`.  
      - `productionGap = hubProduction - lowProduction`.  
      - Returns `{ hubs: RoutingHub[], needsSupply: RoutingRow[] }`.  
      `RoutingHub = { districtId, districtName, production }`.  
      `RoutingRow = { lowDistrict, nearestHub, distanceKm, productionGap }`.
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 7. Build the **4 Smart Tool UI components**:

      **`PredictionSimulator`**  
      - State: `selectedDistrict` (default `'musanze'`), `selectedCrop` (default `'irish-potato'`), `selectedSeason` (default `'A'`), `yieldImprove` (0–100, default 20), `areaExpand` (0–50, default 10).  
      - Calls `usePredictionData(...)` with those state values.  
      - Layout: two-column on md+ (controls left, chart right), single column on mobile.  
      - Controls: `<select>` dropdowns for district, crop, season. Two `<input type="range">` sliders with live value labels.  
      - All `<select>` and `<input>` must have dark-mode classes: `bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600`.  
      - Chart: recharts `BarChart` with 2 grouped bars (Current vs Projected) for 3 metrics: Production (t), Area (ha), Yield (t/ha). Use a single `data` array:
        ```ts
        [
          { metric: 'Production (t)', Current: currentProduction, Projected: projectedProduction },
          { metric: 'Area (ha)', Current: currentArea, Projected: projectedArea },
          { metric: 'Yield (t/ha)', Current: currentYield * 1000, Projected: projectedYield * 1000 }, // scaled x1000 for visibility
        ]
        ```
        Bar colors: Current = `#6b7280`, Projected = `#16a34a` (primary-600).  
      - Show a summary line: "Projected production: X t (+Y%)" below the chart.

      **`SupplyGapFinder`**  
      - State: `selectedCrop` (default `'maize'`).  
      - Calls `useSupplyGapData(selectedCrop)`.  
      - Layout: crop selector at top, then a scrollable table.  
      - Table columns: District | Province | Production (t) | Demand (t) | Surplus/Deficit (t) | Status | Nearest Surplus Districts.  
      - "Status" cell: green badge "Surplus" or red badge "Deficit".  
      - "Nearest Surplus Districts" cell: shows only for Deficit rows; lists neighbor names + distances.  
      - Table dark mode: `bg-white dark:bg-gray-800`, `divide-y divide-gray-200 dark:divide-gray-700`, header `bg-gray-50 dark:bg-gray-700`.

      **`OpportunityFinder`**  
      - State: `filterTag: 'all' | OpportunityCard['tag']` (default `'all'`).  
      - Calls `useOpportunityData()`.  
      - Layout: filter pills at top (one per tag + "All"), then a 3-column grid (md: 2, xl: 3) of cards.  
      - Each card: district name, crop name badge (with crop color dot), season badge, tag badge (colored per type), detail text.  
      - Dark mode on cards: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`.

      **`RegionalSupplyRouting`**  
      - State: `selectedCrop` (default `'cassava'`).  
      - Calls `useRoutingData(selectedCrop)`.  
      - Layout: crop selector, then two sections: "Supply Hubs" (green-tinted table) and "Supply Routing" table.  
      - Supply Hubs table: District | Province | Production (t) — 5 rows.  
      - Supply Routing table: Low District | Nearest Supply Hub | Distance (km) | Production Gap (t) — 5 rows.  
      - A note below: "Distances are straight-line (Haversine). Actual road distances may differ."  
      - Full dark mode on both tables.
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 8. Build the **`SmartToolsTab`** container component.  
      - Props: none (all data hooks live inside).  
      - State: `activeTool: SmartToolId` (default `'prediction'`).  
      - Layout: a secondary tab bar (pills style, horizontal scroll) with 4 tool tabs:
        | id | label | Icon |
        |---|---|---|
        | `prediction` | Prediction Simulator | `Activity` |
        | `supply-gap` | Supply Gap Finder | `Scale` |
        | `opportunity` | Opportunity Finder | `Star` |
        | `routing` | Regional Supply Routing | `Navigation` |
      - Active pill: `bg-primary-600 text-white`. Inactive: `bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600`.
      - Renders the active sub-tool below the pills.  
      - Includes a header card with description of the Smart Tools section (matching the existing page header style).
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors.

- [ ] 9. Wire everything together in the main **`Solutions()`** export.  
      Replace the entire current `Solutions` function body with:
      - `const dataVersion = useDataVersion()` (keep existing).
      - All 5 data hooks called at top level (React rule: hooks must not be conditionally called) using `useMemo(..., [dataVersion])` exactly as the existing code does.
      - `const [activeTab, setActiveTab] = useState<TabId>('irrigation')`.
      - Page header (keep the existing gradient banner with tagline and 4 tag pills).
      - `<TabBar activeTab={activeTab} onChange={setActiveTab} />` below the header.
      - A `switch(activeTab)` (or conditional rendering) that renders only the active tab's component, passing data as props.
      - `SmartToolsTab` receives no props (its sub-hooks are internal).
      
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — TypeScript compiles cleanly. `npm run dev` — page renders all 6 tabs; switching tabs works; recharts charts render in both light and dark mode; Smart Tools sub-tools load without errors.

- [ ] 10. Full-file audit for dark-mode coverage and English-only text.  
      - Every `bg-white` has `dark:bg-gray-800` (or `dark:bg-gray-900`).  
      - Every `text-gray-900` or `text-gray-700` has a `dark:text-gray-*` counterpart.  
      - Every `border-gray-200` has `dark:border-gray-700`.  
      - Every `<select>`, `<input>`, `<table>`, `<th>`, `<td>`, badge, pill has appropriate dark variants.  
      - Recharts charts use `useTheme().isDark` to derive axis/grid/tooltip colors (see `ComparisonChart.tsx` pattern).  
      - All text is English. No Kinyarwanda strings introduced.  
      Files: `src/pages/Solutions.tsx`  
      Verify: `npm run build` — no TS errors. Manually toggle dark mode in the browser; all 6 tabs and all 4 Smart Tools must be legible in both modes.

---

## Recharts Imports Needed (add to existing import)

```ts
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
```

These are already available via `recharts@3.10.1` — no install needed.

## Additional Lucide Icons to Import

The current Solutions.tsx imports: `Droplets, Leaf, Package, TrendingUp, Globe, AlertTriangle, CheckCircle2, ArrowRight, BarChart2`.

Add: `Wrench, Activity, Scale, Star, Navigation` for the new tab/tool icons.

---

## Risks & Assumptions

1. **`districtBaseArea` not exported** — mitigated by copying values into a local `DISTRICT_POP` constant. If the service is ever updated with new districts, the local copy needs to be updated too.
2. **Opportunity cards volume** — 30 districts × 8 crops = 240 possible cards per classification type. The 50-card cap and priority ordering prevent rendering bottlenecks.
3. **Yield metric in Prediction chart** — yield values (1–18 t/ha) are tiny compared to production (thousands of tons), so they're scaled ×1000 in the chart data and the tooltip formatter must divide back: `formatter={(v, name) => name === 'Yield (t/ha)' ? (v/1000).toFixed(2) + ' t/ha' : formatNumber(v as number) + ' t'}`.
4. **No router changes** — confirmed App.tsx route is `/solutions → <Solutions>`. Tab state is entirely local. No URL changes needed.
5. **Hook call order** — all 5 data hooks plus `useDataVersion` remain at the top of `Solutions()` unconditionally. Sub-tool hooks live inside their own sub-components. This satisfies React's Rules of Hooks.
