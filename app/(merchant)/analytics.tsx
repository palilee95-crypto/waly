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
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Path, Polyline } from 'react-native-svg';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [helpModal, setHelpModal] = useState({ visible: false, title: '', message: '' });

  const showHelp = (title: string, message: string) => {
    setHelpModal({ visible: true, title, message });
  };
  const isDesktop = windowWidth >= 768;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loyaltyCards, setLoyaltyCards] = useState<any[]>([]);
  const [merchant, setMerchant] = useState<any>(null);

  // Timeframe states
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
        });
        setLoyaltyCards(cards);
      } catch (err) {
        console.warn('Failed to fetch analytics data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.merchant_id]);

  // Dynamic Transaction Filter
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
    // Unique customers checked-in during this period
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

    // Filter cards by those who had transactions in the active period
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
        { length: t1Len, offset: 0, color: '#FFC700', label: 'Stalled at 1-3 Stamps', count: funnelMetrics.tier1, pct: funnelMetrics.tier1Pct },
        { length: t2Len, offset: -t1Len, color: '#050505', label: 'Stalled at 4-7 Stamps', count: funnelMetrics.tier2, pct: funnelMetrics.tier2Pct },
        { length: t3Len, offset: -(t1Len + t2Len), color: '#10B981', label: 'Close to Reward (8-10)', count: funnelMetrics.tier3, pct: funnelMetrics.tier3Pct }
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

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#050505" />
        <Text style={styles.loaderText}>Analysing sales data...</Text>
      </View>
    );
  }

  const logoUrl = merchant?.logo 
    ? pb.files.getURL(merchant, merchant.logo)
    : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'absolute', top: -16, left: -20, right: -20, height: 210, backgroundColor: '#050505', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, zIndex: 0 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, marginTop: 10, marginBottom: 15, width: '100%' }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Sales Gaps & Insights</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 10, marginBottom: 25 }}>
          <Image source={{ uri: logoUrl }} style={styles.avatarImg} />
          <Text style={styles.merchantNameText}>{merchant?.name || 'Scoop Creamy'}</Text>
        </View>

        {/* 📅 Refined Floating Timeframe Selector */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          padding: 6,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: -20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          shadowColor: '#050505',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.02,
          shadowRadius: 8,
          elevation: 2,
          zIndex: 20
        }}>
          {(['daily', 'monthly', 'yearly', 'custom'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setTimeframe(tab)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: timeframe === tab ? '#FFC700' : 'transparent',
                borderRadius: 18,
              }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                color: timeframe === tab ? '#050505' : '#64748B',
                textTransform: 'capitalize'
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 📅 Premium Custom Date Range Card */}
        {timeframe === 'custom' && (
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#050505',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.03,
            shadowRadius: 16,
            elevation: 3,
            zIndex: 20
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="calendar-outline" size={14} color="#FFC700" />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5 }}>
                FILTER BY CUSTOM RANGE (YYYY-MM-DD)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Start Date */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  Start Date
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  height: 44,
                  gap: 8
                }}>
                  <Ionicons name="play" size={10} color="#FFC700" />
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: 'PlusJakartaSans_600SemiBold',
                      color: '#050505',
                      outlineStyle: 'none'
                    } as any}
                  />
                </View>
              </View>

              {/* End Date */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  End Date
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  height: 44,
                  gap: 8
                }}>
                  <Ionicons name="stop" size={10} color="#EF4444" />
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: 'PlusJakartaSans_600SemiBold',
                      color: '#050505',
                      outlineStyle: 'none'
                    } as any}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 💳 Retention stats card */}
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

        {/* 📊 KPI Grid */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people" size={14} color="#3B82F6" />
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Total Customers</Text>
                <TouchableOpacity onPress={() => showHelp('Total Customers', 'The total number of unique customers who visited or made a transaction during the filtered timeframe.')}>
                  <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {merchantMetrics.totalCustomers.toLocaleString()}
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cash" size={14} color="#10B981" />
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Total Sales</Text>
                <TouchableOpacity onPress={() => showHelp('Total Sales', 'The total gross sales generated from transactions completed within this timeframe.')}>
                  <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                RM {merchantMetrics.totalSales.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="ribbon" size={14} color="#F59E0B" />
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Stamps Issued</Text>
                <TouchableOpacity onPress={() => showHelp('Stamps Issued', 'The total number of stamps rewarded to customers on their loyalty cards during this timeframe.')}>
                  <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {merchantMetrics.totalStamps.toLocaleString()}
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="star" size={14} color="#8B5CF6" />
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Points Issued</Text>
                <TouchableOpacity onPress={() => showHelp('Points Issued', 'The total number of membership points earned by customers during this timeframe.')}>
                  <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {merchantMetrics.totalPoints.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Average Spending Customer */}
          <View style={{ backgroundColor: '#050505', borderRadius: 20, padding: 16, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255, 199, 0, 0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ionicons name="wallet" size={18} color="#FFC700" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }} numberOfLines={1}>
                    Avg Spending per Customer
                  </Text>
                  <TouchableOpacity onPress={() => showHelp('Average Spending per Customer', 'The average spending calculated per active customer card in this period. Higher averages indicate high-value transaction tickets.')}>
                    <Ionicons name="help-circle-outline" size={12} color="rgba(255, 255, 255, 0.6)" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }} numberOfLines={1}>
                  Average spending calculated per customer card
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                  RM {merchantMetrics.avgSpending.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 📉 Visual Churn Rate Gauge Card */}
        <View style={styles.chartCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Customer Retention Health</Text>
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

        {/* 📉 Segment 1: Stamp Funnel Donut Chart */}
        <View style={styles.chartCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Stamp Funnel Drop-off</Text>
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
                  members
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
        </View>

        {/* 📊 Segment 2: Sales Data Chart (6-Month Sales Trend) */}
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

        {/* 🕒 Segment 3: Busiest Hours vs. Slow Hours */}
        <View style={styles.chartCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Busiest Hours vs. Slow Hours</Text>
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
      </ScrollView>

      {/* Custom styled Help Tooltip Modal Card Overlay */}
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
    paddingBottom: 48,
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
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 16,
    zIndex: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  statsRightText: {
    fontSize: 11,
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
    padding: 20,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
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
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
});
