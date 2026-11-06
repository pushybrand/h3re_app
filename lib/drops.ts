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
  imageUrl?: string;
  // The collectible itself - the art the minted NFT carries, shown in the
  // unboxing reveal. Mirrors the image paths in api-server/lib/dropMeta.ts.
  badgeUrl?: string;
  bypassRadius?: boolean;
};

const ART = 'https://h3re-api.vercel.app/drops/';
const BADGE = 'https://h3re-api.vercel.app/';

/**
 * Display copy for drops. The server holds the authoritative coordinates -
 * these are only used for showing distance in the feed.
 */
export const DROPS: Drop[] = [
  {
    id: 'eden-project',
    name: 'eden project',
    location: 'Bodelva, Cornwall',
    latitude: 50.36194,
    longitude: -4.74472,
    radiusMeters: 100,
    editionsLeft: 50,
    editionsTotal: 50,
    description:
      'Under the domes at Bodelva. A rainforest grown inside a worked-out Cornish clay pit. Mintable only from inside the biomes.',
    imageUrl: ART + 'eden-project.jpg',
    badgeUrl: BADGE + 'edenproject_badge.png',
  },
  {
    id: 'breakpoint-london',
    name: 'breakpoint london',
    location: 'Olympia, London',
    latitude: 51.496281,
    longitude: -0.21111,
    radiusMeters: 100,
    editionsLeft: 250,
    editionsTotal: 250,
    description:
      'Olympia London, 15-17 November 2026. Solana Breakpoint in Europe for the first time. Mintable only from inside the venue.',
    imageUrl: ART + 'breakpoint-london.jpg',
    badgeUrl: BADGE + 'breakpoint_badge.png',
  },
  {
    id: 'shoreditch',
    name: 'shoreditch',
    location: 'Shoreditch, London',
    latitude: 51.5238,
    longitude: -0.0762,
    radiusMeters: 100,
    editionsLeft: 100,
    editionsTotal: 100,
    description:
      'Great Eastern Street to Brick Lane. Shutters, paste-ups and repaint cycles. The walls here are never the same twice.',
    imageUrl: ART + 'shoreditch.jpg',
    badgeUrl: BADGE + 'shoreditch_badge.png',
  },
  {
    id: 'superteam-exeter',
    name: 'super team exeter',
    location: 'Topsham Brewery, Exeter',
    latitude: 50.7169084,
    longitude: -3.5294602,
    radiusMeters: 100,
    editionsLeft: 10,
    editionsTotal: 10,
    description:
      'Maclaines Warehouse, Haven Rd. Superteam UK meets on the quayside, pints in hand. Mintable only from inside the brewery.',
    imageUrl: ART + 'superteam-exeter.jpg',
    badgeUrl: BADGE + 'exeter_badge.png',
  },
];

export function getDropById(id: string | undefined): Drop | undefined {
  if (!id) return undefined;
  return DROPS.find((drop) => drop.id === id);
}