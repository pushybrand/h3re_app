export type Drop = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  editionsLeft: number;
  editionsTotal: number;
  description: string;
};

export const DROPS: Drop[] = [
  {
    id: 'neon-alley',
    name: 'neon alley',
    location: 'Shibuya, Tokyo',
    latitude: 50.2636233,
    longitude: -5.053485,
    radiusMeters: 100,
    editionsLeft: 8,
    editionsTotal: 50,
    description: 'A fleeting moment in the everyday. Minted for those who were H3RE.',
  },
  {
    id: 'skyline-moment',
    name: 'skyline moment',
    location: 'Shibuya Crossing, Tokyo',
    latitude: 35.6595,
    longitude: 139.7004,
    radiusMeters: 150,
    editionsLeft: 3,
    editionsTotal: 25,
    description: 'The scramble, frozen. Only if you were standing in it.',
  },
  {
    id: 'ramen-spot',
    name: 'ramen spot',
    location: 'Shibuya, Tokyo',
    latitude: 35.658,
    longitude: 139.7016,
    radiusMeters: 100,
    editionsLeft: 12,
    editionsTotal: 100,
    description: 'Steam, neon, a late bowl. Proof you found the spot.',
  },
];

export function getDropById(id: string | undefined): Drop | undefined {
  if (!id) return undefined;
  return DROPS.find((drop) => drop.id === id);
}

