import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDropById } from '../../lib/drops';

const DISPLAY: Record<string, { name: string; blurb: string }> = {
  'neon-alley': {
    name: 'Neon Alley',
    blurb: 'A fleeting moment in the everyday. Minted by someone who was there.',
  },
  'skyline-moment': {
    name: 'Skyline Moment',
    blurb: 'The scramble, frozen. Only for those standing in it.',
  },
  'demo-anywhere': {
    name: 'Demo Drop',
    blurb: 'A demo badge, mintable from anywhere. The real ones are not.',
  },
  'ramen-spot': {
    name: 'Ramen Spot',
    blurb: 'Steam, neon, a late bowl. Proof you found the spot.',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { dropId } = req.query;
  const id = Array.isArray(dropId) ? dropId[0] : dropId;

  if (!id) {
    return res.status(400).json({ error: 'dropId required' });
  }

  const drop = getDropById(id);
  if (!drop) {
    return res.status(404).json({ error: 'Drop not found: ' + id });
  }

  const display = DISPLAY[id] ?? { name: id, blurb: 'A H3RE location-locked drop.' };
  const origin = 'https://' + (req.headers.host ?? 'h3re-api.vercel.app');

  return res.status(200).json({
    name: 'H3RE - ' + display.name,
    symbol: 'H3RE',
    description: display.blurb + ' This piece could only be minted at its location. Holding it is proof of presence, not purchase.',
    image: origin + '/badge.png',
    external_url: 'https://h3re.app',
    attributes: [
      { trait_type: 'Drop', value: display.name },
      { trait_type: 'Latitude', value: String(drop.latitude) },
      { trait_type: 'Longitude', value: String(drop.longitude) },
      { trait_type: 'Radius (m)', value: String(drop.radiusMeters) },
    ],
    properties: {
      files: [{ uri: origin + '/badge.png', type: 'image/png' }],
      category: 'image',
    },
  });
}