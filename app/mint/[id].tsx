import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Transaction, SystemProgram } from '@solana/web3.js';
import { COLORS } from '../_layout';
import { getVerifiedLocation } from '../../lib/location';
import { signAndSendTransaction } from '../../lib/wallet';
import { getDropById } from '../../lib/drops';
import { recordCheckIn } from '../../lib/checkInHistory';
import { checkIn } from '../../lib/api';

type CheckInState = 'idle' | 'checking' | 'in-range' | 'out-of-range' | 'error';

export default function Mint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = getDropById(typeof id === 'string' ? id : id?.[0]);
  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  const runCheckIn = useCallback(async () => {
    if (!drop) {
      setCheckInState('error');
      return;
    }

    setCheckInState('checking');
    setFailReason(null);
    const fix = await getVerifiedLocation();
    if (!fix) {
      console.log('[check-in] no GPS fix');
      setCheckInState('error');
      return;
    }

    const walletAddress = 'local-device';

    const result = await checkIn({
      walletAddress,
      dropId: drop.id,
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      clientReportedMock: fix.isMockLocation,
      timestamp: fix.timestamp,
    });

    recordCheckIn(walletAddress, fix.latitude, fix.longitude, fix.timestamp);

    const distanceMeters = Math.round(result.distanceMeters);

    console.log('[check-in] verification', {
      dropId: drop.id,
      walletAddress,
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters,
    });

    setDistanceLabel(`${distanceMeters} m away`);
    if (result.approved) {
      setFailReason(null);
      setCheckInState('in-range');
    } else {
      setFailReason(result.reason === 'outside_radius' ? 'too far away' : 'location check failed');
      setCheckInState('out-of-range');
    }
  }, [drop]);

  const handleMint = useCallback(async () => {
    setMinting(true);
    try {
      // Placeholder transaction — swap for the real mint instruction
      // (candy-machine style mint, or your own program's mint ix) once
      // the on-chain side exists. This just proves the MWA sign/send path.
      const signature = await signAndSendTransaction(async (walletPubkey) => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: walletPubkey,
            toPubkey: walletPubkey,
            lamports: 0,
          })
        );
        return tx;
      });

      if (signature) {
        Alert.alert('Minted!', `${drop?.name ?? 'drop'} is now yours.\n${signature.slice(0, 12)}…`);
      } else {
        Alert.alert('Mint failed', 'Something went wrong signing the transaction.');
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
          <View style={[styles.progressFill, { width: `${(1 - drop.editionsLeft / drop.editionsTotal) * 100}%` }]} />
        </View>

        {checkInState === 'idle' && (
          <Pressable style={styles.secondaryButton} onPress={runCheckIn}>
            <Text style={styles.secondaryButtonText}>check my location</Text>
          </Pressable>
        )}

        {checkInState === 'checking' && (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={COLORS.mint} />
            <Text style={[styles.statusText, { color: COLORS.mint }]}>checking location…</Text>
          </View>
        )}

        {checkInState === 'in-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.mint }]}>
              you're in range · {distanceLabel}
            </Text>
          </View>
        )}

        {checkInState === 'out-of-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              {failReason} · {distanceLabel}
            </Text>
          </View>
        )}

        {checkInState === 'error' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              couldn't get your location — check permissions
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
        <Text style={styles.footnote}>this drop is location-locked · be near the spot to mint</Text>
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
