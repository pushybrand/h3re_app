import { createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner } from '@metaplex-foundation/umi';
import { buildUmi } from '../lib/mint';

async function main() {
  const umi = buildUmi();
  const collectionSigner = generateSigner(umi);

  await createCollection(umi, {
    collection: collectionSigner,
    name: 'H3RE',
    uri: 'https://h3re-api.vercel.app/metadata/collection.json',
  }).sendAndConfirm(umi);

  console.log('H3RE collection address:', collectionSigner.publicKey.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});