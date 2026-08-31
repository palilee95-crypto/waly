import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
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
  const { user, refreshSession, isOwner, staffPermissions } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<'Today' | 'This Week' | 'This Month'>('Today');
  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pricing, setPricing] = useState({
    base_price_1m: 119,
    discount_3m: 5,
    discount_6m: 10,
    discount_9m: 12,
    discount_12m: 15,
    enable_3m: true,
    enable_6m: true,
    enable_9m: true,
    enable_12m: true,
  });

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [activePromos, setActivePromos] = useState<any[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<1 | 3 | 6 | 9 | 12>(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const record = await pb.collection('pricing_settings').getOne('pricesettings01');
        setPricing({
          base_price_1m: record.base_price_1m || 119,
          discount_3m: record.discount_3m || 5,
          discount_6m: record.discount_6m || 10,
          discount_9m: record.discount_9m || 12,
          discount_12m: record.discount_12m || 15,
          enable_3m: record.enable_3m !== false,
          enable_6m: record.enable_6m !== false,
          enable_9m: record.enable_9m !== false,
          enable_12m: record.enable_12m !== false,
        });
      } catch (err) {
        console.warn('Failed to load dynamic pricing, using defaults:', err);
      }
    };
    const loadPromos = async () => {
      try {
        const records = await pb.collection('subscription_promo_codes').getFullList({
          filter: 'is_active = true',
          sort: '-created',
        });
        setActivePromos(records);
      } catch (err) {
        console.warn('Failed to load promo codes:', err);
      }
    };
    if (user) {
      loadPricing();
      loadPromos();
    }
  }, [user]);

  useEffect(() => {
    // Reset selectedMonths to 1 if the selected option gets disabled
    if (selectedMonths === 3 && !pricing.enable_3m) setSelectedMonths(1);
    if (selectedMonths === 6 && !pricing.enable_6m) setSelectedMonths(1);
    if (selectedMonths === 9 && !pricing.enable_9m) setSelectedMonths(1);
    if (selectedMonths === 12 && !pricing.enable_12m) setSelectedMonths(1);
  }, [pricing, selectedMonths]);

  const handleApplyPromo = async () => {
    setPromoError('');
    setPromoSuccess('');
    const code = promoCode.trim();
    if (!code) return;
    try {
      const record = await pb.collection('subscription_promo_codes').getFirstListItem(`code = "${code}" && is_active = true`);
      setAppliedPromo({
        code: record.code,
        discount_type: record.discount_type,
        discount_value: record.discount_value,
      });
      setPromoSuccess(
        record.discount_type === 'percentage'
          ? `Promo applied! -${record.discount_value}% off`
          : `Promo applied! -RM${record.discount_value} off`
      );
    } catch (err) {
      setPromoError('Invalid or expired promo code.');
      setAppliedPromo(null);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoSuccess('');
    setPromoError('');
  };

  const handleUpgradePress = () => {
    router.push('/(merchant)/subscription' as any);
  };

  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);
  const [claimInputs, setClaimInputs] = useState<{ [claimId: string]: { billAmount: string; stampAmount: number } }>({});

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const fetchPendingClaims = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const records = await pb.collection('nfc_claims').getFullList({
        filter: `merchant = '${user.merchant_id}' && status = 'pending'`,
        sort: '-created',
        requestKey: null,
      });
      setPendingClaims(records);

      setClaimInputs((prev) => {
        const next = { ...prev };
        records.forEach((c) => {
          if (!next[c.id]) {
            next[c.id] = {
              billAmount: c.bill_amount ? String(c.bill_amount) : '10',
              stampAmount: c.stamp_amount ? Number(c.stamp_amount) : 1,
            };
          }
        });
        return next;
      });
    } catch (err) {
      console.warn('Failed to fetch pending NFC claims:', err);
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    const inputs = claimInputs[claimId] || { billAmount: '10', stampAmount: 1 };
    const billAmt = parseFloat(inputs.billAmount) || 0;
    const stampAmt = parseInt(String(inputs.stampAmount), 10) || 1;

    setProcessingClaimId(claimId);
    try {
      const res = await pb.send('/api/risev/nfc/complete', {
        method: 'POST',
        body: JSON.stringify({
          claim_id: claimId,
          bill_amount: billAmt,
          stamp_amount: stampAmt,
        }),
      });
      if (res.success || res.message?.includes('completed')) {
        setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));
        fetchMerchantData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve claim');
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleDeclineClaim = async (claimId: string) => {
    setProcessingClaimId(claimId);
    try {
      await pb.collection('nfc_claims').update(claimId, { status: 'cancelled' });
      setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (err: any) {
      console.warn('Failed to decline claim:', err);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const fetchMerchantData = async () => {
    if (!user || !user.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      fetchPendingClaims();

      // 0. Fetch active/trialing subscription
      try {
        const subList = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = '${user.merchant_id}' && status = 'active'`,
          sort: '-created',
        });
        if (subList.items.length > 0) {
          setActiveSubscription(subList.items[0]);
        } else {
          setActiveSubscription(null);
        }
      } catch (subErr) {
        setActiveSubscription(null);
      }

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

  useFocusEffect(
    useCallback(() => {
      fetchMerchantData();
    }, [user])
  );

  useEffect(() => {
    fetchMerchantData();

    // Subscribe to merchants, transactions, subscriptions & nfc_claims
    if (user && user.merchant_id) {
      pb.collection('merchants').subscribe(user.merchant_id, () => {
        fetchMerchantData();
      }).catch(() => {});

      pb.collection('transactions').subscribe('*', () => {
        fetchMerchantData();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).catch(() => {});

      pb.collection('subscriptions').subscribe('*', () => {
        fetchMerchantData();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).catch(() => {});

      pb.collection('nfc_claims').subscribe('*', () => {
        fetchPendingClaims();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).catch(() => {});
    }

    return () => {
      if (user && user.merchant_id) {
        pb.collection('merchants').unsubscribe(user.merchant_id).catch(() => {});
      }
      pb.collection('transactions').unsubscribe('*').catch(() => {});
      pb.collection('subscriptions').unsubscribe('*').catch(() => {});
      pb.collection('nfc_claims').unsubscribe('*').catch(() => {});
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
      const amt = tx.bill_amount ?? tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
      return acc + Number(amt);
    }, 0);

  const salesProgressPercentage = Math.min((salesThisMonth / monthlySalesGoal) * 100, 100);
  const remainingSales = Math.max(monthlySalesGoal - salesThisMonth, 0);

  const mappedActivities: ActivityItem[] = filteredTransactions.map((tx: any) => {
    const cust = tx.expand?.customer;
    const billAmt = tx.bill_amount ?? tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      {/* Scrollable Dashboard View */}
      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        contentContainerStyle={[
          { paddingBottom: 110, minHeight: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Background - full black, spanning full width */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 + insets.top, zIndex: 0, backgroundColor: '#050505' }} />

        {/* Centered Content Wrapper */}
        <View style={[
          { paddingTop: 16 + insets.top, paddingHorizontal: 20, gap: 20 },
          isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
        ]}>
          {/* Header Content */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{ uri: merchant?.logo ? pb.files.getURL(merchant, merchant.logo) : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' }}
              style={[styles.merchantAvatar, { borderColor: '#050505', borderWidth: 2 }]}
            />
            <View style={styles.profileTextWrap}>
              <Text style={[styles.welcomeSub, { color: 'rgba(255,255,255,0.7)' }]}>{t('welcome_back')}</Text>
              <Text style={[styles.merchantName, { color: '#FFFFFF' }]}>{merchant?.name || 'Boutique Royal'}</Text>
            </View>
          </View>
          
          <Image
            source={require('../../assets/risev logo.png')}
            style={{ width: 96, height: 32, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>

        {/* Unified Floating Analytics Card */}
        <View style={{ backgroundColor: '#FFC700', borderRadius: 24, padding: 24, shadowColor: '#050505', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 6, zIndex: 10, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
            {/* Stamps Awarded */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="wallet-outline" size={14} color="#050505" />
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{t('total_stamps_awarded')}</Text>
              </View>
              <Text style={{ fontSize: 32, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', letterSpacing: -1 }}>
                {loading ? '...' : totalStampsAwarded.toLocaleString()}
              </Text>
            </View>

            {/* Scan QR Button */}
            <TouchableOpacity 
              style={{ backgroundColor: '#050505', borderRadius: 16, width: 64, height: 64, alignItems: 'center', justifyContent: 'center', shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
              onPress={() => router.push('/(merchant)/give')}
            >
              <Ionicons name="qr-code" size={28} color="#FFC700" />
            </TouchableOpacity>
          </View>

          {/* Sales Progress (Only for Owner or Staff with can_view_analytics) */}
          {(isOwner || staffPermissions?.can_view_analytics) && (
            <View style={{ backgroundColor: '#050505', borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="trending-up" size={14} color="#FFC700" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700' }}>{t('this_months_sales')}</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.7)' }}>
                  Goal: RM{monthlySalesGoal.toLocaleString()}
                </Text>
              </View>
              <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', marginBottom: 12 }}>
                {loading ? '...' : `RM ${salesThisMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              </Text>
              <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${salesProgressPercentage}%`, backgroundColor: '#FFC700', borderRadius: 3 }} />
              </View>
            </View>
          )}
        </View>

        {/* 🎯 Real-time Customer Quota Tracker Card */}
        {(() => {
          const customerCount = new Set(transactions.map((t: any) => t.customer).filter(Boolean)).size || 0;
          const isPro = activeSubscription?.plan === 'pro' || activeSubscription?.plan === 'business' || activeSubscription?.plan === 'enterprise';
          const quotaLimit = isPro ? Infinity : 500;
          const percentage = isPro ? 100 : Math.min(100, Math.round((customerCount / quotaLimit) * 100));
          const isNearLimit = !isPro && customerCount >= 400;
          const isCritical = !isPro && customerCount >= 475;
          
          return (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#050505',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 10,
              elevation: 2,
              marginTop: -8,
              marginBottom: 4,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isPro ? '#EEF2FF' : '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="people" size={15} color={isPro ? '#4F46E5' : '#B45309'} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      Customer Quota
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      {isPro ? `${(activeSubscription?.plan || 'PRO').toUpperCase()} Plan • Unlimited` : 'Stand Welcome Bundle • No Expiry'}
                    </Text>
                  </View>
                </View>

                {!isPro ? (
                  <TouchableOpacity 
                    onPress={() => router.push('/(merchant)/subscription' as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#050505',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                      gap: 4
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>Upgrade</Text>
                    <Ionicons name="arrow-forward" size={10} color="#FFC700" />
                  </TouchableOpacity>
                ) : (
                  <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>ACTIVE</Text>
                  </View>
                )}
              </View>

              {/* Progress bar */}
              <View style={{ height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                <View 
                  style={{ 
                    height: '100%', 
                    width: isPro ? '100%' : `${Math.max(4, percentage)}%`, 
                    backgroundColor: isPro ? '#4F46E5' : (isCritical ? '#EF4444' : isNearLimit ? '#F59E0B' : '#FFC700'), 
                    borderRadius: 5 
                  }} 
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                  {customerCount.toLocaleString()} {isPro ? '' : `/ ${quotaLimit.toLocaleString()}`} <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Customers</Text>
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: isPro ? '#4F46E5' : (isNearLimit ? '#EA580C' : '#059669') }}>
                  {isPro ? 'Unlimited ♾️' : `${Math.max(0, quotaLimit - customerCount).toLocaleString()} remaining`}
                </Text>
              </View>
            </View>
          );
        })()}



        {/* ⚡ DEDICATED PENDING STAMP REQUESTS SECTION (MONOCHROME B&W) */}
        <View style={styles.pendingSectionContainer}>
          <View style={styles.pendingHeaderRow}>
            <Text style={styles.pendingSectionTitle}>Pending Stamp Requests ({pendingClaims.length})</Text>
          </View>

          {pendingClaims.length === 0 ? (
            <View style={styles.pendingEmptyCard}>
              <View style={styles.pendingEmptyIconWrap}>
                <Ionicons name="radio-outline" size={22} color="#050505" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingEmptyTitle}>Ready for Customer NFC Taps</Text>
                <Text style={styles.pendingEmptyDesc}>
                  Customer stamp claim requests will pop up here in real-time.
                </Text>
              </View>
            </View>
          ) : (
            pendingClaims.map((claim) => {
              const cInput = claimInputs[claim.id] || { billAmount: '10', stampAmount: 1 };
              const isProcessing = processingClaimId === claim.id;
              const timeAgoStr = claim.created ? getTimeAgo(new Date(claim.created)) : 'Just now';

              return (
                <View key={claim.id} style={styles.pendingCard}>
                  {/* Customer Info Header */}
                  <View style={styles.pendingCustomerHeader}>
                    <View style={styles.customerAvatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{(claim.customer_name || 'C')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingCustomerName}>{claim.customer_name || 'Walk-in Customer'}</Text>
                      <Text style={styles.pendingCustomerPhone}>{claim.customer_phone}</Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={12} color="#64748B" />
                      <Text style={styles.timeBadgeText}>{timeAgoStr}</Text>
                    </View>
                  </View>

                  {/* Input Controls: Bill Amount & Stamps Count */}
                  <View style={styles.pendingInputRow}>
                    {/* Bill Amount */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingInputLabel}>BILL AMOUNT (RM)</Text>
                      <View style={styles.amountInputWrap}>
                        <Text style={styles.currencySymbol}>RM</Text>
                        <TextInput
                          style={styles.amountInput}
                          value={cInput.billAmount}
                          onChangeText={(val) =>
                            setClaimInputs((prev) => ({
                              ...prev,
                              [claim.id]: { ...cInput, billAmount: val },
                            }))
                          }
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                        {['10', '20', '50'].map((amt) => (
                          <TouchableOpacity
                            key={amt}
                            style={[
                              styles.presetChip,
                              cInput.billAmount === amt && styles.presetChipActive,
                            ]}
                            onPress={() =>
                              setClaimInputs((prev) => ({
                                ...prev,
                                [claim.id]: { ...cInput, billAmount: amt },
                              }))
                            }
                          >
                            <Text style={[styles.presetChipText, cInput.billAmount === amt && styles.presetChipTextActive]}>
                              RM{amt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Stamp Count Stepper */}
                    <View style={{ width: 110 }}>
                      <Text style={styles.pendingInputLabel}>STAMPS</Text>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() =>
                            setClaimInputs((prev) => ({
                              ...prev,
                              [claim.id]: { ...cInput, stampAmount: Math.max(1, cInput.stampAmount - 1) },
                            }))
                          }
                        >
                          <Ionicons name="remove" size={14} color="#050505" />
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{cInput.stampAmount}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() =>
                            setClaimInputs((prev) => ({
                              ...prev,
                              [claim.id]: { ...cInput, stampAmount: cInput.stampAmount + 1 },
                            }))
                          }
                        >
                          <Ionicons name="add" size={14} color="#050505" />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                        {[1, 2, 3].map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.presetChip,
                              cInput.stampAmount === s && styles.presetChipActive,
                            ]}
                            onPress={() =>
                              setClaimInputs((prev) => ({
                                ...prev,
                                [claim.id]: { ...cInput, stampAmount: s },
                              }))
                            }
                          >
                            <Text style={[styles.presetChipText, cInput.stampAmount === s && styles.presetChipTextActive]}>
                              {s}★
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.pendingActionsRow}>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDeclineClaim(claim.id)}
                      disabled={isProcessing}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#64748B" />
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.approveBtn, isProcessing && { opacity: 0.6 }]}
                      onPress={() => handleApproveClaim(claim.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.approveBtnText}>Approve & Credit Stamps</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        </View>

      </ScrollView>

      {/* Redesigned Premium Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 420 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Upgrade to Merchant Pro</Text>
              <TouchableOpacity onPress={() => setShowUpgradeModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Ensure uninterrupted access to dynamic loyalty cards, broadcast blasts, and auto WhatsApp notifications.
            </Text>

            {/* 1. Select Duration Dropdown */}
            <Text style={styles.sectionLabel}>SELECT PLAN DURATION</Text>
            <View style={{ width: '100%', marginBottom: 12 }}>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.dropdownHeaderText}>
                    {selectedMonths === 1 ? '1 Month' : `${selectedMonths} Months`}
                  </Text>
                  {(() => {
                    let disc = 0;
                    if (selectedMonths === 3) disc = pricing.discount_3m;
                    else if (selectedMonths === 6) disc = pricing.discount_6m;
                    else if (selectedMonths === 9) disc = pricing.discount_9m;
                    else if (selectedMonths === 12) disc = pricing.discount_12m;
                    if (disc > 0) {
                      return (
                        <View style={[styles.planDiscountBadge, { marginTop: 0 }]}>
                          <Text style={styles.planDiscountText}>-{disc}%</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
                <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={styles.dropdownList}>
                  {([1, 3, 6, 9, 12] as const)
                    .filter((m) => {
                      if (m === 1) return true;
                      if (m === 3) return pricing.enable_3m;
                      if (m === 6) return pricing.enable_6m;
                      if (m === 9) return pricing.enable_9m;
                      if (m === 12) return pricing.enable_12m;
                      return false;
                    })
                    .map((m) => {
                      const isSelected = selectedMonths === m;
                      let disc = 0;
                      if (m === 3) disc = pricing.discount_3m;
                      else if (m === 6) disc = pricing.discount_6m;
                      else if (m === 9) disc = pricing.discount_9m;
                      else if (m === 12) disc = pricing.discount_12m;

                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() => {
                            setSelectedMonths(m);
                            setIsDropdownOpen(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                            {m === 1 ? '1 Month' : `${m} Months`}
                          </Text>
                          {disc > 0 && (
                            <View style={[styles.planDiscountBadge, { marginTop: 0 }]}>
                              <Text style={styles.planDiscountText}>-{disc}%</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )}
            </View>

            {/* 2. Promo Code Input */}
            <View style={styles.promoRow}>
              <TextInput
                style={[styles.promoInput, appliedPromo && { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="Promo or voucher code"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                editable={!appliedPromo}
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
              <TouchableOpacity
                style={[styles.promoBtn, appliedPromo && { backgroundColor: '#EF4444' }]}
                onPress={appliedPromo ? handleRemovePromo : handleApplyPromo}
                activeOpacity={0.8}
              >
                <Text style={styles.promoBtnText}>{appliedPromo ? 'Remove' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
            {promoError ? <Text style={styles.promoErrorText}>{promoError}</Text> : null}
            {promoSuccess ? <Text style={styles.promoSuccessText}>{promoSuccess}</Text> : null}

            {/* 3. Pricing Summary */}
            {(() => {
              const basePrice = pricing.base_price_1m;
              const months = selectedMonths;
              const rawTotal = basePrice * months;
              
              let durationDiscountPercent = 0;
              if (months === 3) durationDiscountPercent = pricing.discount_3m;
              else if (months === 6) durationDiscountPercent = pricing.discount_6m;
              else if (months === 9) durationDiscountPercent = pricing.discount_9m;
              else if (months === 12) durationDiscountPercent = pricing.discount_12m;

              const durationDiscountAmount = rawTotal * (durationDiscountPercent / 100);
              const priceAfterDurationDiscount = rawTotal - durationDiscountAmount;

              let promoDiscountAmount = 0;
              if (appliedPromo) {
                if (appliedPromo.discount_type === 'percentage') {
                  promoDiscountAmount = priceAfterDurationDiscount * (appliedPromo.discount_value / 100);
                } else {
                  promoDiscountAmount = Math.min(priceAfterDurationDiscount, appliedPromo.discount_value);
                }
              }

              const finalPrice = Math.max(0, priceAfterDurationDiscount - promoDiscountAmount);

              return (
                <View style={styles.summarySection}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subscription ({months === 1 ? '1 Month' : `${months} Months`})</Text>
                    <Text style={styles.summaryValue}>RM {rawTotal.toFixed(2)}</Text>
                  </View>
                  {durationDiscountAmount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Plan Discount (-{durationDiscountPercent}%)</Text>
                      <Text style={[styles.summaryValue, { color: '#10B981' }]}>-RM {durationDiscountAmount.toFixed(2)}</Text>
                    </View>
                  )}
                  {promoDiscountAmount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Voucher Discount</Text>
                      <Text style={[styles.summaryValue, { color: '#10B981' }]}>-RM {promoDiscountAmount.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.summaryTotalRow}>
                    <Text style={styles.summaryTotalLabel}>Total Price</Text>
                    <Text style={styles.summaryTotalValue}>RM {finalPrice.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity
              style={[styles.payBtn, { marginTop: 20 }]}
              onPress={() => {
                setShowUpgradeModal(false);
                router.push('/(merchant)/subscription' as any);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.payBtnText}>Upgrade Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
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
    backgroundColor: '#050505', // Carbon black card
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#050505',
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
    color: '#050505',
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
    backgroundColor: '#050505', // Black progress fill
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
    backgroundColor: '#050505',
    borderColor: '#050505',
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
    color: '#050505', // Black stamps counter text
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E4E0F5',
    marginBottom: 16,
    shadowColor: '#1C1340',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  trialTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trialBadge: {
    backgroundColor: '#1C1340',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trialBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  trialDays: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
  },
  trialTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  trialSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
    marginBottom: 12,
  },
  trialBarWrap: {
    height: 6,
    backgroundColor: '#E4E0F5',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  trialBarFill: {
    height: '100%',
    backgroundColor: '#1C1340',
    borderRadius: 3,
  },
  trialFeatures: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  trialFeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trialFeatText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
  },
  trialPromoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  trialPromoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4F2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E4E0F5',
  },
  trialPromoChipActive: {
    backgroundColor: '#1C1340',
    borderColor: '#1C1340',
  },
  trialPromoChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1340',
  },
  trialPromoChipTextActive: {
    color: '#FFFFFF',
  },
  trialPromoChipDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
  },
  trialPromoChipDescActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  trialPromoSuccess: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#22C55E',
    marginBottom: 8,
  },
  trialPromoError: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#EF4444',
    marginBottom: 8,
  },
  trialBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trialPrice: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  trialPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trialPriceStrikethrough: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  trialPriceDiscounted: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#22C55E',
  },
  trialUpgradeBtn: {
    backgroundColor: '#1C1340',
    borderRadius: 10,
    paddingHorizontal: 18,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialUpgradeBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 8,
  },
  planGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 4,
    width: '100%',
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planCardActive: {
    borderColor: '#050505',
    backgroundColor: '#F8FAFC',
  },
  planDuration: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
  },
  planDiscountBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  planDiscountText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
    width: '100%',
  },
  promoInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    backgroundColor: '#FFFFFF',
  },
  promoBtn: {
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  promoSuccessText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#10B981',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  promoErrorText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  summarySection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 6,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  payBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#050505',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  dropdownHeaderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1E293B',
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    width: '100%',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemActive: {
    backgroundColor: '#F8FAFC',
  },
  dropdownItemText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  dropdownItemTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0040e0',
  },
  // Dedicated Pending Stamp Requests Styles (Monochrome B&W)
  pendingSectionContainer: {
    marginBottom: 40,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingSectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  pendingEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  pendingEmptyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingEmptyTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  pendingEmptyDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  pendingCustomerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pendingCustomerName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  pendingCustomerPhone: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  pendingInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  pendingInputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 10,
  },
  currencySymbol: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  presetChipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  pendingActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  declineBtn: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  declineBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  approveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#050505',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
});
