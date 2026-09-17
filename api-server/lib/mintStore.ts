import { Redis } from '@upstash/redis';

/**
 * Mint tickets.
 *
 * A ticket is granted only when a check-in passes verification, and is
 * consumed by the mint endpoint. This is what makes the mint genuinely
 * gated on presence: the only thing that can authorise a mint is the same
 * server that just confirmed the collector was standing at the drop.
 *
 * Tickets are short-lived so an approved check-in cannot be banked and
 * redeemed days later from somewhere else.
 */

const redis = Redis.fromEnv();

const TICKET_PREFIX = 'mint-ticket:';
const MINTED_PREFIX = 'minted:';
const TICKET_TTL_SECONDS = 15 * 60;

function ticketKey(walletAddress: string, dropId: string) {
  return `${TICKET_PREFIX}${walletAddress}:${dropId}`;
}

function mintedKey(walletAddress: string, dropId: string) {
  return `${MINTED_PREFIX}${walletAddress}:${dropId}`;
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
  try {
    await redis.set(mintedKey(walletAddress, dropId), {
      assetAddress,
      signature,
      mintedAt: Date.now(),
    });
  } catch (err) {
    console.error('[mint] record failed', err);
  }
}