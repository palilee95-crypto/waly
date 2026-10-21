import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { handleSmartBack } from '@/lib/navigation';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme';
import {
  fetchManageCustomers,
  type ManageCustomerRow,
  type ManageFilter,
  type ManageSort,
} from '@/lib/customer-management';
import CustomerListRow from '@/components/customer-workspace/manage/CustomerListRow';
import CustomerManagePanel from '@/components/customer-workspace/manage/CustomerManagePanel';
import CustomerWhatsAppComposer from '@/components/customer-workspace/manage/CustomerWhatsAppComposer';
import CustomerVisitDatePicker, { formatVisitDate, malaysiaToday, shiftVisitDate } from '@/components/customer-workspace/manage/CustomerVisitDatePicker';

type Branch = { id: string; name: string; is_hq?: boolean };
type Picker = 'branch' | 'sort' | null;

const PER_PAGE = 25;

const FILTERS: { id: ManageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'near_reward', label: 'Near reward' },
  { id: 'new', label: 'New' },
];

const SORTS: { id: ManageSort; label: string }[] = [
  { id: 'last_visit', label: 'Last visit' },
  { id: 'name', label: 'Name' },
  { id: 'visits', label: 'Visits' },
  { id: 'spend', label: 'Spend' },
];

export default function ManageCustomersScreen() {
  const router = useRouter();
  const { user, isOwner, staffPermissions } = useAuth();
  const canManage = !!isOwner || !!staffPermissions?.can_manage_customers;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [items, setItems] = useState<ManageCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<ManageFilter>('all');
  const [sort, setSort] = useState<ManageSort>('last_visit');
  const [branchId, setBranchId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [messageCustomer, setMessageCustomer] = useState<ManageCustomerRow | null>(null);
  const [messageNotice, setMessageNotice] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const merchantId = user?.merchant_id || String((pb.authStore.record as any)?.merchant_id || '');
    if (!merchantId) return;
    pb.collection('branches')
      .getFullList<Branch>({
        filter: `merchant = "${merchantId}"`,
        sort: '-is_hq,-created',
        requestKey: null,
      })
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [user?.merchant_id]);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      const requestId = ++requestRef.current;
      if (replace) {
        setLoading(true);
        setItems([]);
        setTotal(0);
      }
      else setLoadingMore(true);
      setError('');
      try {
        const result = await fetchManageCustomers({
          branchId,
          date: visitDate,
          q: debouncedQuery,
          sort,
          filter,
          page: targetPage,
          perPage: PER_PAGE,
        });
        if (requestId !== requestRef.current) return;
        setItems((current) => (replace ? result.items : [...current, ...result.items]));
        setTotal(result.total);
        setPage(targetPage);
        if (replace && isDesktop) {
          setSelectedId((current) => {
            if (current && result.items.some((row) => row.id === current)) return current;
            return result.items[0]?.id || null;
          });
        }
      } catch (err: any) {
        if (requestId === requestRef.current) {
          const raw = String(err?.data?.message || err?.message || '');
          setError(
            err?.status === 404 || /file not found/i.test(raw)
              ? 'Manage customers is not available on this server yet. Deploy the latest backend, then retry.'
              : raw || 'Could not load customers.'
          );
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [branchId, visitDate, debouncedQuery, sort, filter, isDesktop]
  );

  useFocusEffect(
    useCallback(() => {
      load(1, true);
    }, [load])
  );

  const loadMore = () => {
    if (loading || loadingMore || items.length >= total) return;
    load(page + 1, false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const branchLabel = useMemo(() => {
    if (!isOwner && user?.branch_name) return user.branch_name;
    return branches.find((branch) => branch.id === branchId)?.name || 'All outlets';
  }, [branches, branchId, isOwner, user?.branch_name]);
  const sortLabel = SORTS.find((option) => option.id === sort)?.label || 'Last visit';

  const openCustomer = (row: ManageCustomerRow) => {
    if (isDesktop) {
      setSelectedId(row.id);
    } else {
      router.push({
        pathname: '/(merchant)/customer-detail',
        params: { customerId: row.id, ...(visitDate ? { visitDate, visitsOnDate: String(row.visitsOnDate) } : {}) },
      } as any);
    }
  };

  const pickerOptions = picker === 'branch'
    ? [{ id: '', label: 'All outlets' }, ...branches.map((branch) => ({ id: branch.id, label: branch.name }))]
    : SORTS;
  const pickerSelected = picker === 'branch' ? branchId : sort;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => handleSmartBack(router, '/(merchant)/customers')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Back to customers"
        >
          <Ionicons name="arrow-back" size={iconSizes.lg} color={colors.black} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Manage customers</Text>
          <Text style={styles.subtitle}>
            {loading && items.length === 0 ? 'Loading…' : visitDate
              ? `${total.toLocaleString('en-MY')} visited · ${formatVisitDate(visitDate)}`
              : `${total.toLocaleString('en-MY')} customers · ${branchLabel}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRefresh}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Refresh customers"
        >
          <Ionicons name="refresh" size={iconSizes.md} color={colors.accent[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search" size={iconSizes.sm} color={colors.accent[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or phone"
            placeholderTextColor={colors.accent[400]}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={iconSizes.sm} color={colors.accent[400]} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.dateRow}>
          {visitDate ? (
            <TouchableOpacity style={styles.dateStep} onPress={() => setVisitDate(shiftVisitDate(visitDate, -1))} accessibilityRole="button" accessibilityLabel="Previous day">
              <Ionicons name="chevron-back" size={17} color={colors.black} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.dateButton, visitDate && styles.dateButtonActive]} onPress={() => setDatePickerOpen(true)} accessibilityRole="button" accessibilityLabel={visitDate ? `Visit date ${formatVisitDate(visitDate)}. Choose another date` : 'Choose a visit date'}>
            <Ionicons name="calendar-outline" size={17} color={colors.black} />
            <Text style={styles.dateText} numberOfLines={1}>{visitDate ? `Visited · ${formatVisitDate(visitDate)}` : 'All visit dates'}</Text>
            <Ionicons name="chevron-down" size={15} color={colors.accent[500]} />
          </TouchableOpacity>
          {visitDate ? (
            <TouchableOpacity style={styles.dateStep} onPress={() => setVisitDate(shiftVisitDate(visitDate, 1))} disabled={visitDate >= malaysiaToday()} accessibilityRole="button" accessibilityLabel="Next day">
              <Ionicons name="chevron-forward" size={17} color={visitDate >= malaysiaToday() ? colors.accent[300] : colors.black} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.controlRow}>
          {isOwner ? (
            <TouchableOpacity style={styles.controlPill} onPress={() => setPicker('branch')} activeOpacity={0.8}>
              <Ionicons name="business-outline" size={iconSizes.sm} color={colors.accent[500]} />
              <Text style={styles.controlText} numberOfLines={1}>{branchLabel}</Text>
              <Ionicons name="chevron-down" size={iconSizes.sm} color={colors.accent[400]} />
            </TouchableOpacity>
          ) : (
            <View style={styles.controlPill}>
              <Ionicons name="business-outline" size={iconSizes.sm} color={colors.accent[500]} />
              <Text style={styles.controlText} numberOfLines={1}>{branchLabel}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.controlPill} onPress={() => setPicker('sort')} activeOpacity={0.8}>
            <Ionicons name="swap-vertical" size={iconSizes.sm} color={colors.accent[500]} />
            <Text style={styles.controlText} numberOfLines={1}>{sortLabel}</Text>
            <Ionicons name="chevron-down" size={iconSizes.sm} color={colors.accent[400]} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(option.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {visitDate ? <Text style={styles.dateHint}>Showing recorded visits on this day. Loyalty and spend figures remain lifetime totals; segments reflect current status.</Text> : null}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={iconSizes.sm} color={colors.error.dark} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} activeOpacity={0.75}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {messageNotice ? <Text style={styles.messageNotice}>{messageNotice}</Text> : null}

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <View style={[styles.listCard, isDesktop && styles.listCardDesktop]}>
          {loading && items.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.black} />
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CustomerListRow
                  row={item}
                  visitDate={visitDate}
                  selected={isDesktop && selectedId === item.id}
                  onPress={() => openCustomer(item)}
                  onWhatsApp={() => setMessageCustomer(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={error ? null :
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={iconSizes.xl} color={colors.accent[300]} />
                  <Text style={styles.emptyTitle}>No customers found</Text>
                  <Text style={styles.emptyText}>
                    {visitDate
                      ? `No recorded customer visits on ${formatVisitDate(visitDate)} for these filters. Try another day or choose All dates.`
                      : query || filter !== 'all'
                        ? 'Try a different search or filter.'
                      : 'Customers will appear here after their first visit.'}
                  </Text>
                </View>
              }
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator color={colors.accent[400]} style={styles.footerSpinner} />
                ) : null
              }
            />
          )}
        </View>

        {isDesktop ? (
          <View style={styles.detailCol}>
            {selectedId ? (
              <CustomerManagePanel
                customerId={selectedId}
                visitDate={visitDate}
                visitsOnDate={items.find((row) => row.id === selectedId)?.visitsOnDate}
                onChanged={() => load(1, true)}
                onDeleted={() => {
                  setSelectedId(null);
                  load(1, true);
                }}
              />
            ) : (
              <View style={styles.emptyDetail}>
                <Ionicons name="person-circle-outline" size={iconSizes.display} color={colors.accent[300]} />
                <Text style={styles.emptyTitle}>Select a customer</Text>
                <Text style={styles.emptyText}>Choose a customer from the list to manage their profile, stamps, points and vouchers.</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPicker(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{picker === 'branch' ? 'Select outlet' : 'Sort customers'}</Text>
            {pickerOptions.map((option) => {
              const active = pickerSelected === option.id;
              return (
                <TouchableOpacity
                  key={option.id || 'all'}
                  style={styles.sheetRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (picker === 'branch') setBranchId(option.id);
                    else setSort(option.id as ManageSort);
                    setPicker(null);
                  }}
                >
                  <Text style={[styles.sheetOption, active && styles.sheetOptionActive]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark" size={iconSizes.md} color={colors.black} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
      <CustomerVisitDatePicker
        visible={datePickerOpen}
        value={visitDate}
        onSelect={(date) => { setVisitDate(date); setFilter('all'); }}
        onClose={() => setDatePickerOpen(false)}
      />
      <CustomerWhatsAppComposer
        visible={!!messageCustomer}
        customerId={messageCustomer?.id || null}
        onClose={() => setMessageCustomer(null)}
        onOpened={() => setMessageNotice('Opened in WhatsApp. Risev cannot confirm whether the message was sent.')}
        onIssueVoucher={canManage ? () => {
          if (!messageCustomer) return;
          router.push({ pathname: '/(merchant)/customer-detail', params: { customerId: messageCustomer.id, issueVoucher: '1' } } as any);
          setMessageCustomer(null);
        } : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.accent[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, letterSpacing: -0.5, color: colors.black },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: colors.accent[500], marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },

  toolbar: {
    marginHorizontal: spacing[4],
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[3],
    gap: spacing[2],
    ...shadows.sm,
  },
  dateRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  dateButton: { flex: 1, minHeight: 44, paddingHorizontal: spacing[3], borderRadius: radii.md, backgroundColor: colors.accent[50], borderWidth: 1, borderColor: colors.accent[100], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateButtonActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  dateText: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.black },
  dateStep: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.accent[50], borderWidth: 1, borderColor: colors.accent[100], alignItems: 'center', justifyContent: 'center' },
  dateHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 15, color: colors.accent[500] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 42,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingVertical: 0,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: colors.black,
  },
  controlRow: { flexDirection: 'row', gap: spacing[2] },
  controlPill: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  controlText: { flexShrink: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.accent[700] },
  filters: { flexDirection: 'row', gap: spacing[2], paddingVertical: 1 },
  filterChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radii.full, backgroundColor: colors.accent[50] },
  filterChipActive: { backgroundColor: colors.black },
  filterText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: colors.accent[700] },
  filterTextActive: { color: colors.white, fontFamily: 'PlusJakartaSans_700Bold' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.error.light,
  },
  messageNotice: { marginHorizontal: spacing[4], marginTop: spacing[2], padding: spacing[3], borderRadius: radii.md, backgroundColor: colors.success.light, color: colors.success.dark, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  errorText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: colors.error.dark },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.error.dark },

  content: { flex: 1, marginTop: spacing[3], marginHorizontal: spacing[4] },
  contentDesktop: { flexDirection: 'row', gap: spacing[3] },
  listCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    overflow: 'hidden',
    ...shadows.sm,
  },
  listCardDesktop: { flex: 0, width: 390 },
  list: { flex: 1 },
  listContent: { padding: spacing[2], paddingBottom: spacing[8] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerSpinner: { paddingVertical: spacing[3] },
  detailCol: { flex: 1, minWidth: 0 },
  emptyDetail: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[2] },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[10], gap: spacing[2] },
  emptyTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.black },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: colors.accent[500], textAlign: 'center', maxWidth: 280 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[1],
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.accent[200], alignSelf: 'center', marginBottom: spacing[3] },
  sheetTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.black, marginBottom: spacing[2] },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.accent[50] },
  sheetOption: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: colors.accent[700] },
  sheetOptionActive: { fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
});
