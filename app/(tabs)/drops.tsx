import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../lib/theme';
import { DROPS, type Drop } from '../../lib/drops';
import { getVerifiedLocation, haversineDistanceMeters } from '../../lib/location';
import CornerAccents from '../../components/CornerAccents';

const TILE_ACCENTS = [COLORS.bubblegum, COLORS.lilac, COLORS.yellow, COLORS.mint];

type NearbyDrop = Drop & {
  distanceM: number | null;
  accent: string;
};

function formatDistance(drop: NearbyDrop): string {
  if (drop.bypassRadius) return 'anywhere';
  if (drop.distanceM === null) return '--';
  if (drop.distanceM < 1000) return drop.distanceM + ' m';
  const km = drop.distanceM / 1000;
  return (km < 10 ? km.toFixed(1) : Math.round(km).toString()) + ' km';
}

function isInRange(drop: NearbyDrop): boolean {
  if (drop.bypassRadius) return true;
  if (drop.distanceM === null) return false;
  return drop.distanceM <= drop.radiusMeters;
}

export default function Discover() {
  const router = useRouter();
  const [nearby, setNearby] = useState<NearbyDrop[]>(
    DROPS.map((drop, i) => ({ ...drop, distanceM: null, accent: TILE_ACCENTS[i % TILE_ACCENTS.length] }))
  );
  const [located, setLocated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const fix = await getVerifiedLocation();
      if (cancelled) return;

      const withDistance: NearbyDrop[] = DROPS.map((drop, i) => {
        const distanceM =
          fix && !drop.bypassRadius
            ? Math.round(
                haversineDistanceMeters(fix.latitude, fix.longitude, drop.latitude, drop.longitude)
              )
            : null;
        return { ...drop, distanceM, accent: TILE_ACCENTS[i % TILE_ACCENTS.length] };
      }).sort((a, b) => {
        if (a.bypassRadius && !b.bypassRadius) return -1;
        if (b.bypassRadius && !a.bypassRadius) return 1;
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
      setLocated(Boolean(fix));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const inRangeCount = nearby.filter(isInRange).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CornerAccents corner="top-right" size="sm" style={styles.headerAccent} />
        <Text style={styles.logo}>H3RE</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {located ? inRangeCount + ' in range' : 'locating...'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>nearby drops</Text>

      <FlatList
        data={nearby}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push('/mint/' + item.id)}>
            <View style={[styles.accentStrip, { backgroundColor: item.accent }]} />
            {/* 4:3 so the artwork shows in full - these are maps, and a
                crop loses the title card and the captions. */}
            <View style={[styles.imageWrap, { backgroundColor: item.accent }]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <Text style={styles.placeholder}>H3RE</Text>
              )}
            </View>

            <View style={styles.info}>
              <View style={styles.infoTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: isInRange(item) ? COLORS.mint : COLORS.surface },
                  ]}
                >
                  <Text style={styles.pillText}>
                    {isInRange(item) ? 'in range' : formatDistance(item)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.bypassRadius
                  ? item.location
                  : item.location + '  ' + item.editionsLeft + '/' + item.editionsTotal + ' left'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAccent: { top: 60, right: 16 },
  logo: { fontSize: 30, fontWeight: '900', fontStyle: 'italic', color: COLORS.ink, letterSpacing: -1 },
  statusPill: {
    backgroundColor: COLORS.mint,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },

  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accentStrip: { height: 5, width: '100%' },
  imageWrap: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 26, fontWeight: '900', fontStyle: 'italic', color: COLORS.ink },

  info: { paddingHorizontal: 14, paddingVertical: 12 },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontSize: 19, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  pill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: 0.2,
  },
  meta: { fontSize: 12, fontWeight: '600', color: COLORS.inkMuted, marginTop: 4 },
});
