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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
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
  customerId?: string;
};

export default function MerchantDashboard() {
  const { user, refreshSession } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<'Today' | 'This Week' | 'This Month'>('Today');
  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Helper to determine trial status
  const getTrialStatus = () => {
    if (user?.merchant_status === 'pending' && user?.merchant_created) {
      const createdTime = new Date(user.merchant_created).getTime();
      const now = new Date().getTime();
      const diffMs = now - createdTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays < 7) {
        return {
          isInTrial: true,
          daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
        };
      }
    }
    return { isInTrial: false, daysRemaining: 0 };
  };

  const { isInTrial, daysRemaining: trialDaysRemaining } = getTrialStatus();

  const handleUpgradePress = async () => {
    const message = `Hello, I'd like to manually upgrade my RISEV Merchant Pro subscription for my store (Merchant ID: ${user?.merchant_id || 'N/A'}).`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/601110209669?text=${encodedMessage}`;
    
    try {
      await Linking.openURL(whatsappUrl);
    } catch (err) {
      alert('Could not open WhatsApp. Please contact 01110209669 manually.');
    }
  };

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

  // Sales progress for the month (configurable goal stored in merchant metadata, defaults to 10000)
  const monthlySalesGoal = Number(merchant?.metadata?.monthly_sales_goal) || 10000;
  const salesThisMonth = transactions
    .filter(tx => {
      if (tx.type !== 'earn') return false;
      const txDate = new Date(tx.created);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((acc, tx) => {
      const amt = tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
      return acc + Number(amt);
    }, 0);

  const salesProgressPercentage = Math.min((salesThisMonth / monthlySalesGoal) * 100, 100);
  const remainingSales = Math.max(monthlySalesGoal - salesThisMonth, 0);

  const mappedActivities: ActivityItem[] = filteredTransactions.map((tx: any) => {
    const cust = tx.expand?.customer;
    const billAmt = tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
    return {
      id: tx.id,
      name: cust?.name || 'Walk-in Customer',
      avatar: cust?.avatar 
        ? `${pb.baseUrl}/api/files/_pb_users_auth_/${cust.id}/${cust.avatar}`
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      date: new Date(tx.created).toLocaleDateString(),
      amount: billAmt > 0 ? `RM ${Number(billAmt).toFixed(2)}` : 'RM 0.00',
      stamps: tx.stamps || 0,
      status: tx.type === 'adjust' ? 'Pending' : 'Success',
      customerId: cust?.id || ''
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{ 
                uri: merchant?.logo 
                  ? pb.files.getURL(merchant, merchant.logo)
                  : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' 
              }}
              style={styles.merchantAvatar}
            />
            <View style={styles.profileTextWrap}>
              <Text style={styles.welcomeSub}>{t('welcome_back')}</Text>
              <Text style={styles.merchantName}>{merchant?.name || 'Boutique Royal'}</Text>
            </View>
          </View>
          <Image
            source={require('../../theme/rise_officiallogo.png')}
            style={{ width: 110, height: 38, resizeMode: 'contain' }}
          />
        </View>

        {isInTrial && (
          <View style={styles.trialBanner}>
            <View style={styles.trialBannerContent}>
              <View style={styles.trialIconWrap}>
                <Ionicons name="sparkles" size={20} color="#D97706" />
              </View>
              <View style={styles.trialTextWrap}>
                <Text style={styles.trialTitle}>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'Day' : 'Days'} Left on Free Trial
                </Text>
                <Text style={styles.trialSubtitle}>
                  You are currently using the 7-day Free Trial of Merchant Pro. Upgrade today to ensure uninterrupted access.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.trialUpgradeBtn}
              onPress={handleUpgradePress}
              activeOpacity={0.9}
            >
              <Text style={styles.trialUpgradeBtnText}>Upgrade via WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Total Stamp Issued Metric Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceTextWrap}>
              <Text style={styles.balanceLabel}>{t('total_stamps_awarded')}</Text>
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
            <Text style={styles.scanBtnText}>{t('scan_customer_qr')}</Text>
          </TouchableOpacity>
        </View>

        {/* Goal Progress Card (Matches the goal/rewards limit progress card) */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t('this_months_sales')}</Text>
            <Ionicons name="trending-up" size={18} color="#000000" />
          </View>

          <Text style={styles.progressStats}>
            {loading ? (
              '...'
            ) : (
              `RM ${salesThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}{' '}
            <Text style={styles.progressStatsMax}>/ RM {monthlySalesGoal.toLocaleString()} {t('goal')}</Text>
          </Text>

          {/* Sleek Progress Fill Bar */}
          <View style={styles.barContainer}>
            <View style={[styles.barFill, { width: `${salesProgressPercentage}%` }]} />
          </View>

          <Text style={styles.remainingText}>
            {loading
              ? '...'
              : `RM ${remainingSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('to_go')}`}
          </Text>
        </View>

        {/* Recent Stamps List section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('recent_stamps_issued')}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>{t('see_all')}</Text>
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
                {t(filter.toLowerCase().replace(' ', '_'))}
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
              <Text style={styles.emptyStateTitle}>{t('no_recent_activities')}</Text>
              <Text style={styles.emptyStateSubtitle}>
                {t('stamps_issued_desc')}
              </Text>
            </View>
          ) : (
            mappedActivities.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.activityCard}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.customerId) {
                    router.push({
                      pathname: '/(merchant)/customers',
                      params: { customerId: item.customerId }
                    });
                  }
                }}
              >
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
                  <Text style={styles.stampDelta}>+{item.stamps} {t('stamps_label')}</Text>
                  <Text style={styles.transAmount}>{item.amount}</Text>
                </View>
              </TouchableOpacity>
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
    justifyContent: 'space-between',
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
  trialBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 16,
  },
  trialBannerContent: {
    flexDirection: 'row',
    gap: 12,
  },
  trialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  trialTextWrap: {
    flex: 1,
    gap: 2,
  },
  trialTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  trialSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    lineHeight: 18,
  },
  trialUpgradeBtn: {
    backgroundColor: '#D97706',
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialUpgradeBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
