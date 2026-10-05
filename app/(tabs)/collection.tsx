import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Image,
} from 'react-native';
import { COLORS } from '../../lib/theme';
import { connectWallet } from '../../lib/wallet';

const API_BASE = 'https://h3re-api.vercel.app';
const ACCENTS = [COLORS.bubblegum, COLORS.lilac, COLORS.yellow, COLORS.mint];

type CollectionItem = {
  dropId: string;
  name: string;
  imageUrl?: string;
  assetAddress: string;
  signature: string;
  mintedAt: number;
  explorerUrl: string;
};

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return address.slice(0, 4) + '...' + address.slice(-4);
}

function formatDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function Collection() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async (address: string) => {
    setFailure(null);
    try {
      const res = await fetch(API_BASE + '/api/collection?wallet=' + address);
      if (!res.ok) throw new Error('lookup failed (' + res.status + ')');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      console.error('[collection] load failed', err);
      setFailure(err?.message ?? 'could not load collection');
    }
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const pubkey = await connectWallet();
      if (!pubkey) {
        setFailure('wallet not connected');
        return;
      }
      const address = pubkey.toBase58();
      setWallet(address);
      await load(address);
    } finally {
      setLoading(false);
    }
  }, [load]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      await load(wallet);
    } finally {
      setLoading(false);
    }
  }, [wallet, load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>collection</Text>
        {wallet && (
          <View style={styles.walletPill}>
            <Text style={styles.walletText}>{shortAddress(wallet)}</Text>
          </View>
        )}
      </View>

      {!wallet ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>nothing here yet</Text>
          <Text style={styles.emptyBody}>
            connect your wallet to see the badges you have picked up
          </Text>
          <Pressable style={styles.connectButton} onPress={connect} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text style={styles.connectText}>connect wallet</Text>
            )}
          </Pressable>
          {failure && <Text style={styles.failure}>{failure}</Text>}
        </View>
      ) : items.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>no badges yet</Text>
          <Text style={styles.emptyBody}>go and stand somewhere. minted badges show up here.</Text>
          {failure && <Text style={styles.failure}>{failure}</Text>}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.assetAddress}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          renderItem={({ item, index }) => (
            <Pressable style={styles.card} onPress={() => Linking.openURL(item.explorerUrl)}>
              {/* Square centre crop - the pin and radius rings sit dead
                  centre in the artwork, so this lands on them. */}
              <View style={[styles.thumb, { backgroundColor: ACCENTS[index % ACCENTS.length] }]}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.thumbText}>H3RE</Text>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{formatDate(item.mintedAt)}</Text>
                <Text style={styles.cardAddress}>{shortAddress(item.assetAddress)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: COLORS.ink, letterSpacing: -1 },
  walletPill: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletText: { fontSize: 11, fontWeight: '700', color: COLORS.inkMuted },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.4 },
  emptyBody: { fontSize: 14, color: COLORS.inkMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  connectButton: {
    marginTop: 24,
    backgroundColor: COLORS.mint,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  connectText: { fontSize: 14, fontWeight: '800', color: COLORS.ink },
  failure: { marginTop: 16, fontSize: 12, color: COLORS.bubblegum, fontWeight: '700' },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  thumb: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  thumbText: { fontSize: 15, fontWeight: '900', fontStyle: 'italic', color: COLORS.ink },
  cardBody: { flex: 1, padding: 14, justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: COLORS.ink, letterSpacing: -0.3 },
  cardMeta: { fontSize: 12, fontWeight: '600', color: COLORS.inkMuted, marginTop: 3 },
  cardAddress: { fontSize: 11, fontWeight: '600', color: COLORS.inkMuted, marginTop: 6 },
});