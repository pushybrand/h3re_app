import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COLORS } from '../_layout';
import { getDropById } from '../../lib/drops';
import { checkInWithBond, requestMint } from '../../lib/bondPayment';

type CheckInState = 'idle' | 'checking' | 'in-range' | 'out-of-range' | 'error';

function describeFailure(reason?: string, error?: string): string {
  if (error === 'location_permission_denied') return 'location permission denied';
  if (error) return 'check-in failed';
  switch (reason) {
    case 'outside_radius':
      return 'too far away';
    case 'client_reported_mock_location':
      return 'mock location detected';
    case 'implausible_travel_speed':
      return 'impossible travel detected';
    case 'implausible_accuracy':
      return 'gps accuracy looks wrong';
    case 'bond_already_used':
      return 'bond already spent';
    case 'bond_not_found':
    case 'bond_transaction_failed':
    case 'bond_lookup_failed':
      return 'bond payment failed';
    case 'bond_amount_insufficient':
      return 'bond too small';
    case 'bond_payer_mismatch':
      return 'bond came from another wallet';
    default:
      return 'location check failed';
  }
}

export default function Mint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = getDropById(typeof id === 'string' ? id : id?.[0]);
  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [bondNote, setBondNote] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  const runCheckIn = useCallback(async () => {
    if (!drop) {
      setCheckInState('error');
      return;
    }

    setCheckInState('checking');
    setFailReason(null);
    setBondNote(null);

    const result = await checkInWithBond(drop.id);

    const distanceMeters =
      typeof result.distanceMeters === 'number' ? Math.round(result.distanceMeters) : null;
    setDistanceLabel(distanceMeters !== null ? distanceMeters + ' m away' : null);

    if (result.bondAction === 'refund') {
      setBondNote('bond refunded');
    } else if (result.bondAction === 'slash') {
      setBondNote('bond forfeited');
    } else {
      setBondNote(null);
    }

    console.log('[check-in] verification', {
      dropId: drop.id,
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters,
      refundSignature: result.refundSignature,
    });

    if (result.error === 'location_permission_denied') {
      setFailReason(describeFailure(result.reason, result.error));
      setCheckInState('error');
      return;
    }

    if (result.approved) {
      setFailReason(null);
      setCheckInState('in-range');
    } else {
      setFailReason(describeFailure(result.reason, result.error));
      setCheckInState('out-of-range');
    }
  }, [drop]);

  const handleMint = useCallback(async () => {
    if (!drop) return;
    setMinting(true);
    try {
      const result = await requestMint(drop.id);

      if (result.minted) {
        Alert.alert(
          'Minted',
          drop.name + ' is yours.\nasset ' + (result.assetAddress ?? '').slice(0, 12) + '...'
        );
      } else if (result.reason === 'already_minted') {
        Alert.alert('Already minted', 'You have already collected this drop.');
      } else if (result.reason === 'no_valid_check_in') {
        Alert.alert('Check in first', 'Your check-in expired. Check in again to mint.');
      } else {
        Alert.alert('Mint failed', result.reason ?? result.error ?? 'Something went wrong.');
      }
    } finally {
      setMinting(false);
    }
  }, [drop]);

  if (!drop) {
    return (
      <View style={styles.screen}>
        <View style={styles.body}>
          <Text style={styles.desc}>this drop could not be found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.imageBlock} />

      <View style={styles.body}>
        <Text style={styles.location}>{drop.location}</Text>
        <Text style={styles.desc}>{drop.description}</Text>

        <View style={styles.editionRow}>
          <Text style={styles.editionLabel}>edition</Text>
          <Text style={styles.editionValue}>{drop.editionsLeft} / {drop.editionsTotal} left</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: ((1 - drop.editionsLeft / drop.editionsTotal) * 100) + '%' }]} />
        </View>

        {checkInState === 'idle' && (
          <Pressable style={styles.secondaryButton} onPress={runCheckIn}>
            <Text style={styles.secondaryButtonText}>stake bond and check in</Text>
          </Pressable>
        )}

        {checkInState === 'checking' && (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={COLORS.mint} />
            <Text style={[styles.statusText, { color: COLORS.mint }]}>staking bond, checking location...</Text>
          </View>
        )}

        {checkInState === 'in-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.mint }]}>
              you are in range{distanceLabel ? ' - ' + distanceLabel : ''}{bondNote ? ' - ' + bondNote : ''}
            </Text>
          </View>
        )}

        {checkInState === 'out-of-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              {failReason}{distanceLabel ? ' - ' + distanceLabel : ''}{bondNote ? ' - ' + bondNote : ''}
            </Text>
          </View>
        )}

        {checkInState === 'error' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              {failReason ?? 'could not get your location - check permissions'}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.mintButton, checkInState !== 'in-range' && styles.mintButtonDisabled]}
          disabled={checkInState !== 'in-range' || minting}
          onPress={handleMint}
        >
          {minting ? (
            <ActivityIndicator size="small" color={COLORS.bg} />
          ) : (
            <Text style={styles.mintButtonText}>mint now</Text>
          )}
        </Pressable>
        <Text style={styles.footnote}>this drop is location-locked - be near the spot to mint</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  imageBlock: { height: 220, margin: 14, borderRadius: 10, backgroundColor: COLORS.card },
  body: { paddingHorizontal: 16 },
  location: { fontSize: 11, color: COLORS.mint, marginBottom: 4 },
  desc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 16 },
  editionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  editionLabel: { fontSize: 11, color: COLORS.textMuted },
  editionValue: { fontSize: 12, color: COLORS.white, fontFamily: 'monospace' },
  progressTrack: { height: 7, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: '100%', backgroundColor: COLORS.bubblegum },
  secondaryButton: {
    borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12,
  },
  secondaryButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.card, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  statusText: { fontSize: 11 },
  mintButton: {
    backgroundColor: COLORS.mint, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  mintButtonDisabled: { backgroundColor: COLORS.border },
  mintButtonText: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  footnote: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, marginTop: 8, marginBottom: 24 },
});