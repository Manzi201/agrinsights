import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Season } from '../../types/agriculture';
import { districts } from '../../services/agricultureData';
import { getProductionByDistrict, formatNumber } from '../../utils/calculations';

interface RwandaMapProps {
  cropId: string;
  season: Season;
  year: number;
  cropName: string;
  onDistrictClick?: (districtId: string) => void;
  // Irrigation overlay (optional)
  irrigationMode?: boolean;
  irrigationData?: Map<string, number>; // districtId → irrigatedHa
}

// Map a 0–1 value to a green color gradient (light → dark)
function greenGradient(t: number): string {
  const r = Math.round(240 - t * 226); // 240 → 14
  const g = Math.round(253 - t * 100); // 253 → 153
  const b = Math.round(244 - t * 197); // 244 → 47
  return `rgb(${r}, ${g}, ${b})`;
}

// Map a 0–1 value to a blue color gradient (light → dark blue)
function blueGradient(t: number): string {
  const r = Math.round(147 - t * 118);
  const g = Math.round(197 - t * 119);
  const b = Math.round(253 - t * 37);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function RwandaMap({
  cropId, season, year, cropName, onDistrictClick,
  irrigationMode = false, irrigationData,
}: RwandaMapProps) {
  const byDistrict = getProductionByDistrict(cropId, season, year);

  // When in irrigation mode, derive values from irrigationData; otherwise use production data
  const effectiveValues = new Map<string, number>();
  if (irrigationMode && irrigationData) {
    for (const [id, ha] of irrigationData) effectiveValues.set(id, ha);
  } else {
    for (const [id, data] of byDistrict) effectiveValues.set(id, data.production);
  }

  const valuesArr = Array.from(effectiveValues.values()).filter((v) => v > 0);
  const maxVal = valuesArr.length > 0 ? Math.max(...valuesArr) : 1;
  const minVal = valuesArr.length > 0 ? Math.min(...valuesArr) : 0;

  // Keep backward-compat aliases
  const productionValues = Array.from(byDistrict.values()).map((v) => v.production).filter((p) => p > 0);
  const maxProd = productionValues.length > 0 ? Math.max(...productionValues) : 1;
  const minProd = productionValues.length > 0 ? Math.min(...productionValues) : 0;

  const colorFn = irrigationMode ? blueGradient : greenGradient;
  const borderColor = irrigationMode ? '#1e3a8a' : '#166534';
  const legendLabel = irrigationMode ? 'Irrigation (ha)' : 'Production (tons)';
  const legendMin = irrigationMode ? minVal : minProd;
  const legendMax = irrigationMode ? maxVal : maxProd;

  return (
    <div className="relative">
      <div style={{ height: 'clamp(300px, 60vh, 550px)' }} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <MapContainer
          center={[-1.9, 29.8]}
          zoom={8}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            maxZoom={19}
          />

          {districts.map((district) => {
            const data = byDistrict.get(district.id);
            const production = data?.production ?? 0;
            const area = data?.area ?? 0;
            const yieldPerHa = data?.yieldPerHa ?? 0;
            const irrigatedHa = irrigationData?.get(district.id) ?? 0;

            const displayValue = irrigationMode ? irrigatedHa : production;
            if (displayValue === 0) return null;

            const t = maxVal > minVal ? (displayValue - minVal) / (maxVal - minVal) : 0.5;
            const fillColor = colorFn(t);
            const radius = 8 + t * 16; // 8px → 24px

            return (
              <CircleMarker
                key={district.id}
                center={[district.lat, district.lng]}
                radius={radius}
                pathOptions={{
                  color: borderColor,
                  weight: 1,
                  fillColor,
                  fillOpacity: 0.75,
                }}
                eventHandlers={{
                  click: () => onDistrictClick?.(district.id),
                }}
              >
                <Popup>
                  <div style={{ minWidth: '160px' }}>
                    <strong style={{ fontSize: '14px' }}>{district.name}</strong>
                    <br />
                    <span style={{ fontSize: '12px', color: '#666' }}>{district.province} Province</span>
                    <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #eee' }} />
                    <div style={{ fontSize: '12px' }}>
                      {irrigationMode ? (
                        <>
                          <div>Irrigated: <strong>{formatNumber(irrigatedHa)} ha</strong></div>
                        </>
                      ) : (
                        <>
                          <div>Crop: <strong>{cropName}</strong></div>
                          <div>Production: <strong>{formatNumber(production)} t</strong></div>
                          <div>Area: <strong>{formatNumber(area)} ha</strong></div>
                          <div>Yield: <strong>{yieldPerHa} t/ha</strong></div>
                          <div>Season: <strong>{season}</strong> | Year: <strong>{year}</strong></div>
                        </>
                      )}
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -5]}>
                  {district.name}: {irrigationMode ? `${formatNumber(irrigatedHa)} ha irrigated` : `${formatNumber(production)} t`}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-3 z-[1000]">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{legendLabel}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(legendMin)}</span>
          <div
            className="h-3 w-32 rounded"
            style={{
              background: `linear-gradient(to right, ${colorFn(0)}, ${colorFn(0.5)}, ${colorFn(1)})`,
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(legendMax)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">Low</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">High</span>
        </div>
      </div>
    </div>
  );
}
