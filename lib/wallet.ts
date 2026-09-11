import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction, Connection, clusterApiUrl } from '@solana/web3.js';

// Devnet for hackathon build/testing. Swap to mainnet-beta before mainnet submission.
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const APP_IDENTITY = {
  name: 'H3RE',
  uri: 'https://h3re.app', // replace with real domain once registered
  icon: 'favicon.ico',
};

/**
 * Connects to the user's wallet app via Mobile Wallet Adapter and
 * returns their public key. Call this once on app start / wallet screen.
 */
export async function connectWallet(): Promise<PublicKey | null> {
  try {
    const authResult = await transact(async (wallet: Web3MobileWallet) => {
      return await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });
    });

    const pubkeyBytes = Buffer.from(authResult.accounts[0].address, 'base64');
    return new PublicKey(pubkeyBytes);
  } catch (err) {
    console.error('[wallet] connect failed', err);
    return null;
  }
}

/**
 * Signs and sends a prepared transaction via MWA.
 * `buildTx` is provided by the caller (e.g. the mint flow) so this
 * helper stays generic across mint / bond-stake / bond-refund calls.
 */
export async function signAndSendTransaction(
  buildTx: (walletPubkey: PublicKey) => Promise<Transaction>
): Promise<string | null> {
  try {
    console.log('[wallet] fetching latest blockhash');
    const latestBlockhash = await connection.getLatestBlockhash();

    console.log('[wallet] opening MWA session');
    const signedTx = await transact(async (wallet: Web3MobileWallet) => {
      console.log('[wallet] authorizing');
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });
      const pubkeyBytes = Buffer.from(authResult.accounts[0].address, 'base64');
      const pubkey = new PublicKey(pubkeyBytes);
      console.log('[wallet] authorized', pubkey.toBase58());

      console.log('[wallet] building transaction');
      const tx = await buildTx(pubkey);
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = pubkey;

      console.log('[wallet] requesting signature');
      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      console.log('[wallet] transaction signed');
      return signedTxs[0];
    });

    console.log('[wallet] sending raw transaction');
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    console.log('[wallet] confirming transaction', signature);
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('[wallet] confirmed', signature);
    return signature;
  } catch (err) {
    console.error('[wallet] sign/send failed', err);
    return null;
  }
}
