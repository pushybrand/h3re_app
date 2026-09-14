import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDropById } from '../lib/drops';
import { verifyCheckIn } from '../lib/verifyLocation';

function parseBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return req.body;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateCheckInBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const { walletAddress, dropId, latitude, longitude, accuracy, clientReportedMock, timestamp } =
    body as Record<string, unknown>;

  if (typeof walletAddress !== 'string' || walletAddress.length === 0) {
    return 'walletAddress must be a non-empty string';
  }
  if (typeof dropId !== 'string' || dropId.length === 0) {
    return 'dropId must be a non-empty string';
  }
  if (!isFiniteNumber(latitude)) {
    return 'latitude must be a finite number';
  }
  if (!isFiniteNumber(longitude)) {
    return 'longitude must be a finite number';
  }
  if (accuracy !== null && !isFiniteNumber(accuracy)) {
    return 'accuracy must be a finite number or null';
  }
  if (typeof clientReportedMock !== 'boolean') {
    return 'clientReportedMock must be a boolean';
  }
  if (!isFiniteNumber(timestamp)) {
    return 'timestamp must be a finite number';
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body: unknown;
    try {
      body = parseBody(req);
    } catch {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }

    const validationError = validateCheckInBody(body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { walletAddress, dropId, latitude, longitude, accuracy, clientReportedMock, timestamp } =
      body as {
        walletAddress: string;
        dropId: string;
        latitude: number;
        longitude: number;
        accuracy: number | null;
        clientReportedMock: boolean;
        timestamp: number;
      };

    const drop = getDropById(dropId);
    if (!drop) {
      return res.status(404).json({ error: `Drop not found: ${dropId}` });
    }

    const result = verifyCheckIn(
      { walletAddress, dropId, latitude, longitude, accuracy, clientReportedMock, timestamp },
      drop,
      null
    );

    return res.status(200).json({
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters: result.distanceMeters,
    });
  } catch (error) {
    console.error('check-in failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
