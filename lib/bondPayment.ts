import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getVerifiedLocation } from './location';
import { API_BASE, APP_IDENTITY, CHAIN, RPC_URL } from './network';

let lastWalletAddress: string | null = null;

const connection = new Connection(RPC_URL, 'confirmed');

// The collector also pays the network fee on their own bond transfer, so
// they need a little more than the bond itself.
const FEE_HEADROOM_LAMPORTS = 10_000;

type BondQuote = {
  currency: 'SOL';
  escrow: string;
  amountLamports: number;
  amountSol: number;
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
  if (!res.ok) throw new Error('bond_quote_unavailable');
  const quote = await res.json();
  if (typeof quote?.amountLamports !== 'number' || typeof quote?.escrow !== 'string') {
    throw new Error('bond_quote_unavailable');
  }
  return quote;
}

/**
 * Stakes the check-in bond: a plain SOL transfer from the collector to the
 * H3RE bond wallet. The server refunds it after an honest check-in.
 */
async function payBond(quote: BondQuote): Promise<{ signature: string; walletAddress: string }> {
  const escrow = new PublicKey(quote.escrow);

  console.log('[bond] fetching blockhash');
  const latestBlockhash = await connection.getLatestBlockhash();

  console.log('[bond] opening wallet session');
  const { signedTx, walletAddress } = await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.authorize({
      chain: CHAIN,
      identity: APP_IDENTITY,
    });

    const payer = new PublicKey(Buffer.from(auth.accounts[0].address, 'base64'));
    console.log('[bond] authorized', payer.toBase58());
    lastWalletAddress = payer.toBase58();

    // Check before asking for a signature: an underfunded wallet would
    // otherwise sign, then fail on chain with an unhelpful error. If the
    // balance lookup itself fails (public RPC hiccup), don't block the
    // check-in over it - the network will reject a short payment anyway.
    let balance: number | null = null;
    try {
      balance = await connection.getBalance(payer, 'confirmed');
    } catch (err) {
      console.warn('[bond] balance check skipped', err);
    }
    if (balance !== null && balance < quote.amountLamports + FEE_HEADROOM_LAMPORTS) {
      throw new Error('insufficient_sol');
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: escrow,
        lamports: quote.amountLamports,
      })
    );
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = payer;

    console.log('[bond] requesting signature for', quote.amountSol, 'SOL');
    const signed = await wallet.signTransactions({ transactions: [tx] });

    return { signedTx: signed[0], walletAddress: payer.toBase58() };
  });

  console.log('[bond] sending bond transaction');
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  );
  if (confirmation.value.err) throw new Error('bond_transaction_failed');
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
    console.log('[bond] quote', quote.amountSol, 'SOL to', quote.escrow);

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

export type MintResult = {
  minted: boolean;
  assetAddress?: string;
  signature?: string;
  // Which number this badge is in its drop (#1, #2...). Null if the server
  // couldn't assign one - the mint still stands.
  edition?: number | null;
  reason?: string;
  error?: string;
};

/**
 * Asks the server to mint. No wallet prompt - the server already verified
 * presence and holds the ticket that authorises this, so the collector signs
 * nothing beyond the bond they already paid. The mint fee is on H3RE.
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
