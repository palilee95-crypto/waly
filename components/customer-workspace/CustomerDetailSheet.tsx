import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { colors, radii } from '@/theme';
import {
  CustomerDetail,
  fetchCustomerDetail,
  deleteCustomer,
  relativeDays,
  formatShortDateFromIso,
} from '@/lib/customer-workspace';
import { buildWhatsAppLink } from '@/lib/whatsapp';

const TYPE_LABEL: Record<string, string> = {
  earn: 'Stamp earned',
  stamp: 'Stamp earned',
  spend: 'Reward redeemed',
  redeem: 'Reward redeemed',
  points: 'Points earned',
  adjust: 'Adjustment',
};

type Props = {
  visible: boolean;
  customerId: string | null;
  name?: string;
  phone?: string;
  onClose: () => void;
  onDeleted: () => void;
};

export default function CustomerDetailSheet({
  visible,
  customerId,
  name,
  phone,
  onClose,
  onDeleted,
}: Props) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !customerId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setDeleteError(null);
    setConfirming(false);
    setLoading(true);
    fetchCustomerDetail(customerId, { name, phone })
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this customer.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, customerId, name, phone]);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const openChat = async () => {
    const link = buildWhatsAppLink(detail?.phone || phone || '', '');
    if (!link) return;
    try {
      await Linking.openURL(link);
    } catch {
      /* no WhatsApp handler on this device */
    }
  };

  const remove = async () => {
    if (!customerId) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomer(customerId);
      onDeleted();
    } catch (err: any) {
      const payload = err?.response?.data;
      setDeleteError(payload?.message || 'Could not remove this customer.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const initials = (detail?.name || name || 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const hasPhone = !!buildWhatsAppLink(detail?.phone || phone || '', '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'C'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {detail?.name || name || 'Customer'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {detail?.phone || phone || 'No phone on file'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.black} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : detail ? (
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {detail.stamps}
                    <Text style={styles.statMuted}>/{detail.goal}</Text>
                  </Text>
                  <Text style={styles.statLabel}>Stamps</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{detail.points.toLocaleString('en-MY')}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{detail.completions}</Text>
                  <Text style={styles.statLabel}>Rewards</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{detail.vouchers}</Text>
                  <Text style={styles.statLabel}>Vouchers</Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              {detail.activity.length === 0 ? (
                <Text style={styles.emptyText}>No visits recorded yet.</Text>
              ) : (
                detail.activity.map((item) => (
                  <View key={item.id} style={styles.activityRow}>
                    <View style={styles.activityIcon}>
                      <Ionicons
                        name={item.type === 'spend' || item.type === 'redeem' ? 'gift-outline' : 'add-circle-outline'}
                        size={14}
                        color="#686868"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {TYPE_LABEL[item.type] || item.type || 'Activity'}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {[
                          item.bill > 0 ? `RM ${item.bill.toFixed(2)}` : null,
                          item.stamps ? `+${item.stamps} stamp${item.stamps === 1 ? '' : 's'}` : null,
                          item.points ? `${item.points} pts` : null,
                          `${formatShortDateFromIso(item.created)} · ${relativeDays(item.created)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}

          {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.secondaryBtn, !hasPhone && { opacity: 0.4 }]}
              disabled={!hasPhone}
              onPress={openChat}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={15} color={colors.black} />
              <Text style={styles.secondaryText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerBtn, confirming && styles.dangerBtnArmed]}
              onPress={remove}
              disabled={deleting}
              activeOpacity={0.85}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.dangerText}>
                    {confirming ? 'Tap to confirm' : 'Remove customer'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.footerNote}>
            Removing takes this customer off your store only — their other stores are untouched.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,12,0.35)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.black },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { paddingVertical: 32, alignItems: 'center' },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#B91C1C' },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    paddingVertical: 12,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.black },
  statMuted: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#94A3B8' },
  statLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0' },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 12,
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.black },
  activityMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748B', marginTop: 1 },
  deleteError: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: '#B91C1C',
    marginTop: 10,
    lineHeight: 16,
  },
  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.white,
  },
  secondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.black },
  dangerBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dangerBtnArmed: { backgroundColor: '#B91C1C' },
  dangerText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: '#FFFFFF' },
  footerNote: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
});
