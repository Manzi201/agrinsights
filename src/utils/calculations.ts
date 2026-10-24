import type { DataPoint, Insight, Season } from '../types/agriculture';
import { getAllData, getDistrictById, getCropById, crops, districts, seasons } from '../services/agricultureData';

/** Format a number with thousands separators. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format a number with a unit suffix, e.g. "12,345 t". */
export function formatWithUnit(n: number, unit: string): string {
  return `${formatNumber(n)} ${unit}`;
}

/** Calculate percentage change between two values. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Get all data points matching the given crop, season, and year.
 *  Falls back to all available years if exact year has no data. */
export function filterData(cropId: string, season: Season, year: number): DataPoint[] {
  const all = getAllData();
  const exact = all.filter(
    (dp) => dp.cropId === cropId && dp.season === season && dp.year === year,
  );
  return exact.length > 0 ? exact : all.filter((dp) => dp.cropId === cropId && dp.season === season);
}

/** Aggregate production by district for a given crop, season, and year. */
export function getProductionByDistrict(cropId: string, season: Season, year: number) {
  const data = filterData(cropId, season, year);  const byDistrict = new Map<string, { production: number; area: number; yieldPerHa: number }>();

  for (const dp of data) {
    const existing = byDistrict.get(dp.districtId);
    if (existing) {
      existing.production += dp.production;
      existing.area += dp.area;
    } else {
      byDistrict.set(dp.districtId, {
        production: dp.production,
        area: dp.area,
        yieldPerHa: 0,
      });
    }
  }

  for (const [, val] of Array.from(byDistrict)) {
    val.yieldPerHa = val.area > 0 ? Math.round((val.production / val.area) * 100) / 100 : 0;
    val.production = Math.round(val.production);
    val.area = Math.round(val.area);
  }

  return byDistrict;
}

/**
 * Generate automated insights from the data.
 * Looks for notable changes, trends, and outliers.
 */
