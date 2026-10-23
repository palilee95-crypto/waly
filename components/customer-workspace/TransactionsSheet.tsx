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
import { LedgerRow, LedgerType, type LedgerFocus, fetchTransactions, formatLedgerImpact, formatLocalTimeFromIso, formatShortDateFromIso } from '@/lib/customer-workspace';
import { collectLedger, buildLedgerCsv, shareCsv } from '@/lib/customer-csv';
import CustomerDetailSheet from './CustomerDetailSheet';
import { pb } from '@/lib/pocketbase';
import ThermalReceiptScreen from '@/components/ThermalReceiptScreen';
import { PaidReceipt } from '@/lib/paidReceipt';

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

function compactImpact(row: LedgerRow): string {
  if (row.billCents > 0) return `RM ${(row.billCents / 100).toFixed(2)}`;
  if (row.stamps) return `${row.stamps > 0 ? '+' : ''}${row.stamps} stamp${Math.abs(row.stamps) === 1 ? '' : 's'}`;
  if (row.points) return `${row.points > 0 ? '+' : ''}${row.points} pts`;
  if (row.type === 'redeem') return 'Reward';
  if (row.type === 'expire') return 'Expired';
  if (row.type === 'adjust') return 'Adjusted';
  return 'Activity';
}

type Props = {
  visible: boolean;
  branchId: string;
  from: string;
  to: string;
  periodLabel: string;
  focus?: LedgerFocus | null;
  onClose: () => void;
};

