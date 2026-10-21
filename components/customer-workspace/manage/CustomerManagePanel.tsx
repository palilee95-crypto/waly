import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme';
import { detailSignal, validVouchers } from '@/lib/customer-outreach';
import { whatsappNumber } from '@/lib/whatsapp';
import { formatVisitDate } from './CustomerVisitDatePicker';
import CustomerWhatsAppComposer from './CustomerWhatsAppComposer';
import {
  deleteCustomer,
  fetchDeletionAllowance,
  formatMoney,
  formatShortDateFromIso,
  relativeDays,
  type DeletionAllowance,
} from '@/lib/customer-workspace';
import {
  adjustCustomerPoints,
  adjustCustomerStamps,
  avatarUrl,
  fetchManageCustomer,
  fetchManageRewards,
  issueCustomerVoucher,
  updateCustomerInfo,
  voidCustomerVoucher,
  type ManageCustomerDetail,
  type ManageReward,
} from '@/lib/customer-management';

type Props = {
  customerId: string;
  visitDate?: string;
  visitsOnDate?: number;
  startIssueVoucher?: boolean;
  onChanged?: () => void;
  onDeleted?: () => void;
};

type Action = 'edit' | 'stamps' | 'points' | null;

const TYPE_LABEL: Record<string, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  expire: 'Expired',
  adjust: 'Adjusted',
};

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
}

function errorMessage(error: any) {
  const raw = String(error?.data?.message || error?.message || '');
  if (error?.status === 404 && /file not found/i.test(raw)) {
    return 'Customer management is not deployed on this server yet. Deploy the latest backend, then retry.';
  }
  return raw || 'Something went wrong.';
}

