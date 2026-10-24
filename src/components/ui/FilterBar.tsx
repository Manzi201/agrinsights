import { useEffect } from 'react';
import type { Season } from '../../types/agriculture';
import { crops, getAvailableYears } from '../../services/agricultureData';
import { useDataVersion } from '../../hooks/useAgricultureData';

interface FilterBarProps {
  cropId: string;
  season: Season;
  year: number;
  onCropChange: (id: string) => void;
  onSeasonChange: (season: Season) => void;
  onYearChange: (year: number) => void;
}

export default function FilterBar({ cropId, season, year, onCropChange, onSeasonChange, onYearChange }: FilterBarProps) {
  useDataVersion(); // re-render when store updates

  // Only show years that have real data for this exact crop + season combo
  const availableYears = getAvailableYears(cropId, season);

  // If the current year is not available for this combo, snap to the last available
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      onYearChange(availableYears[availableYears.length - 1]);
    }
  }, [cropId, season, availableYears, year, onYearChange]);

  const selectCls = [
    'px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full',
    'border-gray-300 dark:border-gray-600',
    'bg-white dark:bg-gray-700',
    'text-gray-800 dark:text-gray-100',
  ].join(' ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">

        {/* Crop */}
        <div className="flex flex-col flex-1 min-w-[150px]">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Crop</label>
          <select value={cropId} onChange={(e) => onCropChange(e.target.value)} className={selectCls}>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Season */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Season</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            {(['A', 'B', 'C'] as Season[]).map((s) => (
              <button
                key={s}
                onClick={() => onSeasonChange(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  season === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Year — only shows years with actual data for this crop+season */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Year</label>
          {availableYears.length > 0 ? (
            <select
              value={availableYears.includes(year) ? year : availableYears[availableYears.length - 1]}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className={selectCls + ' min-w-[90px]'}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs min-w-[90px]">
              No data
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