export default function TransactionsSheet({
  visible,
  branchId,
  from,
  to,
  periodLabel,
  focus,
  onClose,
}: Props) {
  const effectiveBranchId = focus?.branchId ?? branchId;
  const effectiveFrom = focus?.from ?? from;
  const effectiveTo = focus?.to ?? to;
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
  const [paidReceipt, setPaidReceipt] = useState<PaidReceipt | null>(null);
  const [receiptBusyId, setReceiptBusyId] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const requestId = useRef(0);

  const openPaidReceipt = async (transactionId: string) => {
    if (receiptBusyId) return;
    setReceiptBusyId(transactionId); setReceiptError('');
    try {
      const result = await pb.collection('digital_receipts').getList<PaidReceipt>(1, 1, {
        filter: `transaction = "${transactionId}"`, sort: '-created', expand: 'merchant', requestKey: null,
      });
      const receipt = result.items[0];
      if (!receipt || receipt.payment_status !== 'paid') throw new Error('No paid receipt is available for this transaction.');
      setPaidReceipt(receipt);
    } catch (error: any) { setReceiptError(error?.message || 'Could not load receipt.'); }
    finally { setReceiptBusyId(''); }
  };

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
          branchId: effectiveBranchId,
          from: effectiveFrom,
          to: effectiveTo,
          page: nextPage,
          perPage: PAGE_SIZE,
          type: focus?.salesOnly ? 'all' : type,
          q: search,
          staffId: focus?.staffId,
          unassignedOutlet: focus?.unassignedOutlet,
          unassignedStaff: focus?.unassignedStaff,
          hour: focus?.hour,
          salesOnly: focus?.salesOnly,
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
    [effectiveBranchId, effectiveFrom, effectiveTo, type, search, focus?.staffId, focus?.unassignedOutlet, focus?.unassignedStaff, focus?.hour, focus?.salesOnly]
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
      const rows = await collectLedger({ branchId: effectiveBranchId, from: effectiveFrom, to: effectiveTo, type: focus?.salesOnly ? 'all' : type, q: search, staffId: focus?.staffId, unassignedOutlet: focus?.unassignedOutlet, unassignedStaff: focus?.unassignedStaff, hour: focus?.hour, salesOnly: focus?.salesOnly });
      if (!rows.length) return;
      await shareCsv(`risev-transactions-${effectiveFrom}_${effectiveTo}.csv`, buildLedgerCsv(rows));
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
              <Text style={styles.title}>{focus?.title || 'Transactions'}</Text>
              <Text style={styles.subtitle}>
                {total.toLocaleString('en-MY')} recorded · {focus?.from || focus?.to ? `${effectiveFrom}–${effectiveTo}` : periodLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={exportCsv} style={styles.iconBtn} disabled={exporting} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Export transactions">
              {exporting ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons name="download-outline" size={17} color={colors.black} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close transactions">
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

          {!focus?.salesOnly ? <ScrollView horizontal style={styles.typeScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typePill, type === t.id && styles.typePillActive]}
                onPress={() => setType(t.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t.id }}
              >
                <Text style={[styles.typePillText, type === t.id && styles.typePillTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView> : null}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 10 }}>
            {items.map((row) => {
              const isRedeem = row.type === 'redeem';
              const isAdjust = row.type === 'adjust';
              const impact = compactImpact(row);
              const detail = [row.branchName || 'HQ', row.staffName || null, row.voucherCode || null]
                .filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  key={row.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => setDetail(row)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.customerName}, ${TYPE_LABEL[row.type] || row.type}, ${formatLedgerImpact(row)}`}
                >
                  <View style={styles.rowContent}>
                    <View style={[styles.eventIcon, isRedeem && styles.eventIconRedeem, isAdjust && styles.eventIconAdjust]}>
                      <Ionicons
                        name={isRedeem ? 'gift-outline' : isAdjust ? 'options-outline' : 'receipt-outline'}
                        size={19}
                        color={colors.black}
                      />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>{row.customerName}</Text>
                      <Text style={styles.rowWhen}>
                        {formatShortDateFromIso(row.created)} · {formatLocalTimeFromIso(row.created)}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.amount} numberOfLines={2}>{impact}</Text>
                      {row.billCents > 0 && (row.stamps !== 0 || row.points !== 0) ? (
                        <Text style={styles.impactMeta} numberOfLines={1}>
                          {[
                            row.stamps ? `${row.stamps > 0 ? '+' : ''}${row.stamps} st` : null,
                            row.points ? `${row.points > 0 ? '+' : ''}${row.points} pts` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.rowDetails}>
                    <View style={[styles.tag, isRedeem && styles.tagRedeem, isAdjust && styles.tagAdjust]}>
                      <Text style={[styles.tagText, isRedeem && styles.tagTextRedeem, isAdjust && styles.tagTextAdjust]}>
                        {TYPE_LABEL[row.type] || row.type}
                      </Text>
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>{detail}</Text>
                    {row.hasReceipt && <TouchableOpacity onPress={(event) => { event.stopPropagation(); openPaidReceipt(row.id); }} accessibilityRole="button" accessibilityLabel={`View receipt for ${row.customerName}`} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FFF3B5' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#111' }}>{receiptBusyId === row.id ? 'Loading…' : 'Receipt'}</Text>
                    </TouchableOpacity>}
                  </View>
                </TouchableOpacity>
              );
            })}

            {!!receiptError && <Text style={styles.errorText}>{receiptError}</Text>}
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
          <ThermalReceiptScreen visible={!!paidReceipt} receipt={paidReceipt} mode="merchant" onClose={() => setPaidReceipt(null)} />
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
    paddingHorizontal: 18,
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
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    height: 44,
    borderRadius: radii.full,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: colors.black,
    outlineWidth: 0,
  } as any,
  typeScroll: { flexGrow: 0, height: 52 },
  typeRow: { gap: 6, alignItems: 'center', paddingVertical: 6 },
  typePill: {
    paddingHorizontal: 12,
    height: 38,
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF3',
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF5CB', alignItems: 'center', justifyContent: 'center' },
  eventIconRedeem: { backgroundColor: '#F2F4F7' },
  eventIconAdjust: { backgroundColor: '#FEF2F2' },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.black },
  rowWhen: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#64748B', marginTop: 3 },
  rowDetails: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, marginLeft: 52 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
  },
  tagRedeem: { backgroundColor: '#FFFBEA' },
  tagAdjust: { backgroundColor: '#FEF2F2' },
  tagText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#334155' },
  tagTextRedeem: { color: '#B45309' },
  tagTextAdjust: { color: '#B91C1C' },
  rowMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748B', flex: 1, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', width: 112, flexShrink: 0 },
  amount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.black, textAlign: 'right' },
  impactMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#64748B', marginTop: 3, textAlign: 'right' },
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
