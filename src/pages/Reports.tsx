import { useRef, useMemo, useState } from 'react';
import type { Season } from '../types/agriculture';
import { crops, districts, years, seasons, getAllData, getDistrictById, getCropById } from '../services/agricultureData';
import { formatNumber, percentChange } from '../utils/calculations';
import { exportToCSV, exportReportToPDF, dataPointsToCSVRows } from '../utils/exportUtils';
import { useDataVersion } from '../hooks/useAgricultureData';
import { FileDown, FileText, Printer } from 'lucide-react';

export default function Reports() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<Season[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([2024]);
  const [exporting, setExporting] = useState(false);
  const dataVersion = useDataVersion();

  const toggle = <T,>(arr: T[], val: T, setArr: (v: T[]) => void) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  // Filter data based on report config
  const reportData = useMemo(() => {
    return getAllData().filter((dp) => {
      if (selectedDistricts.length > 0 && !selectedDistricts.includes(dp.districtId)) return false;
      if (selectedCrops.length > 0 && !selectedCrops.includes(dp.cropId)) return false;
      if (selectedSeasons.length > 0 && !selectedSeasons.includes(dp.season)) return false;
      if (selectedYears.length > 0 && !selectedYears.includes(dp.year)) return false;
      return true;
    });
  }, [selectedDistricts, selectedCrops, selectedSeasons, selectedYears, dataVersion]);

  // Summary stats
  const summary = useMemo(() => {
    const totalProduction = reportData.reduce((s, dp) => s + dp.production, 0);
    const totalArea = reportData.reduce((s, dp) => s + dp.area, 0);
    const avgYield = totalArea > 0 ? totalProduction / totalArea : 0;
    return {
      totalProduction: Math.round(totalProduction),
      totalArea: Math.round(totalArea),
      avgYield: Math.round(avgYield * 100) / 100,
      recordCount: reportData.length,
    };
  }, [reportData]);

  // Production by crop summary
  const byCropSummary = useMemo(() => {
    const map = new Map<string, { production: number; area: number; yield: number }>();
    for (const dp of reportData) {
      const existing = map.get(dp.cropId) ?? { production: 0, area: 0, yield: 0 };
      existing.production += dp.production;
      existing.area += dp.area;
      map.set(dp.cropId, existing);
    }
    return Array.from(map.entries())
      .map(([cropId, val]) => {
        const crop = getCropById(cropId);
        return {
          cropId,
          cropName: crop?.name ?? cropId,
          production: Math.round(val.production),
          area: Math.round(val.area),
          yield: val.area > 0 ? Math.round((val.production / val.area) * 100) / 100 : 0,
        };
      })
      .sort((a, b) => b.production - a.production);
  }, [reportData]);

  // Production by district summary
  const byDistrictSummary = useMemo(() => {
    const map = new Map<string, { production: number; area: number }>();
    for (const dp of reportData) {
      const existing = map.get(dp.districtId) ?? { production: 0, area: 0 };
      existing.production += dp.production;
      existing.area += dp.area;
      map.set(dp.districtId, existing);
    }
    return Array.from(map.entries())
      .map(([districtId, val]) => {
        const district = getDistrictById(districtId);
        return {
          districtId,
          districtName: district?.name ?? districtId,
          province: district?.province ?? '',
          production: Math.round(val.production),
          area: Math.round(val.area),
          yield: val.area > 0 ? Math.round((val.production / val.area) * 100) / 100 : 0,
        };
      })
      .sort((a, b) => b.production - a.production);
  }, [reportData]);

  // Year comparison
  const yearComparison = useMemo(() => {
    const map = new Map<number, number>();
    for (const dp of reportData) {
      map.set(dp.year, (map.get(dp.year) ?? 0) + dp.production);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([year, production], i) => ({
      year,
      production: Math.round(production),
      change: i > 0 ? percentChange(production, sorted[i - 1][1]) : 0,
    }));
  }, [reportData]);

  const handleCSVExport = () => {
    const rows = dataPointsToCSVRows(reportData);
    exportToCSV(rows, `agrinsights-report-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handlePDFExport = () => {
    setExporting(true);
    const summaryLines = [
      `Total Production: ${formatNumber(summary.totalProduction)} tons`,
      `Total Area: ${formatNumber(summary.totalArea)} hectares`,
      `Average Yield: ${summary.avgYield} tons/ha`,
      `Records: ${summary.recordCount}`,
      `Districts: ${selectedDistricts.length === 0 ? 'All' : selectedDistricts.length}`,
      `Crops: ${selectedCrops.length === 0 ? 'All' : selectedCrops.length}`,
      `Seasons: ${selectedSeasons.length === 0 ? 'All' : selectedSeasons.join(', ')}`,
      `Years: ${selectedYears.length === 0 ? 'All' : selectedYears.join(', ')}`,
    ];

    const tableHeaders = ['District', 'Crop', 'Season', 'Year', 'Prod (t)', 'Area (ha)', 'Yield'];
    const tableRows = reportData.slice(0, 200).map((dp) => {
      const d = getDistrictById(dp.districtId);
      const c = getCropById(dp.cropId);
      return [
        d?.name ?? dp.districtId,
        c?.name ?? dp.cropId,
        dp.season,
        String(dp.year),
        String(dp.production),
        String(dp.area),
        String(dp.yieldPerHa),
      ];
    });

    exportReportToPDF(
      'Agrinsights — Agricultural Report',
      summaryLines,
      tableHeaders,
      tableRows,
      `agrinsights-report-${new Date().toISOString().split('T')[0]}.pdf`,
    );
    setExporting(false);
  };

  return (
    <div>
      {/* Configuration form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-5 mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Report Configuration — Igena raporo</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Districts */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Districts (empty = all)
            </label>
            <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
              {districts.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={selectedDistricts.includes(d.id)}
                    onChange={() => toggle(selectedDistricts, d.id, setSelectedDistricts)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-gray-700">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.province}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Crops */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Crops (empty = all)
            </label>
            <div className="border border-gray-200 rounded-lg p-2 space-y-1">
              {crops.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCrops.includes(c.id)}
                    onChange={() => toggle(selectedCrops, c.id, setSelectedCrops)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-gray-700">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Seasons */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Seasons (empty = all)
            </label>
            <div className="space-y-2">
              {seasons.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSeasons.includes(s)}
                    onChange={() => toggle(selectedSeasons, s, setSelectedSeasons)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-gray-700">Season {s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Years */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Years (empty = all)
            </label>
            <div className="space-y-2">
              {years.map((y) => (
                <label key={y} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(y)}
                    onChange={() => toggle(selectedYears, y, setSelectedYears)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-gray-700">{y}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handlePDFExport}
            disabled={exporting || reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleCSVExport}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report preview */}
      <div ref={reportRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Printer className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-bold text-gray-900">Agricultural Report Preview</h3>
        </div>

        {/* Report meta */}
        <div className="text-sm text-gray-500 mb-4">
          <p>
            Districts: {selectedDistricts.length === 0 ? 'All Rwanda (30 districts)' : selectedDistricts.map((id) => getDistrictById(id)?.name).join(', ')}
          </p>
          <p>
            Crops: {selectedCrops.length === 0 ? 'All crops' : selectedCrops.map((id) => getCropById(id)?.name).join(', ')}
          </p>
          <p>
            Seasons: {selectedSeasons.length === 0 ? 'All seasons' : selectedSeasons.join(', ')} |
            Years: {selectedYears.length === 0 ? 'All years' : selectedYears.join(', ')}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-primary-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Production</p>
            <p className="text-lg font-bold text-primary-700">{formatNumber(summary.totalProduction)} t</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Area</p>
            <p className="text-lg font-bold text-amber-700">{formatNumber(summary.totalArea)} ha</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Average Yield</p>
            <p className="text-lg font-bold text-blue-700">{summary.avgYield} t/ha</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Data Records</p>
            <p className="text-lg font-bold text-purple-700">{formatNumber(summary.recordCount)}</p>
          </div>
        </div>

        {reportData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Select filters above and data will appear in the report preview.
          </div>
        ) : (
          <>
            {/* Production by crop table */}
            {byCropSummary.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Production by Crop</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Crop</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Production (t)</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Area (ha)</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Yield (t/ha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCropSummary.map((row) => (
                      <tr key={row.cropId} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-700">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: crops.find((c) => c.id === row.cropId)?.color }} />
                            {row.cropName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{formatNumber(row.production)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatNumber(row.area)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{row.yield}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Production by district table */}
            {byDistrictSummary.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Production by District</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">District</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Province</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Production (t)</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Area (ha)</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Yield (t/ha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDistrictSummary.slice(0, 15).map((row) => (
                      <tr key={row.districtId} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-700">{row.districtName}</td>
                        <td className="py-2 px-3 text-gray-500">{row.province}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatNumber(row.production)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatNumber(row.area)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{row.yield}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {byDistrictSummary.length > 15 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Showing top 15 of {byDistrictSummary.length} districts. See full data in CSV export.
                  </p>
                )}
              </div>
            )}

            {/* Year comparison */}
            {yearComparison.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Year Comparison</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Year</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Production (t)</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Change (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearComparison.map((row) => (
                      <tr key={row.year} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-700">{row.year}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatNumber(row.production)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${row.change > 0 ? 'text-green-600' : row.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {row.change > 0 ? '+' : ''}{row.change}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
