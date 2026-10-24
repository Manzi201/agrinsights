# NISR supplementary data integration across Dashboard, Insights, Solutions, Reports, CashCrops, AgriMap

This change wires five supplementary NISR stores (`getPracticeData`, `getHarvestData`, `getLargeScaleData`, `getCashProdData`, `getCashAreaData`) into all major pages, replacing mock/synthetic computations with real NISR API data. The approach is additive: new `useMemo` blocks reading from the stores drive new stat cards, charts, and alert panels, while the page structure and routing are unchanged. All supplementary stores return `[]` on initial render and populate after the sequential fetch in `nisr.ts` completes, so every new data path must guard for empty arrays. Watch for: a hardcoded `year === 2023` filter in `computeExportData()` that will silently return zero results once the data moves past 2023; a triple re-fetch of the CashCrops API calls triggered by `dataVersion` dependency; and three pre-existing `<h4>` headings in Reports.tsx missing `dark:text` variants that become noticeable next to the new dark-mode-correct headings introduced in this PR.

**Verdict**: NEEDS_CHANGES

---

## High-level view

All five pages add sections that correctly guard for empty stores with loading placeholders, and the new JSX consistently applies `dark:` Tailwind variants. TypeScript type-checking passes clean (`npx tsc --noEmit` exits 0). The most significant correctness gap is in `computeExportData()`: it still filters on a hardcoded `year === 2023` while the three newly added functions that compute similar export-crop rankings (`exportRanking` in Reports, `topExport` in Insights) all use the dynamic `Math.max(...adYears)` pattern. When the dataset includes a 2024 Season A entry, `computeExportData()` will silently drop all 2024 data while the Insights and Reports panels show 2024 numbers — the same tab will show inconsistent results.

The CashCrops fallback introduces a subtler behavioral issue: adding `dataVersion` to the `useEffect` dependency causes `Promise.all([fetchCashCropData(), fetchFullYieldTable(), fetchCashCropAreaData()])` to fire three times on cold load (once per `bump()` call in `nisr.ts`). The first two calls race against the store fills, so the fallback logic only succeeds on the third call. The cancelled-flag cleanup handles this safely — no double-render or stale state — but it fires three external API calls where one was intended.

The Soil tab's `computeSoilData()` deviation from the plan is a practical improvement. The plan specified a three-bar grouped chart per district (erosion, inorganic fertilizer, organic fertilizer); the implementation keeps a single aggregated `coverageHa` field and a concatenated practice-name string. This simplifies the chart and still surfaces the same actionable signal for the Soil & Fertility Track 1 goal.

AgriMap's irrigation overlay is complete: `RwandaMap` accepts the two optional props, uses a blue gradient when `irrigationMode` is true, and switches the legend label and popup content correctly. Dark mode variants were added to the legend wrapper in the same commit.

---

<details>
<summary>Issues (4)</summary>

1. **Export data hardcoded to 2023** — `computeExportData()` in Solutions.tsx filters `dp.year === 2023`, while the Insights and Reports export panels use dynamic `Math.max(...adYears)`. Replace with `const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023` and filter on `latestYear`. The label in the `dataInsight` paragraph also hardcodes "2023" and should use the computed value.

2. **CashCrops triple re-fetch** — Adding `dataVersion` to the `useEffect` dependency causes `fetchCashCropData()`, `fetchFullYieldTable()`, and `fetchCashCropAreaData()` to each fire three times on page load (once per `bump()` in `nisr.ts`). The intent was to run the fallback *after* the supplementary stores populate, but `nisr.ts` only bumps after all supplementary data is ready, not before it. The fix is to split the effect: keep the primary API fetch on `[]` (fires once), and add a separate effect on `[dataVersion]` that only runs the fallback logic when the primary fetch returned empty and the stores are now populated.

3. **Reports.tsx pre-existing `<h4>` headings missing `dark:text-gray-200`** — "Production by Crop", "Production by District", and "Year Comparison" headings use `text-gray-700` with no `dark:` variant. These are not introduced by this PR but they sit immediately above the new dark-mode-correct headings added here (which use `dark:text-gray-200`), making the inconsistency visible in the same scroll view. Suggestion: fix all three while the file is open. (Severity: suggestion; confirmed by reading the file.)

4. **Soil tab plan deviation — no grouping** — The plan specified a three-bar grouped BarChart (Erosion Control / Inorganic Fertilizer / Organic Fertilizer) per district with a `<Legend />`. The implementation uses a single aggregated `coverageHa` column and a concatenated practice string in the insight list. The `SoilRow` interface now has `{ practice: string; coverageHa: number }` instead of `{ erosionHa; inorganicHa; organicHa; totalHa }`. The chart remains a single-bar chart. This is a functional deviation from the plan; the result is less detailed but still valid. Worth noting if the plan was a hackathon deliverable requirement.

</details>

<details>
<summary>Details</summary>

### Hardcoded 2023 in `computeExportData()` vs dynamic year everywhere else

`computeExportData()` (Solutions.tsx, confirmed) still filters:

```ts
for (const dp of data.filter((dp) => dp.year === 2023 && dp.season === 'A' && exportCrops.includes(dp.cropId))) {
```

All three equivalent computations added in this PR use the safe pattern:

