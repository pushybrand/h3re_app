import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { RPC_URL } from './network';

/**
 * Anti-spoof bond, paid in SOL.
 *
 * Attempting a location check-in stakes a small bond. A verified check-in
 * gets it straight back. An honest miss (genuinely too far away) also gets
 * it back. Only a check-in that fails as fraud - mocked GPS, impossible
 * travel, faked accuracy - forfeits it.
 *
 * The point is asymmetry: honest collectors pay nothing but a network fee,
 * while spoofing has a real, repeated cost.
 */

export const BOND_SOL = 0.01;
export const BOND_LAMPORTS = Math.round(BOND_SOL * LAMPORTS_PER_SOL);

// A bond has to be spent on a check-in soon after it was paid.
const BOND_MAX_AGE_SECONDS = 30 * 60;

export const connection = new Connection(RPC_URL, 'confirmed');

export function getEscrowPublicKey(): PublicKey {
  const value = process.env.BOND_ESCROW_ADDRESS?.trim();
  if (!value) throw new Error('BOND_ESCROW_ADDRESS is not set');
  return new PublicKey(value);
}

function getEscrowKeypair(): Keypair {
  const value = process.env.BOND_ESCROW_SECRET?.trim();
  if (!value) throw new Error('BOND_ESCROW_SECRET is not set');
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value)));
  // If these ever disagree, collectors would pay bonds into a wallet the
  // server cannot refund from. Refuse loudly instead.
  if (!keypair.publicKey.equals(getEscrowPublicKey())) {
    throw new Error('BOND_ESCROW_SECRET does not match BOND_ESCROW_ADDRESS');
  }
  return keypair;
}

export type BondVerification = {
  valid: boolean;
  reason?: string;
  amountLamports?: number;
};

/**
 * Confirms that a bond payment actually landed on chain.
 *
 * Reads the transaction's SOL balance changes rather than trying to parse
 * instruction shapes - that way it holds regardless of how the client built
 * the transfer, and can't be fooled by a transaction that looks right but
 * moved nothing.
 */
export async function verifyBondPayment(
  signature: string,
  walletAddress: string
): Promise<BondVerification> {
  let tx;
  try {
    tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    console.error('[bond] failed to fetch transaction', err);
    return { valid: false, reason: 'bond_lookup_failed' };
  }

  if (!tx || !tx.meta) return { valid: false, reason: 'bond_not_found' };
  if (tx.meta.err) return { valid: false, reason: 'bond_transaction_failed' };

  if (tx.blockTime && Date.now() / 1000 - tx.blockTime > BOND_MAX_AGE_SECONDS) {
    return { valid: false, reason: 'bond_expired' };
  }

  const keys = tx.transaction.message.accountKeys;
  const escrow = getEscrowPublicKey().toBase58();
  const escrowIndex = keys.findIndex((k) => k.pubkey.toBase58() === escrow);
  const payerIndex = keys.findIndex((k) => k.pubkey.toBase58() === walletAddress);

  if (escrowIndex < 0) return { valid: false, reason: 'bond_amount_insufficient' };

  // How much SOL did the bond wallet gain in this transaction?
  const gained = tx.meta.postBalances[escrowIndex] - tx.meta.preBalances[escrowIndex];
  if (gained < BOND_LAMPORTS) {
    return { valid: false, reason: 'bond_amount_insufficient' };
  }

  // And did it come from - and was it signed by - the wallet claiming the
  // check-in? Without this, one person's bond could be replayed by anyone.
  if (payerIndex < 0 || !keys[payerIndex].signer) {
    return { valid: false, reason: 'bond_payer_mismatch' };
  }
  const spent = tx.meta.preBalances[payerIndex] - tx.meta.postBalances[payerIndex];
  if (spent < BOND_LAMPORTS) {
    return { valid: false, reason: 'bond_payer_mismatch' };
  }

  return { valid: true, amountLamports: gained };
}

/**
 * Returns the bond to the collector. Called for verified check-ins and for
 * honest misses alike - only fraud forfeits.
 */
export async function refundBond(walletAddress: string): Promise<string | null> {
  try {
    const escrow = getEscrowKeypair();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrow.publicKey,
        toPubkey: new PublicKey(walletAddress),
        lamports: BOND_LAMPORTS,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [escrow], {
      commitment: 'confirmed',
    });
    console.log('[bond] refunded', { walletAddress, signature });
    return signature;
  } catch (err) {
    console.error('[bond] refund failed', err);
    // Deliberately non-fatal: a refund failure must not turn a legitimate
    // check-in into a rejection. The bond is recoverable manually.
    return null;
  }
}
