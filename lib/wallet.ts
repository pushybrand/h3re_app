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
    return await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });
      const pubkeyBytes = Buffer.from(authResult.accounts[0].address, 'base64');
      const pubkey = new PublicKey(pubkeyBytes);

      const tx = await buildTx(pubkey);
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = pubkey;

      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      const signature = await connection.sendRawTransaction(signedTxs[0].serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    });
  } catch (err) {
    console.error('[wallet] sign/send failed', err);
    return null;
  }
}
