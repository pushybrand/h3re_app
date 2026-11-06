/**
 * Which Solana network the app talks to, in one place.
 *
 * H3RE runs on mainnet: the check-in bond is real SOL (refunded to honest
 * collectors) and badges are real Metaplex Core assets.
 */

export const CLUSTER = 'mainnet-beta' as const;

// MWA 2.0 chain identifier - what the wallet (Phantom, Solflare, Seed Vault)
// is asked to sign for.
export const CHAIN = 'solana:mainnet' as const;

// Public mainnet RPC. Fine for a handful of collectors; swap for a dedicated
// endpoint (Helius, Triton...) if traffic grows.
export const RPC_URL = 'https://api.mainnet-beta.solana.com';

export const API_BASE = 'https://h3re-api.vercel.app';

/**
 * How H3RE introduces itself to the wallet. The wallet checks that this
 * domain vouches for the app (api-server/public/.well-known/assetlinks.json,
 * tied to the app's signing key) - that's what turns Phantom's "identity
 * could not be verified" warning into a verified connect screen.
 */
export const APP_IDENTITY = {
  name: 'H3RE',
  uri: API_BASE,
  icon: 'h3re-icon.png',
};

export function explorerAddressUrl(address: string): string {
  return (
    'https://explorer.solana.com/address/' +
    address +
    (CLUSTER === 'mainnet-beta' ? '' : '?cluster=' + CLUSTER)
  );
}
