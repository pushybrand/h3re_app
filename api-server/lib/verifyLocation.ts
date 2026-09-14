/**
 * Server-side location verification for H3RE location-locked mints.
 *
 * This is the actual gate. The app's client-side location check
 * (lib/location.ts) is only a UX convenience — anyone can spoof
 * Android's reported coordinates with a root-level GPS mocker, so
 * nothing here can trust a raw lat/lon from the device alone.
 *
 * Framework-agnostic on purpose — adapt the request/response shapes
 * to whatever you deploy this as (Express route, Vercel/Cloudflare
 * function, etc).
 */

type DropRecord = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type CheckInRequest = {
  walletAddress: string;
  dropId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  clientReportedMock: boolean;
  timestamp: number;
};

type PriorCheckIn = {
  latitude: number;
  longitude: number;
  timestamp: number;
} | null;

type VerificationResult = {
  approved: boolean;
  reason?: string;
  bondAction: 'refund' | 'slash' | 'none';
  distanceMeters: number;
};

const MAX_PLAUSIBLE_SPEED_MPS = 55; // ~200 km/h — generous, catches teleport-style spoofing
const MIN_ACCEPTABLE_ACCURACY_M = 100; // reject wildly imprecise fixes
const SUSPICIOUSLY_PERFECT_ACCURACY_M = 1; // some spoofers report unrealistically exact fixes

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Core check. Call this from your API route after loading the drop
 * record and the wallet's last known check-in (if any) from your DB.
 */
export function verifyCheckIn(
  req: CheckInRequest,
  drop: DropRecord,
  prior: PriorCheckIn
): VerificationResult {
  const distanceMeters = haversineDistanceMeters(
    req.latitude,
    req.longitude,
    drop.latitude,
    drop.longitude
  );

  // 1. Reject anything the client itself flagged as mocked.
  //    Not sufficient alone, but a free early rejection.
  if (req.clientReportedMock) {
    return { approved: false, reason: 'client_reported_mock_location', bondAction: 'slash', distanceMeters };
  }

  // 2. Reject fixes with no/garbage accuracy, or suspiciously exact ones.
  if (
    req.accuracy === null ||
    req.accuracy > MIN_ACCEPTABLE_ACCURACY_M ||
    req.accuracy < SUSPICIOUSLY_PERFECT_ACCURACY_M
  ) {
    return { approved: false, reason: 'implausible_accuracy', bondAction: 'slash', distanceMeters };
  }

  // 3. Distance check against the drop's pin + radius.
  if (distanceMeters > drop.radiusMeters) {
    return { approved: false, reason: 'outside_radius', bondAction: 'refund', distanceMeters }; // honest miss, not fraud — refund
  }

  // 4. Speed/teleport check against the wallet's last known check-in.
  //    A wallet that "arrives" faster than physically possible is a
  //    strong spoofing signal, independent of the reported accuracy.
  if (prior) {
    const elapsedSeconds = Math.max((req.timestamp - prior.timestamp) / 1000, 1);
    const distanceFromPrior = haversineDistanceMeters(
      req.latitude, req.longitude, prior.latitude, prior.longitude
    );
    const impliedSpeed = distanceFromPrior / elapsedSeconds;
    if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
      return { approved: false, reason: 'implausible_travel_speed', bondAction: 'slash', distanceMeters };
    }
  }

  return { approved: true, bondAction: 'refund', distanceMeters };
}

/**
 * Bond flow this plugs into (SKR anti-spoof mechanic):
 *  1. Client stakes a small SKR amount on-chain before requesting a check-in.
 *  2. Client submits GPS data to this endpoint.
 *  3. verifyCheckIn() runs — approved → refund the bond + allow mint;
 *     rejected-as-fraud → slash the bond; rejected-as-honest-miss (outside
 *     radius) → refund, no penalty for just not being close enough yet.
 *
 * The actual stake/refund/slash calls are a small on-chain program —
 * out of scope for this file, stubbed here as the integration point.
 */
export async function applyBondAction(
  walletAddress: string,
  action: VerificationResult['bondAction']
): Promise<void> {
  if (action === 'none') return;
  // TODO: call the H3RE bond program's refund/slash instruction
  console.log(`[bond] ${action} for ${walletAddress}`);
}
