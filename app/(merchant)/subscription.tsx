import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Image, 
  Alert, 
  Platform,
  Linking,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

const { width: screenWidth } = Dimensions.get('window');

const BENEFITS = [
  { icon: 'rocket', title: 'Grow 5x Faster', desc: 'Digital loyalty cards that customers love.' },
  { icon: 'chatbubble-ellipses', title: 'WhatsApp Automation', desc: 'Send stamp alerts & broadcasts instantly.' },
  { icon: 'flash', title: 'NFC Magic Stand', desc: 'Collect stamps in 2 seconds at the counter.' }
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; order_id?: string; plan?: string; cycle?: string; checkout?: string }>();
  const { user, refreshSession, switchRole } = useAuth();
  const { locale } = useLanguage();
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureType, setFailureType] = useState<'cancelled' | 'failed'>('cancelled');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'fpx' | 'card' | 'duitnow'>('fpx');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [standTotalQuota, setStandTotalQuota] = useState(500);
  const [customerCount, setCustomerCount] = useState(0);
  const [monthlyCustomerCount, setMonthlyCustomerCount] = useState(0);

  // Stand Activation Code States (TikTok Shop / Shopee fulfillment)
  const [standCodeInput, setStandCodeInput] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [monthlyBookingCount, setMonthlyBookingCount] = useState(0);
  const [branchCount, setBranchCount] = useState(1);
  const [staffCount, setStaffCount] = useState(1);
  const [activeVoucherCount, setActiveVoucherCount] = useState(0);
  const [showUsageModal, setShowUsageModal] = useState(false);

  // Auto-open checkout modal if requested via route params
  useEffect(() => {
    if (params.plan === 'starter' || params.plan === 'pro') {
      setSelectedPlan(params.plan);
    }
    if (params.cycle === 'monthly' || params.cycle === 'annually') {
      setBillingCycle(params.cycle);
    }
    if (params.checkout === 'true') {
      setShowCheckoutModal(true);
    }
  }, [params.plan, params.cycle, params.checkout]);

  // Handle gateway callback status
  useEffect(() => {
    if (params.status === 'success') {
      refreshSession();
      setShowSuccessModal(true);
    } else if (params.status === 'cancelled') {
      setFailureType('cancelled');
      setShowFailureModal(true);
    } else if (params.status === 'failed') {
      setFailureType('failed');
      setShowFailureModal(true);
    }
  }, [params.status]);

  // Load real subscription & customer database count (Total & Monthly)
  useEffect(() => {
    if (!user?.merchant_id) return;
    const fetchSubData = async () => {
      try {
        const subs = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}" && status = "active"`,
          sort: '-created',
        });
        if (subs.items.length > 0) {
          setActiveSub(subs.items[0]);
        }
        
        // Total stand quota from redeemed activation codes
        try {
          const codes = await pb.collection('activation_codes').getFullList({
            filter: `redeemed_by = "${user.merchant_id}" && is_redeemed = true`,
            requestKey: null,
          });
          if (codes.length > 0) {
            const sumQuota = codes.reduce((acc: number, c: any) => acc + (Number(c.quota) > 0 ? Number(c.quota) : 500), 0);
            if (sumQuota > 0) setStandTotalQuota(sumQuota);
          }
        } catch (codeErr) {}

        // Total customers ever registered
        const allCards = await pb.collection('loyalty_cards').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}"`,
        });
        setCustomerCount(allCards.totalItems);

        // Monthly customers registered in current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().replace('T', ' ').substring(0, 19);
        const monthlyCards = await pb.collection('loyalty_cards').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}" && created >= "${startOfMonth}"`,
        });
        setMonthlyCustomerCount(monthlyCards.totalItems);

        // Monthly bookings count
        try {
          const monthlyBookings = await pb.collection('bookings').getList(1, 1, {
            filter: `merchant = "${user.merchant_id}" && created >= "${startOfMonth}"`,
            requestKey: null,
          });
          setMonthlyBookingCount(monthlyBookings.totalItems);
        } catch {}

        // Outlets count
        try {
          const bList = await pb.collection('merchant_branches').getFullList({
            filter: `merchant = "${user.merchant_id}"`,
            requestKey: null,
          });
          setBranchCount(bList.length + 1);
        } catch {
          setBranchCount(1);
        }

        // Staff count
        try {
          const sList = await pb.collection('staff_accounts').getFullList({
            filter: `merchant = "${user.merchant_id}"`,
            requestKey: null,
          });
          setStaffCount(sList.length);
        } catch {
          setStaffCount(1);
        }

        // Active vouchers / rewards count
        try {
          const vList = await pb.collection('rewards').getFullList({
            filter: `merchant = "${user.merchant_id}" && is_active = true`,
            requestKey: null,
          });
          setActiveVoucherCount(vList.length);
        } catch {
          setActiveVoucherCount(0);
        }
      } catch (e) {}
    };
    fetchSubData();
  }, [user?.merchant_id]);

  const handleRedeemCode = async () => {
    if (!standCodeInput.trim()) {
      setCodeError(locale === 'en' ? 'Please enter your stand activation code.' : 'Sila masukkan kod pengaktifan stand anda.');
      return;
    }
    setIsRedeemingCode(true);
    setCodeError('');
    setCodeSuccess('');

    try {
      const res = await pb.send<{ success: boolean; message: string; plan?: string }>('/api/risev/merchant/redeem-stand-code', {
        method: 'POST',
        body: { code: standCodeInput.trim() },
      });

      if (res.success) {
        setCodeSuccess(res.message || 'Activation code redeemed successfully!');
        setStandCodeInput('');
        await refreshSession();
        setShowSuccessModal(true);
      } else {
        setCodeError(res.message || 'Invalid activation code.');
      }
    } catch (err: any) {
      setCodeError(err.message || 'Failed to redeem activation code.');
    } finally {
      setIsRedeemingCode(false);
    }
  };

  // Auto-play benefits slider
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % BENEFITS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const getPriceDetails = () => {
    if (selectedPlan === 'starter') {
      return {
        price: billingCycle === 'monthly' ? 'RM 47' : 'RM 38',
        originalPrice: billingCycle === 'monthly' ? 'RM 59' : 'RM 49',
        label: 'Starter Plan'
      };
    } else {
      return {
        price: billingCycle === 'monthly' ? 'RM 97' : 'RM 78',
        originalPrice: billingCycle === 'monthly' ? 'RM 129' : 'RM 99',
        label: 'PRO Plan'
      };
    }
  };

  const currentPrice = getPriceDetails();

  const getOrderSummary = () => {
    const isAnnual = billingCycle === 'annually';
    if (selectedPlan === 'starter') {
      const monthlyRate = isAnnual ? 38 : 47;
      const baseMonthly = isAnnual ? 59 : 59;
      const subtotal = baseMonthly * (isAnnual ? 12 : 1);
      const total = monthlyRate * (isAnnual ? 12 : 1);
      const discount = subtotal - total;
      return {
        planTitle: 'Starter Plan',
        badgeColor: '#64748B',
        badgeBg: '#F1F5F9',
        icon: 'cube-outline' as const,
        monthlyRate,
        months: isAnnual ? 12 : 1,
        subtotal,
        discount,
        total,
        periodLabel: isAnnual ? (locale === 'en' ? '12 Months (Annual)' : '12 Bulan (Tahunan)') : (locale === 'en' ? '1 Month (Monthly)' : '1 Bulan (Bulanan)'),
        highlights: locale === 'en' ? [
          '300 customer quota per renewal',
          'Basic booking engine (30 bookings / mo)',
          'Single Store Outlet (HQ) & up to 5 staff'
        ] : [
          'Kuota 300 pelanggan setiap pembaharuan',
          'Sistem tempahan asas (30 tempahan / bln)',
          '1 Outlet (HQ) & hingga 5 akaun staf'
        ]
      };
    } else {
      const monthlyRate = isAnnual ? 78 : 97;
      const baseMonthly = isAnnual ? 129 : 129;
      const subtotal = baseMonthly * (isAnnual ? 12 : 1);
      const total = monthlyRate * (isAnnual ? 12 : 1);
      const discount = subtotal - total;
      return {
        planTitle: 'PRO Plan',
        badgeColor: '#4F46E5',
        badgeBg: '#EEF2FF',
        icon: 'star-outline' as const,
        monthlyRate,
        months: isAnnual ? 12 : 1,
        subtotal,
        discount,
        total,
        periodLabel: isAnnual ? (locale === 'en' ? '12 Months (Annual - Save 20%)' : '12 Bulan (Tahunan - Jimat 20%)') : (locale === 'en' ? '1 Month (Monthly)' : '1 Bulan (Bulanan)'),
        highlights: locale === 'en' ? [
          'Unlimited customer database ♾️',
          'Unlimited bookings & staff commission',
          'Up to 5 store outlets (1 HQ + 4 Branches)',
          'Milestone rewards & birthday automation',
          'Up to 10 staff accounts'
        ] : [
          'Database pelanggan tanpa had ♾️',
          'Tempahan tanpa had & komisen staf',
          'Hingga 5 outlet (1 HQ + 4 Cawangan)',
          'Ganjaran kemajuan & automasi hari lahir',
          'Hingga 10 akaun staf'
        ]
      };
    }
  };

  const handlePurchase = () => {
    setShowCheckoutModal(true);
  };

  const handleProceedToPayment = async () => {
    setProcessingPayment(true);
    const summary = getOrderSummary();
    
    try {
      const res = await pb.send<{
        success: boolean;
        order_id: string;
        payment_url?: string;
        message?: string;
      }>('/api/risev/merchant/subscription/checkout', {
        method: 'POST',
        body: {
          plan: selectedPlan,
          billing_cycle: billingCycle,
          payment_method: selectedPaymentMethod,
        }
      });

      setProcessingPayment(false);
      setShowCheckoutModal(false);

      if (res.payment_url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = res.payment_url;
        } else {
          Linking.openURL(res.payment_url);
        }
      } else {
        const methodNames: Record<string, string> = {
          fpx: 'FPX Online Banking',
          card: 'Credit / Debit Card',
          duitnow: 'DuitNow QR / E-Wallet'
        };

        Alert.alert(
          locale === 'en' ? 'Order Created' : 'Pesanan Dicipta',
          locale === 'en' 
            ? `Order #${res.order_id || 'PENDING'} for ${summary.planTitle} (${summary.periodLabel}) total RM ${summary.total.toLocaleString()} prepared via ${methodNames[selectedPaymentMethod]}.`
            : `Pesanan #${res.order_id || 'PENDING'} untuk ${summary.planTitle} (${summary.periodLabel}) berjumlah RM ${summary.total.toLocaleString()} disediakan melalui ${methodNames[selectedPaymentMethod]}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      setProcessingPayment(false);
      Alert.alert('Checkout Error', err.message || 'Failed to initialize checkout session.');
    }
  };

  const getFeaturesList = () => {
    if (selectedPlan === 'starter') {
      return [
        '300 customer quota per renewal',
        'Single Store Outlet (HQ)',
        'Basic Analytics Dashboard',
        'Up to 10 active vouchers',
        'Up to 5 staff accounts',
        'Email support',
        '[LOCK] Unlimited Customer Database',
        '[LOCK] 4 Extra Branches (1 HQ + 4 Branches)',
        '[LOCK] Pro Sales & Opportunity Analytics',
        '[LOCK] Up to 10 staff accounts'
      ];
    } else {
      return [
        'Everything in Starter',
        'Unlimited customer database ♾️',
        'Up to 5 store outlets (1 HQ + 4 Branches)',
        'Pro Sales & Opportunity Analytics',
        'Unlimited active vouchers',
        'Up to 10 staff accounts',
        'Priority WhatsApp support'
      ];
    }
  };

  return (
    <View style={styles.container}>
      {/* Dark header bleed — sits behind the SafeAreaView header only */}
      <View style={styles.headerBleed} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Sticky Header with Logo & Tagline */}
          <View style={styles.header}>
            <View style={[styles.headerTop, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity 
                  style={styles.closeBtn} 
                  onPress={async () => {
                    if (user?.merchant_status === 'active') {
                      router.replace('/(merchant)');
                    } else {
                      await switchRole('customer');
                      router.replace('/(customer)');
                    }
                  }} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </TouchableOpacity>
                <View>
                  <Text style={styles.headerUpsellTitle}>Subscription Plan</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                    {locale === 'en' ? 'Manage store tier & quota' : 'Urus taraf kedai & kuota'}
                  </Text>
                </View>
              </View>
              <Image 
                source={require('../../assets/risev logo.png')}
                style={{ width: 85, height: 26, resizeMode: 'contain' }}
              />
            </View>
          </View>

          <View style={styles.scrollContent}>

          {/* 1. Current Active Plan & Quota Status Card (Clear White Compact Style) */}
          {user?.merchant_status === 'active' ? (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 13,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: '#FFCC00',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="sparkles" size={16} color="#050505" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.3 }}>
                      {activeSub?.plan === 'stand_bundle'
                        ? 'Stand Starter Bundle'
                        : activeSub?.plan === 'starter'
                          ? 'Starter Plan'
                          : activeSub?.plan === 'business'
                            ? 'Business Plan'
                            : 'PRO Plan'}
                    </Text>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                      {activeSub?.plan === 'stand_bundle' ? 'Included with NFC Plate' : 'Executive VIP Membership'}
                    </Text>
                  </View>
                </View>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#DCFCE7',
                  borderWidth: 1,
                  borderColor: '#86EFAC',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 20,
                }}>
                  <View style={{ width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: '#16A34A' }} />
                  <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D', letterSpacing: 0.4 }}>ACTIVE VIP</Text>
                </View>
              </View>

              {/* Dual Quota Milestones */}
              <View style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginTop: 10,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                gap: 9,
              }}>
                {/* 1. Customer Database Quota */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="people-outline" size={13} color="#64748B" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        {locale === 'en' ? 'Customer Database' : 'Pangkalan Pelanggan'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {customerCount.toLocaleString()}
                      </Text>
                      {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? (
                        <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE047', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Unlimited ♾️</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          / {(activeSub?.plan === 'stand_bundle' ? standTotalQuota : 300).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ height: 4.5, backgroundColor: '#E2E8F0', borderRadius: 2.5, overflow: 'hidden' }}>
                    <View style={{ 
                      height: '100%', 
                      width: activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                        ? '100%'
                        : `${Math.min(100, Math.round((customerCount / (activeSub?.plan === 'stand_bundle' ? standTotalQuota : 300)) * 100))}%`, 
                      backgroundColor: '#FFCC00', 
                      borderRadius: 2.5 
                    }} />
                  </View>
                </View>

                {/* 2. Monthly Bookings Quota */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="calendar-outline" size={13} color="#64748B" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        {locale === 'en' ? 'Monthly Bookings' : 'Tempahan (Bulan Ini)'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {monthlyBookingCount.toLocaleString()}
                      </Text>
                      {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? (
                        <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE047', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Unlimited ♾️</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          / 30
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ height: 4.5, backgroundColor: '#E2E8F0', borderRadius: 2.5, overflow: 'hidden' }}>
                    <View style={{ 
                      height: '100%', 
                      width: activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                        ? '100%'
                        : `${Math.min(100, Math.round((monthlyBookingCount / 30) * 100))}%`, 
                      backgroundColor: '#10B981', 
                      borderRadius: 2.5 
                    }} />
                  </View>
                </View>
              </View>

              {/* Expiry Details & Usage Milestones Action */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons 
                    name={activeSub?.plan === 'stand_bundle' ? "infinite" : "calendar-outline"} 
                    size={13} 
                    color="#64748B" 
                  />
                  <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    {activeSub?.plan === 'stand_bundle'
                      ? 'Lifetime Hardware License'
                      : activeSub?.current_period_end 
                        ? `Renews on ${new Date(activeSub.current_period_end.replace(' ', 'T')).toLocaleDateString()}` 
                        : 'Active Subscription'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowUsageModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {locale === 'en' ? 'Usage Details' : 'Milestone Kuota'}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Option B: Buy NFC Stand in-app (Daylight White Squircle with Gold Accent) */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 14,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.8}
            onPress={() => router.push('/(merchant)/nfc-marketplace')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#FFCC00',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="cart" size={19} color="#050505" />
              </View>
              <View>
                <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  {locale === 'en' ? "Don't have a Stand?" : "Belum ada NFC Stand?"}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                  {locale === 'en' ? "Get RiseV NFC Bundle · Lifetime Quota" : "Dapatkan Bundle NFC RiseV · Kuota Seumur Hidup"}
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: '#050505',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                Order
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#FFCC00" />
            </View>
          </TouchableOpacity>

          {/* 2. Explore Plans Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
            <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.3 }}>
              Explore Plans
            </Text>
            <TouchableOpacity onPress={() => setShowUsageModal(true)} activeOpacity={0.7}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                {locale === 'en' ? 'Compare benefits' : 'Bandingkan ciri'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3. Segmented Cadence Toggle (Monthly / Annually) */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: '#F1F5F9',
            borderRadius: 14,
            padding: 4,
            marginBottom: 14,
          }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 11,
                backgroundColor: billingCycle === 'monthly' ? '#000000' : 'transparent',
              }}
              onPress={() => setBillingCycle('monthly')}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 12.5,
                fontFamily: billingCycle === 'monthly' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                color: billingCycle === 'monthly' ? '#FFFFFF' : '#475569',
              }}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 11,
                backgroundColor: billingCycle === 'annually' ? '#000000' : 'transparent',
              }}
              onPress={() => setBillingCycle('annually')}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 12.5,
                fontFamily: billingCycle === 'annually' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                color: billingCycle === 'annually' ? '#FFFFFF' : '#475569',
              }}>
                Annually (Save 20%)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4. Plan Selector: Stacked Radio Cards */}
          {/* Starter Plan */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 14,
              marginBottom: 10,
              borderWidth: selectedPlan === 'starter' ? 2 : 1,
              borderColor: selectedPlan === 'starter' ? '#FFCC00' : '#E2E8F0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: selectedPlan === 'starter' ? 0.05 : 0.02,
              shadowRadius: 6,
              elevation: selectedPlan === 'starter' ? 2 : 1,
            }}
            onPress={() => setSelectedPlan('starter')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {selectedPlan === 'starter' ? (
                <View style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#FEF08A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#000000' }} />
                </View>
              ) : (
                <View style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  borderWidth: 2,
                  borderColor: '#CBD5E1',
                  backgroundColor: '#FFFFFF',
                }} />
              )}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    Starter
                  </Text>
                  {activeSub?.status === 'active' && activeSub?.plan === 'starter' ? (
                    <View style={{ backgroundColor: '#FEF08A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#854D0E' }}>Current</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                  Essential loyalty & 30 bookings/mo
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                {billingCycle === 'monthly' ? 'RM 47' : 'RM 38'}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                / month
              </Text>
            </View>
          </TouchableOpacity>

          {/* PRO Plan */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 14,
              marginBottom: 18,
              borderWidth: selectedPlan === 'pro' ? 2 : 1,
              borderColor: selectedPlan === 'pro' ? '#FFCC00' : '#E2E8F0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: selectedPlan === 'pro' ? '#FFCC00' : '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: selectedPlan === 'pro' ? 0.12 : 0.02,
              shadowRadius: 8,
              elevation: selectedPlan === 'pro' ? 3 : 1,
            }}
            onPress={() => setSelectedPlan('pro')}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {selectedPlan === 'pro' ? (
                <View style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#FEF08A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#000000' }} />
                </View>
              ) : (
                <View style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  borderWidth: 2,
                  borderColor: '#CBD5E1',
                  backgroundColor: '#FFFFFF',
                }} />
              )}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    PRO
                  </Text>
                  {activeSub?.status === 'active' && (activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise') ? (
                    <View style={{ backgroundColor: '#FEF08A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#854D0E' }}>Current</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#FEF08A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#854D0E' }}>Popular</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                  Unlimited loyalty, bookings & team
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                {billingCycle === 'monthly' ? 'RM 97' : 'RM 78'}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                / month
              </Text>
            </View>
          </TouchableOpacity>

          {/* 5. Key Differences Table */}
          <View style={{ marginBottom: 14 }}>
            {/* Table Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                Key Differences
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: 85, textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                  Starter
                </Text>
                <View style={{ width: 85, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 3 }}>
                  <Text style={{ textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    PRO
                  </Text>
                </View>
              </View>
            </View>

            {/* Table Content Container */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              overflow: 'hidden',
            }}>
              {[
                { icon: 'people-outline' as const, label: 'Customer capacity', starter: '300', pro: 'Unlimited ♾️' },
                { icon: 'calendar-outline' as const, label: 'Booking engine', starter: '30 / month', pro: 'Unlimited' },
                { icon: 'storefront-outline' as const, label: 'Business outlets', starter: '1 (HQ)', pro: '5 Outlets' },
                { icon: 'person-add-outline' as const, label: 'Staff accounts', starter: 'Up to 5', pro: '10 + Comm' },
                { icon: 'gift-outline' as const, label: 'Milestone loyalty', starter: 'Standard', pro: 'All Engines 🎁' },
                { icon: 'ticket-outline' as const, label: 'Active vouchers', starter: '5 Max', pro: 'Unlimited' },
              ].map((item, index, arr) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: index === arr.length - 1 ? 0 : 1,
                    borderBottomColor: '#F1F5F9',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name={item.icon} size={16} color="#64748B" />
                    <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}>
                      {item.label}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ width: 85, textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      {item.starter}
                    </Text>
                    <View style={{ width: 85, alignItems: 'center', backgroundColor: '#F8FAFC', paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {item.pro}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 6. Sticky IAP Action Footer — inside SafeAreaView so it always shows */}
      <View style={styles.stickyFooter}>
        {(() => {
          const activePlanRaw = (user?.merchant_status === 'active' && activeSub?.status === 'active') ? activeSub?.plan : 'none';
          const activePlanNormalized = (activePlanRaw === 'enterprise' || activePlanRaw === 'business') ? 'enterprise' : activePlanRaw;
          const planRank: Record<string, number> = { none: 0, stand_bundle: 1, starter: 2, pro: 3, enterprise: 4, business: 4 };
          const isCurrentPlan = activePlanNormalized === selectedPlan;
          const isUpgrade = planRank[selectedPlan] > (planRank[activePlanNormalized] || 0);

          return (
            <TouchableOpacity 
              style={[
                styles.ctaButton,
                isCurrentPlan && { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.2 }
              ]} 
              onPress={isCurrentPlan ? undefined : handlePurchase}
              disabled={isCurrentPlan}
              activeOpacity={isCurrentPlan ? 1 : 0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isCurrentPlan && <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
                <Text style={[styles.ctaButtonText, isCurrentPlan && { color: '#FFFFFF' }]}>
                  {isCurrentPlan 
                    ? (locale === 'en' ? 'Current Active Plan' : 'Pelan Aktif Semasa')
                    : isUpgrade
                      ? (selectedPlan === 'pro' 
                          ? (locale === 'en' ? 'Upgrade to PRO (Recommended)' : 'Naik Taraf ke PRO (Disyorkan)')
                          : (locale === 'en' ? 'Subscribe to Starter' : 'Langgan Pelan Starter'))
                      : (locale === 'en' ? 'Switch to Starter' : 'Tukar ke Starter')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Legal Row */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Alert.alert('Restore Purchases', 'Restoring past purchases...')}><Text style={styles.legalLink}>Restore Purchases</Text></TouchableOpacity>
          <Text style={styles.legalSeparator}>•</Text>
          <TouchableOpacity onPress={() => Alert.alert('Terms of Service', 'Terms of service details...')}><Text style={styles.legalLink}>Terms</Text></TouchableOpacity>
          <Text style={styles.legalSeparator}>•</Text>
          <TouchableOpacity onPress={() => Alert.alert('Privacy Policy', 'Privacy policy details...')}><Text style={styles.legalLink}>Privacy</Text></TouchableOpacity>
        </View>
      </View>

      {/* Usage Milestones & Feature Breakdown Modal */}
      <Modal
        visible={showUsageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUsageModal(false)}
      >
        <View style={styles.checkoutOverlay}>
          <TouchableOpacity 
            style={styles.checkoutOverlayBg} 
            activeOpacity={1} 
            onPress={() => setShowUsageModal(false)} 
          />

          <View style={[styles.checkoutSheet, { maxHeight: '85%' }]}>
            {/* Sheet Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  {locale === 'en' ? 'Feature Usage & Milestones' : 'Milestone Penggunaan Ciri'}
                </Text>
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                  {locale === 'en' ? 'Live status of your monthly plan entitlements' : 'Status langsung kuota pelan bulanan anda'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowUsageModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
              {/* Active Tier Pill */}
              <View style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="shield-checkmark" size={16} color="#000000" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? 'PRO Plan (VIP Member)' : 'Starter Plan'}
                    </Text>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      {activeSub?.current_period_end ? `Renews: ${new Date(activeSub.current_period_end.replace(' ', 'T')).toLocaleDateString()}` : 'Active Lifetime License'}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>ACTIVE</Text>
                </View>
              </View>

              {/* Metric 1: Customer Database */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="people" size={15} color="#B45309" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Customer Database' : 'Pangkalan Pelanggan'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                          ? 'Unlimited customer registration'
                          : `${Math.max(0, 300 - customerCount)} quota balance remaining`}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {customerCount} {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? '♾️' : '/ 300'}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                      ? '100%'
                      : `${Math.min(100, Math.round((customerCount / 300) * 100))}%`,
                    backgroundColor: '#FFCC00',
                  }} />
                </View>
              </View>

              {/* Metric 2: Monthly Bookings */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="calendar" size={15} color="#15803D" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Bookings (This Month)' : 'Tempahan (Bulan Ini)'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                          ? 'Unlimited storefront bookings'
                          : `${Math.max(0, 30 - monthlyBookingCount)} bookings balance remaining`}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {monthlyBookingCount} {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? '♾️' : '/ 30'}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                      ? '100%'
                      : `${Math.min(100, Math.round((monthlyBookingCount / 30) * 100))}%`,
                    backgroundColor: '#10B981',
                  }} />
                </View>
              </View>

              {/* Metric 3: Outlets & Branches */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="storefront" size={15} color="#6D28D9" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Business Outlets' : 'Cawangan Kedai'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                          ? 'Up to 5 outlets included (1 HQ + 4 Branches)'
                          : '1 Single HQ outlet'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {branchCount} / {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? '5' : '1'}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((branchCount / (activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? 5 : 1)) * 100))}%`,
                    backgroundColor: '#8B5CF6',
                  }} />
                </View>
              </View>

              {/* Metric 4: Staff Accounts */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-add" size={15} color="#0369A1" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Staff Accounts' : 'Akaun Staf'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                          ? 'Up to 10 staff with commission engine'
                          : 'Up to 5 cashier accounts'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {staffCount} / {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? '10' : '5'}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((staffCount / (activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? 10 : 5)) * 100))}%`,
                    backgroundColor: '#0284C7',
                  }} />
                </View>
              </View>

              {/* Metric 5: Active Vouchers */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="ticket" size={15} color="#DC2626" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Active Vouchers' : 'Baucar Aktif'}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                          ? 'Unlimited active vouchers & discount campaigns'
                          : `${Math.max(0, 5 - activeVoucherCount)} active vouchers remaining`}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {activeVoucherCount} {activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise' ? '♾️' : '/ 5'}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: activeSub?.plan === 'pro' || activeSub?.plan === 'business' || activeSub?.plan === 'enterprise'
                      ? '100%'
                      : `${Math.min(100, Math.round((activeVoucherCount / 5) * 100))}%`,
                    backgroundColor: '#EF4444',
                  }} />
                </View>
              </View>

              {/* Bottom Action */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#050505',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginTop: 6,
                }}
                onPress={() => setShowUsageModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                  {locale === 'en' ? 'Close Breakdown' : 'Tutup Status Kuota'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Checkout Order Summary Modal */}
      <Modal
        visible={showCheckoutModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <View style={styles.checkoutOverlay}>
          <TouchableOpacity 
            style={styles.checkoutOverlayBg} 
            activeOpacity={1} 
            onPress={() => setShowCheckoutModal(false)} 
          />

          <View style={styles.checkoutSheet}>
            {/* Sheet Handle */}
            <View style={styles.checkoutHandle} />

            {/* Header */}
            <View style={styles.checkoutHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.checkoutTitle}>
                    {locale === 'en' ? 'Checkout Summary' : 'Ringkasan Pesanan'}
                  </Text>
                  <View style={styles.securePill}>
                    <Ionicons name="lock-closed" size={9} color="#15803D" />
                    <Text style={styles.securePillText}>SSL SECURE</Text>
                  </View>
                </View>
                <Text style={styles.checkoutSubtitle}>
                  {locale === 'en' ? 'Review & complete your subscription' : 'Semak & lengkapkan langganan anda'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowCheckoutModal(false)} 
                style={styles.checkoutCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Selected Plan VIP Card */}
              {(() => {
                const summary = getOrderSummary();
                const isPro = selectedPlan === 'pro';

                return (
                  <>
                    <View style={[
                      styles.vipPlanCard,
                      isPro && styles.vipPlanCardPro,
                    ]}>
                      {/* Top Plan Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.vipIconWrap, { backgroundColor: isPro ? 'rgba(99, 102, 241, 0.2)' : 'rgba(148, 163, 184, 0.2)' }]}>
                            <Ionicons name={summary.icon} size={20} color={isPro ? '#A5B4FC' : '#E2E8F0'} />
                          </View>
                          <View>
                            <Text style={styles.vipPlanTitle}>{summary.planTitle}</Text>
                            <Text style={styles.vipPlanPeriod}>{summary.periodLabel}</Text>
                          </View>
                        </View>
                        <View style={styles.vipPricePill}>
                          <Text style={styles.vipPricePillAmount}>RM {summary.monthlyRate}</Text>
                          <Text style={styles.vipPricePillPer}>/mo</Text>
                        </View>
                      </View>

                      {/* Feature Highlights Grid */}
                      <View style={styles.vipFeatureGrid}>
                        {summary.highlights.map((h, i) => (
                          <View key={i} style={styles.vipFeatureItem}>
                            <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                            <Text style={styles.vipFeatureText} numberOfLines={1}>
                              {h}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Merchant Account Identity Bar */}
                    <View style={styles.merchantIdentityBar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.merchantAvatarCircle}>
                          <Ionicons name="storefront" size={14} color="#B45309" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.merchantStoreName} numberOfLines={1}>
                            {(user as any)?.merchant_name || user?.name || 'Risev Merchant'}
                          </Text>
                          <Text style={styles.merchantIdTag}>
                            ID: {user?.merchant_id || 'M-DEFAULT'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.invoiceBadgePill}>
                        <Ionicons name="receipt-outline" size={11} color="#059669" />
                        <Text style={styles.invoiceBadgePillText}>WhatsApp Invoice</Text>
                      </View>
                    </View>

                    {/* Payment Method Notice Card (White-Labeled) */}
                    <View style={{ marginTop: 14, marginBottom: 14 }}>
                      <View style={styles.paymentMethodNoticeCard}>
                        <View style={styles.paymentMethodNoticeIconWrap}>
                          <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={styles.paymentMethodNoticeTitle}>
                              {locale === 'en' ? 'Secure Online Payment' : 'Pembayaran Atas Talian Selamat'}
                            </Text>
                            <View style={styles.feePill}>
                              <Text style={styles.feePillText}>0% FEE</Text>
                            </View>
                          </View>
                          <Text style={styles.paymentMethodNoticeSubtitle}>
                            FPX • Visa / Mastercard • DuitNow QR • Touch 'n Go
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Price Breakdown Card */}
                    <View style={styles.modernInvoiceBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.invoiceRowLabel}>
                          {summary.planTitle} ({summary.months} {summary.months > 1 ? (locale === 'en' ? 'Months' : 'Bulan') : (locale === 'en' ? 'Month' : 'Bulan')})
                        </Text>
                        <Text style={styles.invoiceRowValue}>RM {summary.subtotal.toFixed(2)}</Text>
                      </View>

                      {summary.discount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={styles.savingsPill}>
                            <Ionicons name="sparkles" size={11} color="#15803D" />
                            <Text style={styles.savingsPillText}>
                              {locale === 'en' ? 'Annual Discount (20% OFF)' : 'Diskaun Tahunan (Jimat 20%)'}
                            </Text>
                          </View>
                          <Text style={styles.savingsValue}>- RM {summary.discount.toFixed(2)}</Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.invoiceRowLabel}>
                          {locale === 'en' ? 'Processing & Server Fee' : 'Yuran Pemprosesan & Server'}
                        </Text>
                        <Text style={styles.invoiceRowValue}>RM 0.00</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={styles.invoiceRowLabel}>
                          {locale === 'en' ? 'SST / Service Tax' : 'Cukai Perkhidmatan (SST)'}
                        </Text>
                        <Text style={styles.invoiceRowValue}>RM 0.00</Text>
                      </View>

                      <View style={styles.invoiceDivider} />

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                        <View>
                          <Text style={styles.invoiceGrandTotalLabel}>
                            {locale === 'en' ? 'Total Payable' : 'Jumlah Perlu Dibayar'}
                          </Text>
                          <Text style={styles.invoiceGrandTotalSub}>
                            {locale === 'en' ? 'All taxes & platform fees included' : 'Semua cukai & yuran platform termasuk'}
                          </Text>
                        </View>
                        <Text style={styles.invoiceGrandTotalAmount}>
                          RM {summary.total.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Trust & Guarantee Banner */}
                    <View style={styles.modernTrustBanner}>
                      <Ionicons name="shield-checkmark" size={15} color="#059669" />
                      <Text style={styles.modernTrustBannerText}>
                        {locale === 'en' 
                          ? '256-Bit SSL Encrypted • Instant Upgrade • Cancel Anytime'
                          : 'Penyulitan SSL 256-Bit • Pengaktifan Segera • Batal Bila-bila Masa'}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </ScrollView>

            {/* Bottom Proceed Button */}
            <View style={styles.checkoutActionContainer}>
              <TouchableOpacity
                style={[styles.proceedBtn, processingPayment && { opacity: 0.7 }]}
                onPress={handleProceedToPayment}
                disabled={processingPayment}
                activeOpacity={0.85}
              >
                {processingPayment ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="lock-closed" size={15} color="#050505" />
                    <Text style={styles.proceedBtnText}>
                      {locale === 'en' 
                        ? `Proceed to Pay RM ${getOrderSummary().total.toFixed(2)}`
                        : `Bayar RM ${getOrderSummary().total.toFixed(2)} Sekarang`}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color="#050505" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Success Celebratory Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.replace('/(merchant)');
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 28,
            width: '100%',
            maxWidth: 420,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 4,
              borderColor: '#BBF7D0',
            }}>
              <Ionicons name="checkmark-circle" size={42} color="#16A34A" />
            </View>

            <Text style={{
              fontSize: 20,
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: -0.3,
            }}>
              {locale === 'en' ? 'Payment Successful! 🎉' : 'Pembayaran Berjaya! 🎉'}
            </Text>

            <Text style={{
              fontSize: 13,
              fontFamily: 'PlusJakartaSans_500Medium',
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}>
              {locale === 'en'
                ? 'Your store subscription is now active! Enjoy official WhatsApp automation, customer analytics, and unlimited CRM growth.'
                : 'Langganan kedai anda kini aktif! Nikmati automasi WhatsApp rasmi, analitik pelanggan, dan pertumbuhan CRM tanpa had.'}
            </Text>

            {params.order_id ? (
              <View style={{
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                  {locale === 'en' ? 'Reference:' : 'Rujukan:'}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  {params.order_id}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: '#FFC700',
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
                shadowColor: '#FFC700',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/(merchant)');
              }}
              activeOpacity={0.85}
            >
              <Text style={{
                fontSize: 14,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                color: '#050505',
              }}>
                {locale === 'en' ? 'Enter Merchant Dashboard →' : 'Masuk Papan Pemuka →'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                paddingVertical: 8,
                alignItems: 'center',
              }}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: 'PlusJakartaSans_600SemiBold',
                color: '#64748B',
              }}>
                {locale === 'en' ? 'Stay on Subscriptions' : 'Kekal di Halaman Langganan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Unsuccessful / Cancelled Modal */}
      <Modal
        visible={showFailureModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFailureModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 28,
            width: '100%',
            maxWidth: 420,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          }}>
            {/* Status Icon */}
            <View style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              backgroundColor: failureType === 'cancelled' ? '#FEF3C7' : '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 4,
              borderColor: failureType === 'cancelled' ? '#FDE68A' : '#FECACA',
            }}>
              <Ionicons 
                name={failureType === 'cancelled' ? 'close-circle' : 'alert-circle'} 
                size={40} 
                color={failureType === 'cancelled' ? '#D97706' : '#DC2626'} 
              />
            </View>

            {/* Title */}
            <Text style={{
              fontSize: 20,
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: -0.3,
            }}>
              {failureType === 'cancelled'
                ? (locale === 'en' ? 'Payment Incomplete' : 'Pembayaran Dibatalkan')
                : (locale === 'en' ? 'Payment Unsuccessful' : 'Pembayaran Tidak Berjaya')}
            </Text>

            {/* Explanatory Description */}
            <Text style={{
              fontSize: 13,
              fontFamily: 'PlusJakartaSans_500Medium',
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 20,
            }}>
              {failureType === 'cancelled'
                ? (locale === 'en'
                    ? 'You left the payment gateway before completing checkout. No charges were made to your bank account, and your current store plan was unchanged.'
                    : 'Anda telah meninggalkan gerbang pembayaran sebelum selesai. Tiada sebarang bayaran ditolak daripada akaun bank anda, dan pelan kedai anda tidak berubah.')
                : (locale === 'en'
                    ? 'Your bank or payment method could not complete this transaction. No funds were captured. Please try again or choose another payment method.'
                    : 'Bank atau kaedah pembayaran anda tidak dapat melengkapkan transaksi ini. Tiada wang ditolak. Sila cuba lagi atau pilih kaedah pembayaran lain.')}
            </Text>

            {/* Action CTA: Resume / Try Again */}
            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: '#FFC700',
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
                shadowColor: '#FFC700',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={() => {
                setShowFailureModal(false);
                setShowCheckoutModal(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={{
                fontSize: 14,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                color: '#050505',
              }}>
                {failureType === 'cancelled'
                  ? (locale === 'en' ? 'Resume Checkout ⚡' : 'Sambung Pembayaran ⚡')
                  : (locale === 'en' ? 'Try Again ⚡' : 'Cuba Lagi ⚡')}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action: Dismiss */}
            <TouchableOpacity
              style={{
                paddingVertical: 8,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowFailureModal(false);
                router.replace('/(merchant)');
              }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: 'PlusJakartaSans_600SemiBold',
                color: '#64748B',
              }}>
                {locale === 'en' ? 'Back to Dashboard' : 'Kembali ke Papan Pemuka'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBleed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#FFFFFF',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerUpsell: {
    marginTop: 24,
    width: '100%',
  },
  headerUpsellTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerUpsellDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 8,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
    backgroundColor: '#F8FAFC',
    paddingTop: 18,
    flex: 1,
  },
  upsellSparkle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,199,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  upsellCopyText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 16,
  },
  dotInactive: {
    width: 4,
    backgroundColor: '#334155',
  },
  billingToggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  billingToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  billingToggleText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  billingToggleTextActive: {
    color: '#050505',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  planSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  planCardActive: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF5',
  },
  proPlanCardHighlight: {
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bestSellerTag: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFC700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  bestSellerTagText: {
    fontSize: 7.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  planCardTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  planCardPrice: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 6,
  },
  planCardPeriod: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  priceHighlightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  highlightPlanName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  highlightActivePrice: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  highlightOriginalPrice: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    alignSelf: 'baseline',
  },
  highlightPeriod: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  highlightBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highlightBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  timerText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EA580C',
  },
  featuresBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  featureText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    flex: 1,
  },
  inlineBadge: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    backgroundColor: '#FEF3C7',
    color: '#D97706',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stickyFooter: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  ctaButton: {
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  legalLink: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  legalSeparator: {
    fontSize: 10,
    color: '#E2E8F0',
  },

  // Checkout Modal Styles (Ultra-Refined Modern Design)
  checkoutOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 5, 5, 0.7)',
  },
  checkoutOverlayBg: {
    ...StyleSheet.absoluteFill,
  },
  checkoutSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  checkoutHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 4,
  },
  checkoutTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.3,
  },
  checkoutSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  securePillText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  checkoutCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // VIP Plan Card
  vipPlanCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  vipPlanCardPro: {
    backgroundColor: '#0A0E1A',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.25,
  },
  vipPlanCardBusiness: {
    backgroundColor: '#110D05',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
  },
  vipIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipPlanTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  vipPlanPeriod: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  vipPricePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  vipPricePillAmount: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  vipPricePillPer: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#CBD5E1',
  },
  vipFeatureGrid: {
    gap: 7,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  vipFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  vipFeatureText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#E2E8F0',
    flex: 1,
  },

  // Merchant Account Strip
  merchantIdentityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  merchantAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantStoreName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  merchantIdTag: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 1,
  },
  invoiceBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  invoiceBadgePillText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#059669',
  },

  // Payment Method Options
  checkoutSectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modernPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  modernPaymentCardActive: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF7',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  modernPaymentIconBg: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernPaymentIconBgActive: {
    backgroundColor: '#FEF3C7',
  },
  modernPaymentTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  modernPaymentSubtitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  instantPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  instantPillText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  feePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  feePillText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  modernRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modernRadioActive: {
    borderColor: '#050505',
    backgroundColor: '#FFC700',
  },
  modernRadioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#050505',
  },
  paymentMethodNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  paymentMethodNoticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodNoticeTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  paymentMethodNoticeSubtitle: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B45309',
  },

  // Invoice Breakdown
  modernInvoiceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: 12,
  },
  invoiceRowLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  invoiceRowValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingsPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  savingsValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#16A34A',
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  invoiceGrandTotalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  invoiceGrandTotalSub: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  invoiceGrandTotalAmount: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.4,
  },

  // Trust Strip
  modernTrustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 4,
  },
  modernTrustBannerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
    textAlign: 'center',
  },

  // Checkout Action CTA
  checkoutActionContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  proceedBtn: {
    backgroundColor: '#FFC700',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  proceedBtnText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.2,
  },
});
