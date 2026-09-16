import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from '@solana/spl-token';

/**
 * SKR anti-spoof bond.
 *
 * Attempting a location check-in costs a small staked bond. A verified
 * check-in gets it straight back. A check-in that fails as fraud — mocked
 * GPS, impossible travel — forfeits it.
 *
 * The point is asymmetry: honest collectors pay nothing but a round trip,
 * while spoofing has a real, repeated cost. Being genuinely too far from a
 * drop is not fraud and is always refunded.
 *
 * On devnet this uses a stand-in SPL token with SKR's 6 decimals, so
 * swapping in the real mint for mainnet is a single env var change.
 */

export const BOND_DECIMALS = 6; // matches SKR
export const BOND_AMOUNT_UI = 1; // 1 token per check-in attempt
export const BOND_AMOUNT_BASE = BOND_AMOUNT_UI * 10 ** BOND_DECIMALS;

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  'confirmed'
);

export function getBondMint(): PublicKey {
  const value = process.env.BOND_MINT_ADDRESS;
  if (!value) throw new Error('BOND_MINT_ADDRESS is not set');
  return new PublicKey(value);
}

export function getEscrowPublicKey(): PublicKey {
  const value = process.env.BOND_ESCROW_ADDRESS;
  if (!value) throw new Error('BOND_ESCROW_ADDRESS is not set');
  return new PublicKey(value);
}

function getEscrowKeypair(): Keypair {
  const value = process.env.BOND_ESCROW_SECRET;
  if (!value) throw new Error('BOND_ESCROW_SECRET is not set');
  const secret = Uint8Array.from(JSON.parse(value));
  return Keypair.fromSecretKey(secret);
}

export type BondVerification = {
  valid: boolean;
  reason?: string;
  amountBase?: number;
};

/**
 * Confirms that a bond payment actually landed on chain.
 *
 * Reads the transaction's token balance deltas rather than trying to parse
 * instruction shapes — that way it holds regardless of how the client built
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

  if (!tx) return { valid: false, reason: 'bond_not_found' };
  if (tx.meta?.err) return { valid: false, reason: 'bond_transaction_failed' };

  const mint = getBondMint().toBase58();
  const escrow = getEscrowPublicKey().toBase58();

  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  // How much of the bond mint did the escrow gain in this transaction?
  const escrowPre = pre.find((b) => b.mint === mint && b.owner === escrow);
  const escrowPost = post.find((b) => b.mint === mint && b.owner === escrow);

  const before = Number(escrowPre?.uiTokenAmount.amount ?? 0);
  const after = Number(escrowPost?.uiTokenAmount.amount ?? 0);
  const gained = after - before;

  if (gained < BOND_AMOUNT_BASE) {
    return { valid: false, reason: 'bond_amount_insufficient' };
  }

  // And did it come from the wallet that's claiming the check-in? Without
  // this, one person's bond payment could be replayed by anyone.
  const payerPre = pre.find((b) => b.mint === mint && b.owner === walletAddress);
  const payerPost = post.find((b) => b.mint === mint && b.owner === walletAddress);

  const payerBefore = Number(payerPre?.uiTokenAmount.amount ?? 0);
  const payerAfter = Number(payerPost?.uiTokenAmount.amount ?? 0);

  if (payerBefore - payerAfter < BOND_AMOUNT_BASE) {
    return { valid: false, reason: 'bond_payer_mismatch' };
  }

  return { valid: true, amountBase: gained };
}

/**
 * Returns the bond to the collector. Called for verified check-ins and for
 * honest misses alike — only fraud forfeits.
 */
export async function refundBond(walletAddress: string): Promise<string | null> {
  try {
    const escrow = getEscrowKeypair();
    const mint = getBondMint();
    const recipient = new PublicKey(walletAddress);

    const escrowAta = await getAssociatedTokenAddress(mint, escrow.publicKey);
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection,
      escrow,
      mint,
      recipient
    );

    const tx = new Transaction().add(
      createTransferInstruction(
        escrowAta,
        recipientAta.address,
        escrow.publicKey,
        BOND_AMOUNT_BASE
      )
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [escrow]);
    console.log('[bond] refunded', { walletAddress, signature });
    return signature;
  } catch (err) {
    console.error('[bond] refund failed', err);
    // Deliberately non-fatal: a refund failure must not turn a legitimate
    // check-in into a rejection. The bond is recoverable manually.
    return null;
  }
}
