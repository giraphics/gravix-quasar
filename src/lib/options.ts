import { BackendPreference } from '@giraphics/gravix-engine';

export interface LaunchOptions {
  readonly preference: BackendPreference;
  readonly failDeviceCreation: boolean;
  readonly pointCapacity: number;
}

function queryParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.indexOf('?');
  if (hashQuery >= 0) {
    const fromHash = new URLSearchParams(window.location.hash.slice(hashQuery));
    for (const [key, value] of fromHash) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }
  }
  return params;
}

export function readLaunchOptions(): LaunchOptions {
  const params = queryParams();
  const points = Number(params.get('points') ?? 300_000);
  return {
    preference:
      params.get('backend') === 'webgl' ? BackendPreference.WebGL2 : BackendPreference.Auto,
    failDeviceCreation: params.get('failDevice') === '1',
    pointCapacity: Number.isFinite(points) && points > 0 ? Math.floor(points) : 300_000,
  };
}
