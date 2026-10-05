import { View, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * A small lightning-bolt glyph built from two offset, rotated bars - the
 * same "flat diagonal shape" language as CornerAccents - rather than the
 * system lightning emoji, which renders in full colour on Android no
 * matter what text colour is set.
 */
export default function BoltIcon({ size = 18, color = '#FFFFFF' }: Props) {
  const barWidth = size * 0.34;
  const barHeight = size * 0.72;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: barHeight,
            backgroundColor: color,
            top: 0,
            left: size * 0.34,
            borderRadius: barWidth * 0.25,
            transform: [{ rotate: '18deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: barHeight,
            backgroundColor: color,
            bottom: 0,
            left: size * 0.16,
            borderRadius: barWidth * 0.25,
            transform: [{ rotate: '18deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute' },
});
