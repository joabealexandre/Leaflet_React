import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { Weather } from "./weather";

export interface FarmAttributes {
  id: string;
  name: string;
  areaHectares: number;
  revenue: number;
  weather?: Weather;
}

export type FarmFeature = Feature<Polygon, FarmAttributes>;

export type FarmFeatureCollection = FeatureCollection<Polygon, FarmAttributes>;
