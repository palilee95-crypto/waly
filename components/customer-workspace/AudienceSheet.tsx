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
import { AudienceCard, AudienceRow, fetchAudience } from '@/lib/customer-workspace';
import { buildWhatsAppLink, renderTemplate, DEFAULT_ACTION_TEMPLATES } from '@/lib/whatsapp';

const PAGE_SIZE = 20;

const CARD_TITLES: Record<AudienceCard, string> = {
  return: 'Bring customers back',
  rewards: 'Rewards ready',
  birthday: 'Birthdays this week',
};

type Props = {
  visible: boolean;
  card: AudienceCard;
  merchantId: string;
  merchantName: string;
  branchId: string;
  total: number;
  onClose: () => void;
};

export default function AudienceSheet({
  visible,
  card,
  merchantId,
  merchantName,
  branchId,
  total,
  onClose,
}: Props) {
  const [items, setItems] = useState<AudienceRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState(DEFAULT_ACTION_TEMPLATES[card]);
  const [messaged, setMessaged] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const requestId = useRef(0);

  const templateKey = `@ws_action_template:${merchantId}:${card}`;
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
    loadPage(1);
    AsyncStorage.getItem(templateKey).then((saved) => {
      setTemplate(saved && saved.trim() ? saved : DEFAULT_ACTION_TEMPLATES[card]);
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
    renderTemplate(template, {
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

  const canLoadMore = items.length > 0 && items.length < total;
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
                {total.toLocaleString('en-MY')} customer{total === 1 ? '' : 's'} · {messagedToday} opened here
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {card !== 'birthday' ? (
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.name || 'Customer'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {card === 'return'
                        ? `Last visit ${row.daysOverdue ?? '?'} days ago`
                        : card === 'rewards'
                          ? row.reason === 'voucher'
                            ? 'Has a valid voucher'
                            : '1–2 stamps from a reward'
                          : row.birthday
                            ? `Birthday ${row.birthday}`
                            : 'Birthday this week'}
                    </Text>
                  </View>
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

          <Text style={styles.disclaimer}>
            Opens WhatsApp on this device with the message prefilled. Risev cannot confirm it was sent.
          </Text>
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
  disclaimer: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
});
