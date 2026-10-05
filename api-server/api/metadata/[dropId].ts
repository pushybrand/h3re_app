import type { VercelRequest, VercelResponse } from '@vercel/node';
import { metaFor, mimeForImage } from '../../lib/dropMeta';
import { getDropById } from '../../lib/drops';

/**
 * Token metadata, served per drop. This is the URI baked into each minted
 * asset, so the shape has to stay stable once badges exist in the wild.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.dropId;
  const dropId = Array.isArray(raw) ? raw[0] : raw;

  if (typeof dropId !== 'string' || !dropId) {
    return res.status(400).json({ error: 'dropId required' });
  }

  const meta = metaFor(dropId);
  const drop = getDropById(dropId);
  const origin = 'https://' + (req.headers.host ?? 'h3re-api.vercel.app');
  const imageUrl = origin + meta.image;

  const attributes: Array<{ trait_type: string; value: string }> = [
    { trait_type: 'Location', value: meta.name },
    { trait_type: 'Verification', value: 'GPS verified on site' },
  ];

  if (drop && !drop.bypassRadius) {
    attributes.push({ trait_type: 'Mint radius', value: drop.radiusMeters + ' m' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');

  return res.status(200).json({
    name: 'H3RE - ' + meta.name,
    symbol: 'H3RE',
    description: meta.description,
    image: imageUrl,
    external_url: 'https://h3re.app',
    attributes,
    properties: {
      files: [{ uri: imageUrl, type: mimeForImage(meta.image) }],
      category: 'image',
    },
  });
}