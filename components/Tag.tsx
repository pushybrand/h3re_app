import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../lib/theme';

type Props = { icon: string; label: string; filled?: boolean };

/**
 * Small icon + label pill, used for the drop attribute row
 * ("demo", "anywhere", "location-locked", ...).
 */
export default function Tag({ icon, label, filled }: Props) {
  return (
    <View style={[styles.tag, filled ? styles.tagFilled : styles.tagOutline]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, filled && styles.labelFilled]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagFilled: { backgroundColor: COLORS.black },
  tagOutline: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  icon: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.ink },
  labelFilled: { color: COLORS.mint },
});
