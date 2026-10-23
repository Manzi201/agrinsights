# Solutions Page — Smart Tabs & Tools Implementation

The rebuilt Solutions page introduces a six-tab layout (Irrigation, Soil & Fertility, Post-Harvest, Productivity, Export Markets, Smart Tools) with four interactive data tools in the Smart Tools tab. All content is computed from the live `getAllData()` service and displayed via recharts. The page is written in English and carries dark-mode variants throughout.

Watch for: **(1)** `computeRoutingData` slices the bottom-5 from all 30 districts sorted by production, so for narrow crops the "Needs Supply" set will be populated entirely by zero-production districts — confirmed by reading the code. **(2)** The Prediction Simulator chart plots yield as `Yield ×100` on the same axis as production and area; the Tooltip formatter rescales it, but the bar label is confusing to users — likely to cause questions.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The tab system uses a single `useState<TabId>` at the `Solutions` root. `TabBar` applies active/inactive styles through a ternary and all six IDs are wired to conditional renders — exhaustive, no stray state.

`PredictionSimulator` projection math is multiplicatively correct: `projectedProd = (currentArea × (1 + areaExpand/100)) × (currentYield × (1 + yieldImprove/100))`. The BarChart groups Production, Area, and Yield×100 into Current/Projected bars. The ×100 yield encoding is a single-axis layout workaround; the Tooltip formatter rescales it via a string match on `'Yield ×100'` — correct but fragile.

`SupplyGapFinder` uses a hardcoded population proxy for demand (`DISTRICT_POP[d.id] * 0.3 * 0.1`), which is crop-agnostic. The 2-nearest-surplus-neighbor search applies Haversine correctly using `districts[].lat/lng`. Nearly every district will show a surplus because the demand constant is small relative to agricultural production volumes — the tool is most useful as a relative comparison.

`OpportunityFinder` generates cards for four tag types: Improvement (yield <70% of national avg), Intensification (large area but below-avg yield), Risk Alert (>5% national production drop year-over-year), and Investment (three consecutive years of growth). Cards are capped at 80 and filtered client-side. Filter-button counts are recomputed inline on every render — minor inefficiency.

`RegionalSupplyRouting` picks the bottom-5 by production from the full 30-district sorted list. For crops grown in fewer than 30 districts, zero-production districts always land in the bottom slice, producing routing rows that route to a supply hub for a crop the district has never grown.

Dark mode is applied consistently across all containers, tables, badges, inputs, and chart colors. TypeScript compiles clean. All UI text is English.

---

<details>
<summary>Issues (3)</summary>

1. **Zero-production districts in bottom-5 routing** (HIGH) — `computeRoutingData` uses `sorted.slice(-5)` from all 30 districts. Districts with 0 production for the selected crop always fall to the bottom. For a crop like wheat or rice, the "Needs Supply" table will list districts that simply don't grow that crop, not districts with an actual supply shortage. Fix: filter `production > 0` before slicing, or separate "not grown here" from "grown but undersupplied" with a status column.

2. **Prediction chart Yield ×100 label** (MEDIUM) — Yield is multiplied by 100 to plot on the same axis as production (tons) and area (ha). The bar group is labeled `metric: 'Yield ×100'` and the Tooltip formatter detects the string `name === 'Yield ×100'` to divide back. The bar will display as e.g. 847 while the tooltip shows 8.47 t/ha — guaranteed to confuse reviewers and end users. The string-match rescale will also silently break if the metric label changes. Fix: use a composed bar chart with a secondary Y-axis for yield, or drop yield from the grouped chart and show it as a separate stat card.

3. **Opportunity Finder filter-count double computation** (LOW) — Each filter button calls `cards.filter(c => c.tag === fo.value).length` inline in JSX, firing on every parent render. Fix: derive counts into a `useMemo` map keyed by tag.

</details>

---

<details>
<summary>Details</summary>

### Zero-production districts in routing (confirmed)

```typescript
const sorted = districts
  .map((d) => ({ district: d, production: prodByDistrict.get(d.id) ?? 0 }))
  .sort((a, b) => b.production - a.production);

const bottom5 = sorted.slice(-5);
```

`prodByDistrict` is built from the filtered dataset — districts absent from the dataset get `?? 0`. For wheat (grown predominantly in northern districts), roughly half the 30 districts will have `production = 0`, and those will consistently occupy the bottom-5. The routing table will then show e.g. Kicukiro (an urban district) paired with a northern supply hub, with a "production gap" equal to the hub's full output — a meaningless number.

### Prediction Simulator — correct math, fragile chart

The projection formula is sound. The chart issue is an axis-collapse workaround:

```typescript
{ metric: 'Yield ×100', Current: Math.round(result.currentYield * 100), Projected: Math.round(result.projectedYield * 100) }
```

The Tooltip formatter:
```typescript
formatter={(v, name) => {
  if (name === 'Yield ×100') return [(v as number / 100).toFixed(2) + ' t/ha', 'Yield'];
  ...
}}
```

The `name` parameter in a recharts `Tooltip` formatter is the `dataKey`, not the `metric` field. `dataKey` here is `"Current"` or `"Projected"`, not `"Yield ×100"`. The condition `name === 'Yield ×100'` will never be true — the formatter always falls through to `formatNumber(v as number)`, displaying `847` instead of `8.47 t/ha`. This is a confirmed bug: yield will always render as the raw ×100 integer in the tooltip.

### Opportunity Finder — four tag types present

All four tag types are generated and filter correctly. The `useMemo(() => computeOpportunityData(), [])` empty-deps memoization means cards don't recompute on theme changes, which is intentional since the computation is expensive.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|------|-------------|
| `src/pages/Solutions.tsx` | Complete rebuild — six-tab layout, five data-driven SolutionArea cards, four Smart Tools (PredictionSimulator, SupplyGapFinder, OpportunityFinder, RegionalSupplyRouting), Haversine routing, dark-mode coverage |

Full diff: `git diff main -- src/pages/Solutions.tsx`

</details>
