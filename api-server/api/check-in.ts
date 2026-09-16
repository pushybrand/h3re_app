import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLastCheckIn, recordCheckIn } from '../lib/checkInStore';
import { isBondSignatureUsed, markBondSignatureUsed } from '../lib/bondStore';
import { verifyBondPayment, refundBond } from '../lib/bond';
import { getDropById } from '../lib/drops';
import { verifyCheckIn } from '../lib/verifyLocation';

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

  const { walletAddress, dropId, latitude, longitude, accuracy, clientReportedMock, timestamp, bondSignature } =
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
  if (typeof bondSignature !== 'string' || bondSignature.length === 0) {
    return 'bondSignature must be a non-empty string';
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

    const {
      walletAddress, dropId, latitude, longitude,
      accuracy, clientReportedMock, timestamp, bondSignature,
    } = body as {
      walletAddress: string;
      dropId: string;
      latitude: number;
      longitude: number;
      accuracy: number | null;
      clientReportedMock: boolean;
      timestamp: number;
      bondSignature: string;
    };

    const drop = getDropById(dropId);
    if (!drop) {
      return res.status(404).json({ error: 'Drop not found: ' + dropId });
    }

    // --- Bond checks, before any location work ---
    // One bond, one check-in. Without this a single payment could back
    // unlimited attempts: pay once, spoof forever.
    if (await isBondSignatureUsed(bondSignature)) {
      console.log('[bond] signature already used', { walletAddress, bondSignature });
      return res.status(400).json({
        approved: false,
        reason: 'bond_already_used',
        bondAction: 'none',
      });
    }

    const bond = await verifyBondPayment(bondSignature, walletAddress);
    if (!bond.valid) {
      console.log('[bond] payment invalid', { walletAddress, reason: bond.reason });
      return res.status(400).json({
        approved: false,
        reason: bond.reason,
        bondAction: 'none',
      });
    }

    await markBondSignatureUsed(bondSignature, walletAddress);

    // --- Location verification ---
    const prior = await getLastCheckIn(walletAddress);

    if (prior) {
      const elapsedSeconds = Math.max((timestamp - prior.timestamp) / 1000, 1);
      const distanceFromPrior = haversineDistanceMeters(
        latitude, longitude, prior.latitude, prior.longitude
      );
      console.log('[check-in] prior found', {
        walletAddress,
        elapsedSeconds: Math.round(elapsedSeconds),
        distanceFromPriorMeters: Math.round(distanceFromPrior),
        impliedSpeedMps: Math.round(distanceFromPrior / elapsedSeconds),
      });
    } else {
      console.log('[check-in] no prior check-in for', walletAddress);
    }

    const result = verifyCheckIn(
      { walletAddress, dropId, latitude, longitude, accuracy, clientReportedMock, timestamp },
      drop,
      prior
    );

    if (result.approved) {
      await recordCheckIn(walletAddress, latitude, longitude, timestamp);
    }

    // --- Settle the bond ---
    // Approved and honest-miss both get the bond back. Only fraud forfeits:
    // being far from a drop is not a lie, claiming to be near one is.
    let refundSignature: string | null = null;
    if (result.bondAction === 'refund') {
      refundSignature = await refundBond(walletAddress);
    } else if (result.bondAction === 'slash') {
      console.log('[bond] slashed', { walletAddress, reason: result.reason });
    }

    console.log('[check-in] result', {
      walletAddress,
      dropId,
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters: Math.round(result.distanceMeters ?? 0),
      refundSignature,
    });

    return res.status(200).json({
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters: result.distanceMeters,
      refundSignature,
    });
  } catch (error) {
    console.error('check-in failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}