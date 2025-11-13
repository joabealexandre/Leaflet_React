import type { FarmFeatureCollection } from "../types/farm";
import polygonsRaw from "../../resources/kgyn_farm.geojson?raw";

const SIMULATED_LATENCY_MS = 450;
const farmCollection: FarmFeatureCollection = JSON.parse(
  polygonsRaw
) as FarmFeatureCollection;

export const fetchFarms = async (): Promise<FarmFeatureCollection> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(farmCollection);
    }, SIMULATED_LATENCY_MS);
  });
