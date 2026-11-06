import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BOND_LAMPORTS, BOND_SOL, getEscrowPublicKey } from '../../lib/bond';
import { CLUSTER } from '../../lib/network';

/**
 * Tells the app what bond to stake before attempting a location check-in.
 *
 * Served rather than hardcoded in the client so the amount and bond wallet
 * can change without shipping a new APK - and so the client never decides
 * what a valid bond looks like.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      currency: 'SOL',
      cluster: CLUSTER,
      escrow: getEscrowPublicKey().toBase58(),
      amountLamports: BOND_LAMPORTS,
      amountSol: BOND_SOL,
    });
  } catch (error) {
    console.error('[bond] quote failed', error);
    return res.status(500).json({ error: 'Bond configuration unavailable' });
  }
}