export default function CustomerManagePanel({ customerId, visitDate, visitsOnDate, startIssueVoucher, onChanged, onDeleted }: Props) {
  const { user, isOwner, staffPermissions } = useAuth();
  const canManage = !!isOwner || !!staffPermissions?.can_manage_customers;

  const [detail, setDetail] = useState<ManageCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<Action>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [delta, setDelta] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [allowance, setAllowance] = useState<DeletionAllowance>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [rewards, setRewards] = useState<ManageReward[]>([]);
  const [rewardId, setRewardId] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerVoucherId, setComposerVoucherId] = useState('');
  const requestRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const voucherY = useRef(0);
  const issueStarted = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await fetchManageCustomer(customerId);
      if (requestId !== requestRef.current) return;
      setDetail(data);
      setEditName(data.profile.name);
      setEditPhone(data.profile.phone);
    } catch (err) {
      if (requestId === requestRef.current) setError(errorMessage(err));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchDeletionAllowance().then(setAllowance).catch(() => setAllowance(null));
  }, []);

  const openAction = (next: Action) => {
    setAction(next);
    setActionError('');
    setNotice('');
    setDelta('1');
    setReason('');
    setConfirmDelete(false);
  };

  const refresh = async () => {
    await load();
    onChanged?.();
  };

  const saveEdit = async () => {
    if (!detail) return;
    if (!editName.trim()) {
      setActionError('Customer name cannot be empty.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await updateCustomerInfo(detail.profile.id, editName.trim(), editPhone.trim());
      setNotice('Customer information updated.');
      setAction(null);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveAdjust = async () => {
    if (!detail || (action !== 'stamps' && action !== 'points')) return;
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) {
      setActionError('Enter a non-zero whole number.');
      return;
    }
    if (!reason.trim()) {
      setActionError('A reason is required.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      if (action === 'stamps') {
        const result = await adjustCustomerStamps(detail.profile.id, amount, reason.trim());
        setNotice(result.rewardUnlocked ? 'Stamps updated. A reward has been unlocked.' : 'Stamps updated.');
      } else {
        await adjustCustomerPoints(detail.profile.id, amount, reason.trim());
        setNotice('Points updated.');
      }
      setAction(null);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openIssue = async () => {
    setIssueOpen(true);
    setActionError('');
    setNotice('');
    if (rewards.length) return;
    try {
      const merchantId = user?.merchant_id || String((pb.authStore.record as any)?.merchant_id || '');
      setRewards(await fetchManageRewards(merchantId));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const showIssue = () => {
    void openIssue();
    setTimeout(() => scrollRef.current?.scrollTo({ y: voucherY.current, animated: true }), 180);
  };

  useEffect(() => {
    if (!detail || !startIssueVoucher || issueStarted.current) return;
    issueStarted.current = true;
    showIssue();
  }, [detail?.profile.id, startIssueVoucher]);

  const issueVoucher = async () => {
    if (!detail || !rewardId) {
      setActionError('Choose a reward first.');
      return;
    }
    setIssuing(true);
    setActionError('');
    try {
      await issueCustomerVoucher({ customerId: detail.profile.id, rewardId });
      setNotice('Voucher issued.');
      setIssueOpen(false);
      setRewardId('');
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIssuing(false);
    }
  };

  const voidVoucher = async (voucherId: string) => {
    if (confirmVoidId !== voucherId) {
      setConfirmVoidId(voucherId);
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await voidCustomerVoucher(voucherId, 'Voided from Manage customers');
      setNotice('Voucher voided.');
      setConfirmVoidId(null);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setActionError('');
    try {
      await deleteCustomer(customerId);
      onDeleted?.();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={iconSizes.lg} color={colors.accent[400]} />
        <Text style={styles.errorText}>{error || 'Customer not found.'}</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { profile, metrics, loyalty, vouchers, activity } = detail;
  const canAdjustStamps = canManage && loyalty.enableStamps;
  const canAdjustPoints = canManage && loyalty.enablePoints;
  const stampProgress = loyalty.stampGoal > 0 ? Math.min(1, loyalty.stamps / loyalty.stampGoal) : 0;
  const activeVouchers = validVouchers(vouchers);
  const signal = detailSignal(detail);
  const hasPhone = !!whatsappNumber(profile.phone);

  return (
    <>
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          {profile.avatar ? (
            <Image source={{ uri: avatarUrl(profile.id, profile.avatar) }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials(profile.name)}</Text>
            </View>
          )}
          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.profilePhone} numberOfLines={1}>
              {profile.phone || 'No phone on file'}
            </Text>
            <View style={styles.profileMetaRow}>
              <View style={styles.tierChip}>
                <Text style={styles.tierText}>{profile.tier}</Text>
              </View>
              <Text style={styles.profileMeta}>
                {metrics.lastVisit ? `last ${relativeDays(metrics.lastVisit)}` : 'never visited'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.profileMessage, !hasPhone && styles.disabled]} onPress={() => setComposerOpen(true)} disabled={!hasPhone} accessibilityRole="button" accessibilityLabel={hasPhone ? `Message ${profile.name} on WhatsApp` : 'No usable phone number to message on WhatsApp'} accessibilityState={{ disabled: !hasPhone }}>
            <Ionicons name="logo-whatsapp" size={21} color={hasPhone ? '#128C5E' : colors.accent[400]} />
          </TouchableOpacity>
        </View>
        <Text style={styles.profileFootnote}>
          {profile.optInMarketing ? 'Marketing messages allowed' : 'Marketing messages opted out'}
          {profile.joinedAt ? ` · customer since ${formatShortDateFromIso(profile.joinedAt)}` : ''}
          {profile.birthday ? ` · birthday ${formatShortDateFromIso(profile.birthday)}` : ''}
        </Text>
      </View>

      {visitDate ? (
        <View style={styles.visitDateContext}>
          <Ionicons name="calendar-outline" size={18} color={colors.black} />
          <View style={{ flex: 1 }}>
            <Text style={styles.visitDateTitle}>{visitsOnDate || 'Recorded'} {visitsOnDate === 1 ? 'visit' : 'visits'} on {formatVisitDate(visitDate)}</Text>
            <Text style={styles.visitDateDetail}>The profile and lifetime totals below show the customer's current record.</Text>
          </View>
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {actionError ? <Text style={styles.errorBanner}>{actionError}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <View style={styles.nextStepCard}>
        <View style={styles.nextIcon}><Ionicons name={signal.icon} size={21} color={colors.black} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nextEyebrow}>SUGGESTED NEXT STEP</Text>
          <Text style={styles.nextTitle}>{signal.title}</Text>
          <Text style={styles.nextDetail}>{signal.detail}</Text>
        </View>
        {hasPhone && profile.optInMarketing ? <TouchableOpacity style={styles.nextAction} onPress={() => setComposerOpen(true)} accessibilityRole="button" accessibilityLabel="Draft a WhatsApp message"><Ionicons name="arrow-forward" size={18} color={colors.black} /></TouchableOpacity> : null}
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Visits" value={String(metrics.visits)} icon="repeat-outline" />
        <Metric label="Lifetime spend" value={formatMoney(metrics.spendCents)} icon="wallet-outline" />
      </View>
      {metrics.avgSpendCents !== null ? <Text style={styles.metricFootnote}>Average spend per visit · {formatMoney(metrics.avgSpendCents)}</Text> : null}

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Loyalty</Text>
          <Text style={styles.sectionMeta}>{loyalty.programName || 'Loyalty program'}</Text>
        </View>
        <View style={styles.loyaltyRow}>
          <View style={styles.loyaltyBlock}>
            <Text style={styles.loyaltyValue}>
              {loyalty.stamps} / {loyalty.stampGoal}
            </Text>
            <Text style={styles.loyaltyLabel}>stamps</Text>
          </View>
          <View style={styles.loyaltyBlock}>
            <Text style={styles.loyaltyValue}>{loyalty.points}</Text>
            <Text style={styles.loyaltyLabel}>points</Text>
          </View>
          <View style={styles.loyaltyBlock}>
            <Text style={styles.loyaltyValue}>{loyalty.completions}</Text>
            <Text style={styles.loyaltyLabel}>rewards earned</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${stampProgress * 100}%` }]} />
        </View>
        <Text style={styles.progressHint}>{loyalty.stampGoal > 0 ? `${Math.max(0, loyalty.stampGoal - loyalty.stamps)} stamps to the next reward` : 'Stamp rewards are not active'}</Text>
      </View>

      <View style={styles.card} onLayout={(event) => { voucherY.current = event.nativeEvent.layout.y; if (issueOpen) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: voucherY.current, animated: true })); }}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Vouchers {activeVouchers.length ? `· ${activeVouchers.length} active` : ''}</Text>
          {canManage ? (
            <TouchableOpacity onPress={showIssue} activeOpacity={0.75} accessibilityRole="button">
              <Text style={styles.link}>Issue voucher</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {issueOpen ? (
          <View style={styles.issueBox}>
            <Text style={styles.formHint}>Choose a reward. The voucher expires in 30 days.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardRow}>
              {rewards.map((reward) => {
                const active = rewardId === reward.id;
                return (
                  <TouchableOpacity
                    key={reward.id}
                    style={[styles.rewardChip, active && styles.rewardChipActive]}
                    onPress={() => setRewardId(reward.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.rewardChipText, active && styles.rewardChipTextActive]}>
                      {reward.name || reward.title || 'Reward'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {rewards.length === 0 ? <Text style={styles.empty}>No active rewards.</Text> : null}
            </ScrollView>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIssueOpen(false)} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, issuing && styles.disabled]} onPress={issueVoucher} disabled={issuing} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>{issuing ? 'Issuing…' : 'Issue voucher'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {activeVouchers.length === 0 ? <Text style={styles.empty}>No active voucher to share right now.</Text> : activeVouchers.map((voucher) => (
          <View key={voucher.id} style={styles.activeVoucher}>
            <View style={styles.voucherTop}>
              <Ionicons name="gift-outline" size={19} color={colors.primary[700]} />
              <Text style={styles.voucherName} numberOfLines={1}>{voucher.rewardName}</Text>
              <Text style={styles.activeTag}>ACTIVE</Text>
            </View>
            <Text style={styles.voucherMeta}>{voucher.code}{voucher.expiresAt ? ` · expires ${formatShortDateFromIso(voucher.expiresAt)}` : ''}</Text>
            <View style={styles.voucherActions}>
              {hasPhone && profile.optInMarketing ? <TouchableOpacity style={styles.shareVoucher} onPress={() => { setComposerVoucherId(voucher.id); setComposerOpen(true); }} accessibilityRole="button" accessibilityLabel={`Share ${voucher.rewardName} on WhatsApp`}><Ionicons name="logo-whatsapp" size={16} color="#128C5E" /><Text style={styles.shareVoucherText}>Share on WhatsApp</Text></TouchableOpacity> : null}
              {canManage ? <TouchableOpacity style={styles.voidButton} onPress={() => voidVoucher(voucher.id)} activeOpacity={0.75} accessibilityRole="button"><Text style={styles.voidLink}>{confirmVoidId === voucher.id ? 'Confirm void' : 'Void'}</Text></TouchableOpacity> : null}
            </View>
          </View>
        ))}
        {vouchers.some((voucher) => !activeVouchers.some((active) => active.id === voucher.id)) ? <Text style={styles.historyLabel}>PAST VOUCHERS</Text> : null}
        {vouchers.filter((voucher) => !activeVouchers.some((active) => active.id === voucher.id)).map((voucher) => (
            <View key={voucher.id} style={styles.voucherRow}>
              <View style={[styles.voucherIcon, styles.voucherIconMuted]}>
                <Ionicons name="gift-outline" size={iconSizes.sm} color={colors.accent[400]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.voucherName} numberOfLines={1}>
                  {voucher.rewardName}
                </Text>
                <Text style={styles.voucherMeta} numberOfLines={1}>
                  {voucher.code} · {voucher.status === 'active' ? 'expired' : voucher.status}
                  {voucher.expiresAt ? ` · expires ${formatShortDateFromIso(voucher.expiresAt)}` : ''}
                </Text>
              </View>
            </View>
          ))}
      </View>

      {canManage ? (
        <View style={styles.actionRow}>
          <ActionButton icon="create-outline" label="Edit" onPress={() => openAction('edit')} />
          {canAdjustStamps ? (
            <ActionButton icon="ribbon-outline" label="Stamps" onPress={() => openAction('stamps')} />
          ) : null}
          {canAdjustPoints ? (
            <ActionButton icon="sparkles-outline" label="Points" onPress={() => openAction('points')} />
          ) : null}
        </View>
      ) : null}

      {action === 'edit' ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Edit customer</Text>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput value={editName} onChangeText={setEditName} style={styles.input} placeholder="Customer name" placeholderTextColor={colors.accent[400]} />
          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput value={editPhone} onChangeText={setEditPhone} style={styles.input} placeholder="+60…" placeholderTextColor={colors.accent[400]} keyboardType="phone-pad" />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAction(null)} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, saving && styles.disabled]} onPress={saveEdit} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {action === 'stamps' || action === 'points' ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {action === 'stamps' ? 'Adjust stamps' : 'Adjust points'}
          </Text>
          <Text style={styles.formHint}>
            Current: {action === 'stamps' ? `${loyalty.stamps} stamps` : `${loyalty.points} points`}
          </Text>
          <View style={styles.stepperRow}>
            {[-5, -1, 1, 5].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.stepperChip}
                onPress={() => setDelta(String(amount))}
                activeOpacity={0.8}
              >
                <Text style={styles.stepperText}>{amount > 0 ? `+${amount}` : amount}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              value={delta}
              onChangeText={setDelta}
              style={styles.deltaInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.accent[400]}
            />
          </View>
          <Text style={styles.inputLabel}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={styles.input}
            placeholder="Why is this adjustment needed?"
            placeholderTextColor={colors.accent[400]}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAction(null)} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, saving && styles.disabled]} onPress={saveAdjust} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Apply adjustment'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
        {activity.length === 0 ? (
          <Text style={styles.empty}>No activity recorded.</Text>
        ) : (
          activity.slice(0, 12).map((row) => (
            <View key={row.id} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={row.type === 'redeem' ? 'gift-outline' : row.type === 'adjust' ? 'create-outline' : 'ribbon-outline'}
                  size={iconSizes.sm}
                  color={colors.accent[500]}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.activityTitle}>{TYPE_LABEL[row.type] || row.type}</Text>
                <Text style={styles.activityMeta} numberOfLines={1}>
                  {formatShortDateFromIso(row.createdAt)}
                  {row.staffName ? ` · ${row.staffName}` : ''}
                  {row.branchName ? ` · ${row.branchName}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.activityAmount}>
                  {row.billCents > 0 ? formatMoney(row.billCents) : '—'}
                </Text>
                {row.stamps !== 0 ? <Text style={styles.activityDelta}>{row.stamps > 0 ? '+' : ''}{row.stamps} stamps</Text> : null}
                {row.points !== 0 ? <Text style={styles.activityDelta}>{row.points > 0 ? '+' : ''}{row.points} pts</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>
      {isOwner ? (
        <View style={styles.dangerCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.dangerTitle}>Remove from this store</Text>
            <Text style={styles.dangerDetail}>{allowance ? `${allowance.used} of ${allowance.max} removals used` : 'Removals are unlimited on this plan.'}</Text>
            {confirmDelete ? <Text style={styles.dangerConfirm}>This removes the customer's loyalty history from this store only. Tap again to confirm.</Text> : null}
          </View>
          <TouchableOpacity style={[styles.dangerBtn, deleting && styles.disabled]} onPress={removeCustomer} disabled={deleting} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.dangerBtnText}>{deleting ? 'Removing…' : confirmDelete ? 'Confirm remove' : 'Remove'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
    <CustomerWhatsAppComposer
      visible={composerOpen}
      customerId={customerId}
      preferredVoucherId={composerVoucherId}
      onClose={() => { setComposerOpen(false); setComposerVoucherId(''); }}
      onOpened={() => setNotice('Opened in WhatsApp. Risev cannot confirm whether the message was sent.')}
      onIssueVoucher={canManage ? showIssue : undefined}
    />
    </>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={iconSizes.sm} color={colors.accent[400]} />
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, danger && styles.actionBtnDanger]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={iconSizes.md} color={danger ? colors.error.dark : colors.black} />
      <Text style={[styles.actionBtnText, danger && styles.actionBtnTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { gap: spacing[3], paddingBottom: spacing[8] },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[10], gap: spacing[2] },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: colors.accent[500], textAlign: 'center' },

  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[4],
    ...shadows.sm,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: colors.primary[700] },
  profileCopy: { flex: 1, minWidth: 0 },
  profileMessage: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6EE' },
  profileName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: colors.black },
  profilePhone: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: colors.accent[500], marginTop: 2 },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1.5] },
  tierChip: { backgroundColor: colors.accent[50], borderRadius: radii.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  tierText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9.5, color: colors.accent[700], textTransform: 'capitalize' },
  profileMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[400] },
  profileFootnote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[400], marginTop: spacing[2] },
  visitDateContext: { backgroundColor: colors.primary[50], borderColor: colors.primary[200], borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  visitDateTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.black },
  visitDateDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: colors.accent[600], marginTop: 3 },

  notice: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.success.dark, backgroundColor: colors.success.light, borderRadius: radii.md, padding: spacing[2] },
  errorBanner: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.error.dark, backgroundColor: colors.error.light, borderRadius: radii.md, padding: spacing[2] },

  nextStepCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.primary[50], borderColor: colors.primary[200], borderWidth: 1, borderRadius: radii.xl, padding: spacing[4] },
  nextIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[200] },
  nextEyebrow: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9.5, color: colors.primary[700], letterSpacing: 0.6 },
  nextTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.black, marginTop: 2 },
  nextDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.accent[600], marginTop: 2 },
  nextAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary[400], alignItems: 'center', justifyContent: 'center' },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  metric: { flexGrow: 1, flexBasis: '47%', minWidth: 130, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.accent[100], padding: spacing[3], gap: 2 },
  metricValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: colors.black, marginTop: 2 },
  metricLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[400] },
  metricFootnote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[500], marginTop: -spacing[2], paddingHorizontal: spacing[1] },

  card: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.accent[100], padding: spacing[4], gap: spacing[2], ...shadows.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.black },
  sectionMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[400] },
  link: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.accent[700] },

  loyaltyRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  loyaltyBlock: { flex: 1 },
  loyaltyValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: colors.black },
  loyaltyLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: colors.accent[400], marginTop: 1 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.accent[100], overflow: 'hidden', marginTop: spacing[2] },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: colors.primary[400] },
  progressHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[500], marginTop: spacing[1] },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  actionBtn: { flexGrow: 1, flexBasis: '22%', minWidth: 88, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], borderRadius: radii.md, backgroundColor: colors.accent[50], borderWidth: 1, borderColor: colors.accent[100] },
  actionBtnDanger: { backgroundColor: colors.error.light, borderColor: colors.error.light },
  actionBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.black },
  actionBtnTextDanger: { color: colors.error.dark },

  formCard: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.accent[100], padding: spacing[4], gap: spacing[2], ...shadows.sm },
  formTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.black },
  formHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.accent[500] },
  inputLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: colors.accent[500], marginTop: spacing[1] },
  input: { height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent[100], backgroundColor: colors.accent[50], paddingHorizontal: spacing[3], fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: colors.black },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  stepperChip: { minWidth: 46, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.accent[50], borderWidth: 1, borderColor: colors.accent[100] },
  stepperText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.black },
  deltaInput: { width: 76, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent[100], paddingHorizontal: spacing[2], fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.black },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  primaryBtn: { minHeight: 42, paddingHorizontal: spacing[4], borderRadius: radii.md, backgroundColor: colors.primary[400], alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black },
  secondaryBtn: { minHeight: 42, paddingHorizontal: spacing[3], borderRadius: radii.md, backgroundColor: colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.accent[700] },
  disabled: { opacity: 0.55 },

  dangerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.error.light, borderRadius: radii.xl, padding: spacing[4] },
  dangerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.error.dark },
  dangerDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.error.dark, marginTop: 2 },
  dangerConfirm: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: colors.error.dark, marginTop: spacing[1] },
  dangerBtn: { minHeight: 40, paddingHorizontal: spacing[3], borderRadius: radii.md, backgroundColor: colors.error.dark, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.white },

  issueBox: { gap: spacing[2], padding: spacing[3], borderRadius: radii.lg, backgroundColor: colors.accent[50] },
  rewardRow: { flexDirection: 'row', gap: spacing[2], paddingVertical: 2 },
  rewardChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.accent[100] },
  rewardChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  rewardChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.accent[700] },
  rewardChipTextActive: { color: colors.white },

  voucherRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.accent[50] },
  activeVoucher: { borderWidth: 1, borderColor: colors.primary[200], backgroundColor: colors.primary[50], borderRadius: radii.lg, padding: spacing[3], gap: spacing[1.5] },
  voucherTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  activeTag: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9, color: colors.primary[700], marginLeft: 'auto' },
  voucherActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginTop: spacing[1] },
  shareVoucher: { minHeight: 44, paddingHorizontal: spacing[3], borderRadius: radii.full, backgroundColor: '#E8F6EE', flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  voidButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[2] },
  shareVoucherText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#128C5E' },
  historyLabel: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9.5, letterSpacing: 0.4, color: colors.accent[400], marginTop: spacing[2] },
  voucherIcon: { width: 34, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  voucherIconActive: { backgroundColor: colors.primary[50] },
  voucherIconMuted: { backgroundColor: colors.accent[50] },
  voucherName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.black },
  voucherMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: colors.accent[400], marginTop: 1 },
  voidLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: colors.error.dark },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.accent[50] },
  activityIcon: { width: 30, height: 30, borderRadius: radii.md, backgroundColor: colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.black },
  activityMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: colors.accent[400], marginTop: 1 },
  activityAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11.5, color: colors.black },
  activityDelta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, color: colors.accent[400] },

  empty: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.accent[400], paddingVertical: spacing[3], textAlign: 'center' },
});
