import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consumeMintTicket, recordMinted } from '../lib/mintStore';
import { getDropById } from '../lib/drops';
import { mintBadge } from '../lib/mint';

const DISPLAY_NAMES: Record<string, string> = {
  'neon-alley': 'Neon Alley',
  'skyline-moment': 'Skyline Moment',
  'ramen-spot': 'Ramen Spot',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const walletAddress = body?.walletAddress;
    const dropId = body?.dropId;

    if (typeof walletAddress !== 'string' || !walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }
    if (typeof dropId !== 'string' || !dropId) {
      return res.status(400).json({ error: 'dropId required' });
    }

    const drop = getDropById(dropId);
    if (!drop) {
      return res.status(404).json({ error: 'Drop not found: ' + dropId });
    }

    // The gate: no approved check-in means no ticket, and no ticket means
    // no mint. Consuming it here also stops one check-in minting twice.
    const ticket = await consumeMintTicket(walletAddress, dropId);
    if (!ticket.ok) {
      console.log('[mint] refused', { walletAddress, dropId, reason: ticket.reason });
      return res.status(403).json({ minted: false, reason: ticket.reason });
    }

    const origin = 'https://' + (req.headers.host ?? 'h3re-api.vercel.app');
    const metadataUri = origin + '/api/metadata/' + dropId;
    const displayName = 'H3RE - ' + (DISPLAY_NAMES[dropId] ?? dropId);

    const result = await mintBadge(walletAddress, dropId, displayName, metadataUri);
    await recordMinted(walletAddress, dropId, result.assetAddress, result.signature);

    return res.status(200).json({
      minted: true,
      assetAddress: result.assetAddress,
      signature: result.signature,
    });
  } catch (error) {
    console.error('[mint] failed', error);
    return res.status(500).json({ minted: false, error: 'Mint failed' });
  }
}