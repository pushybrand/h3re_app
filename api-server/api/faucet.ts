import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { Redis } from '@upstash/redis';

/**
 * Test-token faucet.
 *
 * Checking in requires staking a bond, so a reviewer with an empty wallet
 * cannot use the app at all. This hands out enough of the devnet stand-in
 * token to exercise the flow several times over.
 *
 * Devnet only by design - on mainnet the bond is real SKR and there is no
 * faucet. Rate limited per wallet so it cannot be drained.
 */

const redis = Redis.fromEnv();
const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
const DECIMALS = 6;
const GRANT_UI = 10;
const CLAIM_PREFIX = 'faucet-claim:';
const CLAIM_TTL_SECONDS = 60 * 60 * 24;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const walletAddress = body?.walletAddress;

    if (typeof walletAddress !== 'string' || !walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    let recipient: PublicKey;
    try {
      recipient = new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: 'walletAddress is not a valid address' });
    }

    const claimKey = CLAIM_PREFIX + walletAddress;
    const alreadyClaimed = await redis.get(claimKey);
    if (alreadyClaimed) {
      console.log('[faucet] already claimed', walletAddress);
      return res.status(429).json({ funded: false, reason: 'already_claimed_today' });
    }

    const secretRaw = process.env.BOND_ESCROW_SECRET;
    const mintRaw = process.env.BOND_MINT_ADDRESS;
    if (!secretRaw || !mintRaw) {
      return res.status(500).json({ error: 'Faucet not configured' });
    }

    const escrow = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretRaw)));
    const mint = new PublicKey(mintRaw);
    const connection = new Connection(RPC_URL, 'confirmed');

    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection, escrow, mint, recipient
    );

    // Minting rather than transferring, so faucet claims never eat into the
    // float the escrow needs to pay refunds.
    const signature = await mintTo(
      connection, escrow, mint, recipientAta.address, escrow,
      GRANT_UI * 10 ** DECIMALS
    );

    await redis.set(claimKey, { claimedAt: Date.now() }, { ex: CLAIM_TTL_SECONDS });

    console.log('[faucet] funded', { walletAddress, amount: GRANT_UI, signature });

    return res.status(200).json({
      funded: true,
      amountUi: GRANT_UI,
      signature,
    });
  } catch (error) {
    console.error('[faucet] failed', error);
    return res.status(500).json({ funded: false, error: 'Faucet failed' });
  }
}