import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { COLORS } from '../../lib/theme';
import { DROPS, type Drop } from '../../lib/drops';
import { getVerifiedLocation, haversineDistanceMeters } from '../../lib/location';

type Ranked = { drop: Drop; distanceM: number };

function formatDistance(meters: number): string {
  if (meters < 1000) return meters + ' m';
  const km = meters / 1000;
  return (km < 10 ? km.toFixed(1) : Math.round(km).toString()) + ' km';
}

export default function HomeScreen() {
  const router = useRouter();
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(true);
  const [denied, setDenied] = useState(false);
  const [inRangeCount, setInRangeCount] = useState(0);
  const [featured, setFeatured] = useState<Ranked | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const fix = await getVerifiedLocation();
      if (cancelled) return;

      if (!fix) {
        setDenied(true);
        setLocating(false);
        return;
      }

      setAccuracy(fix.accuracy ?? null);

      const ranked: Ranked[] = DROPS.filter((d) => !d.bypassRadius)
        .map((drop) => ({
          drop,
          distanceM: Math.round(
            haversineDistanceMeters(fix.latitude, fix.longitude, drop.latitude, drop.longitude)
          ),
        }))
        .sort((a, b) => a.distanceM - b.distanceM);

      const physicallyInRange = ranked.filter((r) => r.distanceM <= r.drop.radiusMeters).length;
      const alwaysOpen = DROPS.filter((d) => d.bypassRadius).length;

      setInRangeCount(physicallyInRange + alwaysOpen);
      setFeatured(ranked[0] ?? null);

      // Purely cosmetic - the place name is never sent anywhere, and
      // verification still runs on raw coordinates server-side.
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: fix.latitude,
          longitude: fix.longitude,
        });
        if (cancelled) return;
        const p = places && places[0];
        if (p) {
          const label = [p.city || p.subregion || p.district, p.region || p.country]
            .filter(Boolean)
            .join(', ');
          if (label) setPlaceName(label);
        }
      } catch (err) {
        console.log('[home] reverse geocode unavailable', err);
      }

      setLocating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/home-splash.png')}
        style={styles.bottomSplash}
        resizeMode="cover"
        pointerEvents="none"
      />
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {locating ? 'locating...' : inRangeCount + ' in range'}
              </Text>
            </View>
          </View>
          <Image
            source={require('../../assets/home-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

      <View style={styles.locationCard}>
        <Text style={styles.locationLabel}>you are</Text>
        <Text style={styles.locationName}>
          {denied
            ? 'location off'
            : placeName
            ? placeName.toLowerCase()
            : locating
            ? '...'
            : 'somewhere'}
        </Text>
        <Text style={styles.locationMeta}>
          {denied
            ? 'enable location to find drops near you'
            : accuracy !== null
            ? 'accurate to ' + Math.round(accuracy) + ' m'
            : 'getting a fix'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.action, { backgroundColor: COLORS.mint }]}
          onPress={() => router.push('/drops')}
        >
          <Text style={styles.actionText}>find drops</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: COLORS.lilac }]}
          onPress={() => router.push('/collection')}
        >
          <Text style={styles.actionText}>collection</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: COLORS.bubblegum }]}
          onPress={() => router.push('/mint/demo-anywhere')}
        >
          <Text style={styles.actionText}>try demo</Text>
        </Pressable>
      </View>

      {featured && (
        <>
          <Text style={styles.sectionLabel}>closest to you</Text>
          <Pressable
            style={styles.featured}
            onPress={() => router.push('/mint/' + featured.drop.id)}
          >
            <View style={styles.featuredTop}>
              <Text style={styles.featuredTitle}>{featured.drop.name}</Text>
              <View
                style={[
                  styles.featuredChip,
                  {
                    backgroundColor:
                      featured.distanceM <= featured.drop.radiusMeters
                        ? COLORS.mint
                        : COLORS.chrome,
                  },
                ]}
              >
                <Text style={styles.featuredChipText}>
                  {featured.distanceM <= featured.drop.radiusMeters
                    ? 'in range'
                    : formatDistance(featured.distanceM)}
                </Text>
              </View>
            </View>
            <Text style={styles.featuredMeta}>
              {featured.drop.location +
                '  ' +
                featured.drop.editionsLeft +
                '/' +
                featured.drop.editionsTotal +
                ' left'}
            </Text>
            <Text style={styles.featuredBody} numberOfLines={2}>
              {featured.drop.description}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={styles.footnote}>scarcity through presence, not price</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bottomSplash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: 340,
  },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingTop: 96,
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  logoImage: {
    width: 220,
    height: 147,
  },
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

  locationCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.tile,
    borderRadius: 20,
    padding: 20,
  },
  locationLabel: { fontSize: 12, fontWeight: '700', color: COLORS.mint, letterSpacing: 1 },
  locationName: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  locationMeta: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 6 },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  action: { flex: 1, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  actionText: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.ink,
    letterSpacing: 0.3,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkMuted,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 10,
  },
  featured: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredTitle: { fontSize: 23, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  featuredChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  featuredChipText: { fontSize: 14, fontWeight: '900', color: COLORS.ink, letterSpacing: 0.2 },
  featuredMeta: { fontSize: 14, fontWeight: '700', color: COLORS.inkMuted, marginTop: 4 },
  featuredBody: { fontSize: 15, fontWeight: '600', color: COLORS.ink, marginTop: 8, lineHeight: 21 },

  footnote: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.inkMuted,
    marginTop: 28,
  },
});