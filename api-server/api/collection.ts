import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listMinted } from '../lib/mintStore';
import { metaFor } from '../lib/dropMeta';

/**
 * A collector's minted badges, newest first. Read-only and keyed on a
 * public wallet address, so there is nothing here that is not already
 * visible on-chain - this just saves the app from indexing devnet itself.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = req.query.wallet;
  const wallet = Array.isArray(raw) ? raw[0] : raw;

  if (typeof wallet !== 'string' || !wallet) {
    return res.status(400).json({ error: 'wallet query parameter required' });
  }

  try {
    const items = await listMinted(wallet);
    const origin = 'https://' + (req.headers.host ?? 'h3re-api.vercel.app');

    const enriched = items.map((item) => {
      const meta = metaFor(item.dropId);
      return {
        dropId: item.dropId,
        name: meta.name,
        imageUrl: origin + meta.image,
        assetAddress: item.assetAddress,
        signature: item.signature,
        mintedAt: item.mintedAt,
        explorerUrl:
          'https://explorer.solana.com/address/' + item.assetAddress + '?cluster=devnet',
      };
    });

    return res.status(200).json({ wallet, count: enriched.length, items: enriched });
  } catch (error) {
    console.error('[collection] failed', error);
    return res.status(500).json({ error: 'Collection lookup failed' });
  }
}