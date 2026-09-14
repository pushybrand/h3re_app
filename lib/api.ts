const API_BASE_URL = 'https://h3re-api.vercel.app';

export type CheckInRequest = {
  walletAddress: string;
  dropId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  clientReportedMock: boolean;
  timestamp: number;
};

export type CheckInResponse = {
  approved: boolean;
  reason?: string;
  bondAction: 'refund' | 'slash' | 'none';
  distanceMeters: number;
};

const NETWORK_ERROR: CheckInResponse = {
  approved: false,
  reason: 'network_error',
  bondAction: 'none',
  distanceMeters: 0,
};

export async function checkIn(body: CheckInRequest): Promise<CheckInResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Partial<CheckInResponse>;
    if (!res.ok) {
      return NETWORK_ERROR;
    }

    return {
      approved: Boolean(data.approved),
      reason: data.reason,
      bondAction: data.bondAction ?? 'none',
      distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : 0,
    };
  } catch {
    return NETWORK_ERROR;
  }
}
