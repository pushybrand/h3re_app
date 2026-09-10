import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from './_layout';

// Stubbed — replace with a real fetch to your drops API once it exists.
const NEARBY_DROPS = [
  { id: 'neon-alley', name: 'neon alley', distanceM: 120, left: '8/50 left', accent: COLORS.bubblegum },
  { id: 'skyline-moment', name: 'skyline moment', distanceM: 320, left: '3/25 left', accent: COLORS.mint },
  { id: 'ramen-spot', name: 'ramen spot', distanceM: 480, left: '12/100 left', accent: COLORS.yellow },
];

export default function Discover() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>H3RE</Text>
        <View style={styles.locationPill}>
          <Text style={styles.locationText}>Shibuya, Tokyo</Text>
        </View>
      </View>

      <FlatList
        data={NEARBY_DROPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/mint/${item.id}`)}
          >
            <View style={[styles.distanceTag, { borderColor: item.accent }]}>
              <Text style={[styles.distanceText, { color: item.accent }]}>{item.distanceM} m</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.left}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 60, paddingHorizontal: 14, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: { fontSize: 22, fontWeight: '800', fontStyle: 'italic', color: COLORS.white },
  locationPill: {
    backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  locationText: { fontSize: 11, color: COLORS.white },
  card: {
    backgroundColor: COLORS.card, borderRadius: 10, padding: 12, position: 'relative',
  },
  distanceTag: {
    position: 'absolute', top: 10, right: 10, borderWidth: 0.5, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  distanceText: { fontSize: 10, fontFamily: 'monospace' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  cardSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
