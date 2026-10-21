import type { Season } from '../../types/agriculture';
import { crops, years } from '../../services/agricultureData';

interface FilterBarProps {
  cropId: string;
  season: Season;
  year: number;
  onCropChange: (id: string) => void;
  onSeasonChange: (season: Season) => void;
  onYearChange: (year: number) => void;
}

export default function FilterBar({
  cropId,
  season,
  year,
  onCropChange,
  onSeasonChange,
  onYearChange,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {/* Crop selector */}
        <div className="flex flex-col flex-1 min-w-[140px]">
          <label className="text-xs text-gray-500 font-medium mb-1">Crop / Igihingwa</label>
          <select
            value={cropId}
            onChange={(e) => onCropChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full"
          >
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name} ({crop.nameKinyarwanda})
              </option>
            ))}
          </select>
        </div>

        {/* Season selector */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 font-medium mb-1">Season</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['A', 'B', 'C'] as Season[]).map((s) => (
              <button
                key={s}
                onClick={() => onSeasonChange(s)}
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                  season === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Year selector */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 font-medium mb-1">Year / Umwaka</label>
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
