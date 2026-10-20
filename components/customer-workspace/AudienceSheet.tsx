import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radii } from '@/theme';
import {
  AudienceCard,
  AudienceRow,
  fetchAudience,
  fetchDeletionAllowance,
  DeletionAllowance,
} from '@/lib/customer-workspace';
import { collectAudience, buildAudienceCsv, shareCsv } from '@/lib/customer-csv';
import CustomerDetailSheet from './CustomerDetailSheet';
import {
  buildWhatsAppLink,
  renderTemplate,
  DEFAULT_ACTION_TEMPLATES,
  ActionCardId,
} from '@/lib/whatsapp';

const PAGE_SIZE = 20;

/** Directory chats are personal, not a win-back campaign. */
const DIRECTORY_TEMPLATE = 'Hi {{name}}, thanks for visiting {{merchant}}!';

const CARD_TITLES: Record<AudienceCard, string> = {
  return: 'Bring customers back',
  rewards: 'Customers near reward',
  rebook: 'Not rebooked yet',
  birthday: 'Upcoming birthdays',
  all: 'All customers',
};

type Props = {
  visible: boolean;
  card: AudienceCard;
  merchantId: string;
  merchantName: string;
  branchId: string;
  total: number;
  onClose: () => void;
  /** Fired after a customer is removed so the workspace can refresh its counts. */
  onChanged?: () => void;
};

