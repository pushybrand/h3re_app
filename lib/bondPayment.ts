import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import { getVerifiedLocation } from './location';

const API_BASE = 'https://h3re-api.vercel.app';

let lastWalletAddress: string | null = null;

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const APP_IDENTITY = {
  name: 'H3RE',
  uri: 'https://h3re.app',
  icon: 'favicon.ico',
};

type BondQuote = {
  mint: string;
  escrow: string;
  amountBase: number;
  amountUi: number;
  decimals: number;
};

export type CheckInResult = {
  approved: boolean;
  reason?: string;
  bondAction?: 'refund' | 'slash' | 'none';
  distanceMeters?: number;
  refundSignature?: string | null;
  error?: string;
};

async function fetchBondQuote(): Promise<BondQuote> {
  const res = await fetch(`${API_BASE}/api/bond/quote`);
  if (!res.ok) throw new Error(`Bond quote unavailable (${res.status})`);
  return res.json();
}

/**
 * Devnet only. A first-time collector has no stand-in tokens, so their bond
 * transfer fails on chain with an opaque SPL error. This tops them up once so
 * the app is usable out of the box. On mainnet the bond is real SKR and there
 * is no faucet.
 */
async function requestFaucet(): Promise<boolean> {
  try {
    if (!lastWalletAddress) {
      console.log('[faucet] no wallet address known yet');
      return false;
    }
    console.log('[faucet] requesting tokens for', lastWalletAddress);
    const res = await fetch(`${API_BASE}/api/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: lastWalletAddress }),
    });
    const result = await res.json();
    console.log('[faucet] result', result);
    return result?.funded === true;
  } catch (err) {
    console.error('[faucet] failed', err);
    return false;
  }
}

async function payBond(quote: BondQuote): Promise<{ signature: string; walletAddress: string }> {
  const mint = new PublicKey(quote.mint);
  const escrow = new PublicKey(quote.escrow);

  console.log('[bond] fetching blockhash');
  const latestBlockhash = await connection.getLatestBlockhash();

  console.log('[bond] opening wallet session');
  const { signedTx, walletAddress } = await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.authorize({
      cluster: 'devnet',
      identity: APP_IDENTITY,
    });

    const payer = new PublicKey(Buffer.from(auth.accounts[0].address, 'base64'));
    console.log('[bond] authorized', payer.toBase58());

    // Recorded here rather than after the send, so that a failed transfer -
    // which is exactly what an unfunded wallet produces - still leaves us an
    // address to hand the faucet.
    lastWalletAddress = payer.toBase58();

    const payerAta = await getAssociatedTokenAddress(mint, payer);
    const escrowAta = await getAssociatedTokenAddress(mint, escrow);

    const tx = new Transaction();
    tx.add(createTransferInstruction(payerAta, escrowAta, payer, quote.amountBase));
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = payer;

    console.log('[bond] requesting signature');
    const signed = await wallet.signTransactions({ transactions: [tx] });

    return { signedTx: signed[0], walletAddress: payer.toBase58() };
  });

  console.log('[bond] sending bond transaction');
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, 'confirmed');
  console.log('[bond] bond confirmed', signature);

  return { signature, walletAddress };
}

export async function checkInWithBond(dropId: string): Promise<CheckInResult> {
  try {
    const fix = await getVerifiedLocation();
    if (!fix) {
      return { approved: false, error: 'location_permission_denied' };
    }
    console.log('[check-in] got fix', fix.latitude, fix.longitude);

    const quote = await fetchBondQuote();
    console.log('[bond] quote', quote.amountUi, 'to', quote.escrow);

    let signature: string;
    let walletAddress: string;
    try {
      ({ signature, walletAddress } = await payBond(quote));
    } catch (bondErr) {
      console.log('[bond] payment failed, trying faucet', bondErr);
      const funded = await requestFaucet();
      if (!funded) throw bondErr;
      console.log('[bond] funded, retrying payment');
      ({ signature, walletAddress } = await payBond(quote));
    }

    const res = await fetch(`${API_BASE}/api/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        dropId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        clientReportedMock: fix.isMockLocation,
        timestamp: fix.timestamp,
        bondSignature: signature,
      }),
    });

    const result = await res.json();
    console.log('[check-in] server said', result);
    return result;
  } catch (err: any) {
    console.error('[check-in] failed', err);
    return { approved: false, error: err?.message ?? 'check_in_failed' };
  }
}

export type MintResult = {
  minted: boolean;
  assetAddress?: string;
  signature?: string;
  reason?: string;
  error?: string;
};

/**
 * Asks the server to mint. No wallet prompt - the server already verified
 * presence and holds the ticket that authorises this, so the collector signs
 * nothing beyond the bond they already paid.
 */
export async function requestMint(dropId: string): Promise<MintResult> {
  try {
    if (!lastWalletAddress) {
      return { minted: false, error: 'no_wallet' };
    }

    console.log('[mint] requesting', { dropId, wallet: lastWalletAddress });

    const res = await fetch(`${API_BASE}/api/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: lastWalletAddress, dropId }),
    });

    const result = await res.json();
    console.log('[mint] server said', result);
    return result;
  } catch (err: any) {
    console.error('[mint] failed', err);
    return { minted: false, error: err?.message ?? 'mint_failed' };
  }
}