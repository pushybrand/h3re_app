type StoredCheckIn = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

const lastCheckIns = new Map<string, StoredCheckIn>();

export function getLastCheckIn(walletAddress: string): StoredCheckIn | null {
  return lastCheckIns.get(walletAddress) ?? null;
}

export function recordCheckIn(
  walletAddress: string,
  lat: number,
  lon: number,
  timestamp: number
): void {
  lastCheckIns.set(walletAddress, { latitude: lat, longitude: lon, timestamp });
}
