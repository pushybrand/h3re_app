import { View, StyleSheet, ViewStyle } from 'react-native';
import { ACCENT_STRIPE } from '../lib/theme';

/**
 * The little pink/black/lime diagonal tick-marks used in corners of cards
 * and headers - the H3RE "stamp" motif. Purely decorative.
 */
type Props = {
  corner?: 'top-left' | 'top-right';
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

export default function CornerAccents({ corner = 'top-right', size = 'md', style }: Props) {
  const isRight = corner === 'top-right';
  const barHeight = size === 'sm' ? 14 : 20;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, isRight ? { right: 0, flexDirection: 'row-reverse' } : { left: 0 }, style]}
    >
      {ACCENT_STRIPE.map((color, i) => (
        <View key={color + i} style={[styles.bar, { backgroundColor: color, height: barHeight }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, flexDirection: 'row', gap: 5 },
  bar: {
    width: 5,
    borderRadius: 3,
    transform: [{ rotate: '25deg' }],
  },
});
