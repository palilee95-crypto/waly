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
import LoyaltyCardBack from '@/components/LoyaltyCardBack';

/** White or near-black, whichever stays readable on the merchant's card colour. */
function inkOn(background: string) {
  const hex = String(background || '').replace('#', '');
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#0F172A' : '#FFFFFF';
}

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
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (!visible || !customerId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setDeleteError(null);
    setConfirming(false);
    setShowActions(false);
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
      setShowActions(false);
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
  const stampGoal = Math.max(1, detail?.goal || 10);
  const stampsLeft = Math.max(0, stampGoal - (detail?.stamps || 0));

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
            <TouchableOpacity onPress={() => setShowActions((value) => !value)} style={styles.closeBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Customer actions">
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.black} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close customer details">
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {showActions ? (
            <TouchableOpacity style={styles.actionMenuItem} onPress={remove} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Remove customer from this store">
              <Ionicons name="trash-outline" size={17} color={colors.error.dark} />
              <Text style={styles.actionMenuText}>Remove from this store</Text>
            </TouchableOpacity>
          ) : null}

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
              {(() => {
                const design = detail.card;
                const surface = design?.cardColor || colors.black;
                const showStamps = !design || design.enableStamps;

                return (
                  <View style={styles.cardBlock}>
                    <LoyaltyCardBack
                      merchantName={detail.merchantName || 'This store'}
                      cardColor={surface}
                      fontColor={design?.fontColor || inkOn(surface)}
                      cardIcon={design?.cardIcon || 'coffee'}
                      backgroundImage={design?.cardBackgroundBack || ''}
                      stamps={detail.stamps}
                      goal={stampGoal}
                      points={detail.points}
                      enableStamps={showStamps}
                      spendPerPoint={design?.spendPerPoint}
                      milestones={design?.milestones}
                    />
                    <Text style={styles.cardHint}>
                      {!showStamps
                        ? 'Points only — stamps are switched off for this card.'
                        : stampsLeft === 0
                          ? 'Reward ready to claim'
                          : `${stampsLeft} more stamp${stampsLeft === 1 ? '' : 's'} to the next reward`}
                    </Text>
                  </View>
                );
              })()}

              <View style={styles.statRow}>
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

              <Text style={styles.sectionLabel}>Recent activity</Text>
              {detail.activity.length === 0 ? (
                <Text style={styles.emptyText}>No visits recorded yet.</Text>
              ) : (
                <View style={styles.activityList}>
                  {detail.activity.map((item, index) => {
                    const isReward = item.type === 'spend' || item.type === 'redeem';
                    const impact = [
                      item.bill > 0 ? `RM ${item.bill.toFixed(2)}` : null,
                      item.stamps ? `${item.stamps > 0 ? '+' : ''}${item.stamps} stamp${Math.abs(item.stamps) === 1 ? '' : 's'}` : null,
                      item.points ? `${item.points > 0 ? '+' : ''}${item.points} pts` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <View key={item.id} style={[styles.activityRow, index === detail.activity.length - 1 && styles.activityRowLast]}>
                        <View style={[styles.activityIcon, isReward && styles.activityIconReward]}>
                          <Ionicons
                            name={isReward ? 'gift-outline' : 'add-outline'}
                            size={18}
                            color={colors.black}
                          />
                        </View>
                        <View style={styles.activityCopy}>
                          <View style={styles.activityHeading}>
                            <Text style={styles.activityTitle} numberOfLines={1}>
                              {TYPE_LABEL[item.type] || item.type || 'Activity'}
                            </Text>
                            <Text style={styles.activityDate}>{formatShortDateFromIso(item.created)}</Text>
                          </View>
                          <Text style={styles.activityMeta} numberOfLines={2}>
                            {impact || (isReward ? 'Reward claimed' : 'Loyalty activity')}
                            {' · '}{relativeDays(item.created)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          ) : null}

          {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}

          {confirming ? (
            <View style={styles.confirmPanel}>
              <Text style={styles.confirmTitle}>Remove this customer?</Text>
              <Text style={styles.confirmText}>They will be removed from this store only. Their other stores stay unchanged.</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setConfirming(false)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Cancel removal">
                  <Text style={styles.secondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dangerBtn, styles.dangerBtnArmed]} onPress={remove} disabled={deleting} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Confirm remove customer">
                  {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.dangerText}>Remove customer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : hasPhone ? (
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={openChat}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${detail?.name || name || 'customer'}`}
            >
              <Ionicons name="logo-whatsapp" size={15} color={colors.black} />
              <Text style={styles.secondaryText}>Chat with customer</Text>
            </TouchableOpacity>
          ) : null}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.black },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: '#64748B', marginTop: 3 },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.error.light,
    marginBottom: 12,
  },
  actionMenuText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.error.dark },
  center: { paddingVertical: 32, alignItems: 'center' },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#B91C1C' },
  cardBlock: { marginBottom: 10, gap: 8 },
  cardHint: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748B', paddingHorizontal: 2 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    paddingVertical: 15,
    marginBottom: 20,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: colors.black },
  statLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: colors.black,
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 12,
  },
  activityList: { borderWidth: 1, borderColor: '#E9EDF3', borderRadius: 18, paddingHorizontal: 14, backgroundColor: colors.white },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  activityRowLast: { borderBottomWidth: 0 },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconReward: { backgroundColor: '#F1F5F9' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  activityTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.black, flex: 1 },
  activityDate: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748B' },
  activityMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: '#64748B', marginTop: 3 },
  deleteError: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: '#B91C1C',
    marginTop: 10,
    lineHeight: 16,
  },
  confirmPanel: {
    backgroundColor: colors.error.light,
    borderRadius: radii.lg,
    padding: 14,
    marginTop: 12,
  },
  confirmTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.black },
  confirmText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, lineHeight: 18, color: colors.accent[700], marginTop: 4 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  chatBtn: {
    height: 52,
    marginTop: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary[400],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
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
  secondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.black },
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
});
