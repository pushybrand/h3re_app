import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import { getVerifiedLocation } from './location';

const API_BASE = 'https://h3re-api.vercel.app';

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

    const { signature, walletAddress } = await payBond(quote);

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