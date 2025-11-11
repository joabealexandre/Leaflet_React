import type { FarmFeatureCollection } from "./Farm";

declare module "*.geojson" {
  const value: FarmFeatureCollection;
  export default value;
}

declare module "*.geojson?raw" {
  const value: string;
  export default value;
}
