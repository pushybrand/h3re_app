export type DropRecord = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export const DROPS: DropRecord[] = [
  {
    id: 'neon-alley',
    latitude: 50.3363767,
    longitude: -4.8672183,
    radiusMeters: 100,
  },
  {
    id: 'skyline-moment',
    latitude: 35.6595,
    longitude: 139.7004,
    radiusMeters: 150,
  },
  {
    id: 'ramen-spot',
    latitude: 35.658,
    longitude: 139.7016,
    radiusMeters: 100,
  },
];

export function getDropById(id: string | undefined): DropRecord | undefined {
  if (!id) return undefined;
  return DROPS.find((drop) => drop.id === id);
}