```ts
const adYears = ad.filter((p) => p.season === 'A').map((p) => p.year);
const latestYear = adYears.length > 0 ? Math.max(...adYears) : 2023;
```

This is a pre-existing function that was intentionally kept unchanged per the plan ("keep `computeExportData()` unchanged"), but the plan assumed the dataset wouldn't change. Because the same crop IDs feed the Insights export alert and the Reports export ranking — both dynamic — a user comparing the Solutions Export tab against the Reports Export Potential Ranking will see different leading districts when data for a newer year is present. Confirmed by reading the function body at Solutions.tsx line 268.

### CashCrops `dataVersion` dependency causes triple re-fetch

`nisr.ts` calls `bump()` three times on a full cold load: once at the start of `initNisrConnection()`, once after core area+yield data is stored, and once after all supplementary tables finish. With `dataVersion` in the `useEffect` dependency array, each bump re-runs the effect. The `cancelled = true` cleanup in the previous effect cancels the in-flight requests, but the browser still sends the requests. For the fallback to work correctly (populate from `getCashProdData()` when the direct fetch returns empty), the effect needs `dataVersion` to have advanced past the supplementary store fill — which only happens on the third bump. The first two re-runs will find the store still empty and not apply the fallback, but they still send HTTP requests to the NISR API. Confirmed: `bump()` is called at lines 374, 391, and 421 of nisr.ts; `useEffect` dependency is `[dataVersion]` at CashCrops.tsx line 129.

### Soil tab single-bar deviation from plan

The plan specified:

```
Chart: grouped BarChart with 3 bars: "Erosion Control" (#b45309), "Inorganic Fertilizer" (#4f46e5), "Organic Fertilizer" (#15803d). Add <Legend />.
```

The implementation collapses all three into `coverageHa` (sum of erosion + inorganic fertilizer). Organic fertilizer is excluded from `computeSoilData()` entirely — `targetPractices` only includes `['Erosion control', 'Inorganic fertilizer']`. The `SoilRow.practice` field is a concatenated string like `"Erosion control + Inorganic fertilizer"`. This produces a simpler but less granular view. For a hackathon demo this is acceptable, but the fertility message (inorganic vs organic fertilizer adoption gap) is lost.

### TypeScript safety — confirmed clean

`npx tsc --noEmit` exits with no output (0 errors). Interfaces are fully updated: `IrrigationRow`, `SoilRow`, `CropSummaryRow` are all redefined to match the new data shapes. The `CashAreaPoint.category` cast (`p.category as CashCropAreaPoint['category']`) is guarded by the matching string literal values confirmed in nisr.ts. The three pre-existing `<h4>` headings in Reports.tsx that lack `dark:` are not introduced by this PR, but sit immediately above new headings that do have `dark:text-gray-200`, making the inconsistency visible.

### Track 1 alignment

All five Track 1 goals are addressed. Irrigation: `getPracticeData()` with `practice === 'Modern irrigated land'` drives four independent surfaces (Dashboard stat card, AgriMap overlay, Solutions Irrigation tab, Insights alert). Post-harvest: harvest ratio (harvested ÷ cultivated ha) drives Solutions Post-Harvest tab, Dashboard efficiency stat, and Insights risk alert — a direct observational measure. Productivity: scale comparison chart added to Solutions (large-scale vs small-scale kg/ha). Export markets: Irish Potato + Wheat + Rice combined production surfaces in three places; Coffee & Tea trend chart added via `getCashProdData()`. Soil/fertility: covered but with reduced granularity (see Soil tab deviation above).

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `src/pages/Dashboard.tsx` | Added `harvestEff` and `irrigatedDistricts` stat cards; added "Harvest Efficiency by Crop" horizontal BarChart and "Agricultural Practices National Coverage" BarChart |
| `src/pages/Insights.tsx` | Added `track1Alerts` useMemo; added "Track 1 Impact Analysis" 2×2 alert card grid (post-harvest, irrigation, intensification, export) |
| `src/pages/Solutions.tsx` | Replaced `computeIrrigationData`, `computeSoilData`, `computePostHarvestData` with practice/harvest store implementations; added `computeScaleComparison` and `computeCashProdTrend`; added scale comparison chart to Productivity tab; added Coffee & Tea trend chart to Export tab; updated all three tab prop interfaces |
| `src/pages/Reports.tsx` | Added `cropSummaryWithHarvest` (harvest ratio column in crop table), `practicesByDistrict`, `exportRanking` memos; added Track 1 Impact Report section with two tables; fixed `getAvailableYears()` label artifacts |
| `src/pages/CashCrops.tsx` | Added NISR store fallback for `cashData` and `areaData`; added `dataVersion` to effect dependency; replaced hardcoded coffee trend string with computed values |
| `src/pages/AgriMap.tsx` | Added irrigation coverage toggle button; added `irrigationByDistrict` useMemo; passed `irrigationMode` and `irrigationData` props to `RwandaMap` |
| `src/components/map/RwandaMap.tsx` | Added `irrigationMode` / `irrigationData` optional props; added `blueGradient()`; switched legend and popup content conditionally; added dark mode to legend container |

Full diff: `git diff 448f558 HEAD -- src/pages/ src/components/map/RwandaMap.tsx`

</details>
