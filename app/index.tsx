import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../lib/theme';

/**
 * Entry screen. The artwork is bundled rather than fetched so the first
 * thing anyone sees does not depend on the network.
 */
export default function Intro() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });

  return (
    <ImageBackground
      source={require('../assets/intro.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.panel}>
        <Text style={styles.tagline}>go there.{'\n'}mint h3re.</Text>
        <Text style={styles.sub}>scarcity through presence, not price</Text>

        <View style={styles.buttonWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />
          <Pressable style={styles.button} onPress={() => router.replace('/home')}>
            <Text style={styles.buttonText}>LET'S GO!</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.tile },
  panel: {
    backgroundColor: 'rgba(15,15,18,0.72)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 30,
    paddingBottom: 46,
  },
  tagline: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
    letterSpacing: -1.2,
  },
  sub: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mint,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  buttonWrap: { marginTop: 28, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -6,
    bottom: -6,
    borderRadius: 40,
    backgroundColor: COLORS.bubblegum,
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.mint,
    borderRadius: 34,
    paddingVertical: 19,
    alignItems: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: 0.6 },
});