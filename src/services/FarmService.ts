import polygonsRaw from "../../resources/kgyn_farm.geojson?raw";
import type { FarmFeatureCollection } from "../types/Farm";

const SIMULATED_LATENCY_MS = 450;
const farmCollection: FarmFeatureCollection = JSON.parse(
  polygonsRaw
) as FarmFeatureCollection;

export const fetchFarms = async (): Promise<FarmFeatureCollection> =>
  new Promise((resolve) => {
    setTimeout(() => {
      const farms:any = JSON.parse(JSON.stringify(farmCollection));

      resolve(JSON.parse(JSON.stringify(farmCollection))); // TODO: is JSON.parse necessary?
    }, SIMULATED_LATENCY_MS);
  });
