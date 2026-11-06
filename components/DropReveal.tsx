import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Image,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../lib/theme';
import { explorerAddressUrl } from '../lib/network';

/**
 * The "drop moment": a collectible unboxing that plays when a badge is claimed.
 *
 * sealed   - the mint request is in flight. The sealed card pulses, so the
 *            on-chain wait reads as build-up rather than loading.
 * ready    - the mint has confirmed. Only now can the collector open it, so
 *            we never reveal a badge that didn't actually land.
 * opening  - tap: shake, crack, flash, splash burst, flip.
 * revealed - the badge art, its edition number, share.
 * failed   - the mint didn't land. Says so plainly and lets them retry.
 *
 * Built on the core Animated API only - no Lottie, no reanimated, nothing
 * that needs a new native module.
 */

export type RevealStatus = 'sealed' | 'ready' | 'failed';

type Props = {
  visible: boolean;
  status: RevealStatus;
  dropName: string;
  locationLabel: string;
  badgeUrl?: string;
  edition?: number | null;
  editionsTotal?: number | null;
  assetAddress?: string;
  failTitle?: string;
  failMessage?: string;
  onClose: () => void;
};

type Phase = 'sealed' | 'ready' | 'opening' | 'revealed' | 'failed';

const CARD_W = 250;
const CARD_H = 330;

const PARTICLE_COLORS = [
  COLORS.bubblegum,
  COLORS.mint,
  COLORS.yellow,
  COLORS.lilac,
  COLORS.chrome,
  COLORS.bubblegumDeep,
];
const PARTICLE_COUNT = 20;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 2 ? 0.13 : -0.09);
  const dist = 150 + (i % 4) * 40;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist,
    size: 8 + (i % 3) * 6,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    round: i % 3 !== 0,
    spin: ((i * 37) % 90) + 'deg',
  };
});
const RAY_COUNT = 10;

type Buzz = 'light' | 'medium' | 'heavy' | 'success' | 'error';

function buzz(kind: Buzz) {
  try {
    const run =
      kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'error'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        : Haptics.impactAsync(
            kind === 'light'
              ? Haptics.ImpactFeedbackStyle.Light
              : kind === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Heavy
          );
    run.catch(() => {});
  } catch {}
}

