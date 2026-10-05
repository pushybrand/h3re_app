/**
 * Display copy and artwork per drop. Kept separate from lib/drops.ts so
 * editing a description can never move a coordinate. Legacy ids are kept
 * so badges minted before the rename still resolve to a name.
 */

export type DropMeta = {
  name: string;
  description: string;
  image: string;
};

const FALLBACK_IMAGE = '/badge.png';

export const DROP_META: Record<string, DropMeta> = {
  'eden-project': {
    name: 'Eden Project',
    description:
      'Under the domes at Bodelva. A rainforest grown inside a worked-out Cornish clay pit. Mintable only from inside the biomes.',
    image: '/edenproject_badge.png',
  },
  'breakpoint-london': {
    name: 'Breakpoint London',
    description:
      'Olympia London, 15-17 November 2026. Solana Breakpoint in Europe for the first time. Mintable only from inside the venue.',
    image: '/breakpoint_badge.png',
  },
  shoreditch: {
    name: 'Shoreditch',
    description:
      'Great Eastern Street to Brick Lane. Shutters, paste-ups and repaint cycles. The walls here are never the same twice.',
    image: '/shoreditch_badge.png',
  },
  'superteam-exeter': {
    name: 'Super Team Exeter',
    description:
      'Maclaines Warehouse, Haven Rd. Superteam UK meets on the quayside, pints in hand. Mintable only from inside the brewery.',
    image: FALLBACK_IMAGE,
  },
  'demo-anywhere': {
    name: 'Demo Drop',
    description:
      'A reviewer badge, mintable from anywhere so the flow can be tried without travelling. Spoofed GPS is still rejected and the bond is still staked and returned.',
    image: FALLBACK_IMAGE,
  },

  'neon-alley': { name: 'Neon Alley', description: 'An early H3RE drop.', image: FALLBACK_IMAGE },
  'skyline-moment': { name: 'Skyline Moment', description: 'An early H3RE drop.', image: FALLBACK_IMAGE },
  'ramen-spot': { name: 'Ramen Spot', description: 'An early H3RE drop.', image: FALLBACK_IMAGE },
};

export function metaFor(dropId: string): DropMeta {
  return (
    DROP_META[dropId] ?? {
      name: dropId,
      description: 'An H3RE location badge.',
      image: FALLBACK_IMAGE,
    }
  );
}

export function mimeForImage(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}