/**
 * One-off devnet setup for the H3RE SKR bond.
 *
 * Creates:
 *   1. An escrow keypair (holds staked bonds, signs refunds)
 *   2. A test SPL token standing in for SKR on devnet
 *   3. Token accounts for both the escrow and your wallet, funded with test tokens
 *
 * Run once:  node scripts/setup-bond.js <YOUR_WALLET_ADDRESS>
 *
 * SECURITY: this writes h3re-escrow.json containing a private key. It is
 * gitignored, but treat it like a password — it controls the escrow wallet.
 * For devnet the stakes are zero; before mainnet, generate a fresh keypair
 * and store it only as a Vercel environment variable.
 */

const fs = require('fs');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require('@solana/spl-token');

const DECIMALS = 9;
const ESCROW_SOL = 1;
const TOKENS_FOR_YOU = 1000;
const TOKENS_FOR_ESCROW = 1000; // float so refunds work before any bonds land

async function airdropWithRetry(connection, pubkey, sol) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
      return true;
    } catch (err) {
      console.log(`  airdrop attempt ${attempt} failed (${err.message})`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return false;
}

async function main() {
  const yourWalletArg = process.argv[2];
  if (!yourWalletArg) {
    console.error('Usage: node scripts/setup-bond.js <YOUR_WALLET_ADDRESS>');
    process.exit(1);
  }

  let yourWallet;
  try {
    yourWallet = new PublicKey(yourWalletArg);
  } catch {
    console.error(`Not a valid Solana address: ${yourWalletArg}`);
    process.exit(1);
  }

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  console.log('1. Generating escrow keypair...');
  const escrow = Keypair.generate();
  const escrowPath = path.join(__dirname, '..', 'h3re-escrow.json');
  fs.writeFileSync(escrowPath, JSON.stringify(Array.from(escrow.secretKey)));
  console.log(`   escrow address: ${escrow.publicKey.toBase58()}`);
  console.log(`   secret key written to ${escrowPath} (gitignored)`);

  console.log(`\n2. Funding escrow with ${ESCROW_SOL} devnet SOL...`);
  const funded = await airdropWithRetry(connection, escrow.publicKey, ESCROW_SOL);
  if (!funded) {
    console.error('   Airdrop failed after 3 attempts. The devnet faucet is rate limited.');
    console.error('   Fund it manually at https://faucet.solana.com using the address above,');
    console.error('   then re-run this script (it will generate a new keypair, so instead');
    console.error('   consider funding and continuing from a saved keypair).');
    process.exit(1);
  }
  console.log('   funded');

  console.log('\n3. Creating test token mint (stands in for SKR on devnet)...');
  const mint = await createMint(
    connection,
    escrow,             // payer
    escrow.publicKey,   // mint authority
    null,               // freeze authority
    DECIMALS
  );
  console.log(`   mint address: ${mint.toBase58()}`);

  console.log('\n4. Creating token accounts...');
  const escrowTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, escrow, mint, escrow.publicKey
  );
  console.log(`   escrow token account: ${escrowTokenAccount.address.toBase58()}`);

  const yourTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, escrow, mint, yourWallet
  );
  console.log(`   your token account:   ${yourTokenAccount.address.toBase58()}`);

  console.log('\n5. Minting test tokens...');
  await mintTo(
    connection, escrow, mint, yourTokenAccount.address, escrow,
    TOKENS_FOR_YOU * 10 ** DECIMALS
  );
  console.log(`   ${TOKENS_FOR_YOU} to your wallet`);

  await mintTo(
    connection, escrow, mint, escrowTokenAccount.address, escrow,
    TOKENS_FOR_ESCROW * 10 ** DECIMALS
  );
  console.log(`   ${TOKENS_FOR_ESCROW} to escrow (float for refunds)`);

  console.log('\n--- Done. Add these to Vercel env vars ---\n');
  console.log(`BOND_MINT_ADDRESS=${mint.toBase58()}`);
  console.log(`BOND_ESCROW_ADDRESS=${escrow.publicKey.toBase58()}`);
  console.log(`BOND_ESCROW_SECRET=${JSON.stringify(Array.from(escrow.secretKey))}`);
  console.log('\nBOND_ESCROW_SECRET is a private key. Add it via the Vercel dashboard');
  console.log('or `vercel env add`, never by committing it.\n');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
