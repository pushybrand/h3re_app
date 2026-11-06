/**
 * Which Solana network the API runs against, in one place.
 *
 * Defaults to mainnet. Set SOLANA_CLUSTER=devnet only for local testing.
 * SOLANA_RPC_URL overrides the public endpoint (e.g. a Helius URL), which is
 * worth doing once real traffic arrives - the public RPC is rate limited.
 */

export type Cluster = 'mainnet-beta' | 'devnet';

export const CLUSTER: Cluster =
  process.env.SOLANA_CLUSTER?.trim() === 'devnet' ? 'devnet' : 'mainnet-beta';

export const RPC_URL =
  process.env.SOLANA_RPC_URL?.trim() ||
  (CLUSTER === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com');

/**
 * Redis is shared between networks, and a wallet has the same address on
 * devnet and mainnet. Mainnet records live under their own prefix so devnet
 * test mints never block, number or appear alongside real ones. Devnet keeps
 * the original unprefixed keys.
 */
export const KEY_NS = CLUSTER === 'devnet' ? '' : 'mainnet:';

export function explorerAddressUrl(address: string): string {
  return (
    'https://explorer.solana.com/address/' +
    address +
    (CLUSTER === 'mainnet-beta' ? '' : '?cluster=' + CLUSTER)
  );
}
