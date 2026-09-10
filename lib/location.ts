import * as Location from 'expo-location';

export type LocationCheck = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  isMockLocation: boolean;
  timestamp: number;
};

/**
 * Grabs a fresh, high-accuracy fix and flags anything that looks spoofed.
 *
 * IMPORTANT: this is a first line of defense only. Android's `mocked` flag
 * is easy to bypass with root/Xposed-based GPS spoofers, so the real check
 * has to happen server-side (see server/verifyLocation.ts) — never trust
 * this alone to gate a mint or release an SKR bond.
 */
export async function getVerifiedLocation(): Promise<LocationCheck | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  // expo-location surfaces Android's isFromMockProvider via `mocked`
  // on the raw coords object on supported platforms.
  const isMockLocation = (position.coords as any)?.mocked === true;

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    isMockLocation,
    timestamp: position.timestamp,
  };
}

export function haversineDistanceMeters(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
