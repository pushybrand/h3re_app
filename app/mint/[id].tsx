import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { COLORS } from '../_layout';
import { getVerifiedLocation } from '../../lib/location';
import { connectWallet, signAndSendTransaction } from '../../lib/wallet';

type CheckInState = 'idle' | 'checking' | 'in-range' | 'out-of-range' | 'error';

// Stubbed drop lookup — replace with a real fetch by `id` once you have an API.
const DROP = {
  name: 'neon alley',
  location: 'Shibuya, Tokyo',
  editionsLeft: 8,
  editionsTotal: 50,
};

export default function Mint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [checkIn, setCheckIn] = useState<CheckInState>('idle');
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  const runCheckIn = useCallback(async () => {
    setCheckIn('checking');
    const fix = await getVerifiedLocation();
    if (!fix) {
      setCheckIn('error');
      return;
    }

    // POST fix + dropId to /api/check-in, which runs verifyCheckIn()
    // server-side (server/verifyLocation.ts) and returns approved/denied
    // plus the distance so the UI can show something useful either way.
    // Stubbed here as an always-approved response for local UI testing.
    const serverResponse = { approved: true, distanceMeters: 40 };

    setDistanceLabel(`${serverResponse.distanceMeters} m away`);
    setCheckIn(serverResponse.approved ? 'in-range' : 'out-of-range');
  }, [id]);

  const handleMint = useCallback(async () => {
    setMinting(true);
    try {
      const pubkey = await connectWallet();
      if (!pubkey) {
        Alert.alert('Wallet not connected', 'Approve the connection in your wallet app to mint.');
        return;
      }

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
        Alert.alert('Minted!', `${DROP.name} is now yours.\n${signature.slice(0, 12)}…`);
      } else {
        Alert.alert('Mint failed', 'Something went wrong signing the transaction.');
      }
    } finally {
      setMinting(false);
    }
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.imageBlock} />

      <View style={styles.body}>
        <Text style={styles.location}>{DROP.location}</Text>
        <Text style={styles.desc}>A fleeting moment in the everyday. Minted for those who were H3RE.</Text>

        <View style={styles.editionRow}>
          <Text style={styles.editionLabel}>edition</Text>
          <Text style={styles.editionValue}>{DROP.editionsLeft} / {DROP.editionsTotal} left</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(1 - DROP.editionsLeft / DROP.editionsTotal) * 100}%` }]} />
        </View>

        {checkIn === 'idle' && (
          <Pressable style={styles.secondaryButton} onPress={runCheckIn}>
            <Text style={styles.secondaryButtonText}>check my location</Text>
          </Pressable>
        )}

        {checkIn === 'checking' && (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={COLORS.mint} />
            <Text style={[styles.statusText, { color: COLORS.mint }]}>checking location…</Text>
          </View>
        )}

        {checkIn === 'in-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.mint }]}>
              you're in range · {distanceLabel}
            </Text>
          </View>
        )}

        {checkIn === 'out-of-range' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              too far away · {distanceLabel}
            </Text>
          </View>
        )}

        {checkIn === 'error' && (
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: COLORS.bubblegum }]}>
              couldn't get your location — check permissions
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.mintButton, checkIn !== 'in-range' && styles.mintButtonDisabled]}
          disabled={checkIn !== 'in-range' || minting}
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
