import polygons from "../data/farmPolygons";
import type { FarmFeatureCollection } from "../types/Farm";

const SIMULATED_LATENCY_MS = 450;
const farmCollection: FarmFeatureCollection = polygons;

export const fetchFarms = async (): Promise<FarmFeatureCollection> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(farmCollection))); // TODO: is JSON.parse necessary?
    }, SIMULATED_LATENCY_MS);
  });
