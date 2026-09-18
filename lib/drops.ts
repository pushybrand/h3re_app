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
  bypassRadius?: boolean;
};

/**
 * Display copy for drops. The server holds the authoritative coordinates -
 * these are only used for showing distance in the feed.
 */
export const DROPS: Drop[] = [
  {
    id: 'demo-anywhere',
    name: 'demo drop',
    location: 'wherever you are',
    latitude: 0,
    longitude: 0,
    radiusMeters: 0,
    bypassRadius: true,
    editionsLeft: 999,
    editionsTotal: 999,
    description: 'A demo badge you can mint from anywhere, so the flow can be tried without travelling. Every other check still runs - spoofed GPS is still rejected, and the bond is still staked and returned.',
  },
  {
    id: 'neon-alley',
    name: 'neon alley',
    location: 'Cornwall, UK',
    latitude: 50.262562,
    longitude: -5.0506975,
    radiusMeters: 100,
    editionsLeft: 8,
    editionsTotal: 50,
    description: 'A fleeting moment in the everyday. Minted for those who were H3RE.',
  },
  {
    id: 'skyline-moment',
    name: 'skyline moment',
    location: 'Cornwall, UK',
    latitude: 50.262562,
    longitude: -5.0506975,
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