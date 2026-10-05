import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../lib/theme';

type Props = {
  label: string;
  icon?: string;
  /** What shows in the round badge on the right, in place of the default arrow. */
  endIcon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** primary = filled pink gradient pill. secondary = white/chrome outline pill. */
  variant?: 'primary' | 'secondary';
};

/**
 * The glossy pill button from the badge mockup: icon + label on the left,
 * a dark circular badge (arrow by default, or a custom endIcon) on the right.
 */
export default function GradientButton({
  label,
  icon,
  endIcon,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: Props) {
  const isDisabled = disabled || loading;

  const content = (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={[styles.arrowBadge, isDisabled && styles.arrowBadgeDisabled]}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : endIcon ? (
          endIcon
        ) : (
          <Text style={styles.arrow}>{'→'}</Text>
        )}
      </View>
    </View>
  );

  if (variant === 'secondary') {
    return (
      <Pressable
        style={[styles.pill, styles.pillSecondary, isDisabled && styles.pillSecondaryDisabled]}
        onPress={onPress}
        disabled={isDisabled}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={isDisabled ? styles.dimmed : undefined}>
      <LinearGradient
        colors={isDisabled ? [COLORS.surface, COLORS.surface] : [COLORS.bubblegum, COLORS.bubblegumDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        {content}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 34,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  pillSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.ink,
  },
  pillSecondaryDisabled: { borderColor: COLORS.border },
  dimmed: { opacity: 0.55 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 18 },
  label: {
    fontSize: 19,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.ink,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  arrowBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBadgeDisabled: { backgroundColor: COLORS.chrome },
  arrow: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
});
