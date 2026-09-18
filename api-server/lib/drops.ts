export type DropRecord = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  bypassRadius?: boolean;
};

/**
 * Authoritative drop records. The client keeps its own copy for display, but
 * only these coordinates decide whether a check-in passes.
 */
export const DROPS: DropRecord[] = [
  {
    id: 'neon-alley',
    latitude: 50.262562,
    longitude: -5.0506975,
    radiusMeters: 100,
  },
  {
    id: 'skyline-moment',
    latitude: 50.262562,
    longitude: -5.0506975,
    radiusMeters: 150,
  },
  {
    id: 'ramen-spot',
    latitude: 35.658,
    longitude: 139.7016,
    radiusMeters: 100,
  },
  {
    // Reviewer access. The radius check is skipped so this can be minted from
    // anywhere; mock-location detection, accuracy bounds, travel-speed and the
    // full bond cycle all still run exactly as they do for a real drop.
    id: 'demo-anywhere',
    latitude: 0,
    longitude: 0,
    radiusMeters: 0,
    bypassRadius: true,
  },
];

export function getDropById(id: string | undefined): DropRecord | undefined {
  if (!id) return undefined;
  return DROPS.find((drop) => drop.id === id);
}