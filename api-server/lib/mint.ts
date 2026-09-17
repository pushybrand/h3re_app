import { create, mplCore } from '@metaplex-foundation/mpl-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';

/**
 * Mints the H3RE badge for a verified check-in.
 *
 * The mint is server-authorised on purpose: the only thing that can mint is
 * the same server that confirmed the collector was standing at the drop.
 * A client-side mint could in principle be triggered without a passing
 * location check; this one cannot.
 *
 * Metaplex Core rather than Token Metadata - single account per asset,
 * substantially cheaper, and the collector pays nothing.
 */

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

function buildUmi() {
  const secretRaw = process.env.BOND_ESCROW_SECRET;
  if (!secretRaw) throw new Error('BOND_ESCROW_SECRET is not set');

  const umi = createUmi(RPC_URL).use(mplCore());
  const secret = Uint8Array.from(JSON.parse(secretRaw));
  const keypair = umi.eddsa.createKeypairFromSecretKey(secret);
  return umi.use(keypairIdentity(keypair));
}

export type MintResult = {
  assetAddress: string;
  signature: string;
};

export async function mintBadge(
  ownerAddress: string,
  dropId: string,
  displayName: string,
  metadataUri: string
): Promise<MintResult> {
  const umi = buildUmi();
  const asset = generateSigner(umi);

  console.log('[mint] creating asset', {
    owner: ownerAddress,
    dropId,
    asset: asset.publicKey.toString(),
  });

  const result = await create(umi, {
    asset,
    name: displayName,
    uri: metadataUri,
    owner: publicKey(ownerAddress),
  }).sendAndConfirm(umi);

  const signature = base58.deserialize(result.signature)[0];

  console.log('[mint] confirmed', { asset: asset.publicKey.toString(), signature });

  return {
    assetAddress: asset.publicKey.toString(),
    signature,
  };
}