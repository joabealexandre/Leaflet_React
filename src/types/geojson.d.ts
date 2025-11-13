import type { FarmFeatureCollection } from "./farm";

declare module "*.geojson?raw" {
  const value: string;
  export default value;
}
