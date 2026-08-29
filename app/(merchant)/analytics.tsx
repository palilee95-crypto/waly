import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Path, Polyline } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'insights' | 'sales' | 'loyalty' | 'customers' | 'reviews'>('insights');
  const [helpModal, setHelpModal] = useState({ visible: false, title: '', message: '' });

  const showHelp = (title: string, message: string) => {
    setHelpModal({ visible: true, title, message });
  };
  const isDesktop = windowWidth >= 768;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loyaltyCards, setLoyaltyCards] = useState<any[]>([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Timeframe states
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [branchList, setBranchList] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Customer Filter State
  const [customerFilter, setCustomerFilter] = useState<'all' | 'vip' | 'atRisk' | 'nearClaim'>('all');
  const [customerFilterModalVisible, setCustomerFilterModalVisible] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  
  // Customer Profile State
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
  const [customerProfileModalVisible, setCustomerProfileModalVisible] = useState(false);

  // Card Flip Animation State
  const [flipAnimation] = useState(new Animated.Value(0));
  const [isFlipped, setIsFlipped] = useState(false);

  const flipCard = () => {
    Animated.spring(flipAnimation, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(() => setIsFlipped(!isFlipped));
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  // Prefill default dates for custom filter
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const formatDate = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.merchant_id) return;
      try {
        setLoading(true);
        const merch = await pb.collection('merchants').getOne(user.merchant_id).catch(() => null);
        setMerchant(merch);

        const txs = await pb.collection('transactions').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-created',
        });
        setTransactions(txs);

        const cards = await pb.collection('loyalty_cards').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          expand: 'customer',
        });
        setLoyaltyCards(cards);

        const branches = await pb.collection('branches').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-is_hq,-created',
          requestKey: null
        }).catch(() => []);
        setBranchList(branches);

        const fbs = await pb.collection('store_feedbacks').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-created',
          requestKey: null,
        }).catch(() => []);
        setFeedbacks(fbs);
      } catch (err) {
        console.warn('Failed to fetch analytics data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.merchant_id]);

  // Dynamic Transaction Filter
  const reviewStats = useMemo(() => {
    if (feedbacks.length === 0) {
      return { 
        avgRating: '5.0', 
        totalCount: 0, 
        googleRedirects: 0, 
        privateFeedbacks: 0, 
      };
    }
    const totalCount = feedbacks.length;
    const sumRating = feedbacks.reduce((acc, f) => acc + (Number(f.rating) || 5), 0);
    const avgRating = (sumRating / totalCount).toFixed(1);
    const googleRedirects = feedbacks.filter(f => f.redirected_to_google || f.rating === 5).length;
    const privateFeedbacks = feedbacks.filter(f => f.rating < 5 || Boolean(f.feedback)).length;

    return { avgRating, totalCount, googleRedirects, privateFeedbacks };
  }, [feedbacks]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(tx => {
      const txDate = new Date(tx.created);
      if (timeframe === 'daily') {
        return txDate.toDateString() === now.toDateString();
      } else if (timeframe === 'monthly') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (timeframe === 'yearly') {
        return txDate.getFullYear() === now.getFullYear();
      } else if (timeframe === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && isNaN(start.getTime())) return true;
        if (end && isNaN(end.getTime())) return true;

        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      }
      return true;
    });
  }, [transactions, timeframe, startDate, endDate]);

  // Calculate Metrics based on filtered data
  const merchantMetrics = useMemo(() => {
    const totalCustomers = new Set(filteredTransactions.map(tx => tx.customer).filter(Boolean)).size;
    const totalSales = filteredTransactions.reduce((acc, tx) => acc + (Number(tx.bill_amount) || 0), 0);
    const totalStamps = filteredTransactions.reduce((acc, tx) => acc + (tx.stamps || 0), 0);
    const totalPoints = filteredTransactions.reduce((acc, tx) => acc + (tx.points || (tx.stamps ? tx.stamps * 10 : 0)), 0);
    const avgSpending = totalCustomers > 0 ? (totalSales / totalCustomers) : 0;

    return {
      totalCustomers,
      totalSales: Math.round(totalSales),
      totalStamps,
      totalPoints,
      avgSpending: Math.round(avgSpending),
    };
  }, [filteredTransactions]);

  const monthlySalesData = useMemo(() => {
    const months = [];
    const salesCount: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString([], { month: 'short' });
      months.push(key);
      salesCount[key] = 0;
    }

    filteredTransactions.forEach(tx => {
      if (tx.bill_amount) {
        const txDate = new Date(tx.created);
        const key = txDate.toLocaleDateString([], { month: 'short' });
        if (salesCount[key] !== undefined) {
          salesCount[key] += Number(tx.bill_amount) || 0;
        }
      }
    });

    const values = months.map(m => Math.round(salesCount[m]));
    const maxVal = Math.max(...values, 1);

    return months.map((month, idx) => ({
      month,
      value: values[idx],
      percentage: (values[idx] / maxVal) * 100,
      isMax: values[idx] === maxVal && maxVal > 0,
    }));
  }, [filteredTransactions]);

  const churnMetrics = useMemo(() => {
    if (filteredTransactions.length === 0) return { rate: 0, oneTimeUsers: 0, totalUsers: 0 };
    const userTxCount: Record<string, number> = {};
    filteredTransactions.forEach(tx => {
      if (tx.customer && tx.type === 'earn') {
        userTxCount[tx.customer] = (userTxCount[tx.customer] || 0) + 1;
      }
    });

    const totalUsers = Object.keys(userTxCount).length;
    if (totalUsers === 0) return { rate: 0, oneTimeUsers: 0, totalUsers: 0 };

    let oneTimeUsers = 0;
    Object.values(userTxCount).forEach(count => {
      if (count === 1) oneTimeUsers++;
    });

    const rate = Math.round((oneTimeUsers / totalUsers) * 100);
    return { rate, oneTimeUsers, totalUsers };
  }, [filteredTransactions]);

  const funnelMetrics = useMemo(() => {
    let tier1 = 0; 
    let tier2 = 0; 
    let tier3 = 0; 
    let claimedRewards = 0; 

    const activeCustomerIds = new Set(filteredTransactions.map(tx => tx.customer).filter(Boolean));
    const activeCards = loyaltyCards.filter(card => activeCustomerIds.has(card.customer));

    activeCards.forEach(card => {
      const stamps = card.stamps_collected || 0;
      if (stamps >= 1 && stamps <= 3) tier1++;
      else if (stamps >= 4 && stamps <= 7) tier2++;
      else if (stamps >= 8) tier3++;
    });

    filteredTransactions.forEach(tx => {
      if (tx.type === 'redeem') claimedRewards++;
    });

    const totalFunnel = tier1 + tier2 + tier3 || 1;

    return {
      tier1,
      tier1Pct: Math.round((tier1 / totalFunnel) * 100),
      tier2,
      tier2Pct: Math.round((tier2 / totalFunnel) * 100),
      tier3,
      tier3Pct: Math.round((tier3 / totalFunnel) * 100),
      claimedRewards,
    };
  }, [loyaltyCards, filteredTransactions]);

  const customerList = useMemo(() => {
    const cmap: Record<string, any> = {};

    filteredTransactions.forEach(tx => {
      if (!tx.customer) return;
      if (!cmap[tx.customer]) {
        cmap[tx.customer] = {
          id: tx.customer,
          totalSpend: 0,
          totalVisits: 0,
          lastVisit: tx.created,
          stamps: 0,
          name: 'Anonymous',
          phone: '',
          avatar: '',
        };
      }
      
      const c = cmap[tx.customer];
      if (tx.bill_amount) c.totalSpend += Number(tx.bill_amount);
      if (tx.type === 'earn') c.totalVisits++;
      if (new Date(tx.created).getTime() > new Date(c.lastVisit).getTime()) {
        c.lastVisit = tx.created;
      }
    });

    loyaltyCards.forEach(card => {
      if (cmap[card.customer]) {
        cmap[card.customer].stamps = card.stamps_collected || 0;
        if (card.expand?.customer) {
          cmap[card.customer].name = card.expand.customer.name || card.expand.customer.phone || 'Anonymous';
          cmap[card.customer].phone = card.expand.customer.phone || '';
          cmap[card.customer].avatar = card.expand.customer.avatar ? pb.files.getURL(card.expand.customer, card.expand.customer.avatar) : '';
        }
      }
    });

    let list = Object.values(cmap).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

    if (customerFilter === 'vip') {
      list = list.sort((a, b) => b.totalSpend - a.totalSpend);
    } else if (customerFilter === 'atRisk') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = list.filter(c => new Date(c.lastVisit) < thirtyDaysAgo);
    } else if (customerFilter === 'nearClaim') {
      list = list.filter(c => c.stamps >= 8); 
    }

    return list;
  }, [filteredTransactions, loyaltyCards, customerFilter]);

  const donutData = useMemo(() => {
    const total = funnelMetrics.tier1 + funnelMetrics.tier2 + funnelMetrics.tier3;
    const R = 40;
    const C = 2 * Math.PI * R;

    if (total === 0) {
      return {
        total: 0,
        segments: [{ length: C, offset: 0, color: '#F1F5F9', label: 'No Active Stamps', count: 0, pct: 0 }]
      };
    }

    const t1Len = (funnelMetrics.tier1 / total) * C;
    const t2Len = (funnelMetrics.tier2 / total) * C;
    const t3Len = (funnelMetrics.tier3 / total) * C;

    return {
      total,
      segments: [
        { length: t1Len, offset: 0, color: '#FFC700', label: 'Stalled (1-3 Stamps)', count: funnelMetrics.tier1, pct: funnelMetrics.tier1Pct },
        { length: t2Len, offset: -t1Len, color: '#050505', label: 'Mid-Way (4-7 Stamps)', count: funnelMetrics.tier2, pct: funnelMetrics.tier2Pct },
        { length: t3Len, offset: -(t1Len + t2Len), color: '#10B981', label: 'Near Reward (8-10)', count: funnelMetrics.tier3, pct: funnelMetrics.tier3Pct }
      ]
    };
  }, [funnelMetrics]);

  const slowHoursMetrics = useMemo(() => {
    const segments = [0, 0, 0, 0];
    const segmentLabels = ['Morning (6-11am)', 'Lunch (12-2pm)', 'Afternoon (3-6pm)', 'Evening (7-10pm)'];

    filteredTransactions.forEach(tx => {
      if (tx.type === 'earn') {
        const hour = new Date(tx.created).getHours();
        if (hour >= 6 && hour < 12) segments[0]++;
        else if (hour >= 12 && hour < 15) segments[1]++;
        else if (hour >= 15 && hour < 19) segments[2]++;
        else if (hour >= 19 || hour < 6) segments[3]++;
      }
    });

    const maxVal = Math.max(...segments, 1);
    const minVal = Math.min(...segments);
    const quietestIdx = segments.indexOf(minVal);

    return segments.map((val, idx) => ({
      label: segmentLabels[idx],
      value: val,
      percentage: Math.round((val / maxVal) * 100),
      isQuietest: idx === quietestIdx && val > 0,
    }));
  }, [filteredTransactions]);

  const quietestSlot = useMemo(() => {
    const quiet = slowHoursMetrics.find(s => s.isQuietest);
    return quiet ? quiet.label : 'Afternoon (3-6pm)';
  }, [slowHoursMetrics]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#050505" />
        <Text style={styles.loaderText}>Analysing merchant data...</Text>
      </View>
    );
  }

  const logoUrl = merchant?.logo 
    ? pb.files.getURL(merchant, merchant.logo)
    : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';

  const tabList = [
    { id: 'insights', label: 'Insights', icon: 'flash' },
    { id: 'sales', label: 'Sales', icon: 'cash-outline' },
    { id: 'loyalty', label: 'Loyalty', icon: 'ribbon-outline' },
    { id: 'customers', label: 'Customers', icon: 'people-outline' },
    { id: 'reviews', label: 'Reviews', icon: 'star-outline' },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'absolute', top: -16, left: -20, right: -20, height: 180, backgroundColor: '#050505', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, zIndex: 0 }} />

        {/* 🧭 Subscription-Style Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, marginTop: 10, marginBottom: 20, width: '100%' }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', pointerEvents: 'none' }}>
            Analytics
          </Text>
          
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 70, height: 22, resizeMode: 'contain', tintColor: '#FFFFFF', zIndex: 10 }}
          />
        </View>

        {/* 🏢 Branch Dropdown */}
        <View style={{ alignItems: 'center', marginBottom: 14, zIndex: 20 }}>
          <TouchableOpacity onPress={() => setBranchModalVisible(true)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
            <Ionicons name="business" size={14} color="#050505" />
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
              {selectedBranch === 'All Branches' ? 'All Branches' : selectedBranch}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748B" />
          </TouchableOpacity>
        </View>
        {/* 📅 Soft Segmented Timeframe Selector */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 6, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, shadowColor: '#64748B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2, zIndex: 20 }}>
          {(['daily', 'monthly', 'yearly', 'custom'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setTimeframe(tab)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: timeframe === tab ? '#F1F5F9' : 'transparent',
                borderRadius: 14,
              }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: timeframe === tab ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                color: timeframe === tab ? '#050505' : '#64748B',
                textTransform: 'capitalize'
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 📅 Custom Date Range Picker */}
        {timeframe === 'custom' && (
          <View style={styles.customDateCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="calendar-outline" size={14} color="#FFC700" />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5 }}>
                FILTER BY CUSTOM RANGE (YYYY-MM-DD)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  Start Date
                </Text>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="play" size={10} color="#FFC700" />
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={styles.dateInput as any}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  End Date
                </Text>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="stop" size={10} color="#EF4444" />
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={styles.dateInput as any}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 🏷️ Clean Underline Tabs Bar */}
        <View style={{ marginBottom: 24, zIndex: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 24 }}
          >
            {tabList.map((t) => {
              const isSelected = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabUnderline,
                    isSelected && styles.tabUnderlineActive,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons 
                      name={t.icon as any} 
                      size={16} 
                      color={isSelected ? '#050505' : '#94A3B8'} 
                    />
                    <Text style={[
                      styles.tabUnderlineText,
                      isSelected && styles.tabUnderlineTextActive,
                    ]}>
                      {t.label}
                    </Text>
                  </View>
                  {t.id === 'insights' && (churnMetrics.oneTimeUsers > 0 || funnelMetrics.tier3 > 0) && (
                    <View style={styles.tabBadgeDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================================= */}
        {/* ⚡ TAB 1: INSIGHTS & ACTION CENTER                                       */}
        {/* ========================================================================= */}
        {activeTab === 'insights' && (
          <View style={{ gap: 14 }}>
            {/* Top Quick-Stats Banner */}
            <ExpoLinearGradient
              colors={['#1F2937', '#050505']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroActionBanner}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="sparkles" size={14} color="#FFC700" />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700', letterSpacing: 1 }}>
                    GROWTH OPPORTUNITIES
                  </Text>
                </View>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', lineHeight: 22 }}>
                  {churnMetrics.oneTimeUsers > 0 ? `${churnMetrics.oneTimeUsers} customers need follow-up` : 'Loyalty funnel is running strong!'}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 4 }}>
                  Take fast actions below to recover churned visits & increase monthly revenue.
                </Text>
              </View>
            </ExpoLinearGradient>

            {/* Recommendation 1: Win Back Churned Users */}
            {churnMetrics.oneTimeUsers > 0 && (
              <View style={styles.recommendationCard}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={[styles.recomIconBg, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="people" size={18} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        Win Back {churnMetrics.oneTimeUsers} One-Time Visitors
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>{churnMetrics.rate}% Churn</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                      These customers checked in once and stalled. Sending a personalized discount or reminder increases return rates by 28%.
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/marketing' as any)}
                      activeOpacity={0.8}
                      style={styles.recomActionBtn}
                    >
                      <Ionicons name="chatbubble-ellipses" size={14} color="#050505" />
                      <Text style={styles.recomActionBtnText}>Launch Win-Back WhatsApp Blast</Text>
                      <Ionicons name="arrow-forward" size={12} color="#050505" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendation 2: Nudge Near-Reward Members */}
            {funnelMetrics.tier3 > 0 && (
              <View style={styles.recommendationCard}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={[styles.recomIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="gift" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        {funnelMetrics.tier3} VIPs Close to Reward!
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>8-10 Stamps</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                      These customers only need 1–2 more stamps to redeem. Remind them to complete their card this week!
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/marketing' as any)}
                      activeOpacity={0.8}
                      style={styles.recomActionBtn}
                    >
                      <Ionicons name="paper-plane" size={14} color="#050505" />
                      <Text style={styles.recomActionBtnText}>Send "Almost Free" Reminder</Text>
                      <Ionicons name="arrow-forward" size={12} color="#050505" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendation 3: Fill Slow Hours */}
            <View style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={[styles.recomIconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="time" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      Boost Slow Slot: {quietestSlot}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>Slow Slot</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                    This is your quietest checkout slot. Run a "Double Stamp Flash Promo" during these hours to fill empty capacity.
                  </Text>

                  <TouchableOpacity
                    onPress={() => router.push('/(merchant)/marketing' as any)}
                    activeOpacity={0.8}
                    style={styles.recomActionBtn}
                  >
                    <Ionicons name="flash" size={14} color="#050505" />
                    <Text style={styles.recomActionBtnText}>Create Happy Hour Promo</Text>
                    <Ionicons name="arrow-forward" size={12} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Recommendation 4: Google Review Setup */}
            <View style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={[styles.recomIconBg, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="logo-google" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                    Automate 5-Star Google Reviews
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                    Link your Google Business profile so 5-star stamp claimants automatically get redirected to boost your Google Maps ranking.
                  </Text>

                  <TouchableOpacity
                    onPress={() => router.push('/(merchant)/onboarding-setup' as any)}
                    activeOpacity={0.8}
                    style={styles.recomActionBtn}
                  >
                    <Ionicons name="link" size={14} color="#050505" />
                    <Text style={styles.recomActionBtnText}>Setup Google Review Link</Text>
                    <Ionicons name="arrow-forward" size={12} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 💰 TAB 2: SALES (Revenue, AOV & Branch Performance)                      */}
        {/* ========================================================================= */}
        {activeTab === 'sales' && (
          <View style={{ gap: 14 }}>
            {/* Sales KPIs */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="cash" size={14} color="#10B981" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Total Revenue</Text>
                </View>
                <Text style={styles.kpiBoxVal}>RM {merchantMetrics.totalSales.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#10B981', marginTop: 4 }}>
                  In filtered timeframe
                </Text>
              </View>

              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="wallet" size={14} color="#3B82F6" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Avg Order (AOV)</Text>
                </View>
                <Text style={styles.kpiBoxVal}>RM {merchantMetrics.avgSpending.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  Per active member
                </Text>
              </View>
            </View>

            {/* 6-Month Sales Trend Chart */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Sales Performance (RM)</Text>
                <TouchableOpacity onPress={() => showHelp('Sales Performance', 'A 6-month historical overview of your total sales revenue to track growth trends.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Monthly revenue trend for the last 6 months</Text>

              <View style={{ height: 160, width: '100%', marginTop: 16, marginBottom: 8 }}>
                {/* Values (Top) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  {monthlySalesData.map((item, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: item.isMax ? '#FFC700' : '#94A3B8' }}>
                        RM{item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Chart Area */}
                <View style={{ flex: 1, position: 'relative', marginTop: 12, marginBottom: 12 }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '8.33%', right: '8.33%' }}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <Defs>
                        <LinearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#FFC700" stopOpacity="0.4" />
                          <Stop offset="1" stopColor="#FFC700" stopOpacity="0.0" />
                        </LinearGradient>
                      </Defs>
                      <Path 
                        d={`M 0,100 ${monthlySalesData.map((item, i) => `L ${(i / (monthlySalesData.length - 1)) * 100},${100 - item.percentage}`).join(' ')} L 100,100 Z`}
                        fill="url(#salesGradient)"
                      />
                      <Polyline
                        points={monthlySalesData.map((item, i) => `${(i / (monthlySalesData.length - 1)) * 100},${100 - item.percentage}`).join(' ')}
                        fill="none"
                        stroke="#FFC700"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    </Svg>
                  </View>

                  {/* Dots */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                    {monthlySalesData.map((item, idx) => (
                      <View key={idx} style={{ height: '100%', flex: 1, alignItems: 'center' }}>
                        <View 
                          style={{ 
                            position: 'absolute', 
                            top: `${100 - item.percentage}%`, 
                            width: 10, 
                            height: 10, 
                            borderRadius: 5, 
                            backgroundColor: item.isMax ? '#FFC700' : '#FFFFFF',
                            borderWidth: 2,
                            borderColor: '#FFC700',
                            marginTop: -5,
                          }} 
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* Labels (Bottom) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  {monthlySalesData.map((item, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', color: item.isMax ? '#050505' : '#94A3B8' }}>
                        {item.month}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Branch Performance Leaderboard */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Branch Revenue Leaderboard</Text>
                  <TouchableOpacity onPress={() => showHelp('Branch Performance', 'Compares revenue and stamp distribution across all your active store outlets.')}>
                    <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => router.push('/(merchant)/branches' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Manage</Text>
                  <Ionicons name="chevron-forward" size={12} color="#B45309" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Compare sales contribution per outlet</Text>

              <View style={{ gap: 10, marginTop: 16 }}>
                {branchList.length === 0 ? (
                  <View style={styles.emptyBranchBox}>
                    <Ionicons name="business-outline" size={24} color="#94A3B8" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      No Outlets Registered Yet
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                      Add your store branches to view comparative sales and stamp leaderboards.
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/branches' as any)}
                      style={styles.emptyAddBtn}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                        + Add Branches
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  branchList.map((br, idx) => (
                    <View key={br.id || idx} style={styles.branchItemCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: idx === 0 ? '#FFC700' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>#{idx + 1}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{br.name}</Text>
                          {br.is_hq && (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>HQ</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                          RM {(br.total_sales || 0).toLocaleString()}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                          {br.total_stamps || 0} stamps issued
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          {br.manager_name ? `Mgr: ${br.manager_name}` : (br.city || 'Active')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 🎟️ TAB 3: LOYALTY (Stamps, Points & Funnel Health)                       */}
        {/* ========================================================================= */}
        {activeTab === 'loyalty' && (
          <View style={{ gap: 14 }}>
            {/* Loyalty KPIs */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="ribbon" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Stamps Issued</Text>
                </View>
                <Text style={styles.kpiBoxVal}>{merchantMetrics.totalStamps.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  NFC check-in rewards
                </Text>
              </View>

              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="star" size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Points Issued</Text>
                </View>
                <Text style={styles.kpiBoxVal}>{merchantMetrics.totalPoints.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  Membership points
                </Text>
              </View>
            </View>

            {/* Stamp Funnel Donut Chart */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Stamp Funnel & Stalling</Text>
                <TouchableOpacity onPress={() => showHelp('Stamp Funnel Drop-off', 'Tracks how many stamps active members collect before stopping, showing where drop-offs happen so you can target them.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Where are your customers getting stuck?</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 24, gap: 16 }}>
                <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width="120" height="120" viewBox="0 0 100 100">
                    <G transform="rotate(-90 50 50)">
                      <Circle cx="50" cy="50" r="40" stroke="#F1F5F9" strokeWidth="9" fill="none" />
                      {donutData.segments.filter(s => s.count > 0).map((seg, idx) => (
                        <Circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="40"
                          stroke={seg.color}
                          strokeWidth="9"
                          strokeDasharray={`${seg.length} 251.3`}
                          strokeDashoffset={seg.offset}
                          strokeLinecap="round"
                          fill="none"
                        />
                      ))}
                    </G>
                  </Svg>
                  <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {donutData.total}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      cards
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 12, flex: 1, paddingLeft: 10 }}>
                  {donutData.segments.map((seg, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seg.color }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }} numberOfLines={1}>
                          {seg.label}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          {seg.count} ({seg.pct}%)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Redemptions Summary Bar */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      Rewards Claimed
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      Completed card redemptions
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>
                  {funnelMetrics.claimedRewards}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 👥 TAB 4: CUSTOMERS (Retention, Churn & Traffic Times)                    */}
        {/* ========================================================================= */}
        {activeTab === 'customers' && (
          <View style={{ gap: 14 }}>
            {/* Customer Retention & Churn Cards */}
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="people" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={[styles.statsLabel, { marginBottom: 0 }]}>Customer Retention Rate</Text>
                    <TouchableOpacity onPress={() => showHelp('Customer Retention Rate', 'The percentage of customers who visited more than once in the selected timeframe. High retention means loyal repeat business.')}>
                      <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statsValue}>{100 - churnMetrics.rate}%</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: churnMetrics.rate > 40 ? '#FEE2E2' : '#ECFDF5' }]}>
                  <Text style={[styles.statusBadgeText, { color: churnMetrics.rate > 40 ? '#EF4444' : '#10B981' }]}>
                    {churnMetrics.rate > 40 ? 'At Risk' : 'Healthy'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={[styles.iconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={[styles.statsLabel, { marginBottom: 0 }]}>One-and-Done Churn Gap</Text>
                    <TouchableOpacity onPress={() => showHelp('One-and-Done Churn Gap', 'The percentage of customers who visited exactly once in this timeframe and never came back. Higher churn indicates a need for better follow-up deals.')}>
                      <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statsValue}>{churnMetrics.rate}%</Text>
                </View>
                <Text style={styles.statsRightText}>{churnMetrics.oneTimeUsers} idle users</Text>
              </View>
            </View>

            {/* Visual Retention Health Bar */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Customer Database Health</Text>
                <TouchableOpacity onPress={() => showHelp('Customer Retention Health', 'Displays the visual ratio of loyal repeat members vs. one-time visitors to track merchant database health.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Ratio of repeat customers vs. one-time visitors</Text>
              
              <View style={{ height: 24, backgroundColor: '#F1F5F9', borderRadius: 12, overflow: 'hidden', flexDirection: 'row', marginTop: 16 }}>
                <View style={{ width: `${100 - churnMetrics.rate}%`, height: '100%', backgroundColor: '#FFC700', justifyContent: 'center', paddingLeft: 12 }}>
                  {100 - churnMetrics.rate > 20 && (
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      {100 - churnMetrics.rate}% Loyal
                    </Text>
                  )}
                </View>
                <View style={{ width: `${churnMetrics.rate}%`, height: '100%', backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 }}>
                  {churnMetrics.rate > 20 && (
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                      {churnMetrics.rate}% Churned
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFC700' }} />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    Active Repeat Members
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    One-Time Churned
                  </Text>
                </View>
              </View>
            </View>

            {/* Busiest Hours vs. Slow Hours Traffic Analysis */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Peak Rush vs. Slow Hours</Text>
                <TouchableOpacity onPress={() => showHelp('Hour Analysis', 'Identifies busy checkout periods vs quiet slots to help you run happy-hour discounts or targeted promos.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Find empty time slots to fill with promos</Text>

              <View style={{ gap: 12, marginTop: 16 }}>
                {slowHoursMetrics.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ width: 120, fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#050505' }}>
                      {item.label}
                    </Text>
                    <View style={{ flex: 1, height: 16, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
                      <View style={{ width: `${item.percentage}%`, height: '100%', backgroundColor: item.isQuietest ? '#EF4444' : '#050505', borderRadius: 8 }} />
                    </View>
                    <Text style={{ width: 50, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: item.isQuietest ? '#EF4444' : '#050505', textAlign: 'right' }}>
                      {item.value} txs
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 👥 Customer Database & Filters */}
            <View style={[styles.chartCard, { paddingHorizontal: 0, paddingVertical: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Customer Database</Text>
                  <TouchableOpacity onPress={() => showHelp('Customer DB', 'View and filter all your customers. VIPs are top spenders, At-Risk are inactive for >30 days.')}>
                    <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{customerList.length} total</Text>
              </View>

              {/* Filter Dropdown Pill */}
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <TouchableOpacity 
                  onPress={() => setCustomerFilterModalVisible(true)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                    {customerFilter === 'all' ? 'All Customers' : customerFilter === 'vip' ? '🔥 VIP Spenders' : customerFilter === 'atRisk' ? '⚠️ At Risk (>30d)' : '🎁 Almost Claim'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                {customerList.slice(customerPage * 10, (customerPage + 1) * 10).map((c, idx) => (
                  <TouchableOpacity 
                    key={c.id} 
                    activeOpacity={0.6}
                    onPress={() => {
                      setSelectedCustomerProfile(c);
                      setCustomerProfileModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#F1F5F9' }}
                  >
                    {c.avatar ? (
                      <Image source={{ uri: c.avatar }} style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="person" size={18} color="#94A3B8" />
                      </View>
                    )}
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 2 }} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        Last visit: {new Date(c.lastVisit).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>
                        RM {c.totalSpend.toFixed(2)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="ribbon-outline" size={10} color="#64748B" />
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          {c.stamps} stamps • {c.totalVisits} visits
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Pagination Controls */}
                {customerList.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                    <TouchableOpacity 
                      disabled={customerPage === 0}
                      onPress={() => setCustomerPage(prev => Math.max(0, prev - 1))}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: customerPage === 0 ? '#F8FAFC' : '#050505', borderRadius: 12 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: customerPage === 0 ? '#94A3B8' : '#FFFFFF' }}>Previous</Text>
                    </TouchableOpacity>
                    
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      Page {customerPage + 1} of {Math.ceil(customerList.length / 10) || 1}
                    </Text>

                    <TouchableOpacity 
                      disabled={(customerPage + 1) * 10 >= customerList.length}
                      onPress={() => setCustomerPage(prev => prev + 1)}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: (customerPage + 1) * 10 >= customerList.length ? '#F8FAFC' : '#050505', borderRadius: 12 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: (customerPage + 1) * 10 >= customerList.length ? '#94A3B8' : '#FFFFFF' }}>Next</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {customerList.length === 0 && (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8', marginTop: 12 }}>
                      No customers match this filter.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* ⭐ TAB 5: REVIEWS (Ratings, Google Redirects & Feedback Feed)             */}
        {/* ========================================================================= */}
        {activeTab === 'reviews' && (
          <View style={{ gap: 14 }}>
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.sectionTitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                      Customer Ratings & Feedback
                    </Text>
                    <TouchableOpacity onPress={() => showHelp('Ratings & Feedback', 'Shows customer ratings gathered after NFC stamp claims. 5-star reviews were directed to your Google Business page, while lower ratings are captured here privately.')}>
                      <Ionicons name="help-circle-outline" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.sectionSubtitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                    {feedbacks.length > 0 ? `${reviewStats.totalCount} total customer ratings` : 'Ratings from NFC stamp claims'}
                  </Text>
                </View>
              </View>

              {/* Rating Highlight Banner */}
              <View style={{ marginBottom: 20 }}>
                {/* Main Score Banner */}
                <ExpoLinearGradient
                  colors={['#1F2937', '#050505']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', marginBottom: 6, letterSpacing: 1 }}>AVERAGE SCORE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text style={{ fontSize: 36, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                        {reviewStats.avgRating}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Ionicons 
                            key={s} 
                            name={s <= Math.round(Number(reviewStats.avgRating)) ? "star" : "star-outline"} 
                            size={16} 
                            color="#FFC700" 
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 199, 0, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="star" size={24} color="#FFC700" />
                  </View>
                </ExpoLinearGradient>

                {/* Sub Metric Cards */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <View style={{ backgroundColor: '#DCFCE7', padding: 4, borderRadius: 6 }}>
                        <Ionicons name="logo-google" size={14} color="#16A34A" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A', letterSpacing: 0.5 }}>5-STAR GOOGLE</Text>
                    </View>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>
                      {reviewStats.googleRedirects}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#166534', marginTop: 2 }}>redirected to maps</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <View style={{ backgroundColor: '#FEF3C7', padding: 4, borderRadius: 6 }}>
                        <Ionicons name="chatbubble-ellipses" size={14} color="#D97706" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#D97706', letterSpacing: 0.5 }}>PRIVATE</Text>
                    </View>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                      {reviewStats.privateFeedbacks}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#92400E', marginTop: 2 }}>direct feedback</Text>
                  </View>
                </View>
              </View>

              {/* Feedback List */}
              <View style={{ gap: 10 }}>
                {feedbacks.length === 0 ? (
                  <ExpoLinearGradient 
                    colors={['#F8FAFC', '#F1F5F9']} 
                    style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' }}
                  >
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="star" size={32} color="#94A3B8" />
                      <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FFF', borderRadius: 12, padding: 2 }}>
                        <Ionicons name="logo-google" size={16} color="#16A34A" />
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      No Customer Reviews Yet
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18 }}>
                      Add your Google Business review link to automatically capture 5-star reviews directly from your NFC stamps!
                    </Text>
                    <TouchableOpacity 
                      onPress={() => router.push('/(merchant)/onboarding-setup' as any)}
                      style={{ backgroundColor: '#0F172A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="link" size={16} color="#FFF" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFF' }}>Connect Google Business</Text>
                    </TouchableOpacity>
                  </ExpoLinearGradient>
                ) : (
                  feedbacks.slice(0, 10).map((fb, idx) => {
                    const isPositive = Number(fb.rating) === 5;
                    const cleanPhone = (fb.customer_phone || '').replace(/\D/g, '');
                    return (
                      <View key={fb.id || idx} style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons 
                                  key={s} 
                                  name={s <= fb.rating ? "star" : "star-outline"} 
                                  size={13} 
                                  color={s <= fb.rating ? "#F59E0B" : "#CBD5E1"} 
                                />
                              ))}
                            </View>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                              {fb.rating}.0
                            </Text>
                            {isPositive ? (
                              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="logo-google" size={9} color="#15803D" />
                                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>Google</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Private</Text>
                              </View>
                            )}
                          </View>

                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                            {fb.created ? new Date(fb.created).toLocaleDateString() : ''}
                          </Text>
                        </View>

                        {fb.feedback ? (
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#334155', lineHeight: 18, marginBottom: 8, fontStyle: 'italic' }}>
                            "{fb.feedback}"
                          </Text>
                        ) : null}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: fb.feedback ? 2 : 4 }}>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                            {fb.customer_name || fb.customer_phone || 'Anonymous Customer'}
                          </Text>
                          {cleanPhone ? (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E2FBE8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                              onPress={() => {
                                const waNumber = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone.replace(/^0/, '')}`;
                                const msg = encodeURIComponent(`Hi! Thank you for your visit to ${merchant?.name || 'our store'}. We noticed your feedback and would love to assist you!`);
                                Linking.openURL(`https://wa.me/${waNumber}?text=${msg}`).catch(() => {});
                              }}
                            >
                              <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A' }}>WhatsApp</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Help Modal */}
      {helpModal.visible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255, 199, 0, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="information-circle" size={16} color="#FFC700" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {helpModal.title}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 20, marginBottom: 20 }}>
              {helpModal.message}
            </Text>
            <TouchableOpacity
              onPress={() => setHelpModal({ ...helpModal, visible: false })}
              style={{
                backgroundColor: '#050505',
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                Got It
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setBranchModalVisible(false)}
        >
          <View style={[styles.modalCard, { maxWidth: 380, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={16} color="#B45309" />
                </View>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                  Select Store Outlet
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBranchModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, width: '100%' }}>
              {['All Branches', ...branchList.map((b: any) => b.name)].map((bName) => {
                const isSelected = (selectedBranch || 'All Branches') === bName;
                return (
                  <TouchableOpacity
                    key={bName}
                    onPress={() => {
                      setSelectedBranch(bName);
                      setBranchModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#FEF3C7' : '#F8FAFC',
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFC700' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons 
                        name={bName === 'All Branches' ? "business-outline" : "storefront-outline"} 
                        size={18} 
                        color={isSelected ? "#B45309" : "#050505"} 
                      />
                      <Text style={{
                        fontSize: 13,
                        fontFamily: isSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                        color: isSelected ? '#B45309' : '#050505',
                      }}>
                        {bName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#B45309" />
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  setBranchModalVisible(false);
                  router.push('/(merchant)/branches' as any);
                }}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  marginTop: 4,
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#B45309" />
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                  + Manage & Add Branches
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Customer Filter Modal */}
      <Modal
        visible={customerFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomerFilterModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCustomerFilterModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                Filter Customers
              </Text>
              <TouchableOpacity onPress={() => setCustomerFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {(['all', 'vip', 'atRisk', 'nearClaim'] as const).map(f => {
                const isSelected = customerFilter === f;
                const filterLabel = f === 'all' ? 'All Customers' : f === 'vip' ? '🔥 VIP Spenders' : f === 'atRisk' ? '⚠️ At Risk (>30d)' : '🎁 Almost Claim';
                const filterDesc = f === 'all' ? 'View your entire database' : f === 'vip' ? 'Top spenders ranked by total RM' : f === 'atRisk' ? 'Customers inactive for over 30 days' : 'Customers with 8+ stamps';
                
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => {
                      setCustomerFilter(f);
                      setCustomerPage(0);
                      setCustomerFilterModalVisible(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isSelected ? '#FFFBEB' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFC700' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: isSelected ? '#B45309' : '#050505' }}>
                        {filterLabel}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {filterDesc}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#B45309" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Customer Profile Modal */}
      <Modal
        visible={customerProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCustomerProfileModalVisible(false)}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]} 
          activeOpacity={1} 
          onPress={() => setCustomerProfileModalVisible(false)}
        >
          <View style={[styles.modalCard, { padding: 20, width: '100%', maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 40 }]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                Customer Profile
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={() => {}}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCustomerProfileModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#050505" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCustomerProfile && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
                {/* Avatar & Name */}
                {selectedCustomerProfile.avatar ? (
                  <Image source={{ uri: selectedCustomerProfile.avatar }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomerProfile.name ? selectedCustomerProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'C'}
                    </Text>
                  </View>
                )}
                
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 16 }}>
                  {selectedCustomerProfile.name}
                </Text>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Ionicons name="create-outline" size={14} color="#050505" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Edit Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#050505', borderRadius: 20 }}>
                    <Ionicons name="flash" size={14} color="#FFC700" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Adjust Stamps</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Yellow Details Card */}
                <View style={{ width: '100%', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="wallet-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Spend</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>RM {selectedCustomerProfile.totalSpend.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="cart-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Visits</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{selectedCustomerProfile.totalVisits}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="time-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Last Visit</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {new Date(selectedCustomerProfile.lastVisit).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="call-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Phone Number</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomerProfile.phone ? (selectedCustomerProfile.phone.startsWith('+') ? selectedCustomerProfile.phone : `+60${selectedCustomerProfile.phone.replace(/^0/, '')}`) : 'No Phone'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!selectedCustomerProfile.phone) return;
                      const cleanPhone = selectedCustomerProfile.phone.replace(/\D/g, '');
                      const waNumber = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone.replace(/^0/, '')}`;
                      Linking.openURL(`https://wa.me/${waNumber}?text=Hi%20${encodeURIComponent(selectedCustomerProfile.name)}!`).catch(() => {});
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#22C55E',
                      borderRadius: 12,
                      paddingVertical: 14,
                      opacity: selectedCustomerProfile.phone ? 1 : 0.5
                    }}
                    disabled={!selectedCustomerProfile.phone}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      WhatsApp Customer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Stamp Card Progress Section */}
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 24 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1 }}>STAMP CARD PROGRESS</Text>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Ionicons name="create-outline" size={14} color="#B45309" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Adjust Stamps</Text>
                  </TouchableOpacity>
                </View>

                {/* Mockup Stamp Card Container */}
                <View style={{ width: '100%', marginBottom: 12, height: 220 }}>
                  {/* FRONT OF CARD */}
                  <Animated.View style={[{ width: '100%', height: '100%', backfaceVisibility: 'hidden' }, { transform: [{ rotateY: frontInterpolate }] }]}>
                    <View style={{ flex: 1, backgroundColor: '#FFED4A', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                      
                      {/* Diagonal Glassmorphism Effect */}
                      <View style={{ position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, transform: [{ rotate: '-15deg' }] }}>
                        <View style={{ width: '200%', height: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                      </View>

                      {/* Header */}
                      <View style={{ backgroundColor: '#1F2937', paddingVertical: 18, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                        <View style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '45deg' }] }} />
                        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#4B5563', letterSpacing: 4, textTransform: 'uppercase' }}>
                          {merchant?.name || 'SCOOP CREAMY'}
                        </Text>
                      </View>

                      {/* Body */}
                      <View style={{ padding: 20, alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309', marginBottom: 8 }}>
                          YOUR STAMPS <Text style={{ fontSize: 18, color: '#050505' }}>{selectedCustomerProfile.stamps}/10</Text>
                        </Text>
                        
                        <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
                          {/* Top Row (6 Stamps) */}
                          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%' }}>
                            {[...Array(6)].map((_, i) => (
                              <View key={`top-${i}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: i < selectedCustomerProfile.stamps ? '#050505' : 'transparent', borderWidth: 1.5, borderStyle: i < selectedCustomerProfile.stamps ? 'solid' : 'dashed', borderColor: i < selectedCustomerProfile.stamps ? '#050505' : '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="ice-cream" size={16} color={i < selectedCustomerProfile.stamps ? "#FFFFFF" : "rgba(180, 83, 9, 0.2)"} />
                              </View>
                            ))}
                          </View>
                          {/* Bottom Row (4 Stamps) */}
                          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%' }}>
                            {[...Array(4)].map((_, i) => {
                              const stampIndex = i + 6;
                              return (
                                <View key={`bottom-${i}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: stampIndex < selectedCustomerProfile.stamps ? '#050505' : 'transparent', borderWidth: 1.5, borderStyle: stampIndex < selectedCustomerProfile.stamps ? 'solid' : 'dashed', borderColor: stampIndex < selectedCustomerProfile.stamps ? '#050505' : '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="ice-cream" size={16} color={stampIndex < selectedCustomerProfile.stamps ? "#FFFFFF" : "rgba(180, 83, 9, 0.2)"} />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                        
                        <Image source={require('../../assets/risev logo.png')} style={{ width: 50, height: 16, resizeMode: 'contain', tintColor: '#050505', position: 'absolute', bottom: 16, right: 16 }} />
                      </View>
                    </View>
                  </Animated.View>

                  {/* BACK OF CARD */}
                  <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' }, { transform: [{ rotateY: backInterpolate }] }]}>
                    <View style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', marginBottom: 16 }}>
                        {merchant?.name || 'SCOOP CREAMY'}
                      </Text>
                      <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                        <Ionicons name="qr-code" size={64} color="#050505" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 20 }}>
                        Customer ID: {selectedCustomerProfile.id.toUpperCase()}
                      </Text>
                    </View>
                  </Animated.View>
                </View>

                <TouchableOpacity 
                  onPress={flipCard}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 32, paddingVertical: 8, paddingHorizontal: 16 }}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Tap card to flip front / back</Text>
                </TouchableOpacity>

                {/* Progress Bar */}
                <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>Current Stamps</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{selectedCustomerProfile.stamps} / 10</Text>
                  </View>
                  <View style={{ width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                    <View style={{ width: `${(selectedCustomerProfile.stamps / 10) * 100}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Total Completions</Text>
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>0 Completed</Text>
                    </View>
                  </View>
                </View>

                {/* 3. Rewards & Vouchers */}
                <View style={{ width: '100%', marginBottom: 32 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 }}>REWARDS & VOUCHERS</Text>
                  <View style={{ width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>No vouchers issued for this customer.</Text>
                  </View>
                </View>

                {/* 4. Visit History */}
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 }}>VISIT HISTORY</Text>
                  {filteredTransactions.filter(tx => tx.customer === selectedCustomerProfile.id).length > 0 ? (
                    filteredTransactions.filter(tx => tx.customer === selectedCustomerProfile.id).sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map((tx, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <View>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 4 }}>
                            {tx.type === 'earn' ? 'Earned Stamp' : 'Redeemed Reward'}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                            {new Date(tx.created).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(tx.created).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: tx.type === 'earn' ? '#10B981' : '#EF4444' }}>
                          {tx.type === 'earn' ? `+${tx.stamps} stamps` : '-10 stamps'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginTop: 12 }}>No visits recorded yet.</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    marginBottom: 8,
  },
  merchantNameText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  timeframeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 20,
  },
  customDateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
    zIndex: 20,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  tabUnderline: {
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabUnderlineActive: {
    borderBottomColor: '#050505',
  },
  tabUnderlineText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  tabUnderlineTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: 10,
    right: -10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  heroActionBanner: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  recomIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recomActionBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  recomActionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  kpiBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  kpiIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBoxLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  kpiBoxVal: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  statsRightText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },
  emptyBranchBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyAddBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  branchItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
});
