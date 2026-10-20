import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { workspacePeriods, AudienceCard } from '@/lib/customer-workspace';
import { useCustomerWorkspace } from '@/components/customer-workspace/useCustomerWorkspace';
import OverviewTab from '@/components/customer-workspace/OverviewTab';
import ActionsTab from '@/components/customer-workspace/ActionsTab';
import ReportsTab from '@/components/customer-workspace/ReportsTab';
import AudienceSheet from '@/components/customer-workspace/AudienceSheet';

type MainTab = 'overview' | 'actions' | 'reports';

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'actions', label: 'Actions' },
  { id: 'reports', label: 'Reports' },
];

export default function CustomerWorkspaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const periods = useMemo(() => workspacePeriods(), []);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [audienceCard, setAudienceCard] = useState<AudienceCard | null>(null);
  const [picker, setPicker] = useState<'branch' | 'period' | null>(null);

  const period = periods[periodIndex];
  const { snapshot, loading, error, retry } = useCustomerWorkspace(branchId, period);

  const branchLabel = branchId
    ? snapshot?.branches.find((b) => b.id === branchId)?.name || 'Outlet'
    : 'All Branches';

  const goActivity = () => router.push('/(merchant)/customer-activity' as any);
  const goAnalytics = () => router.push('/(merchant)/analytics' as any);

  // Share your store: the existing join link, no messaging involved.
  const shareStore = async () => {
    if (!snapshot) return;
    const link = `https://risev.app/join?m=${snapshot.merchant.id}${branchId ? `&b=${branchId}` : ''}`;
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Join link copied', link);
    } catch {
      Alert.alert('Join link', link);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MerchantMark snapshot={snapshot} fallbackName={user?.name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKicker}>Customer Analytics</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {snapshot?.merchant.name || user?.name || 'Your store'}
              </Text>
            </View>
          </View>
          <Image
            source={require('../../assets/risev logo.png')}
            style={styles.risevWordmark}
          />
        </View>

        {/* ── Scope pills ── */}
        <View style={styles.scopeRow}>
          <TouchableOpacity style={styles.scopePill} activeOpacity={0.85} onPress={() => setPicker('branch')}>
            <Ionicons name="business-outline" size={13} color="#475569" />
            <Text style={styles.scopeText} numberOfLines={1}>
              {branchLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#686868" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.scopePill} activeOpacity={0.85} onPress={() => setPicker('period')}>
            <Ionicons name="calendar-outline" size={13} color="#475569" />
            <Text style={styles.scopeText} numberOfLines={1}>
              {period.label}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#686868" />
          </TouchableOpacity>
        </View>

        {/* ── Main segments ── */}
        <View style={styles.tabBar}>
          {MAIN_TABS.map((tab) => {
            const active = mainTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setMainTab(tab.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Body ── */}
        {loading && !snapshot ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.black} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.black} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.85}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : snapshot ? (
          <>
            {mainTab === 'overview' && (
              <OverviewTab
                snapshot={snapshot}
                periodLabel={period.label}
                onOpenReport={() => setMainTab('reports')}
              />
            )}
            {mainTab === 'actions' && (
              <ActionsTab
                snapshot={snapshot}
                onOpenAudience={setAudienceCard}
                onShareStore={shareStore}
                onOpenReports={() => setMainTab('reports')}
              />
            )}
            {mainTab === 'reports' && (
              <ReportsTab
                snapshot={snapshot}
                periodLabel={period.label}
                onOpenActivity={goActivity}
                onOpenAnalytics={goAnalytics}
              />
            )}
          </>
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* ── Scope pickers ── */}
      <PickerSheet
        visible={picker !== null}
        title={picker === 'branch' ? 'Select branch' : 'Select period'}
        options={
          picker === 'branch'
            ? [
                { id: '', label: 'All Branches' },
                ...(snapshot?.branches || []).map((b) => ({ id: b.id, label: b.name })),
              ]
            : periods.map((p, i) => ({ id: String(i), label: p.label }))
        }
        selectedId={picker === 'branch' ? branchId : String(periodIndex)}
        onSelect={(id) => {
          if (picker === 'branch') setBranchId(id);
          else setPeriodIndex(Number(id) || 0);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      {snapshot && audienceCard ? (
        <AudienceSheet
          visible
          card={audienceCard}
          merchantId={snapshot.merchant.id}
          merchantName={snapshot.merchant.name}
          branchId={branchId}
          total={
            audienceCard === 'birthday'
              ? snapshot.birthdays
              : audienceCard === 'rewards'
                ? snapshot.loyalty.nearReward
                : snapshot.attention.find((a) => a.id === audienceCard)?.count ?? 0
          }
          onClose={() => setAudienceCard(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function MerchantMark({
  snapshot,
  fallbackName,
}: {
  snapshot: ReturnType<typeof useCustomerWorkspace>['snapshot'];
  fallbackName?: string;
}) {
  if (snapshot?.merchant.logo) {
    return (
      <Image
        source={{
          uri: `${pb.baseUrl}/api/files/merchants/${snapshot.merchant.id}/${snapshot.merchant.logo}`,
        }}
        style={styles.logo}
      />
    );
  }
  const initial = (snapshot?.merchant.name || fallbackName || 'R').trim()[0]?.toUpperCase() || 'R';
  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <Text style={styles.logoInitial}>{initial}</Text>
    </View>
  );
}

function PickerSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 340 }}>
            {options.map((o) => {
              const active = o.id === selectedId;
              return (
                <TouchableOpacity
                  key={o.id || 'all'}
                  style={styles.optionRow}
                  activeOpacity={0.85}
                  onPress={() => onSelect(o.id)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={16} color={colors.black} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    ...(Platform.OS === 'web' ? ({ maxWidth: 840, alignSelf: 'center', width: '100%' } as any) : {}),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F6F6F6' },
  logoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFCC00' },
  logoInitial: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111' },
  headerKicker: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  headerName: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.5,
  },
  risevWordmark: { width: 56, height: 20, resizeMode: 'contain', tintColor: '#111111' },
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    backgroundColor: colors.white,
  },
  scopeText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: radii.full,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.full },
  tabBtnActive: { backgroundColor: '#111111' },
  tabText: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#686868' },
  tabTextActive: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' },
  center: { paddingVertical: 60, alignItems: 'center' },
  errorCard: {
    borderWidth: 1,
    borderColor: '#E9E9E9',
    borderRadius: radii.xl,
    padding: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    lineHeight: 19,
  },
  retryBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 22 : 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },
  optionText: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#334155', flex: 1 },
  optionTextActive: { fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
});