export default function DropReveal({
  visible,
  status,
  dropName,
  locationLabel,
  badgeUrl,
  edition,
  editionsTotal,
  assetAddress,
  failTitle,
  failMessage,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>('sealed');
  const [showBack, setShowBack] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Fresh start every time the overlay opens.
  useEffect(() => {
    if (!visible) {
      clearTimers();
      return;
    }
    setPhase('sealed');
    setShowBack(false);
    setImageFailed(false);
    [enter, pulse, wiggle, shake, flash, burst, content, spin].forEach((v) => v.setValue(0));
    flip.setValue(1);
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
    buzz('light');
    // Warm the badge art while the mint confirms, so the flip shows it instantly.
    if (badgeUrl) Image.prefetch(badgeUrl).catch(() => {});
    return clearTimers;
  }, [visible]);

  // Follow the mint result coming in from the parent screen.
  useEffect(() => {
    if (!visible) return;
    if (status === 'ready' && phase === 'sealed') {
      setPhase('ready');
      buzz('medium');
    } else if (status === 'failed' && (phase === 'sealed' || phase === 'ready')) {
      setPhase('failed');
      buzz('error');
      Animated.sequence(
        [1, -1, 0.6, -0.6, 0].map((v) =>
          Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })
        )
      ).start();
    }
  }, [status, visible, phase]);

  // Breathing glow while sealed; quicker pulse plus a nudge once it's ready.
  useEffect(() => {
    if (!visible || (phase !== 'sealed' && phase !== 'ready')) return;
    const half = phase === 'ready' ? 520 : 820;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();

    let nudge: Animated.CompositeAnimation | null = null;
    if (phase === 'ready') {
      nudge = Animated.loop(
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 110, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0.6, duration: 90, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 80, useNativeDriver: true }),
        ])
      );
      nudge.start();
    }

    return () => {
      breathe.stop();
      nudge?.stop();
    };
  }, [phase, visible]);

  // Slow-turning rays behind the revealed badge.
  useEffect(() => {
    if (phase !== 'revealed') return;
    spin.setValue(0);
    const turn = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    turn.start();
    return () => turn.stop();
  }, [phase]);

  const open = () => {
    if (phase !== 'ready') return;
    setPhase('opening');
    wiggle.setValue(0);
    pulse.setValue(0);

    buzz('light');
    later(() => buzz('medium'), 300);

    // A shake that builds, like something trying to get out.
    const steps = [1, -1, 1.4, -1.4, 1.9, -1.9, 2.4, -2.4, 0];
    Animated.sequence(
      steps.map((v, i) =>
        Animated.timing(shake, { toValue: v, duration: 55 + i * 6, useNativeDriver: true })
      )
    ).start(() => {
      buzz('heavy');
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(flash, {
            toValue: 0,
            duration: 480,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(burst, {
          toValue: 1,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(flip, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      // Card is edge-on now - swap the face and spring it back round.
      later(() => {
        setShowBack(true);
        setPhase('revealed');
        buzz('success');
        Animated.spring(flip, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
        Animated.timing(content, {
          toValue: 1,
          duration: 420,
          delay: 220,
          useNativeDriver: true,
        }).start();
      }, 160);
    });
  };

  const share = async () => {
    const editionText = edition ? ' #' + edition : '';
    const link = assetAddress ? '\n' + explorerAddressUrl(assetAddress) : '';
    try {
      await Share.share({
        message:
          'i was h3re. just collected ' +
          dropName +
          editionText +
          ' on @h3re_app, minted on the spot at ' +
          locationLabel +
          '.' +
          link,
      });
    } catch {}
  };

  const canClose = phase === 'revealed' || phase === 'failed';
  const editionLabel = edition
    ? editionsTotal
      ? '#' + edition + ' of ' + editionsTotal
      : '#' + edition
    : null;

  const cardScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] })
  );
  const cardRotate = Animated.add(shake, wiggle).interpolate({
    inputRange: [-4, 4],
    outputRange: ['-8deg', '8deg'],
  });
  const cardShiftX = shake.interpolate({ inputRange: [-3, 3], outputRange: [-14, 14] });

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] });
  const raysRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const contentShift = content.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (canClose) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Text style={styles.kicker}>H3RE  //  DROP MOMENT</Text>

        <View style={styles.stage}>
          {/* rays - only once revealed */}
          <Animated.View
            pointerEvents="none"
            style={[styles.raysAnchor, { opacity: content, transform: [{ rotate: raysRotate }] }]}
          >
            {Array.from({ length: RAY_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.ray,
                  {
                    backgroundColor: i % 2 ? COLORS.mint : COLORS.bubblegum,
                    transform: [{ rotate: (i * 180) / RAY_COUNT + 'deg' }],
                  },
                ]}
              />
            ))}
          </Animated.View>

          {/* glow */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                backgroundColor:
                  phase === 'failed'
                    ? 'rgba(255,231,74,0.25)'
                    : showBack
                    ? COLORS.glowMint
                    : COLORS.glowPink,
                opacity: showBack ? content : glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />

          {/* splash burst */}
          <View pointerEvents="none" style={styles.particleAnchor}>
            {PARTICLES.map((p, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: -p.size / 2,
                  top: -p.size / 2,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.round ? p.size / 2 : 2,
                  backgroundColor: p.color,
                  opacity: burst.interpolate({
                    inputRange: [0, 0.05, 0.75, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                    {
                      scale: burst.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0.2, 1.3, 0.6],
                      }),
                    },
                    { rotate: p.spin },
                  ],
                }}
              />
            ))}
          </View>

          {/* the card */}
          <Pressable onPress={open} disabled={phase !== 'ready'}>
            <Animated.View
              style={{
                opacity: phase === 'failed' ? 0.55 : 1,
                transform: [
                  { translateX: cardShiftX },
                  { rotate: cardRotate },
                  { scale: cardScale },
                  { scaleX: flip },
                ],
              }}
            >
              {showBack ? (
                <View style={[styles.card, styles.cardBack]}>
                  <View style={styles.badgeBox}>
                    {badgeUrl && !imageFailed ? (
                      <Image
                        source={{ uri: badgeUrl }}
                        style={styles.badgeImage}
                        resizeMode="cover"
                        onError={() => setImageFailed(true)}
                      />
                    ) : (
                      <View style={styles.badgeFallback}>
                        <Text style={styles.badgeFallbackText}>H3RE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.backName} numberOfLines={1}>
                    {dropName}
                  </Text>
                  <Text style={styles.backLocation} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                  {editionLabel ? (
                    <View style={styles.editionStamp}>
                      <Text style={styles.editionText}>{editionLabel}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={[styles.card, styles.cardFront]}>
                  <View style={styles.frontStripes}>
                    <View style={[styles.stripe, { backgroundColor: COLORS.bubblegum }]} />
                    <View style={[styles.stripe, { backgroundColor: COLORS.white }]} />
                    <View style={[styles.stripe, { backgroundColor: COLORS.mint }]} />
                  </View>
                  <Text style={styles.frontKicker}>SEALED DROP</Text>
                  <View style={styles.frontRingWrap}>
                    <View style={styles.frontRingGlow} />
                    <View style={styles.frontRing} />
                    <Text style={styles.frontMark}>H3RE</Text>
                  </View>
                  <Text style={styles.frontName} numberOfLines={2}>
                    {dropName}
                  </Text>
                  <Text style={styles.frontLocation} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                  <View style={[styles.frontSeal, phase === 'failed' && styles.frontSealFailed]}>
                    <Text style={styles.frontSealText}>
                      {phase === 'failed' ? 'NOT MINTED' : '✦ SEALED ✦'}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* what's under the card - fixed height so nothing jumps between phases */}
        <View style={styles.below}>
          {phase === 'sealed' && (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={COLORS.mint} />
              <Text style={styles.status}>sealing it on-chain...</Text>
            </View>
          )}

          {phase === 'ready' && (
            <Animated.Text
              style={[
                styles.tapHint,
                { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              ]}
            >
              TAP TO OPEN
            </Animated.Text>
          )}

          {phase === 'revealed' && (
            <Animated.View
              style={{
                alignItems: 'center',
                opacity: content,
                transform: [{ translateY: contentShift }],
              }}
            >
              <Text style={styles.youWere}>you were h3re.</Text>
              <Text style={styles.youWereSub}>location-locked  ·  minted on solana</Text>
              <View style={styles.buttonRow}>
                <Pressable style={[styles.btn, styles.btnShare]} onPress={share}>
                  <Text style={styles.btnShareText}>SHARE</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnDone]} onPress={onClose}>
                  <Text style={styles.btnDoneText}>DONE</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {phase === 'failed' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.failTitle}>{failTitle ?? "mint didn't land"}</Text>
              <Text style={styles.failMessage}>
                {failMessage ??
                  'your bond was already refunded at check-in, so you have lost nothing. try again.'}
              </Text>
              <Pressable style={[styles.btn, styles.btnDone, { marginTop: 16 }]} onPress={onClose}>
                <Text style={styles.btnDoneText}>CLOSE</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* white flash on the crack */}
        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,14,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  kicker: {
    position: 'absolute',
    top: 64,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    color: COLORS.chromeShadow,
  },

  stage: {
    width: CARD_W,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
  },

  raysAnchor: {
    position: 'absolute',
    left: CARD_W / 2,
    top: CARD_H / 2,
    width: 0,
    height: 0,
  },
  ray: {
    position: 'absolute',
    width: 28,
    height: 680,
    left: -14,
    top: -340,
    opacity: 0.13,
  },

  glow: {
    position: 'absolute',
    left: -36,
    top: -36,
    width: CARD_W + 72,
    height: CARD_H + 72,
    borderRadius: 52,
  },

  particleAnchor: {
    position: 'absolute',
    left: CARD_W / 2,
    top: CARD_H / 2,
    width: 0,
    height: 0,
  },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 26,
    overflow: 'hidden',
  },
  cardFront: {
    backgroundColor: COLORS.black,
    borderWidth: 3,
    borderColor: COLORS.chrome,
    alignItems: 'center',
    paddingTop: 26,
    paddingHorizontal: 18,
  },
  frontStripes: {
    position: 'absolute',
    top: 12,
    left: 10,
    transform: [{ rotate: '-45deg' }],
    gap: 3,
  },
  stripe: { width: 34, height: 5, borderRadius: 1 },
  frontKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.6,
    color: COLORS.chromeShadow,
  },
  frontRingWrap: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  frontRingGlow: {
    position: 'absolute',
    width: 200,
    height: 74,
    borderRadius: 999,
    borderWidth: 10,
    borderColor: COLORS.glowPink,
    transform: [{ rotate: '-8deg' }],
  },
  frontRing: {
    position: 'absolute',
    width: 184,
    height: 62,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.bubblegum,
    transform: [{ rotate: '-8deg' }],
  },
  frontMark: {
    fontSize: 54,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
    letterSpacing: -1,
  },
  frontName: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.mint,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 12,
  },
  frontLocation: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.chrome,
    marginTop: 6,
    letterSpacing: 0.6,
  },
  frontSeal: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: COLORS.bubblegum,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  frontSealFailed: { backgroundColor: COLORS.yellow },
  frontSealText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: COLORS.black,
  },

  cardBack: {
    backgroundColor: COLORS.white,
    padding: 12,
    alignItems: 'center',
  },
  badgeBox: {
    width: CARD_W - 24,
    height: CARD_W - 24,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  badgeImage: { width: '100%', height: '100%' },
  badgeFallback: {
    flex: 1,
    backgroundColor: COLORS.bubblegum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFallbackText: {
    fontSize: 48,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.black,
  },
  backName: {
    fontSize: 19,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.ink,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  backLocation: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkMuted,
    marginTop: 3,
  },
  editionStamp: {
    position: 'absolute',
    top: 22,
    right: 18,
    backgroundColor: COLORS.yellow,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '8deg' }],
  },
  editionText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.black,
  },

  below: {
    height: 190,
    marginTop: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: {
    fontSize: 15,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  tapHint: {
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2.4,
    color: COLORS.mint,
  },
  youWere: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  youWereSub: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.chrome,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  btn: {
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  btnShare: { backgroundColor: COLORS.mint },
  btnShareText: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    color: COLORS.black,
  },
  btnDone: { borderWidth: 2, borderColor: COLORS.white },
  btnDoneText: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    color: COLORS.white,
  },
  failTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.yellow,
  },
  failMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.chrome,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 300,
  },

  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
  },
});
