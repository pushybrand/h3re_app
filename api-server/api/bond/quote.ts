import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  BOND_AMOUNT_BASE,
  BOND_AMOUNT_UI,
  BOND_DECIMALS,
  getBondMint,
  getEscrowPublicKey,
} from '../../lib/bond';

/**
 * Tells the app what bond to stake before attempting a location check-in.
 *
 * Served rather than hardcoded in the client so the amount, mint and escrow
 * can change without shipping a new APK — and so the client never decides
 * what a valid bond looks like.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      mint: getBondMint().toBase58(),
      escrow: getEscrowPublicKey().toBase58(),
      amountBase: BOND_AMOUNT_BASE,
      amountUi: BOND_AMOUNT_UI,
      decimals: BOND_DECIMALS,
    });
  } catch (error) {
    console.error('[bond] quote failed', error);
    return res.status(500).json({ error: 'Bond configuration unavailable' });
  }
}
