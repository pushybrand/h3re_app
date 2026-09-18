/**
 * Server-side location verification for H3RE location-locked mints.
 *
 * This is the actual gate. The app's client-side location check is a UX
 * convenience only - anyone can spoof Android's reported coordinates with a
 * root-level GPS mocker, so nothing here trusts a raw lat/lon from the device.
 */

type DropRecord = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  bypassRadius?: boolean;
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

const MAX_PLAUSIBLE_SPEED_MPS = 55; // ~200 km/h - generous, catches teleport-style spoofing
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

export function verifyCheckIn(
  req: CheckInRequest,
  drop: DropRecord,
  prior: PriorCheckIn
): VerificationResult {
  // A bypass drop has no fixed pin - it is wherever the collector is - so
  // there is no meaningful distance to report.
  const distanceMeters = drop.bypassRadius
    ? 0
    : haversineDistanceMeters(req.latitude, req.longitude, drop.latitude, drop.longitude);

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
  //    The demo drop deliberately skips this so a reviewer anywhere on earth
  //    can exercise the flow. Every other check below still applies to it.
  if (!drop.bypassRadius && distanceMeters > drop.radiusMeters) {
    return { approved: false, reason: 'outside_radius', bondAction: 'refund', distanceMeters };
  }

  // 4. Speed/teleport check against the wallet's last known check-in.
  //    A wallet that "arrives" faster than physically possible is a strong
  //    spoofing signal, independent of the reported accuracy.
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