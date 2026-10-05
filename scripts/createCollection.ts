import { createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner } from '@metaplex-foundation/umi';
import { umi } from '../lib/umi';

async function main() {
  const collectionSigner = generateSigner(umi);

  await createCollection(umi, {
    collection: collectionSigner,
    name: 'H3RE',
    uri: 'https://h3re-api.vercel.app/metadata/collection.json',
  }).sendAndConfirm(umi);

  console.log('H3RE collection address:', collectionSigner.publicKey.toString());
}

main();