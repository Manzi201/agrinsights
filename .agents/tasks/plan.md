# Implementation Plan — Dashboard & Pages Redesign (NISR Real Data)

## Context

- **Build command:** `npm run build` (runs `tsc && vite build`)
- **Verify command:** `npm run build` — must exit 0 with no TypeScript errors
- **TypeScript strict mode is on** (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`)
- **Recharts** is the charting library (BarChart, LineChart, etc.)
- **Dark mode** pattern: all Tailwind classes need a matching `dark:` variant
- All supplementary stores (`getPracticeData()`, `getHarvestData()`, etc.) return `[]` until the async sequential fetch in `nisr.ts` completes — every use site must guard against empty arrays

---

## Order of changes (dependency-first)

Items 1–2 are purely additive (no existing logic touched).  
Items 3–5 replace existing compute functions.  
Item 6 (AgriMap) adds an optional UI feature.  
Item 7 (CashCrops) adds a fallback import path.  
Item 8 is the final build verification.

---

- [ ] 1. **Dashboard.tsx** — add two new stat cards and two new chart sections
      
      **What to do:**  
      Import `getPracticeData`, `getHarvestData` from `../services/nisr`.  
      Import `Droplets` from `lucide-react` (already has other Lucide icons).  
      
      **New stat card A — "Harvest Efficiency %":**  
      Replaces the "Crops Tracked" card (4th position in the 5-card grid).  
      Compute inside a `useMemo` that depends on `dataVersion`:  
      ```
      const harvestEff = useMemo(() => {
        const hd = getHarvestData();
        if (hd.length === 0) return null;
        const avg = hd.reduce((s, p) => s + p.harvestRatio, 0) / hd.length;
        return Math.round(avg * 10) / 10;
      }, [dataVersion]);
      ```  
      Render: `<StatCard label="Harvest Efficiency" value={harvestEff !== null ? harvestEff.toString() : '—'} unit="%" icon={<Package />} color="amber" />`  
      Import `Package` from `lucide-react`.
      
      **New stat card B — "Districts with Irrigation":**  
      Replaces nothing — add as 6th card OR replace "Year Change" (5th card) if grid is 5 wide.  
      Per the spec, replace "Crops Tracked" with Harvest Efficiency, then add irrigation as a 6th card (change grid to `lg:grid-cols-6` or keep 5 and replace both 4th and 5th cards):  
      
      Decision: keep exactly 5 cards (same grid breakpoints). Replace "Crops Tracked" with "Harvest Efficiency", replace "Year Change" card with "Districts with Irrigation". Year Change is already shown on the Total Production card via `changePercent`.  
      
      Compute:  
      ```
      const irrigatedDistricts = useMemo(() => {
        const pd = getPracticeData();
        if (pd.length === 0) return null;
        const ids = new Set(pd.filter(p => p.practice === 'Modern irrigated land' && p.areaHa > 0).map(p => p.districtId));
        return ids.size;
      }, [dataVersion]);
      ```  
      Render: `<StatCard label="Districts with Irrigation" value={irrigatedDistricts !== null ? irrigatedDistricts.toString() : '—'} unit="districts" icon={<Droplets />} color="blue" />`
      
      **New section A — "Harvest Efficiency by Crop" horizontal bar chart:**  
      Add after the existing "Charts row 2" (DistrictBarChart) and before the District Analysis panel.  
      Use Recharts `BarChart` with `layout="vertical"`.  
      Compute:  
      ```
      const harvestByCrop = useMemo(() => {
        const hd = getHarvestData();
        if (hd.length === 0) return [];
        const map = new Map<string, number[]>();
        for (const p of hd) {
          if (!map.has(p.cropName)) map.set(p.cropName, []);
          map.get(p.cropName)!.push(p.harvestRatio);
        }
        return Array.from(map.entries())
          .map(([name, vals]) => ({ name, ratio: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10)/10 }))
          .sort((a,b) => b.ratio - a.ratio);
      }, [dataVersion]);
      ```  
      Wrap in a card div with the same `bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700` classes.  
      If `harvestByCrop.length === 0`, show `<p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Harvest data loading...</p>`.  
      Chart height: 240px. Bar fill: `#f59e0b`. XAxis domain `[0, 100]`, label `"%"`.
      
      **New section B — "Agricultural Practices" bar chart:**  
      Add after the harvest efficiency section.  
      Compute national totals per practice (sum areaHa across all districts and seasons):  
      ```
      const practiceNatTotals = useMemo(() => {
        const pd = getPracticeData();
        if (pd.length === 0) return [];
        const map = new Map<string, number>();
        for (const p of pd) map.set(p.practice, (map.get(p.practice) ?? 0) + p.areaHa);
        return Array.from(map.entries()).map(([practice, areaHa]) => ({ practice, areaHa }));
      }, [dataVersion]);
      ```  
      If empty, show `<p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Practices data loading...</p>`.  
      Use a vertical `BarChart` with 5 bars, fill `#16a34a` (primary green), XAxis at bottom with rotated labels (`angle={-20} textAnchor="end"`). Height: 240px.
      
      **Files:** `src/pages/Dashboard.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 2. **Insights.tsx** — add "Track 1 Impact Analysis" section

      **What to do:**  
      Import `getPracticeData`, `getHarvestData`, `getLargeScaleData`, `getAllData` (already from `agricultureData`), `getTopDistricts` (already imported) from the correct services.  
      `getAllData` is imported from `../services/agricultureData` (it's already there as a re-export). `getPracticeData`, `getHarvestData`, `getLargeScaleData` come from `../services/nisr`.  
      
      Add a `useMemo` block for four alert cards — runs after the existing `filteredInsights` memo:
      
      ```
      const track1Alerts = useMemo(() => { ... }, [dataVersion]);
      ```
      
      **Alert 1 — Post-harvest loss (bottom 3 districts by avg harvestRatio):**  
      From `getHarvestData()`, aggregate harvestRatio per districtId (average), sort ascending, take bottom 3.  
      Show as an orange alert card: "⚠ Post-Harvest Loss Risk" with district names and their avg ratio.  
      Guard: if `getHarvestData().length === 0`, render "Data loading..." placeholder.
      
      **Alert 2 — Irrigation opportunity (districts with no irrigation AND low yield):**  
      From `getPracticeData()`, find districtIds where `practice === 'Modern irrigated land'` sums to 0.  
      From `getAllData()`, compute national avg yieldPerHa across Season A latest year. Find districts below national avg.  
      Intersect the two sets → "Irrigation Opportunity" alert (blue).  
      Guard: if either store is empty, show placeholder.
      
      **Alert 3 — Intensification target (large-scale yield > 2× small-scale):**  
      From `getLargeScaleData()`, compute avg yieldKgPerHa per cropId+districtId.  
      From `getAllData()`, compute avg yieldPerHa (t/ha) × 1000 per cropId+districtId for Season A latest year.  
      Find pairs where largeScale > 2 × smallScale.  
      Show as a purple "Intensification Target" alert listing top 5 crop+district pairs.  
      Guard: if either store is empty, show placeholder.
      
      **Alert 4 — Export opportunity (top 3 combined export crop producers):**  
      Re-use same logic as `computeExportData()` in Solutions (Irish Potato + Wheat + Rice, Season A, latest year from `getAllData()`).  
      Show as a teal "Export Opportunity" alert. This uses only `getAllData()` which is always populated, so no guard needed.
      
      **Render location:** Insert the new section (a labelled `<div>` with heading "Track 1 Impact Analysis") between the existing `filteredInsights` grid and the "District Deep Dive" card. Use the same card wrapper classes.
      
      Layout: 2-column grid at `lg:grid-cols-2`, 4 cards total (2 per row).  
      Each alert card pattern:  
      ```
      <div className="bg-{color}-50 dark:bg-{color}-900/20 border border-{color}-200 dark:border-{color}-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-{color}-600" />
          <span className="text-sm font-bold text-{color}-800 dark:text-{color}-200">Title</span>
        </div>
        {content}
      </div>
      ```
      
      **Files:** `src/pages/Insights.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 3. **Solutions.tsx — Irrigation tab** — replace `computeIrrigationData()` with real practice data

      **What to do:**  
      Add import: `getPracticeData, getHarvestData, getLargeScaleData, getCashProdData` from `../services/nisr`.  
      Add import: `useDataVersion` from `../hooks/useAgricultureData` (already imported).
      
      **Replace `computeIrrigationData()`:**  
      Rename the old function to `computeIrrigationDataLegacy()` (keep it in file for reference but unused — actually delete it to avoid `noUnusedLocals` error).  
      Add new inline computation inside the component (via `useMemo`) or as a new standalone function:  
      ```
      function computeRealIrrigationData(): { name: string; province: string; irrigatedHa: number }[] {
        const pd = getPracticeData();
        if (pd.length === 0) return [];
        const map = new Map<string, { name: string; province: string; total: number }>();
        for (const p of pd.filter(x => x.practice === 'Modern irrigated land' && x.areaHa > 0)) {
          const key = p.districtId;
          if (!map.has(key)) map.set(key, { name: p.districtName, province: '', total: 0 });
          map.get(key)!.total += p.areaHa;
        }
        return Array.from(map.values())
          .map(v => ({ name: v.name, province: v.province, irrigatedHa: Math.round(v.total) }))
          .sort((a,b) => b.irrigatedHa - a.irrigatedHa);
      }
      ```
      To get province: look up via `districts.find(d => d.name === v.name)?.province ?? ''`.  
      Actually, `p.districtId` is available — use `getDistrictById(p.districtId)?.province ?? ''` from `../services/agricultureData`.
      
      In `IrrigationTab`, change the prop from `irrigationGap: IrrigationRow[]` to `irrigationRows: { name: string; province: string; irrigatedHa: number }[]`.  
      Update the `dataInsight` block: show irrigatedHa bar chart instead of gap chart.  
      Chart: `BarChart` with `dataKey="irrigatedHa"`, label "Irrigated Ha".  
      Update the challenge text to reflect real practice data.
      
      If `irrigationRows.length === 0`, the `SolutionArea` `dataInsight` prop renders "Modern irrigated land data loading...". The chart itself doesn't render (wrap in `irrigationRows.length > 0 && <chart>`).
      
      **Delete `IrrigationRow` interface** (no longer used) — TypeScript will error if unused.  
      **Add new interface:**  
      ```
      interface IrrigationDistrictRow { name: string; province: string; irrigatedHa: number; }
      ```
      
      **Files:** `src/pages/Solutions.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 4. **Solutions.tsx — Soil & Fertility tab** — replace `computeSoilData()` with practice data

      **What to do:**  
      Delete `computeSoilData()` and `SoilRow` interface (unused after replacement).  
      
      Add new function:  
      ```
      function computeRealSoilData(): { name: string; erosionHa: number; inorganicHa: number; organicHa: number; totalHa: number }[] {
        const pd = getPracticeData();
        if (pd.length === 0) return [];
        const map = new Map<string, { name: string; erosion: number; inorganic: number; organic: number }>();
        for (const p of pd) {
          if (!map.has(p.districtId)) map.set(p.districtId, { name: p.districtName, erosion: 0, inorganic: 0, organic: 0 });
          const entry = map.get(p.districtId)!;
          if (p.practice === 'Erosion control') entry.erosion += p.areaHa;
          else if (p.practice === 'Inorganic fertilizer') entry.inorganic += p.areaHa;
          else if (p.practice === 'Organic fertilizer') entry.organic += p.areaHa;
        }
        return Array.from(map.values())
          .map(v => ({ name: v.name, erosionHa: Math.round(v.erosion), inorganicHa: Math.round(v.inorganic), organicHa: Math.round(v.organic), totalHa: Math.round(v.erosion + v.inorganic + v.organic) }))
          .sort((a,b) => b.totalHa - a.totalHa)
          .slice(0, 10);
      }
      ```
      
      In `SoilTab`, change prop to `soilRows: { name: string; erosionHa: number; inorganicHa: number; organicHa: number; totalHa: number }[]`.  
      Update chart to use grouped `BarChart` with 3 bars: "Erosion Control" (`#b45309`), "Inorganic Fertilizer" (`#4f46e5`), "Organic Fertilizer" (`#15803d`). XAxis: district names. YAxis: ha. Add `<Legend />`.  
      Update `dataInsight` block to show a mini list of top 5 districts with total practice ha.  
      If `soilRows.length === 0`, show "Soil & fertility practice data loading..." in `dataInsight`.  
      Update challenge/solution text to reflect actual practice coverage.
      
      **Files:** `src/pages/Solutions.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 5. **Solutions.tsx — Post-Harvest, Productivity, Export, Smart Tools tabs** — replace remaining compute functions with real data

      **What to do:**
      
      **Post-Harvest tab** — replace `computePostHarvestData()` / `CropSummaryRow`:  
      Delete `computePostHarvestData()` and `CropSummaryRow` interface.  
      Add two new functions:  
      ```
      function computeHarvestRatioByCrop(): { name: string; color: string; avgRatio: number }[] {
        const hd = getHarvestData();
        if (hd.length === 0) return [];
        const map = new Map<string, { name: string; vals: number[] }>();
        for (const p of hd) {
          if (!map.has(p.cropId)) map.set(p.cropId, { name: p.cropName, vals: [] });
          map.get(p.cropId)!.vals.push(p.harvestRatio);
        }
        return Array.from(map.entries()).map(([cropId, v]) => {
          const crop = crops.find(c => c.id === cropId);
          return { name: v.name, color: crop?.color ?? '#6366f1', avgRatio: Math.round(v.vals.reduce((a,b)=>a+b,0)/v.vals.length * 10)/10 };
        }).sort((a,b) => a.avgRatio - b.avgRatio); // lowest ratio first (most losses)
      }

      function computeBottomHarvestDistricts(): { districtName: string; harvestRatio: number }[] {
        const hd = getHarvestData();
        if (hd.length === 0) return [];
        const map = new Map<string, number[]>();
        for (const p of hd) {
          if (!map.has(p.districtId)) map.set(p.districtId, []);
          map.get(p.districtId)!.push(p.harvestRatio);
        }
        return Array.from(map.entries())
          .map(([, vals]) => {
            const first = hd.find(p => p.districtId === [...map.keys()][0]);
            return { districtName: first?.districtName ?? '', harvestRatio: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length * 10)/10 };
          })
          .sort((a,b) => a.harvestRatio - b.harvestRatio)
          .slice(0, 5);
      }
      ```
      Simplify `computeBottomHarvestDistricts` by iterating the map entries directly with key access:  
      ```
      return Array.from(map.entries())
        .map(([districtId, vals]) => {
          const point = hd.find(p => p.districtId === districtId);
          return { districtName: point?.districtName ?? districtId, harvestRatio: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 };
        })
        .sort((a,b) => a.harvestRatio - b.harvestRatio)
        .slice(0, 5);
      ```
      
      In `PostHarvestTab`, change prop to `harvestRatioByCrop: { name: string; color: string; avgRatio: number }[]` plus `bottomDistricts: { districtName: string; harvestRatio: number }[]`.  
      Chart: horizontal `BarChart` (`layout="vertical"`) showing `avgRatio` per crop, domain [0,100], fill `#f97316`. Height 240px.  
      Below chart, add a small table (5 rows): "Top 5 Districts with Highest Post-Harvest Losses".  
      If both arrays are empty, show "Harvest data loading...".  
      Update `dataInsight` block to show the 5 highest-loss crops (lowest ratio) with a colored progress bar.
      
      **Productivity tab** — keep `computeProductivityData()` (it uses `getAllData()`, always populated), but ADD a second section "Large-Scale vs Small-Scale Yield":  
      Add new function:  
      ```
      function computeScaleComparison(): { name: string; color: string; largeScale: number; smallScale: number }[] {
        const lsd = getLargeScaleData();
        const ad = getAllData();
        if (lsd.length === 0) return [];
        const lsMap = new Map<string, number[]>();
        for (const p of lsd.filter(p => p.season === 'A')) {
          if (!lsMap.has(p.cropId)) lsMap.set(p.cropId, []);
          lsMap.get(p.cropId)!.push(p.yieldKgPerHa);
        }
        const ssMap = new Map<string, number[]>();
        const latestYear = Math.max(...ad.filter(p=>p.season==='A').map(p=>p.year), 2023);
        for (const p of ad.filter(p => p.season === 'A' && p.year === latestYear)) {
          if (!ssMap.has(p.cropId)) ssMap.set(p.cropId, []);
          ssMap.get(p.cropId)!.push(p.yieldPerHa * 1000); // convert t/ha → kg/ha
        }
        return crops
          .filter(c => lsMap.has(c.id) && ssMap.has(c.id))
          .map(c => {
            const ls = lsMap.get(c.id)!;
            const ss = ssMap.get(c.id)!;
            return {
              name: c.name, color: c.color,
              largeScale: Math.round(ls.reduce((a,b)=>a+b,0)/ls.length),
              smallScale: Math.round(ss.reduce((a,b)=>a+b,0)/ss.length),
            };
          });
      }
      ```
      Add the comparison chart to `ProductivityTab` as a second card below the existing chart: `BarChart` with two bars (`"Large-Scale"` in `#7c3aed`, `"Small-Scale"` in `#a855f7`), YAxis label "kg/ha".  
      If `computeScaleComparison()` returns empty, show "Large-scale yield data loading...".
      
      **Export Markets tab** — keep `computeExportData()` unchanged.  
      Add a Coffee+Tea production trend line chart below the existing bar chart:  
      ```
      function computeCashProdTrend(): { year: string; Coffee: number; Tea: number }[] {
        const cd = getCashProdData();
        if (cd.length === 0) return [];
        const years = [...new Set(cd.map(p => p.year))].sort();
        return years.map(y => ({
          year: String(y),
          Coffee: cd.find(p => p.crop === 'Coffee' && p.year === y)?.productionTons ?? 0,
          Tea: cd.find(p => p.crop === 'Tea' && p.year === y)?.productionTons ?? 0,
        }));
      }
      ```
      Add as a second `SolutionArea` card inside `ExportMarketsTab` (or as a standalone chart card below). Title: "Coffee & Tea Export Trend". Use Recharts `LineChart`. If empty, show "Cash crop data loading...".  
      Remove hardcoded production values from the insight boxes (currently `"dropped from 23,375 t (2019) to 18,945 t (2022)"` in CashCrops overview and similar) — in Solutions, the data now comes from `getCashProdData()`, so show computed latest/peak values.
      
      **Smart Tools tab — Prediction Simulator** — `computePredictionData` already tries 2024, falls back to 2023 via `getAllData()`. No hardcoded numbers are present. No change needed; keep as-is. This satisfies the spec requirement.
      
      **Files:** `src/pages/Solutions.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 6. **Reports.tsx** — add "Track 1 Impact Report" section

      **What to do:**  
      Add imports: `getPracticeData, getHarvestData` from `../services/nisr`. `getAllData`, `getCropById`, `getDistrictById` already imported.  
      
      Add three new `useMemo` blocks at the bottom of the existing memo declarations (all depend on `dataVersion`, so add `useDataVersion` hook — `import { useDataVersion } from '../hooks/useAgricultureData'` which is already imported... check: it is NOT imported in Reports.tsx currently. Add it).
      
      **Memo 1 — Crop summary with harvest ratio:**  
      ```
      const cropSummaryWithHarvest = useMemo(() => {
        const hd = getHarvestData();
        const harvestRatioMap = new Map<string, number[]>();
        for (const p of hd) {
          if (!harvestRatioMap.has(p.cropId)) harvestRatioMap.set(p.cropId, []);
          harvestRatioMap.get(p.cropId)!.push(p.harvestRatio);
        }
        return byCropSummary.map(row => ({
          ...row,
          avgHarvestRatio: harvestRatioMap.has(row.cropId)
            ? Math.round(harvestRatioMap.get(row.cropId)!.reduce((a,b)=>a+b,0) / harvestRatioMap.get(row.cropId)!.length * 10) / 10
            : null,
        }));
      }, [byCropSummary, dataVersion]);
      ```
      
      **Memo 2 — Agricultural practices coverage (top 10 districts by total practice area):**  
      ```
      const practicesByDistrict = useMemo(() => {
        const pd = getPracticeData();
        if (pd.length === 0) return [];
        const map = new Map<string, { name: string; irrigationHa: number; erosionHa: number; fertilizerHa: number }>();
        for (const p of pd) {
          if (!map.has(p.districtId)) map.set(p.districtId, { name: p.districtName, irrigationHa: 0, erosionHa: 0, fertilizerHa: 0 });
          const entry = map.get(p.districtId)!;
          if (p.practice === 'Modern irrigated land') entry.irrigationHa += p.areaHa;
          else if (p.practice === 'Erosion control') entry.erosionHa += p.areaHa;
          else if (p.practice === 'Inorganic fertilizer' || p.practice === 'Organic fertilizer') entry.fertilizerHa += p.areaHa;
        }
        return Array.from(map.values())
          .map(v => ({ ...v, totalHa: v.irrigationHa + v.erosionHa + v.fertilizerHa }))
          .sort((a,b) => b.totalHa - a.totalHa)
          .slice(0, 10);
      }, [dataVersion]);
      ```
      
      **Memo 3 — Export potential ranking:**  
      ```
      const exportRanking = useMemo(() => {
        const exportCrops = ['irish-potato', 'wheat', 'rice'];
        const ad = getAllData();
        const latestYear = ad.length > 0 ? Math.max(...ad.filter(p=>p.season==='A').map(p=>p.year)) : 2023;
        const map = new Map<string, number>();
        for (const dp of ad.filter(p => p.season==='A' && p.year===latestYear && exportCrops.includes(p.cropId))) {
          map.set(dp.districtId, (map.get(dp.districtId) ?? 0) + dp.production);
        }
        return Array.from(map.entries())
          .map(([districtId, production]) => {
            const d = getDistrictById(districtId);
            return { districtName: d?.name ?? districtId, province: d?.province ?? '', production: Math.round(production) };
          })
          .sort((a,b) => b.production - a.production)
          .slice(0, 10);
      }, [dataVersion]);
      ```
      
      **Render location:** At the bottom of the report preview `div` (after the Year Comparison table), inside the `reportData.length === 0` conditional's else branch. Actually, the spec says to show these sections whenever data is available from supplementary stores regardless of `reportData`, so add them after the closing `</>` of the existing `reportData.length > 0` block, still inside the report preview `div`.
      
      Show all three sections only when data is available:  
      - `cropSummaryWithHarvest` — always shown (based on `byCropSummary` which exists when `reportData.length > 0`), inside the existing `reportData.length > 0` block. Add "Avg Harvest Ratio (%)" as a 5th column to the existing "Production by Crop" table (show `—` when `avgHarvestRatio === null`).  
      - `practicesByDistrict.length > 0` → show "Agricultural Practices Coverage" table; else show `<p className="text-xs text-gray-400 italic">NISR supplementary data loading...</p>`  
      - `exportRanking.length > 0` → show "Export Potential Ranking" table; else the same placeholder.
      
      Table structure for practices coverage:  
      Columns: District | Irrigation (ha) | Erosion Control (ha) | Fertilizer (ha) | Total (ha)  
      
      Table structure for export ranking:  
      Columns: Rank | District | Province | Combined Production (t)  
      
      All table elements use the same existing table class pattern: `w-full text-sm`, thead `border-b border-gray-200 dark:border-gray-700`, tbody rows `border-b border-gray-100 dark:border-gray-700`.
      
      **Files:** `src/pages/Reports.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 7. **CashCrops.tsx** — add nisr.ts supplementary data as fallback

      **What to do:**  
      Add import at top of file:  
      ```
      import { getCashProdData, getCashAreaData } from '../services/nisr';
      import { useDataVersion } from '../hooks/useAgricultureData';
      ```
      
      In the `useEffect` that calls `Promise.all([fetchCashCropData(), fetchFullYieldTable(), fetchCashCropAreaData()])`, update the `.then()` callback:  
      ```
      .then(([cash, yield_, area]) => {
        if (cancelled) return;
        // Fallback: if direct fetch returned empty, populate from nisr.ts supplementary stores
        let resolvedCash = cash;
        if (resolvedCash.length === 0) {
          const nisr = getCashProdData();
          if (nisr.length > 0) {
            resolvedCash = nisr.map(p => ({ crop: p.crop, year: p.year, productionTons: p.productionTons }));
          }
        }
        let resolvedArea = area;
        if (resolvedArea.length === 0) {
          const nisrArea = getCashAreaData();
          if (nisrArea.length > 0) {
            resolvedArea = nisrArea.map(p => ({
              category: p.category as CashCropAreaPoint['category'],
              crop: p.crop,
              isUnderProduction: p.isActive,
              year: p.year,
              areaThousandHa: p.areaThousandHa,
            }));
          }
        }
        setCashData(resolvedCash);
        setYieldData(yield_);
        setAreaData(resolvedArea);
      })
      ```
      
      Note: `CashAreaPoint` from `cashCrops.ts` has field `isUnderProduction` while `CashAreaPoint` from `nisr.ts` has `isActive`. The mapping above handles this. Double-check the category string literals match `CashCropAreaPoint['category']` union — they do (the four strings are identical between both services).
      
      Add `useDataVersion()` call at component top level to re-trigger the effect on data updates:  
      ```
      const dataVersion = useDataVersion();
      ```  
      Add `dataVersion` to the `useEffect` dependency array so the fallback runs after supplementary data loads.
      
      **TypeScript note:** `CashCropAreaPoint` is imported from `../services/cashCrops`. The `category` field in `nisr.ts`'s `CashAreaPoint` uses the field name `category` with the same 4 string values. Verify the exact strings match — they do: `'Total Coffee area'`, `'Coffee under production'`, `'Total tea area'`, `'Tea area under production'`.  
      The `isActive` field in `CashAreaPoint` (nisr) corresponds to `isUnderProduction` in `CashCropAreaPoint` (cashCrops) — map explicitly.
      
      **Files:** `src/pages/CashCrops.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 8. **AgriMap.tsx** — add "Show Irrigation Coverage" toggle

      **What to do:**  
      Add imports:  
      ```
      import { Droplets } from 'lucide-react';
      import { getPracticeData } from '../services/nisr';
      ```
      
      Add state:  
      ```
      const [showIrrigation, setShowIrrigation] = useState(false);
      ```
      
      Compute irrigation data per district:  
      ```
      const irrigationByDistrict = useMemo(() => {
        const pd = getPracticeData();
        if (pd.length === 0) return new Map<string, number>();
        const map = new Map<string, number>();
        for (const p of pd.filter(x => x.practice === 'Modern irrigated land')) {
          map.set(p.districtId, (map.get(p.districtId) ?? 0) + p.areaHa);
        }
        return map;
      }, [dataVersion]);
      
      const hasIrrigationData = irrigationByDistrict.size > 0;
      ```
      
      Add toggle button above (or below) the info banner, but before `<RwandaMap>`:  
      ```
      <div className="flex items-center gap-3 mb-3">
        {hasIrrigationData ? (
          <button
            onClick={() => setShowIrrigation(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              showIrrigation
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Droplets className="w-4 h-4" />
            {showIrrigation ? 'Showing Irrigation Coverage' : 'Show Irrigation Coverage'}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed" title="Irrigation data loading...">
            <Droplets className="w-4 h-4" />
            Irrigation data loading...
          </div>
        )}
      </div>
      ```
      
      Pass irrigation data to `RwandaMap` via the existing `data` prop pattern. The current `RwandaMap` takes `cropId/season/year` and calls `getProductionByDistrict` internally. To reuse the existing `data` prop, the approach is to pass a new optional prop to `RwandaMap`.  
      
      **Modify `RwandaMap.tsx`** to accept an optional override prop:  
      ```
      interface RwandaMapProps {
        cropId: string;
        season: Season;
        year: number;
        cropName: string;
        onDistrictClick?: (districtId: string) => void;
        // New optional prop:
        irrigationMode?: boolean;
        irrigationData?: Map<string, number>; // districtId → irrigatedHa
      }
      ```
      
      Inside `RwandaMap`, when `irrigationMode === true`:  
      - Replace `byDistrict` with a derived object from `irrigationData`:  
        ```
        const effectiveByDistrict = irrigationMode && irrigationData
          ? new Map(Array.from(irrigationData.entries()).map(([id, ha]) => [id, { production: ha, area: ha, yieldPerHa: 0 }]))
          : byDistrict;
        ```  
      - Replace `productionValues` with irrigation hectare values.  
      - Change the legend label to "Irrigation Coverage (ha)" and the Popup content to show irrigated ha.  
      - Use a blue gradient instead of green: add `blueGradient(t)` function (same math, swap to blue):  
        ```
        function blueGradient(t: number): string {
          const r = Math.round(219 - t * 190); // 219 → 29
          const g = Math.round(234 - t * 174); // 234 → 78  (approx)
          const b = Math.round(254 - t * 30);  // 254 → 224 (stays blue-ish)
          return `rgb(${r}, ${g}, ${b})`;
        }
        ```
        Actually use a simpler blue-to-dark-blue: `rgb(147,197,253)` → `rgb(29,78,216)`:
        ```
        function blueGradient(t: number): string {
          const r = Math.round(147 - t * 118);
          const g = Math.round(197 - t * 119);
          const b = Math.round(253 - t * 37);
          return `rgb(${r}, ${g}, ${b})`;
        }
        ```
      - Add a conditional legend below the map: when `irrigationMode`, show "Irrigation (ha)" label.  
      - Pass the correct Popup content: when `irrigationMode`, show district name + "Irrigated: X ha".
      
      In `AgriMap.tsx`, pass props:  
      ```
      <RwandaMap
        cropId={cropId}
        season={season}
        year={year}
        cropName={crop?.name ?? 'Maize'}
        onDistrictClick={setSelectedDistrictId}
        irrigationMode={showIrrigation}
        irrigationData={irrigationByDistrict}
      />
      ```
      
      **Files:** `src/pages/AgriMap.tsx`, `src/components/map/RwandaMap.tsx`  
      **Verify:** `npm run build` — 0 TypeScript errors

---

- [ ] 9. **Final build verification**

      Run `npm run build` from `e:\Project\Agrinsights app`.  
      Expected: TypeScript reports 0 errors, Vite build completes, output in `dist/`.  
      If any TS errors appear, address them before marking done. Common pitfalls to watch for:  
      - `noUnusedLocals`: any deleted compute function must be fully removed, not just commented out  
      - `noUnusedParameters`: new component props that aren't used in the JSX will error — ensure every new prop is referenced  
      - Type narrowing on `Map.get()`: always null-check with `?? 0` or `!` after `has()` guard  
      - `verbatimModuleSyntax`: use `import type` for type-only imports  
      - `Math.max(...array)` on an empty array returns `-Infinity` — always guard with a fallback: `array.length > 0 ? Math.max(...array) : defaultValue`
      
      **Files:** None (verification only)  
      **Verify:** `npm run build` exits 0

---

## Key risks and mitigations

| Risk | Location | Mitigation |
|---|---|---|
| `Math.max(...[])` returns `-Infinity` | `exportRanking` memo, `computeScaleComparison` | Guard with `ad.filter(...).map(p=>p.year)` length check before spreading |
| `noUnusedLocals` error from deleted interfaces | Solutions.tsx | Delete `IrrigationRow`, `SoilRow`, `CropSummaryRow` if they are only used in the deleted functions |
| `noUnusedParameters` on new props | RwandaMap.tsx | Ensure `irrigationMode` and `irrigationData` are always read in the component body |
| Empty `getPracticeData()` / `getHarvestData()` at initial render | All pages | Every computation starts with a guard `if (store.length === 0) return []` or `return null` |
| Dark mode classes | All new JSX | Match the pattern `bg-{color}-50 dark:bg-{color}-900/20` and `text-{color}-700 dark:text-{color}-300` |
| Recharts `BarChart layout="vertical"` requires `XAxis type="number"` and `YAxis type="category" dataKey="name"` | Dashboard, Solutions Post-Harvest | Use correct axis props for horizontal layout |
| `CashAreaPoint.category` type union mismatch | CashCrops.tsx | Cast `p.category as CashCropAreaPoint['category']` only after confirming string values match |
| `useDataVersion` not yet imported in Reports.tsx | Reports.tsx | Add import from `../hooks/useAgricultureData` |
