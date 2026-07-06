import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

const { width } = Dimensions.get('window');

type ActivityItem = {
  id: string;
  name: string;
  avatar: string;
  date: string;
  amount: string;
  stamps: number;
  status?: 'Pending' | 'Success';
};

export default function MerchantDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'Today' | 'This Week' | 'This Month'>('Today');
  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMerchantData = async () => {
    if (!user || !user.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      // 1. Fetch merchant details
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      // 2. Fetch recent transactions
      const txs = await pb.collection('transactions').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        expand: 'customer',
        sort: '-created'
      });
      setTransactions(txs);
    } catch (err) {
      console.warn('Failed to fetch merchant dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantData();

    // Subscribe to new transactions
    if (user && user.merchant_id) {
      pb.collection('transactions').subscribe('*', () => {
        fetchMerchantData();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      });
    }

    return () => {
      pb.collection('transactions').unsubscribe('*');
    };
  }, [user]);

  // Aggregate stats
  const totalStampsAwarded = transactions.reduce((acc, tx) => acc + (tx.stamps || 0), 0);

  // Filter transactions based on date
  const getFilteredTransactions = () => {
    const now = new Date();
    return transactions.filter(tx => {
      const txDate = new Date(tx.created);
      const diffTime = Math.abs(now.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (activeFilter === 'Today') {
        return diffDays <= 1;
      } else if (activeFilter === 'This Week') {
        return diffDays <= 7;
      } else {
        return diffDays <= 30;
      }
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // Stamps progress for the month (goal: 5000 stamps)
  const monthlyGoal = 5000;
  const stampsThisMonth = transactions
    .filter(tx => {
      const txDate = new Date(tx.created);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((acc, tx) => acc + (tx.stamps || 0), 0);

  const progressPercentage = Math.min((stampsThisMonth / monthlyGoal) * 100, 100);
  const remainingStamps = Math.max(monthlyGoal - stampsThisMonth, 0);

  const mappedActivities: ActivityItem[] = filteredTransactions.map((tx: any) => {
    const cust = tx.expand?.customer;
    return {
      id: tx.id,
      name: cust?.name || 'Walk-in Customer',
      avatar: cust?.avatar 
        ? `${pb.baseUrl}/api/files/_pb_users_auth_/${cust.id}/${cust.avatar}`
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      date: new Date(tx.created).toLocaleDateString(),
      amount: tx.metadata?.amount ? `$${tx.metadata.amount.toFixed(2)}` : '$0.00',
      stamps: tx.stamps || 0,
      status: tx.type === 'adjust' ? 'Pending' : 'Success'
    };
  });

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Scrollable Dashboard View */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Merchant Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ 
              uri: merchant?.logo 
                ? pb.files.getURL(merchant, merchant.logo)
                : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' 
            }}
            style={styles.merchantAvatar}
          />
          <View style={styles.profileTextWrap}>
            <Text style={styles.welcomeSub}>Welcome back</Text>
            <Text style={styles.merchantName}>{merchant?.name || 'Boutique Royal'}</Text>
          </View>
        </View>

        {/* Total Stamp Issued Metric Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceTextWrap}>
              <Text style={styles.balanceLabel}>Total Stamps Awarded</Text>
              <Text style={styles.balanceValue}>
                {loading ? '...' : totalStampsAwarded.toLocaleString()}
              </Text>
            </View>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
            </View>
          </View>

          {/* Connect/Scan Quick Action Button inside card */}
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => router.push('/(merchant)/give')}
            activeOpacity={0.9}
          >
            <Ionicons name="qr-code-outline" size={16} color="#000000" />
            <Text style={styles.scanBtnText}>Scan Customer QR</Text>
          </TouchableOpacity>
        </View>

        {/* Goal Progress Card (Matches the goal/rewards limit progress card) */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>This Month's Goal</Text>
            <Ionicons name="trending-up" size={18} color="#000000" />
          </View>

          <Text style={styles.progressStats}>
            {loading ? '...' : stampsThisMonth.toLocaleString()} <Text style={styles.progressStatsMax}>/ {monthlyGoal.toLocaleString()} stamps</Text>
          </Text>

          {/* Sleek Progress Fill Bar */}
          <View style={styles.barContainer}>
            <View style={[styles.barFill, { width: `${progressPercentage}%` }]} />
          </View>

          <Text style={styles.remainingText}>
            {loading ? '...' : `${remainingStamps.toLocaleString()} stamps to go!`}
          </Text>
        </View>

        {/* Recent Stamps List section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Stamps Issued</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Capsule Filter Buttons */}
        <View style={styles.filtersRow}>
          {(['Today', 'This Week', 'This Month'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterBtn,
                activeFilter === filter && styles.filterBtnActive,
              ]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity List cards (Matches Whole Foods & CVS Pharmacy cards style) */}
        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
          ) : mappedActivities.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons name="receipt-outline" size={40} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>No Recent Activities</Text>
              <Text style={styles.emptyStateSubtitle}>
                Stamps issued during this period will show up here.
              </Text>
            </View>
          ) : (
            mappedActivities.map((item) => (
              <View key={item.id} style={styles.activityCard}>
                <Image source={{ uri: item.avatar }} style={styles.customerAvatar} />
                
                <View style={styles.activityDetails}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName}>{item.name}</Text>
                    {item.status === 'Pending' && (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingText}>Pending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.activityDate}>{item.date}</Text>
                </View>

                <View style={styles.amountCol}>
                  <Text style={styles.stampDelta}>+{item.stamps} stamps</Text>
                  <Text style={styles.transAmount}>{item.amount}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Unified white background
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileTextWrap: {
    gap: 2,
  },
  welcomeSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  merchantName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  balanceCard: {
    backgroundColor: '#000000', // Carbon black card
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTextWrap: {
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  balanceValue: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  walletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 46,
    gap: 8,
  },
  scanBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#565e74',
  },
  progressStats: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  progressStatsMax: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#9CA3AF',
  },
  barContainer: {
    height: 8,
    backgroundColor: '#F1F5F9', // Light gray background progress bar
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#000000', // Black progress fill
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#737686',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9CA3AF',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#565e74',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    gap: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityDetails: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  pendingBadge: {
    backgroundColor: '#F1F5F9', // Minimalist gray pending badge
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  activityDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  stampDelta: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Black stamps counter text
  },
  transAmount: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#737686',
  },
  emptyStateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
    width: '100%',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
