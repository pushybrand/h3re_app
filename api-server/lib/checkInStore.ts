import { Redis } from '@upstash/redis';

/**
 * Persistent check-in history, backed by Upstash Redis.
 *
 * This exists so the travel-speed check in verifyCheckIn has something to
 * compare against. Serverless functions keep no memory between invocations,
 * so without this the "did this wallet teleport?" check silently never runs.
 *
 * Failures here are deliberately non-fatal: if Redis is unreachable we lose
 * one anti-spoof signal, but a legitimate collector standing at the drop
 * should never be blocked because of a storage outage.
 */

const redis = Redis.fromEnv();

const KEY_PREFIX = 'checkin:';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export type StoredCheckIn = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export async function getLastCheckIn(
  walletAddress: string
): Promise<StoredCheckIn | null> {
  try {
    const record = await redis.get<StoredCheckIn>(`${KEY_PREFIX}${walletAddress}`);
    if (!record) return null;

    // Guard against malformed records rather than trusting whatever is stored.
    if (
      typeof record.latitude !== 'number' ||
      typeof record.longitude !== 'number' ||
      typeof record.timestamp !== 'number'
    ) {
      console.warn('[store] discarding malformed check-in record', walletAddress);
      return null;
    }

    return record;
  } catch (err) {
    console.error('[store] getLastCheckIn failed', err);
    return null;
  }
}

export async function recordCheckIn(
  walletAddress: string,
  latitude: number,
  longitude: number,
  timestamp: number
): Promise<void> {
  try {
    await redis.set<StoredCheckIn>(
      `${KEY_PREFIX}${walletAddress}`,
      { latitude, longitude, timestamp },
      { ex: THIRTY_DAYS_SECONDS }
    );
  } catch (err) {
    console.error('[store] recordCheckIn failed', err);
    // Swallow deliberately — see note at top of file.
  }
}
