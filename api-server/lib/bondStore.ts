import { Redis } from '@upstash/redis';

/**
 * Replay protection for bond payments.
 *
 * Without this, one bond transaction could be cited on unlimited check-ins —
 * pay once, spoof forever. Each signature is recorded the first time it is
 * accepted and refused thereafter.
 */

const redis = Redis.fromEnv();

const KEY_PREFIX = 'bond-sig:';
const RETENTION_SECONDS = 60 * 60 * 24 * 30;

export async function isBondSignatureUsed(signature: string): Promise<boolean> {
  try {
    const existing = await redis.get(`${KEY_PREFIX}${signature}`);
    return existing !== null;
  } catch (err) {
    console.error('[bond-store] lookup failed', err);
    // Fail closed: if we can't confirm a signature is fresh, don't accept it.
    // Replay is a worse outcome than a rejected check-in the user can retry.
    return true;
  }
}

export async function markBondSignatureUsed(
  signature: string,
  walletAddress: string
): Promise<void> {
  try {
    await redis.set(
      `${KEY_PREFIX}${signature}`,
      { walletAddress, usedAt: Date.now() },
      { ex: RETENTION_SECONDS }
    );
  } catch (err) {
    console.error('[bond-store] mark failed', err);
  }
}
