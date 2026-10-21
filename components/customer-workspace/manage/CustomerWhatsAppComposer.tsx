import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/theme';
import { fetchManageCustomer, type ManageCustomerDetail, type ManageVoucher } from '@/lib/customer-management';
import { validVouchers } from '@/lib/customer-outreach';
import { buildWhatsAppLink } from '@/lib/whatsapp';

type Mode = 'followup' | 'voucher' | 'reward' | 'custom';
type Props = {
  visible: boolean;
  customerId: string | null;
  onClose: () => void;
  onOpened?: () => void;
  onIssueVoucher?: () => void;
  preferredVoucherId?: string;
};

const GREEN = '#128C5E';

function voucherExpiry(voucher: ManageVoucher) {
  if (!voucher.expiresAt) return '';
  const date = new Date(voucher.expiresAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function draftFor(mode: Mode, detail: ManageCustomerDetail, voucher?: ManageVoucher) {
  const name = detail.profile.name.trim() || 'there';
  if (mode === 'voucher' && voucher) {
    const expiry = voucherExpiry(voucher);
    return `Hi ${name}, you have an active ${voucher.rewardName} voucher. Your code is ${voucher.code}.${expiry ? ` It's valid until ${expiry}.` : ''} Let us know if you'd like to use it on your next visit.`;
  }
  if (mode === 'reward') {
    const { stamps, stampGoal } = detail.loyalty;
    return `Hi ${name}, you're at ${stamps} of ${stampGoal} stamps — just ${stampGoal - stamps} more to your next reward. We'd love to see you again!`;
  }
  if (mode === 'custom') return `Hi ${name}, `;
  if (!detail.metrics.lastVisit) return `Hi ${name}, we'd love to welcome you for your first visit. Let us know if you have any questions.`;
  return `Hi ${name}, thanks for visiting us. How was your experience? We'd love to hear from you and welcome you back soon.`;
}

export default function CustomerWhatsAppComposer({ visible, customerId, onClose, onOpened, onIssueVoucher, preferredVoucherId }: Props) {
  const [detail, setDetail] = useState<ManageCustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('followup');
  const [voucherId, setVoucherId] = useState('');
  const [message, setMessage] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!visible || !customerId) return;
    let active = true;
    setDetail(null);
    setLoading(true);
    setError('');
    fetchManageCustomer(customerId)
      .then((result) => {
        if (!active) return;
        const vouchers = validVouchers(result.vouchers);
        const remaining = result.loyalty.stampGoal - result.loyalty.stamps;
        const selected = vouchers.find((voucher) => voucher.id === preferredVoucherId) || vouchers[0];
        const initialMode: Mode = !result.profile.optInMarketing ? 'custom'
          : vouchers.length ? 'voucher'
          : result.loyalty.enableStamps && remaining > 0 && remaining <= 2 ? 'reward'
          : 'followup';
        setDetail(result);
        setVoucherId(selected?.id || '');
        setMode(initialMode);
        setMessage(draftFor(initialMode, result, selected));
      })
      .catch((err) => { if (active) setError(String(err?.data?.message || err?.message || 'Could not load customer details.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, customerId, preferredVoucherId]);

  const vouchers = useMemo(() => validVouchers(detail?.vouchers || []), [detail]);
  const selectedVoucher = vouchers.find((voucher) => voucher.id === voucherId) || vouchers[0];
  const remaining = detail ? detail.loyalty.stampGoal - detail.loyalty.stamps : 0;
  const rewardReady = !!detail?.loyalty.enableStamps && remaining > 0;
  const hasPhone = !!buildWhatsAppLink(detail?.profile.phone, '');

  const chooseMode = (next: Mode) => {
    if (!detail) return;
    setMode(next);
    setMessage(draftFor(next, detail, selectedVoucher));
  };

  const openWhatsApp = async () => {
    const link = buildWhatsAppLink(detail?.profile.phone, message);
    if (!link) { setError('This customer needs a valid phone number before you can open WhatsApp.'); return; }
    if (!message.trim()) { setError('Write a message first.'); return; }
    setOpening(true);
    setError('');
    try {
      await Linking.openURL(link);
      onClose();
      onOpened?.();
    } catch {
      setError('Could not open WhatsApp on this device. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} accessibilityLabel="Close message composer" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Message customer</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{detail?.profile.name || 'Loading customer…'}</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close message composer">
              <Ionicons name="close" size={21} color={colors.black} />
            </TouchableOpacity>
          </View>

          {loading ? <ActivityIndicator color={colors.black} style={styles.loading} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !detail ? <Text style={styles.muted}>Close and try again.</Text> : null}

          {detail ? (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              {!hasPhone ? <Text style={styles.warning}>No usable phone number. Add one to this customer’s profile to message them.</Text> : null}
              {!detail.profile.optInMarketing ? <Text style={styles.warning}>This customer opted out of marketing. Only write a service-related message; promotional templates are unavailable.</Text> : null}
              <Text style={styles.label}>Choose a message</Text>
              <View style={styles.options}>
                {detail.profile.optInMarketing ? (
                  <>
                    <Option label="Follow up" active={mode === 'followup'} onPress={() => chooseMode('followup')} />
                    <Option label="Share active voucher" active={mode === 'voucher'} disabled={!vouchers.length} onPress={() => chooseMode('voucher')} />
                    <Option label="Reward reminder" active={mode === 'reward'} disabled={!rewardReady} onPress={() => chooseMode('reward')} />
                  </>
                ) : null}
                <Option label="Write my own" active={mode === 'custom'} onPress={() => chooseMode('custom')} />
              </View>
              {detail.profile.optInMarketing && !vouchers.length ? (
                <View style={styles.emptyVoucher}>
                  <Text style={styles.muted}>{onIssueVoucher ? 'No active, valid voucher to share.' : 'No active, valid voucher to share. Ask a manager to issue one.'}</Text>
                  {onIssueVoucher ? <TouchableOpacity onPress={() => { onClose(); onIssueVoucher(); }} accessibilityRole="button"><Text style={styles.issueLink}>Issue voucher first →</Text></TouchableOpacity> : null}
                </View>
              ) : null}
              {mode === 'voucher' && vouchers.length > 1 ? (
                <>
                  <Text style={styles.label}>Active voucher</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
                    {vouchers.map((voucher) => (
                      <Option key={voucher.id} label={voucher.rewardName} active={selectedVoucher?.id === voucher.id} onPress={() => { setVoucherId(voucher.id); setMessage(draftFor('voucher', detail, voucher)); }} />
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <Text style={styles.label}>Preview and edit</Text>
              <TextInput style={styles.message} value={message} onChangeText={setMessage} multiline textAlignVertical="top" accessibilityLabel="WhatsApp message" placeholder="Write a message…" placeholderTextColor={colors.accent[400]} />
              <Text style={styles.helper}>Risev opens this draft in WhatsApp. You review and send it there; Risev cannot confirm delivery.</Text>
            </ScrollView>
          ) : null}

          <TouchableOpacity style={[styles.openButton, (!detail || !hasPhone || !message.trim() || opening) && styles.disabled]} onPress={openWhatsApp} disabled={!detail || !hasPhone || !message.trim() || opening} accessibilityRole="button" accessibilityLabel="Open message in WhatsApp">
            <Ionicons name="logo-whatsapp" size={20} color={colors.white} />
            <Text style={styles.openText}>{opening ? 'Opening…' : 'Open WhatsApp'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Option({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.option, active && styles.optionActive, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled: !!disabled }}>
    <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  backdrop: { flex: 1 },
  sheet: { maxHeight: '88%', backgroundColor: colors.white, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6] },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.accent[200], alignSelf: 'center', marginBottom: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: colors.accent[500], marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  loading: { paddingVertical: spacing[8] },
  content: { gap: spacing[2], paddingBottom: spacing[3] },
  contentScroll: { flexShrink: 1 },
  label: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.black, marginTop: spacing[2] },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: { minHeight: 44, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.accent[50], borderWidth: 1, borderColor: colors.accent[100] },
  optionActive: { backgroundColor: colors.black, borderColor: colors.black },
  optionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.accent[700] },
  optionTextActive: { color: colors.white },
  emptyVoucher: { backgroundColor: colors.primary[50], borderRadius: radii.md, padding: spacing[3], gap: spacing[1] },
  muted: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: colors.accent[600] },
  issueLink: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: colors.black },
  warning: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, lineHeight: 16, color: colors.warning.dark, backgroundColor: colors.warning.light, padding: spacing[3], borderRadius: radii.md },
  message: { minHeight: 122, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.accent[200], padding: spacing[3], fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, lineHeight: 22, color: colors.black },
  helper: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: colors.accent[500] },
  openButton: { minHeight: 50, marginTop: spacing[3], borderRadius: radii.full, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  openText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.white },
  disabled: { opacity: 0.45 },
  error: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.error.dark, backgroundColor: colors.error.light, padding: spacing[3], borderRadius: radii.md, marginBottom: spacing[2] },
});
