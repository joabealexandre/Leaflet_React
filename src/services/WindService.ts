import type { WindVector } from "../mocks/wind";
import { MOCK_WIND_VECTORS } from "../mocks/wind";

const SIMULATED_LATENCY_MS = 400;

export const fetchWindVectors = async (): Promise<WindVector[]> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_WIND_VECTORS);
    }, SIMULATED_LATENCY_MS);
  });

