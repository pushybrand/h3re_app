import { Redis } from '@upstash/redis';

/**
 * Mint tickets and collection history.
 *
 * A ticket is granted only when a check-in passes verification, and is
 * consumed by the mint endpoint. This is what makes the mint genuinely
 * gated on presence: the only thing that can authorise a mint is the same
 * server that just confirmed the collector was standing at the drop.
 *
 * Tickets are short-lived so an approved check-in cannot be banked and
 * redeemed days later from somewhere else.
 *
 * Every successful mint is also pushed onto a per-wallet list so the app
 * can show a collector what they have picked up without having to index
 * the chain itself.
 */

const redis = Redis.fromEnv();

const TICKET_PREFIX = 'mint-ticket:';
const MINTED_PREFIX = 'minted:';
const COLLECTION_PREFIX = 'collection:';
const TICKET_TTL_SECONDS = 15 * 60;
const COLLECTION_MAX = 200;

export type CollectionItem = {
  dropId: string;
  assetAddress: string;
  signature: string;
  mintedAt: number;
};

function ticketKey(walletAddress: string, dropId: string) {
  return TICKET_PREFIX + walletAddress + ':' + dropId;
}

function mintedKey(walletAddress: string, dropId: string) {
  return MINTED_PREFIX + walletAddress + ':' + dropId;
}

function collectionKey(walletAddress: string) {
  return COLLECTION_PREFIX + walletAddress;
}

export async function grantMintTicket(walletAddress: string, dropId: string): Promise<void> {
  try {
    await redis.set(
      ticketKey(walletAddress, dropId),
      { grantedAt: Date.now() },
      { ex: TICKET_TTL_SECONDS }
    );
    console.log('[mint] ticket granted', { walletAddress, dropId });
  } catch (err) {
    console.error('[mint] grant failed', err);
  }
}

/**
 * Consumes a ticket. Returns false if there is no valid ticket, or if this
 * wallet already minted this drop. Deletes the ticket on success so it
 * cannot be reused.
 */
export async function consumeMintTicket(
  walletAddress: string,
  dropId: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const alreadyMinted = await redis.get(mintedKey(walletAddress, dropId));
    if (alreadyMinted) {
      return { ok: false, reason: 'already_minted' };
    }

    const ticket = await redis.get(ticketKey(walletAddress, dropId));
    if (!ticket) {
      return { ok: false, reason: 'no_valid_check_in' };
    }

    await redis.del(ticketKey(walletAddress, dropId));
    return { ok: true };
  } catch (err) {
    console.error('[mint] consume failed', err);
    // Fail closed - an unverifiable ticket must not mint.
    return { ok: false, reason: 'ticket_lookup_failed' };
  }
}

export async function recordMinted(
  walletAddress: string,
  dropId: string,
  assetAddress: string,
  signature: string
): Promise<void> {
  const item: CollectionItem = {
    dropId,
    assetAddress,
    signature,
    mintedAt: Date.now(),
  };

  try {
    await redis.set(mintedKey(walletAddress, dropId), {
      assetAddress,
      signature,
      mintedAt: item.mintedAt,
    });
  } catch (err) {
    console.error('[mint] record failed', err);
  }

  // Collection history is a nice-to-have, so it is written separately.
  // If this fails the mint itself still stands.
  try {
    await redis.lpush(collectionKey(walletAddress), item);
    await redis.ltrim(collectionKey(walletAddress), 0, COLLECTION_MAX - 1);
  } catch (err) {
    console.error('[mint] collection push failed', err);
  }
}

/**
 * Everything this wallet has minted, newest first.
 */
export async function listMinted(walletAddress: string): Promise<CollectionItem[]> {
  try {
    const raw = await redis.lrange(collectionKey(walletAddress), 0, COLLECTION_MAX - 1);
    if (!Array.isArray(raw)) return [];

    const items: CollectionItem[] = [];
    for (const entry of raw) {
      // Upstash may hand back either a parsed object or a JSON string
      // depending on how it was written, so handle both.
      let parsed: any = entry;
      if (typeof entry === 'string') {
        try {
          parsed = JSON.parse(entry);
        } catch {
          continue;
        }
      }
      if (parsed && typeof parsed.dropId === 'string' && typeof parsed.assetAddress === 'string') {
        items.push({
          dropId: parsed.dropId,
          assetAddress: parsed.assetAddress,
          signature: typeof parsed.signature === 'string' ? parsed.signature : '',
          mintedAt: typeof parsed.mintedAt === 'number' ? parsed.mintedAt : 0,
        });
      }
    }
    return items;
  } catch (err) {
    console.error('[mint] list failed', err);
    return [];
  }
}