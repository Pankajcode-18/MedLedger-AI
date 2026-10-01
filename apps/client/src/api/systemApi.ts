import { apiClient } from './apiClient.js';

let demoModeCache: Promise<boolean> | null = null;

export const systemApi = {
  /** true while the server runs with the demo accounts switched on (DEMO_ACCOUNTS=true) */
  demoMode: (): Promise<boolean> => {
    if (!demoModeCache) {
      demoModeCache = apiClient
        .get('/health')
        .then((res) => Boolean(res.data?.demoMode))
        .catch(() => false);
    }
    return demoModeCache;
  }
};

export interface HealthCheck {
  reachable: boolean;
  ms: number;
  mongoConnected: boolean;
}

/** Calls the server's health endpoint and times the round trip. */
export const checkHealth = async (): Promise<HealthCheck> => {
  const t0 = performance.now();
  try {
    const res = await apiClient.get('/health');
    return { reachable: true, ms: Math.round(performance.now() - t0), mongoConnected: Boolean(res.data?.mongoConnected) };
  } catch {
    return { reachable: false, ms: Math.round(performance.now() - t0), mongoConnected: false };
  }
};
