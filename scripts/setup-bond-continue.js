/**
 * Continues H3RE bond setup using the escrow keypair already saved by
 * setup-bond.js. Run this once the escrow address has some devnet SOL.
 *
 *   node scripts/setup-bond-continue.js <YOUR_WALLET_ADDRESS>
 *
 * Safe to re-run: token accounts are created only if missing.
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

const DECIMALS = 6; // matches real SKR
const TOKENS_FOR_YOU = 1000;
const TOKENS_FOR_ESCROW = 1000;
const MIN_SOL_NEEDED = 0.05;

async function main() {
  const yourWalletArg = process.argv[2];
  if (!yourWalletArg) {
    console.error('Usage: node scripts/setup-bond-continue.js <YOUR_WALLET_ADDRESS>');
    process.exit(1);
  }

  let yourWallet;
  try {
    yourWallet = new PublicKey(yourWalletArg);
  } catch {
    console.error(`Not a valid Solana address: ${yourWalletArg}`);
    process.exit(1);
  }

  const escrowPath = path.join(__dirname, '..', 'h3re-escrow.json');
  if (!fs.existsSync(escrowPath)) {
    console.error(`No escrow keypair at ${escrowPath}. Run setup-bond.js first.`);
    process.exit(1);
  }

  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(escrowPath, 'utf8')));
  const escrow = Keypair.fromSecretKey(secret);
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  console.log(`escrow address: ${escrow.publicKey.toBase58()}`);

  const balance = await connection.getBalance(escrow.publicKey);
  const sol = balance / LAMPORTS_PER_SOL;
  console.log(`escrow balance: ${sol} SOL`);

  if (sol < MIN_SOL_NEEDED) {
    console.error(`\nNot enough SOL. Send at least ${MIN_SOL_NEEDED} devnet SOL to:`);
    console.error(`  ${escrow.publicKey.toBase58()}`);
    console.error('\nThen re-run this script.');
    process.exit(1);
  }

  console.log('\n1. Creating test token mint (stands in for SKR on devnet)...');
  const mint = await createMint(
    connection, escrow, escrow.publicKey, null, DECIMALS
  );
  console.log(`   mint address: ${mint.toBase58()}`);

  console.log('\n2. Creating token accounts...');
  const escrowTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, escrow, mint, escrow.publicKey
  );
  console.log(`   escrow token account: ${escrowTokenAccount.address.toBase58()}`);

  const yourTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, escrow, mint, yourWallet
  );
  console.log(`   your token account:   ${yourTokenAccount.address.toBase58()}`);

  console.log('\n3. Minting test tokens...');
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
  console.log('\nBOND_ESCROW_SECRET is a private key — add it via the Vercel');
  console.log('dashboard or `vercel env add`, never by committing it.\n');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
