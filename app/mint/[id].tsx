import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../_layout';
import { getDropById } from '../../lib/drops';
import { checkInWithBond, requestMint } from '../../lib/bondPayment';
import CornerAccents from '../../components/CornerAccents';
import Tag from '../../components/Tag';
import GradientButton from '../../components/GradientButton';
import GlobeIcon from '../../components/GlobeIcon';
import BoltIcon from '../../components/BoltIcon';

type CheckInState = 'idle' | 'checking' | 'in-range' | 'out-of-range' | 'error';

function describeFailure(reason?: string, error?: string): string {
  if (error === 'location_permission_denied') return 'location permission denied';
  if (error) return 'check-in failed';
  switch (reason) {
    case 'outside_radius': return 'too far away';
    case 'client_reported_mock_location': return 'mock location detected';
    case 'implausible_travel_speed': return 'impossible travel detected';
    case 'implausible_accuracy': return 'gps accuracy looks wrong';
    case 'bond_already_used': return 'bond already spent';
    case 'bond_not_found':
    case 'bond_transaction_failed':
    case 'bond_lookup_failed': return 'bond payment failed';
    case 'bond_amount_insufficient': return 'bond too small';
    case 'bond_payer_mismatch': return 'bond came from another wallet';
    default: return 'location check failed';
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Static requires only - RN's bundler can't resolve a dynamic path, so each
// drop that has its own wordmark artwork gets an explicit entry here. Drops
// without one (nothing added yet) fall through to the ring+text fallback.
function getWordmarkImage(id: string) {
  switch (id) {
    case 'demo-anywhere':
      return require('../../assets/wordmark-demo-drop.png');
    case 'eden-project':
      return require('../../assets/wordmark-eden-project.png');
    case 'breakpoint-london':
      return require('../../assets/wordmark-breakpoint-london.png');
    case 'shoreditch':
      return require('../../assets/wordmark-shoreditch.png');
    case 'superteam-exeter':
      return require('../../assets/wordmark-superteam-exeter.png');
    default:
      return null;
  }
}

function Sparkle({ style, color, size }: { style: any; color: string; size: number }) {
  return (
    <View style={style} pointerEvents="none">
      <View
        style={[
          styles.sparkleGlow,
          { width: size * 2.6, height: size * 2.6, borderRadius: size * 1.3, backgroundColor: color },
        ]}
      />
      <Text style={[styles.sparkleGlyph, { color, fontSize: size }]}>{'✦'}</Text>
    </View>
  );
}

export default function Mint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = getDropById(typeof id === 'string' ? id : id?.[0]);
  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [bondNote, setBondNote] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!drop || drop.bypassRadius) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          const meters = haversineMeters(
            loc.coords.latitude,
            loc.coords.longitude,
            drop.latitude,
            drop.longitude
          );
          setLiveDistance(Math.round(meters));
        }
      );
    })();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [drop]);

  const runCheckIn = useCallback(async () => {
    if (!drop) { setCheckInState('error'); return; }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackType.Light).catch(() => {});
    } catch {}

    setCheckInState('checking');
    setFailReason(null);
    setBondNote(null);

    const result = await checkInWithBond(drop.id);

    const distanceMeters =
      typeof result.distanceMeters === 'number' ? Math.round(result.distanceMeters) : null;
    setDistanceLabel(distanceMeters !== null ? distanceMeters + ' m away' : null);

    if (result.bondAction === 'refund') setBondNote('bond refunded');
    else if (result.bondAction === 'slash') setBondNote('bond forfeited');
    else setBondNote(null);

    console.log('[check-in] verification', {
      dropId: drop.id,
      approved: result.approved,
      reason: result.reason,
      bondAction: result.bondAction,
      distanceMeters,
      refundSignature: result.refundSignature,
    });

    if (result.error === 'location_permission_denied') {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
      setFailReason(describeFailure(result.reason, result.error));
      setCheckInState('error');
      return;
    }

    if (result.approved) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
      setFailReason(null);
      setCheckInState('in-range');
    } else {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); } catch {}
      setFailReason(describeFailure(result.reason, result.error));
      setCheckInState('out-of-range');
    }
  }, [drop]);

  const handleMint = useCallback(async () => {
    if (!drop) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackType.Light).catch(() => {});
    } catch {}
    setMinting(true);
    try {
      const result = await requestMint(drop.id);
      if (result.minted) {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackType.Heavy);
          await new Promise((resolve) => setTimeout(resolve, 90));
          await Haptics.impactAsync(Haptics.ImpactFeedbackType.Heavy);
          await new Promise((resolve) => setTimeout(resolve, 90));
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        Alert.alert('Minted', drop.name + ' is yours.\nasset ' + (result.assetAddress ?? '').slice(0, 12) + '...');
      } else if (result.reason === 'already_minted') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
        Alert.alert('Already minted', 'You have already collected this drop.');
      } else if (result.reason === 'no_valid_check_in') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
        Alert.alert('Check in first', 'Your check-in expired. Check in again to mint.');
      } else {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
        Alert.alert('Mint failed', result.reason ?? result.error ?? 'Something went wrong.');
      }
    } finally {
      setMinting(false);
    }
  }, [drop]);

  if (!drop) {
    return (
      <View style={styles.screen}>
        <Text style={styles.desc}>this drop could not be found</Text>
      </View>
    );
  }

  const tagDefs = drop.bypassRadius
    ? [
        { icon: '⚡', label: 'demo', filled: true },
        { icon: '📍', label: 'anywhere' },
        { icon: '◈', label: 'testable' },
      ]
    : [
        { icon: '📍', label: 'location-locked', filled: true },
        { icon: '◈', label: 'limited' },
        { icon: '⛓', label: 'on-chain' },
      ];

  const showLiveDistance = checkInState === 'idle' && !drop.bypassRadius && liveDistance !== null;
  const liveInRange = showLiveDistance && liveDistance !== null && liveDistance <= drop.radiusMeters;
  const subtitle = drop.bypassRadius ? 'wherever you are' : drop.location;
  const wordmarkImage = getWordmarkImage(drop.id);

  return (
    <ImageBackground
      source={require('../../assets/bg-pattern.png')}
      style={styles.screen}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.heroFrame}>
          <CornerAccents corner="top-right" />
          <CornerAccents corner="top-left" size="sm" style={styles.heroAccentBottom} />
          <Text style={styles.heroKicker}>H3RE COLLECTIVE</Text>
          <Text style={styles.heroCrosshair}>{'⊕'}</Text>
          <View style={styles.heroGlow} />
          <View style={[styles.heroCard, { backgroundColor: COLORS.bubblegum }]}>
            {drop.imageUrl ? (
              <Image source={{ uri: drop.imageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <Text style={styles.heroPlaceholder}>H3RE</Text>
            )}
          </View>
        </View>

        <View style={styles.wordmarkWrap}>
          <Sparkle style={styles.sparkleTL} color={COLORS.bubblegum} size={18} />
          <Sparkle style={styles.sparkleBR} color={COLORS.mint} size={22} />
          {wordmarkImage ? (
            <Image
              source={wordmarkImage}
              style={styles.wordmarkImage}
              resizeMode="contain"
            />
          ) : (
            <>
              <View style={styles.ringGlow} />
              <View style={styles.ringChrome} />
              <View style={styles.ringHighlight} />
              <Text style={styles.wordmark}>{drop.name}</Text>
            </>
          )}
          <Text style={styles.wordmarkSub}>{subtitle}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.divider}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={styles.dividerDash} />
            ))}
          </View>

          <Text style={styles.desc}>{drop.description}</Text>

          <View style={styles.tagRow}>
            {tagDefs.map((tag) => (
              <Tag key={tag.label} icon={tag.icon} label={tag.label} filled={tag.filled} />
            ))}
          </View>

          {!drop.bypassRadius && (
            <>
              <Text style={styles.editions}>
                {drop.editionsLeft}/{drop.editionsTotal} left
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: ((1 - drop.editionsLeft / drop.editionsTotal) * 100) + '%' },
                  ]}
                />
              </View>
            </>
          )}

          {showLiveDistance && (
            <View style={[styles.liveDistancePill, liveInRange && styles.liveDistancePillInRange]}>
              <Text style={styles.liveDistanceText}>
                {liveInRange ? "you're here — check in below" : liveDistance + 'm away'}
              </Text>
            </View>
          )}

          {checkInState === 'idle' && (
            <View style={styles.buttonSlot}>
              <GradientButton
                label="Check in"
                icon="◆"
                endIcon={<GlobeIcon size={18} color={COLORS.white} />}
                onPress={runCheckIn}
                variant="primary"
              />
            </View>
          )}

          {checkInState === 'checking' && (
            <View style={[styles.banner, { backgroundColor: COLORS.lilac }]}>
              <ActivityIndicator size="small" color={COLORS.ink} />
              <Text style={styles.bannerText}>staking bond, checking location...</Text>
            </View>
          )}

          {checkInState === 'in-range' && (
            <View style={[styles.banner, { backgroundColor: COLORS.mint }]}>
              <Text style={styles.bannerText}>
                {'✓ '}you are in range{distanceLabel ? '  ' + distanceLabel : ''}
                {bondNote ? '  ' + bondNote : ''}
              </Text>
            </View>
          )}

          {checkInState === 'out-of-range' && (
            <View style={[styles.banner, { backgroundColor: COLORS.bubblegum }]}>
              <Text style={styles.bannerText}>
                {failReason}{distanceLabel ? '  ' + distanceLabel : ''}
                {bondNote ? '  ' + bondNote : ''}
              </Text>
            </View>
          )}

          {checkInState === 'error' && (
            <View style={[styles.banner, { backgroundColor: COLORS.yellow }]}>
              <Text style={styles.bannerText}>
                {failReason ?? 'could not get your location - check permissions'}
              </Text>
            </View>
          )}

          <View style={styles.buttonSlot}>
            <GradientButton
              label="mint now"
              icon="▢"
              endIcon={<BoltIcon size={18} color={COLORS.white} />}
              onPress={handleMint}
              disabled={checkInState !== 'in-range'}
              loading={minting}
              variant="secondary"
            />
          </View>

          <Text style={styles.footnote}>
            {drop.bypassRadius
              ? 'demo drop - mintable anywhere, every other check still runs'
              : 'this drop is location-locked - be near the spot to mint'}
          </Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  heroFrame: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingTop: 30,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroAccentBottom: { top: undefined, bottom: 14 } as any,
  heroKicker: {
    position: 'absolute',
    top: 14,
    left: 18,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.inkMuted,
    letterSpacing: 1.4,
  },
  heroCrosshair: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    fontSize: 20,
    color: COLORS.inkMuted,
    opacity: 0.7,
  },
  heroGlow: {
    position: 'absolute',
    left: 26,
    right: 26,
    top: 30,
    bottom: 10,
    borderRadius: 24,
    backgroundColor: COLORS.glowPink,
    transform: [{ rotate: '-2.5deg' }],
  },
  heroCard: {
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    transform: [{ rotate: '-1.2deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { fontSize: 30, fontWeight: '900', color: COLORS.ink },

  wordmarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 34,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  wordmarkImage: {
    width: '92%',
    height: 150,
  },
  // Fallback treatment for drops without their own wordmark artwork - three
  // offset ellipse outlines standing in for a metallic ring.
  ringGlow: {
    position: 'absolute',
    top: '32%',
    width: '82%',
    height: 66,
    borderRadius: 999,
    borderWidth: 10,
    borderColor: COLORS.glowPink,
    transform: [{ rotate: '-5deg' }],
  },
  ringChrome: {
    position: 'absolute',
    top: '36%',
    width: '74%',
    height: 54,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: COLORS.chromeShadow,
    opacity: 0.55,
    transform: [{ rotate: '-5deg' }],
  },
  ringHighlight: {
    position: 'absolute',
    top: '35%',
    width: '74%',
    height: 54,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.chromeHighlight,
    opacity: 0.9,
    transform: [{ rotate: '-5deg' }, { translateY: -2 }],
  },
  sparkleGlow: {
    position: 'absolute',
    opacity: 0.28,
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
  sparkleGlyph: { fontWeight: '900' },
  sparkleTL: { position: 'absolute', top: 6, left: '15%' },
  sparkleBR: { position: 'absolute', bottom: 0, right: '13%' },
  wordmark: {
    fontSize: 46,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -1,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  wordmarkSub: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.inkMuted,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 10,
    textTransform: 'lowercase',
  },

  body: { paddingHorizontal: 20, paddingTop: 8 },
  divider: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dividerDash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.chromeShadow,
  },
  desc: { fontSize: 16, fontWeight: '600', color: COLORS.ink, lineHeight: 23 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  editions: { fontSize: 18, fontWeight: '900', color: COLORS.ink, marginTop: 20 },
  progressTrack: {
    height: 8, backgroundColor: COLORS.surface, borderRadius: 4,
    overflow: 'hidden', marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.bubblegum },
  liveDistancePill: {
    alignSelf: 'center', backgroundColor: COLORS.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 18,
  },
  liveDistancePillInRange: { backgroundColor: COLORS.mint },
  liveDistanceText: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  buttonSlot: { marginTop: 22 },
  banner: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 22, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  bannerText: { fontSize: 13, fontWeight: '800', color: COLORS.ink, textAlign: 'center' },
  footnote: {
    textAlign: 'center', fontSize: 11, fontWeight: '600',
    color: COLORS.inkMuted, marginTop: 14,
  },
});
