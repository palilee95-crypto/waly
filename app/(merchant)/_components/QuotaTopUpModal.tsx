import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

type QuotaPackage = {
  id: string;
  quantity: number;
  price: number;
  label: string;
};

type QuotaState = {
  plan?: string;
  used?: number;
  base_limit?: number | null;
  addon_quota?: number;
  limit?: number | null;
  remaining?: number | null;
  unlimited?: boolean;
  deletions_allowed?: number | null;
};

// Only used when the packages route cannot be reached; the server stays authoritative.
const FALLBACK_PACKAGES: QuotaPackage[] = [
  { id: 'quota50', quantity: 50, price: 19, label: '+50 members' },
  { id: 'quota100', quantity: 100, price: 29, label: '+100 members' },
  { id: 'quota500', quantity: 500, price: 99, label: '+500 members' },
  { id: 'quota1000', quantity: 1000, price: 179, label: '+1,000 members' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onPurchased?: () => void;
  used?: number;
  limit?: number | null;
};

export default function QuotaTopUpModal({ visible, onClose, onPurchased, used, limit }: Props) {
  const { locale } = useLanguage();
  const [packages, setPackages] = useState<QuotaPackage[]>(FALLBACK_PACKAGES);
  const [current, setCurrent] = useState<QuotaState | null>(null);
  const [selectedId, setSelectedId] = useState('quota500');
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    pb.send('/api/risev/merchant/quota/packages', { method: 'GET' })
      .then((res: any) => {
        if (cancelled) return;
        if (Array.isArray(res?.packages) && res.packages.length > 0) {
          setPackages(res.packages);
          if (!res.packages.some((p: QuotaPackage) => p.id === selectedId)) {
            setSelectedId(res.packages[Math.min(2, res.packages.length - 1)].id);
          }
        }
        if (res?.current) setCurrent(res.current);
      })
      .catch(() => {
        if (!cancelled) setPackages(FALLBACK_PACKAGES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const selected = packages.find((p) => p.id === selectedId) || packages[0];
  const usedCount = typeof current?.used === 'number' ? current.used : used;
  const effectiveLimit = typeof current?.limit === 'number' ? current.limit : limit;

  const handleBuy = async () => {
    if (!selected || buying) return;
    setBuying(true);
    setError('');
    try {
      const res = await pb.send<{
        success: boolean;
        order_id: string;
        payment_url?: string;
        amount: number;
        quantity: number;
      }>('/api/risev/merchant/quota/checkout', {
        method: 'POST',
        body: { package_id: selected.id },
      });

      setBuying(false);

      if (res.payment_url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = res.payment_url;
        } else {
          Linking.openURL(res.payment_url);
        }
        return;
      }

      if (onPurchased) onPurchased();
      Alert.alert(
        locale === 'en' ? 'Order Created' : 'Pesanan Dicipta',
        locale === 'en'
          ? `Order #${res.order_id} for ${res.quantity.toLocaleString()} extra members (RM ${res.amount}) has been prepared.`
          : `Pesanan #${res.order_id} untuk ${res.quantity.toLocaleString()} ahli tambahan (RM ${res.amount}) telah disediakan.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (err: any) {
      setBuying(false);
      setError(err?.message || (locale === 'en' ? 'Failed to start the purchase.' : 'Gagal memulakan pembelian.'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {locale === 'en' ? 'Add Customer Slots' : 'Tambah Slot Pelanggan'}
              </Text>
              <Text style={styles.subtitle}>
                {locale === 'en'
                  ? 'One-time purchase · never expires'
                  : 'Pembelian sekali · tidak luput'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            <View style={styles.usageCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.usageLabel}>
                  {locale === 'en' ? 'Current customers' : 'Pelanggan semasa'}
                </Text>
                <Text style={styles.usageValue}>
                  {(usedCount ?? 0).toLocaleString()}
                  {typeof effectiveLimit === 'number' ? ` / ${effectiveLimit.toLocaleString()}` : ''}
                </Text>
              </View>
              {typeof effectiveLimit === 'number' && effectiveLimit > 0 ? (
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, Math.round(((usedCount || 0) / effectiveLimit) * 100))}%` },
                    ]}
                  />
                </View>
              ) : null}
              {current?.addon_quota ? (
                <Text style={styles.addonNote}>
                  {locale === 'en'
                    ? `${current.addon_quota.toLocaleString()} extra slot(s) already added`
                    : `${current.addon_quota.toLocaleString()} slot tambahan telah ditambah`}
                </Text>
              ) : null}
            </View>

            {loading ? (
              <ActivityIndicator color="#0F172A" style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.packageGrid}>
                {packages.map((pkg) => {
                  const isSelected = pkg.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedId(pkg.id)}
                    >
                      <Text style={[styles.packageQty, isSelected && styles.packageQtySelected]}>
                        +{pkg.quantity.toLocaleString()}
                      </Text>
                      <Text style={styles.packageUnit}>
                        {locale === 'en' ? 'members' : 'ahli'}
                      </Text>
                      <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                        RM {pkg.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={14} color="#64748B" />
              <Text style={styles.noteText}>
                {locale === 'en'
                  ? 'Slots are added to your lifetime Stand Bundle capacity. Each 100 slots also grants 10 extra customer removals.'
                  : 'Slot ditambah kepada kapasiti Stand Bundle seumur hidup. Setiap 100 slot turut memberi 10 penyingkiran pelanggan tambahan.'}
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.payBtn, buying && { opacity: 0.6 }]}
              activeOpacity={0.85}
              disabled={buying || !selected}
              onPress={handleBuy}
            >
              {buying ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={17} color="#050505" />
                  <Text style={styles.payBtnText}>
                    {locale === 'en'
                      ? `Buy ${selected ? `+${selected.quantity.toLocaleString()}` : ''} slots · RM ${selected?.price ?? 0}`
                      : `Beli ${selected ? `+${selected.quantity.toLocaleString()}` : ''} slot · RM ${selected?.price ?? 0}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.secureNote}>FPX · Card · DuitNow · SSL secure</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  usageCard: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', padding: 12, marginBottom: 14 },
  usageLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' },
  usageValue: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
  barTrack: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 2.5, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', backgroundColor: '#FFCC00', borderRadius: 2.5 },
  addonNote: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309', marginTop: 7 },
  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  packageCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  packageCardSelected: { borderColor: '#0F172A', backgroundColor: '#FFFBEB' },
  packageQty: { fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.5 },
  packageQtySelected: { color: '#0F172A' },
  packageUnit: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 },
  packagePrice: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#475569', marginTop: 6 },
  packagePriceSelected: { color: '#B45309' },
  noteRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginBottom: 14 },
  noteText: { flex: 1, fontSize: 10.5, lineHeight: 15, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' },
  errorText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#DC2626', marginBottom: 10 },
  payBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFCC00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnText: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' },
  secureNote: { textAlign: 'center', fontSize: 9.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 9 },
});
