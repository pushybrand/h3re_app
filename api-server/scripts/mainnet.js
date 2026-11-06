/**
 * H3RE mainnet setup. Run from the api-server folder.
 *
 *   node scripts/mainnet.js wallet       1. make the bond wallet (once)
 *   node scripts/mainnet.js status       2. check its SOL balance
 *   node scripts/mainnet.js collection   3. create the H3RE collection (once)
 *
 * The bond wallet holds collectors' bonds, refunds them, and pays the fee on
 * every mint. Its private key is written to h3re-mainnet-escrow.json in the
 * project folder (one level ABOVE api-server), so it is never uploaded to
 * Vercel with a deploy, and it is gitignored. Treat it like a password: back
 * it up somewhere safe and never share or commit it.
 */

const fs = require('fs');
const path = require('path');
const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const KEY_FILE = path.join(PROJECT_ROOT, 'h3re-mainnet-escrow.json');
const COLLECTION_FILE = path.join(PROJECT_ROOT, 'h3re-mainnet-collection.txt');
const COLLECTION_URI = 'https://h3re-api.vercel.app/metadata/collection.json';
const MIN_SOL_FOR_COLLECTION = 0.02;

function loadWallet() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error('No bond wallet yet. Run:  node scripts/mainnet.js wallet');
    process.exit(1);
  }
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')));
  return Keypair.fromSecretKey(secret);
}

async function balanceSol(pubkey) {
  const connection = new Connection(RPC_URL, 'confirmed');
  return (await connection.getBalance(pubkey)) / LAMPORTS_PER_SOL;
}

async function wallet() {
  if (fs.existsSync(KEY_FILE)) {
    // Never overwrite: that would orphan any SOL already sent to it.
    const existing = loadWallet();
    console.log('A bond wallet already exists - keeping it.');
    console.log('Address:', existing.publicKey.toBase58());
    return;
  }
  const keypair = Keypair.generate();
  fs.writeFileSync(KEY_FILE, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  console.log('');
  console.log('New H3RE bond wallet created.');
  console.log('Address (safe to share):', keypair.publicKey.toBase58());
  console.log('Private key saved to:', KEY_FILE);
  console.log('');
  console.log('Next: send about 0.1-0.2 SOL to that address from Phantom,');
  console.log('then run:  node scripts/mainnet.js status');
}

async function status() {
  const kp = loadWallet();
  const sol = await balanceSol(kp.publicKey);
  console.log('Bond wallet:', kp.publicKey.toBase58());
  console.log('Balance:', sol, 'SOL');
  console.log('Roughly', Math.floor(sol / 0.0035), 'mints of runway (each mint ~0.0035 SOL incl. fees).');
  if (fs.existsSync(COLLECTION_FILE)) {
    console.log('Collection:', fs.readFileSync(COLLECTION_FILE, 'utf8').trim());
  }
}

async function collection() {
  if (fs.existsSync(COLLECTION_FILE)) {
    console.log('Collection already created:', fs.readFileSync(COLLECTION_FILE, 'utf8').trim());
    printEnvSteps(loadWallet().publicKey.toBase58(), fs.readFileSync(COLLECTION_FILE, 'utf8').trim());
    return;
  }

  const kp = loadWallet();
  const sol = await balanceSol(kp.publicKey);
  if (sol < MIN_SOL_FOR_COLLECTION) {
    console.error('Bond wallet has', sol, 'SOL - send it at least', MIN_SOL_FOR_COLLECTION, 'SOL first.');
    console.error('Address:', kp.publicKey.toBase58());
    process.exit(1);
  }

  const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
  const { mplCore, createCollection } = require('@metaplex-foundation/mpl-core');
  const { keypairIdentity, generateSigner } = require('@metaplex-foundation/umi');

  const umi = createUmi(RPC_URL).use(mplCore());
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(kp.secretKey)));

  const collectionSigner = generateSigner(umi);
  console.log('Creating the H3RE collection on mainnet...');
  await createCollection(umi, {
    collection: collectionSigner,
    name: 'H3RE',
    uri: COLLECTION_URI,
  }).sendAndConfirm(umi);

  const address = collectionSigner.publicKey.toString();
  fs.writeFileSync(COLLECTION_FILE, address + '\n');
  console.log('');
  console.log('H3RE collection created:', address);
  printEnvSteps(kp.publicKey.toBase58(), address);
}

function printEnvSteps(walletAddress, collectionAddress) {
  console.log('');
  console.log('Now point Vercel at mainnet. In this api-server folder (PowerShell), run these one at a time:');
  console.log('');
  console.log('  npx vercel env rm BOND_MINT_ADDRESS production -y');
  console.log('  npx vercel env rm BOND_ESCROW_SECRET production -y');
  console.log('  npx vercel env rm BOND_ESCROW_ADDRESS production -y');
  console.log('  npx vercel env rm H3RE_COLLECTION_ADDRESS production -y');
  console.log('  Get-Content ..\\h3re-mainnet-escrow.json -Raw | npx vercel env add BOND_ESCROW_SECRET production');
  console.log('  "' + walletAddress + '" | npx vercel env add BOND_ESCROW_ADDRESS production');
  console.log('  "' + collectionAddress + '" | npx vercel env add H3RE_COLLECTION_ADDRESS production');
  console.log('  npx vercel --prod');
  console.log('');
}

const command = process.argv[2];
const commands = { wallet, status, collection };
if (!commands[command]) {
  console.log('Usage: node scripts/mainnet.js <wallet | status | collection>');
  process.exit(1);
}
commands[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