export function generateInsights(
  cropId: string,
  season: Season,
  year: number,
): Insight[] {
  const insights: Insight[] = [];
  const crop = getCropById(cropId);
  if (!crop) return insights;

  // 1. Year-over-year change per district
  const currentData = filterData(cropId, season, year);
  const prevData = filterData(cropId, season, year - 1);

  const currentByDistrict = new Map<string, number>();
  const prevByDistrict = new Map<string, number>();

  for (const dp of currentData) {
    currentByDistrict.set(dp.districtId, (currentByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }
  for (const dp of prevData) {
    prevByDistrict.set(dp.districtId, (prevByDistrict.get(dp.districtId) ?? 0) + dp.production);
  }

  const changes: { districtId: string; change: number; current: number; prev: number }[] = [];
  for (const [districtId, current] of currentByDistrict) {
    const prev = prevByDistrict.get(districtId) ?? 0;
    if (prev > 0) {
      const change = ((current - prev) / prev) * 100;
      changes.push({ districtId, change, current, prev });
    }
  }

  // Sort by biggest drops first
  changes.sort((a, b) => a.change - b.change);

  // Report the biggest decline
  if (changes.length > 0 && changes[0].change < -5) {
    const d = changes[0];
    const district = getDistrictById(d.districtId);
    insights.push({
      id: `decline-${d.districtId}-${year}`,
      type: d.change < -15 ? 'critical' : 'warning',
      title: `${crop.name} production dropped ${Math.abs(Math.round(d.change * 10) / 10)}% in ${district?.name}`,
      description: `${district?.name} saw production fall from ${formatNumber(d.prev)} t to ${formatNumber(d.current)} t in Season ${season} ${year} compared to ${year - 1}. It is recommended to investigate rainfall data, seed varieties, and farming practices to identify the cause.`,
      cropId,
      districtId: d.districtId,
      season,
      year,
      metric: 'production',
      changePercent: Math.round(d.change * 10) / 10,
    });
  }

  // Report the biggest increase
  if (changes.length > 0 && changes[changes.length - 1].change > 5) {
    const d = changes[changes.length - 1];
    const district = getDistrictById(d.districtId);
    insights.push({
      id: `increase-${d.districtId}-${year}`,
      type: 'positive',
      title: `${crop.name} production rose ${Math.round(d.change * 10) / 10}% in ${district?.name}`,
      description: `${district?.name} increased from ${formatNumber(d.prev)} t to ${formatNumber(d.current)} t in Season ${season} ${year}. This improvement could serve as a model for neighboring districts.`,
      cropId,
      districtId: d.districtId,
      season,
      year,
      metric: 'production',
      changePercent: Math.round(d.change * 10) / 10,
    });
  }

  // 2. Highest yield district
  const yieldByDistrict = getProductionByDistrict(cropId, season, year);
  let bestYield: { districtId: string; yieldPerHa: number } | null = null;
  for (const [districtId, val] of yieldByDistrict) {
    if (!bestYield || val.yieldPerHa > bestYield.yieldPerHa) {
      bestYield = { districtId, yieldPerHa: val.yieldPerHa };
    }
  }
  if (bestYield && bestYield.yieldPerHa > 0) {
    const district = getDistrictById(bestYield.districtId);
    insights.push({
      id: `best-yield-${year}`,
      type: 'info',
      title: `${district?.name} has the highest ${crop.name} yield at ${bestYield.yieldPerHa} t/ha`,
      description: `${district?.name} in ${district?.province} Province achieves ${bestYield.yieldPerHa} tons per hectare for ${crop.name} in Season ${season} ${year}, above the national average for this crop.`,
      cropId,
      districtId: bestYield.districtId,
      season,
      year,
      metric: 'yield',
    });
  }

  // 3. National trend
  const totalCurrent = currentData.reduce((s, dp) => s + dp.production, 0);
  const totalPrev = prevData.reduce((s, dp) => s + dp.production, 0);
  if (totalPrev > 0) {
    const natChange = ((totalCurrent - totalPrev) / totalPrev) * 100;
    insights.push({
      id: `national-trend-${year}`,
      type: Math.abs(natChange) < 3 ? 'info' : natChange > 0 ? 'positive' : 'warning',
      title: `National ${crop.name} production ${natChange > 0 ? 'up' : 'down'} ${Math.abs(Math.round(natChange * 10) / 10)}% in ${year}`,
      description: `Total ${crop.name} production for Season ${season} ${year} is ${formatNumber(totalCurrent)} t compared to ${formatNumber(totalPrev)} t in ${year - 1}. ${
        natChange > 0 ? 'This suggests a positive trend.' : 'This suggests a need for intervention.'
      }`,
      cropId,
      season,
      year,
      metric: 'national-production',
      changePercent: Math.round(natChange * 10) / 10,
    });
  }

  // 4. Season comparison
  const otherSeasons = seasons.filter((s) => s !== season);
  for (const otherSeason of otherSeasons) {
    const otherData = filterData(cropId, otherSeason, year);
    const otherTotal = otherData.reduce((s, dp) => s + dp.production, 0);
    if (otherTotal > 0 && totalCurrent > 0) {
      const diff = ((totalCurrent - otherTotal) / otherTotal) * 100;
      if (Math.abs(diff) > 20) {
        insights.push({
          id: `season-comp-${season}-${otherSeason}-${year}`,
          type: 'info',
          title: `Season ${season} produces ${diff > 0 ? 'more' : 'less'} ${crop.name} than Season ${otherSeason}`,
          description: `Season ${season} ${year} production is ${formatNumber(totalCurrent)} t vs Season ${otherSeason}'s ${formatNumber(otherTotal)} t (${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}%).`,
          cropId,
          season,
          year,
          metric: 'season-comparison',
          changePercent: Math.round(diff * 10) / 10,
        });
      }
    }
  }

  return insights;
}

/** Compare multiple crops across districts and seasons. */
export function compareCrops(
  cropIds: string[],
  districtIds: string[],
  season: Season,
  year: number,
) {
  const results: { cropId: string; cropName: string; districtId: string; districtName: string; production: number; area: number; yieldPerHa: number }[] = [];

  for (const cropId of cropIds) {
    const crop = getCropById(cropId);
    for (const districtId of districtIds) {
      const district = getDistrictById(districtId);
      const data = getAllData().filter(
        (dp) => dp.cropId === cropId && dp.districtId === districtId && dp.season === season && dp.year === year,
      );
      const production = data.reduce((s, dp) => s + dp.production, 0);
      const area = data.reduce((s, dp) => s + dp.area, 0);
      const yieldPerHa = area > 0 ? Math.round((production / area) * 100) / 100 : 0;
      results.push({
        cropId,
        cropName: crop?.name ?? cropId,
        districtId,
        districtName: district?.name ?? districtId,
        production: Math.round(production),
        area: Math.round(area),
        yieldPerHa,
      });
    }
  }

  return results;
}

/** Get available crops, districts, seasons, and years for UI selectors. */
export function getSelectors() {
  return {
    crops: crops.map((c) => ({ id: c.id, name: c.name, nameKinyarwanda: c.nameKinyarwanda, color: c.color })),
    districts: districts.map((d) => ({ id: d.id, name: d.name, province: d.province })),
    seasons,
  };
}
