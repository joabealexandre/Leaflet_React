import type { Feature, FeatureCollection, Polygon } from "geojson";

export interface FarmAttributes {
  id: string;
  name: string;
  areaHectares: number;
  revenue: number;
}

export type FarmFeature = Feature<Polygon, FarmAttributes>;

export type FarmFeatureCollection = FeatureCollection<
  Polygon,
  FarmAttributes
>;