export default function AudienceSheet({
  visible,
  card,
  merchantId,
  merchantName,
  branchId,
  total,
  onClose,
  onChanged,
}: Props) {
  const [items, setItems] = useState<AudienceRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState(
    DEFAULT_ACTION_TEMPLATES[card === 'all' ? 'return' : card] ?? DEFAULT_ACTION_TEMPLATES.return
  );
  const [messaged, setMessaged] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [detailRow, setDetailRow] = useState<AudienceRow | null>(null);
  const [allowance, setAllowance] = useState<DeletionAllowance>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const requestId = useRef(0);

  // The directory is a lookup list, not a campaign: no editable template, just a
  // plain greeting when the merchant opens a chat.
  const isDirectory = card === 'all';
  const templateCard: ActionCardId = isDirectory ? 'return' : card;
  const templateKey = `@ws_action_template:${merchantId}:${templateCard}`;
  const messagedKey = `@ws_action_messaged:${merchantId}:${card}`;

  const loadPage = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAudience({ card, branchId, page: nextPage, perPage: PAGE_SIZE });
        if (id !== requestId.current) return;
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
        if (typeof res.total === 'number') setServerTotal(res.total);
      } catch {
        if (id !== requestId.current) return;
        setError('Could not load this audience.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [card, branchId]
  );

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    setPage(1);
    setCopied(false);
    setExportError(null);
    setServerTotal(null);
    loadPage(1);
    fetchDeletionAllowance()
      .then(setAllowance)
      .catch(() => setAllowance(null));
    AsyncStorage.getItem(templateKey).then((saved) => {
      setTemplate(
        saved && saved.trim()
          ? saved
          : DEFAULT_ACTION_TEMPLATES[templateCard] ?? DEFAULT_ACTION_TEMPLATES.return
      );
    });
    AsyncStorage.getItem(messagedKey).then((saved) => {
      try {
        const parsed = saved ? JSON.parse(saved) : [];
        setMessaged(Array.isArray(parsed) ? parsed : []);
      } catch {
        setMessaged([]);
      }
    });
  }, [visible, card, templateKey, messagedKey, loadPage]);

  const persistTemplate = (value: string) => {
    setTemplate(value);
    AsyncStorage.setItem(templateKey, value).catch(() => {});
  };

  const markMessaged = (id: string) => {
    setMessaged((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      AsyncStorage.setItem(messagedKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const messageFor = (row: AudienceRow) =>
    renderTemplate(isDirectory ? DIRECTORY_TEMPLATE : template, {
      name: (row.name || '').split(' ')[0] || 'there',
      merchant: merchantName,
      days: row.daysOverdue ?? '',
      reward: row.reason === 'voucher' ? 'a voucher' : row.reason === 'near_reward' ? 'a reward' : 'a reward',
    });

  const openChat = async (row: AudienceRow) => {
    const link = buildWhatsAppLink(row.phone, messageFor(row));
    if (!link) return;
    markMessaged(row.id);
    try {
      await Linking.openURL(link);
    } catch {
      /* the device has no WhatsApp handler; nothing else to do */
    }
  };

  const copyNumbers = async () => {
    const numbers = items
      .map((r) => (r.phone || '').replace(/[^\d+]/g, ''))
      .filter(Boolean)
      .join('\n');
    if (!numbers) return;
    await Clipboard.setStringAsync(numbers);
    setCopied(true);
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await collectAudience(card, branchId);
      if (!rows.length) {
        setExportError('Nothing to export yet.');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      await shareCsv(`risev-${card}-customers-${stamp}.csv`, buildAudienceCsv(rows, card));
    } catch (err: any) {
      setExportError(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleted = () => {
    setDetailRow(null);
    setItems([]);
    loadPage(1);
    fetchDeletionAllowance()
      .then(setAllowance)
      .catch(() => {});
    onChanged?.();
  };

  const effectiveTotal = serverTotal ?? total;
  const canLoadMore = items.length > 0 && items.length < effectiveTotal;
  const messagedToday = useMemo(
    () => items.filter((r) => messaged.includes(r.id)).length,
    [items, messaged]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{CARD_TITLES[card]}</Text>
              <Text style={styles.subtitle}>
                {effectiveTotal.toLocaleString('en-MY')} customer{effectiveTotal === 1 ? '' : 's'} ·{' '}
                {messagedToday} opened here
              </Text>
            </View>
            <TouchableOpacity
              onPress={exportCsv}
              style={styles.closeBtn}
              activeOpacity={0.7}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons name="download-outline" size={17} color={colors.black} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {isDirectory ? (
            <Text style={styles.directoryNote}>
              Your full customer list, most recent visit first. Tap a customer for their details, or open a chat.
            </Text>
          ) : card !== 'birthday' ? (
            <View style={styles.templateBlock}>
              <Text style={styles.templateLabel}>MESSAGE</Text>
              <TextInput
                value={template}
                onChangeText={persistTemplate}
                multiline
                maxLength={300}
                style={styles.templateInput}
                placeholder="Write your message..."
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.templateHint}>
                {'{{name}} {{merchant}} {{days}} {{reward}}'} · saved for this card
              </Text>
            </View>
          ) : (
            <Text style={styles.birthdayNote}>
              Birthdays are already handled by the automated birthday reward. Send a personal nudge here if you
              want to, then check the reward was issued.
            </Text>
          )}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 8 }}>
            {items.map((row) => {
              const hasPhone = !!buildWhatsAppLink(row.phone, '');
              const opened = messaged.includes(row.id);
              return (
                <View key={row.id} style={styles.row}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => setDetailRow(row)}
                  >
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.name || 'Customer'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {card === 'return' || card === 'rebook'
                        ? `Last visit ${row.daysOverdue ?? '?'} days ago`
                        : card === 'all'
                          ? `${row.visits ?? 0} visit${row.visits === 1 ? '' : 's'} · ${
                              row.daysOverdue === null || row.daysOverdue === undefined
                                ? 'never visited'
                                : row.daysOverdue <= 0
                                  ? 'visited today'
                                  : `last visit ${row.daysOverdue} days ago`
                            }`
                          : card === 'rewards'
                            ? row.reason === 'voucher'
                              ? 'Has a valid voucher'
                              : '1–2 stamps from a reward'
                            : row.birthday
                              ? `Birthday ${row.birthday}`
                              : 'Birthday this week'}
                    </Text>
                  </TouchableOpacity>
                  {opened ? <Ionicons name="checkmark" size={14} color="#686868" style={{ marginRight: 6 }} /> : null}
                  <TouchableOpacity
                    style={[styles.waBtn, !hasPhone && styles.waBtnDisabled]}
                    activeOpacity={0.85}
                    disabled={!hasPhone}
                    onPress={() => openChat(row)}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color={hasPhone ? colors.black : '#9CA3AF'} />
                    <Text style={[styles.waText, !hasPhone && { color: '#9CA3AF' }]}>
                      {hasPhone ? 'Chat' : 'No phone'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.black} />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={() => loadPage(page)}>
                  <Text style={styles.smallBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : items.length === 0 ? (
              <Text style={styles.emptyText}>Nobody is in this list right now.</Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.secondaryBtn, !items.length && { opacity: 0.4 }]}
              disabled={!items.length}
              onPress={copyNumbers}
              activeOpacity={0.85}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={colors.black} />
              <Text style={styles.secondaryText}>{copied ? 'Copied' : 'Copy numbers'}</Text>
            </TouchableOpacity>

            {canLoadMore ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => loadPage(page + 1)}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Ionicons name="chevron-down" size={15} color={colors.black} />
                <Text style={styles.secondaryText}>More</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {allowance ? (
            <Text style={styles.allowance}>
              {`Stand Bundle: ${Math.max(0, allowance.max - allowance.used)} of ${allowance.max} removals left`}
            </Text>
          ) : null}

          {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}

          <Text style={styles.disclaimer}>
            Opens WhatsApp on this device with the message prefilled. Risev cannot confirm it was sent.
          </Text>

          <CustomerDetailSheet
            visible={!!detailRow}
            customerId={detailRow?.id ?? null}
            name={detailRow?.name}
            phone={detailRow?.phone}
            onClose={() => setDetailRow(null)}
            onDeleted={handleDeleted}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'web' ? 22 : 34,
    paddingTop: 8,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  subtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateBlock: { marginTop: 14, gap: 6 },
  templateLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#686868',
    letterSpacing: 0.8,
  },
  templateInput: {
    borderWidth: 1,
    borderColor: '#E9E9E9',
    borderRadius: radii.md,
    padding: 10,
    minHeight: 62,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.black,
    textAlignVertical: 'top',
  },
  templateHint: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#9CA3AF' },
  birthdayNote: {
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 12,
  },
  directoryNote: {
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 10,
    marginBottom: 2,
  },
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },
  rowName: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  rowMeta: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: '#FFCC00',
  },
  waBtnDisabled: { backgroundColor: '#F6F6F6' },
  waText: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  center: { paddingVertical: 24, alignItems: 'center', gap: 10 },
  errorText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#686868' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: '#FFCC00',
  },
  smallBtnText: { fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  emptyText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    paddingVertical: 18,
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  allowance: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
    marginTop: 10,
    textAlign: 'center',
  },
  exportError: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
    marginTop: 8,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
});
