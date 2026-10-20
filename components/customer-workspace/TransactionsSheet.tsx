import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { LedgerRow, LedgerType, fetchTransactions, formatShortDateFromIso } from '@/lib/customer-workspace';
import { collectLedger, buildLedgerCsv, shareCsv } from '@/lib/customer-csv';
import CustomerDetailSheet from './CustomerDetailSheet';

const PAGE_SIZE = 25;

const TYPES: { id: LedgerType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earn', label: 'Earned' },
  { id: 'redeem', label: 'Redeemed' },
  { id: 'adjust', label: 'Adjustments' },
];

const TYPE_LABEL: Record<string, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  expire: 'Expired',
  adjust: 'Adjusted',
};

type Props = {
  visible: boolean;
  branchId: string;
  from: string;
  to: string;
  periodLabel: string;
  onClose: () => void;
};

export default function TransactionsSheet({
  visible,
  branchId,
  from,
  to,
  periodLabel,
  onClose,
}: Props) {
  const [items, setItems] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<LedgerType>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<LedgerRow | null>(null);
  const requestId = useRef(0);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTransactions({
          branchId,
          from,
          to,
          page: nextPage,
          perPage: PAGE_SIZE,
          type,
          q: search,
        });
        if (id !== requestId.current) return;
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(nextPage);
      } catch {
        if (id !== requestId.current) return;
        setError('Could not load transactions.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [branchId, from, to, type, search]
  );

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    setPage(1);
    setTotal(0);
    loadPage(1);
  }, [visible, loadPage]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await collectLedger({ branchId, from, to, type, q: search });
      if (!rows.length) return;
      await shareCsv(`risev-transactions-${from}_${to}.csv`, buildLedgerCsv(rows));
    } catch {
      setError('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const canLoadMore = items.length > 0 && items.length < total;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Transactions</Text>
              <Text style={styles.subtitle}>
                {total.toLocaleString('en-MY')} recorded · {periodLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={exportCsv} style={styles.iconBtn} disabled={exporting} activeOpacity={0.7}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons name="download-outline" size={17} color={colors.black} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search customer or phone"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={15} color="#CBD5E1" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typePill, type === t.id && styles.typePillActive]}
                onPress={() => setType(t.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.typePillText, type === t.id && styles.typePillTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 10 }}>
            {items.map((row) => {
              const isRedeem = row.type === 'redeem';
              const isAdjust = row.type === 'adjust';
              return (
                <TouchableOpacity
                  key={row.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => setDetail(row)}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {row.customerName}
                      </Text>
                      <Text style={styles.rowWhen}>
                        {formatShortDateFromIso(row.created)} · {row.created.slice(11, 16)}
                      </Text>
                    </View>

                    <View style={styles.rowTags}>
                      <View
                        style={[
                          styles.tag,
                          isRedeem && styles.tagRedeem,
                          isAdjust && styles.tagAdjust,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            isRedeem && styles.tagTextRedeem,
                            isAdjust && styles.tagTextAdjust,
                          ]}
                        >
                          {TYPE_LABEL[row.type] || row.type}
                        </Text>
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[row.branchName || 'HQ', row.staffName || null, row.voucherCode || null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowRight}>
                    {row.billCents > 0 ? (
                      <Text style={styles.amount}>RM {(row.billCents / 100).toFixed(2)}</Text>
                    ) : (
                      <Text style={styles.amountMuted}>—</Text>
                    )}
                    <Text style={styles.rowMeta}>
                      {[
                        row.stamps ? `${row.stamps > 0 ? '+' : ''}${row.stamps} st` : null,
                        row.points ? `${row.points} pts` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || ' '}
                    </Text>
                  </View>
                </TouchableOpacity>
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
              <Text style={styles.emptyText}>No transactions in this period.</Text>
            ) : null}
          </ScrollView>

          {canLoadMore ? (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => loadPage(page + 1)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-down" size={15} color={colors.black} />
              <Text style={styles.moreText}>Load more</Text>
            </TouchableOpacity>
          ) : null}

          <CustomerDetailSheet
            visible={!!detail}
            customerId={detail?.customerId ?? null}
            name={detail?.customerName}
            phone={detail?.customerPhone}
            onClose={() => setDetail(null)}
            onDeleted={() => {
              setDetail(null);
              loadPage(1);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    height: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#64748B', marginTop: 2 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: colors.black,
    outlineWidth: 0,
  } as any,
  typeRow: { gap: 6, paddingVertical: 10 },
  typePill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillActive: { backgroundColor: colors.black },
  typePillText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: '#475569' },
  typePillTextActive: { color: '#FFFFFF' },
  list: { flex: 1, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.black, flexShrink: 1 },
  rowWhen: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#94A3B8' },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
  },
  tagRedeem: { backgroundColor: '#FFFBEA' },
  tagAdjust: { backgroundColor: '#FEF2F2' },
  tagText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9.5, color: '#334155' },
  tagTextRedeem: { color: '#B45309' },
  tagTextAdjust: { color: '#B91C1C' },
  rowMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#94A3B8', flexShrink: 1 },
  rowRight: { alignItems: 'flex-end', minWidth: 78 },
  amount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black },
  amountMuted: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: '#CBD5E1' },
  center: { paddingVertical: 28, alignItems: 'center', gap: 10 },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: '#B91C1C' },
  smallBtn: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: '#FFFFFF' },
  emptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 28,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginTop: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moreText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.black },
});
