import { View, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  color?: string;
};

/**
 * A small wireframe "y2k" globe - outer ring, one vertical meridian ellipse,
 * one horizontal equator line. Built from plain Views (no svg dependency)
 * so it stays a flat, reliably-black icon rather than a colour emoji.
 */
export default function GlobeIcon({ size = 18, color = '#FFFFFF' }: Props) {
  const border = Math.max(1.4, size * 0.09);
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, borderWidth: border, borderColor: color },
        ]}
      />
      <View
        style={[
          styles.meridian,
          {
            width: size * 0.46,
            height: size,
            borderRadius: size / 2,
            borderWidth: border,
            borderColor: color,
            left: (size - size * 0.46) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.equator,
          { width: size, height: border, backgroundColor: color, top: (size - border) / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  meridian: { position: 'absolute' },
  equator: { position: 'absolute' },
});
