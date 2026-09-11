import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from './_layout';
import { DROPS, type Drop } from '../lib/drops';
import { getVerifiedLocation, haversineDistanceMeters } from '../lib/location';

const ACCENTS = [COLORS.bubblegum, COLORS.mint, COLORS.yellow];

type NearbyDrop = Drop & {
  distanceM: number | null;
  accent: string;
};

export default function Discover() {
  const router = useRouter();
  const [nearby, setNearby] = useState<NearbyDrop[]>(
    DROPS.map((drop, i) => ({ ...drop, distanceM: null, accent: ACCENTS[i % ACCENTS.length] }))
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const fix = await getVerifiedLocation();
      if (cancelled) return;

      const withDistance: NearbyDrop[] = DROPS.map((drop, i) => {
        const distanceM = fix
          ? Math.round(
              haversineDistanceMeters(fix.latitude, fix.longitude, drop.latitude, drop.longitude)
            )
          : null;
        return { ...drop, distanceM, accent: ACCENTS[i % ACCENTS.length] };
      }).sort((a, b) => {
        if (a.distanceM === null && b.distanceM === null) return 0;
        if (a.distanceM === null) return 1;
        if (b.distanceM === null) return -1;
        return a.distanceM - b.distanceM;
      });

      console.log('[discover] user location', fix);
      console.log(
        '[discover] drops by distance',
        withDistance.map((d) => ({ id: d.id, distanceM: d.distanceM }))
      );
      setNearby(withDistance);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>H3RE</Text>
        <View style={styles.locationPill}>
          <Text style={styles.locationText}>Shibuya, Tokyo</Text>
        </View>
      </View>

      <FlatList
        data={nearby}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/mint/${item.id}`)}
          >
            <View style={[styles.distanceTag, { borderColor: item.accent }]}>
              <Text style={[styles.distanceText, { color: item.accent }]}>
                {item.distanceM === null ? '— m' : `${item.distanceM} m`}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.editionsLeft}/{item.editionsTotal} left</Text>
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
