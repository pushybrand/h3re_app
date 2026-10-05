export type DropRecord = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  bypassRadius?: boolean;
};

/**
 * The authoritative drop list. These coordinates are the only ones that
 * decide whether a check-in passes - the app ships its own copy for
 * display, but it has no say in verification.
 */
export const DROPS: DropRecord[] = [
  { id: 'eden-project', latitude: 50.36194, longitude: -4.74472, radiusMeters: 100 },
  { id: 'breakpoint-london', latitude: 51.496281, longitude: -0.21111, radiusMeters: 100 },
  { id: 'shoreditch', latitude: 51.5238, longitude: -0.0762, radiusMeters: 100 },
  { id: 'superteam-exeter', latitude: 50.7169084, longitude: -3.5294602, radiusMeters: 100 },
  { id: 'demo-anywhere', latitude: 0, longitude: 0, radiusMeters: 0, bypassRadius: true },
];

export function getDropById(id: string | undefined): DropRecord | undefined {
  if (!id) return undefined;
  return DROPS.find((drop) => drop.id === id);
}