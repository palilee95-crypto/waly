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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { workspacePeriods } from '@/lib/customer-workspace';
import { useCustomerWorkspace } from '@/components/customer-workspace/useCustomerWorkspace';
import OverviewTab from '@/components/customer-workspace/OverviewTab';
import ReportsTab from '@/components/customer-workspace/ReportsTab';

type MainTab = 'overview' | 'reports';

export default function CustomerWorkspaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const periods = useMemo(() => workspacePeriods(), []);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('overview');

  const period = periods[periodIndex];
  const { snapshot, loading, error, retry } = useCustomerWorkspace(branchId, period);

  const scopeLabel = useMemo(() => {
    if (!snapshot) return branchId ? 'Outlet' : 'All outlets';
    if (!branchId) return 'All outlets';
    return snapshot.branches.find((b) => b.id === branchId)?.name || 'Outlet';
  }, [snapshot, branchId]);

  const goActivity = () => router.push('/(merchant)/customer-activity' as any);
  const goAnalytics = () => router.push('/(merchant)/analytics' as any);
  const goUpgrade = () => router.push('/(merchant)/subscription' as any);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Merchant identity — the workspace's own header, no promotional hero */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={{
                uri: snapshot
                  ? `${pb.baseUrl}/api/files/merchants/${snapshot.merchant.id}/logo`
                  : undefined,
              }}
              style={styles.logo}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKicker}>Customers</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {snapshot?.merchant.name || user?.name || 'Your store'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction} onPress={goActivity} activeOpacity={0.85}>
            <Ionicons name="list-outline" size={18} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* Branch scope */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <TouchableOpacity
            style={[styles.pill, !branchId && styles.pillActive]}
            onPress={() => setBranchId('')}
            activeOpacity={0.85}
          >
            <Text style={[styles.pillText, !branchId && styles.pillTextActive]}>All outlets</Text>
          </TouchableOpacity>
          {(snapshot?.branches || []).map((branch) => {
            const active = branchId === branch.id;
            return (
              <TouchableOpacity
                key={branch.id}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setBranchId(branch.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
                  {branch.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Period */}
        <View style={styles.periodRow}>
          {periods.map((p, i) => {
            const active = i === periodIndex;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.periodBtn, active && styles.periodBtnActive]}
                onPress={() => setPeriodIndex(i)}
                activeOpacity={0.85}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Main tabs */}
        <View style={styles.tabBar}>
          {(['overview', 'reports'] as MainTab[]).map((tab) => {
            const active = mainTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setMainTab(tab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab === 'overview' ? 'Overview' : 'Reports'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Body */}
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
          mainTab === 'overview' ? (
            <OverviewTab
              snapshot={snapshot}
              periodLabel={period.label}
              scopeLabel={scopeLabel}
              onOpenCustomers={goActivity}
              onOpenReport={(report) => {
                if (report === 'bookings') {
                  setMainTab('reports');
                } else {
                  goActivity();
                }
              }}
            />
          ) : (
            <ReportsTab
              snapshot={snapshot}
              entitled={snapshot.entitlements.reports}
              onUpgrade={goUpgrade}
              onOpenActivity={goActivity}
              onOpenAnalytics={goAnalytics}
            />
          )
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
    ...(Platform.OS === 'web' ? ({ maxWidth: 840, alignSelf: 'center', width: '100%' } as any) : {}),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F6F6F6' },
  headerKicker: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#686868',
    letterSpacing: 0.4,
  },
  headerName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    backgroundColor: colors.white,
    maxWidth: 190,
  },
  pillActive: { backgroundColor: colors.black, borderColor: colors.black },
  pillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#686868' },
  pillTextActive: { color: colors.white, fontFamily: 'PlusJakartaSans_700Bold' },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#F6F6F6', borderColor: '#E9E9E9' },
  periodText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#686868' },
  periodTextActive: { color: colors.black, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: radii.full,
    padding: 4,
    marginTop: 2,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.full },
  tabBtnActive: { backgroundColor: '#FFCC00' },
  tabText: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8' },
  tabTextActive: { color: '#050505', fontFamily: 'PlusJakartaSans_800ExtraBold' },
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
});
