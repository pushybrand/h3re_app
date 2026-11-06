import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Retired. The devnet build topped up new collectors with stand-in bond
 * tokens. On mainnet the bond is real SOL and comes straight back after an
 * honest check-in, so there is nothing to hand out.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({
    funded: false,
    error: 'faucet_retired',
    message: 'H3RE runs on mainnet. The bond is 0.01 SOL and is refunded after check-in.',
  });
}
