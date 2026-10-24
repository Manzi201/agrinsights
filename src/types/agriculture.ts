// Core domain types for Agrinsights

export type Province = 'Kigali' | 'Eastern' | 'Northern' | 'Southern' | 'Western';
export type Season = 'A' | 'B' | 'C';
export type CropCategory = 'Cereals' | 'Legumes' | 'Roots & Tubers' | 'Bananas' | 'Other';
export type InsightType = 'positive' | 'warning' | 'critical' | 'info';

export interface District {
  id: string;
  name: string;
  province: Province;
  lat: number;
  lng: number;
}

export interface Crop {
  id: string;
  name: string;
  nameKinyarwanda: string;
  category: CropCategory;
  yieldLow: number;
  yieldHigh: number;
  color: string;
}

export interface DataPoint {
  districtId: string;
  cropId: string;
  season: Season;
  year: number;
  production: number; // tons
  area: number; // hectares
  yieldPerHa: number; // tons/ha
}

export interface Filters {
  cropId: string;
  season: Season;
  year: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  cropId?: string;
  districtId?: string;
  season?: Season;
  year?: number;
  metric?: string;
  changePercent?: number;
}

export interface ReportConfig {
  districtIds: string[];
  cropIds: string[];
  seasons: Season[];
  years: number[];
}

export interface SummaryStats {
  totalArea: number;
  totalProduction: number;
  averageYield: number;
  cropCount: number;
  yearChangePercent: number;
}
