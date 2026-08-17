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
} from 'react-native';
import { useRouter } from 'expo-router';
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
  const { user, refreshSession } = useAuth();
  const { locale } = useLanguage();
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'fpx' | 'card' | 'duitnow'>('fpx');
  const [processingPayment, setProcessingPayment] = useState(false);

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
    } else if (selectedPlan === 'pro') {
      return {
        price: billingCycle === 'monthly' ? 'RM 97' : 'RM 78',
        originalPrice: billingCycle === 'monthly' ? 'RM 129' : 'RM 99',
        label: 'PRO Plan'
      };
    } else {
      return {
        price: billingCycle === 'monthly' ? 'RM 329' : 'RM 263',
        originalPrice: billingCycle === 'monthly' ? 'RM 499' : 'RM 399',
        label: 'Business Plan'
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
          '500 monthly customer quota',
          'Basic analytics dashboard',
          '1 staff account'
        ] : [
          'Kuota 500 pelanggan bulanan',
          'Papan pemuka analitik asas',
          '1 akaun staf'
        ]
      };
    } else if (selectedPlan === 'pro') {
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
          'Official Meta WhatsApp Automation',
          'Promotional WhatsApp Broadcasts',
          'Up to 5 staff accounts'
        ] : [
          'Database pelanggan tanpa had ♾️',
          'Automasi Rasmi Meta WhatsApp',
          'Pemasaran Broadcast WhatsApp',
          'Hingga 5 akaun staf'
        ]
      };
    } else {
      const monthlyRate = isAnnual ? 263 : 329;
      const baseMonthly = isAnnual ? 499 : 499;
      const subtotal = baseMonthly * (isAnnual ? 12 : 1);
      const total = monthlyRate * (isAnnual ? 12 : 1);
      const discount = subtotal - total;
      return {
        planTitle: 'Business Plan',
        badgeColor: '#D97706',
        badgeBg: '#FEF3C7',
        icon: 'business-outline' as const,
        monthlyRate,
        months: isAnnual ? 12 : 1,
        subtotal,
        discount,
        total,
        periodLabel: isAnnual ? (locale === 'en' ? '12 Months (Annual - Save 20%)' : '12 Bulan (Tahunan - Jimat 20%)') : (locale === 'en' ? '1 Month (Monthly)' : '1 Bulan (Bulanan)'),
        highlights: locale === 'en' ? [
          'Everything in PRO included',
          'Multi-branch outlet management',
          'Unlimited staff accounts',
          '24/7 dedicated support'
        ] : [
          'Semua ciri dalam PRO',
          'Sokongan pelbagai cawangan',
          'Akaun staf tanpa had',
          'Sokongan akaun 24/7'
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
        Linking.openURL(res.payment_url);
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
        '500 new unique customers / mo (Quota resets monthly)',
        'Up to 2 store outlets (1 HQ + 1 Branch)',
        'Basic Analytics Dashboard',
        'Up to 10 active vouchers',
        '1 staff account',
        'Email support',
        '[LOCK] Unlimited Customer Database',
        '[LOCK] Official Meta WhatsApp Automation',
        '[LOCK] Promotional Broadcasts',
        '[LOCK] 3+ Branch Outlets',
        '[LOCK] Up to 5 staff accounts'
      ];
    } else if (selectedPlan === 'pro') {
      return [
        'Everything in Starter',
        'Unlimited customer database ♾️',
        'Up to 2 store outlets (1 HQ + 1 Branch)',
        'Official Meta WhatsApp Automation',
        'Promotional WhatsApp Broadcasts',
        'Pro Sales & Opportunity Analytics',
        'Unlimited active vouchers',
        'Up to 5 staff accounts',
        'Priority WhatsApp support',
        '[LOCK] Unlimited (3+) Multi-Branch Engine',
        '[LOCK] Custom integration & White-label'
      ];
    } else {
      return [
        'Everything in PRO',
        'Unlimited staff accounts',
        'Unlimited (3+) Multi-Branch Engine',
        'Custom integration & APIs',
        'Custom branding',
        '24/7 dedicated account support'
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.8}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerUpsellTitle}>Subscription Plan</Text>
              </View>
              <Image 
                source={require('../../assets/risev logo.png')}
                style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
              />
            </View>
          </View>

          <View style={styles.scrollContent}>

          {/* 1. Current Active Plan & Quota Status Card */}
          <View style={{
            backgroundColor: '#050505',
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: 'rgba(255, 199, 0, 0.3)',
            shadowColor: '#050505',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Stand Starter Bundle
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                    Current Active Plan
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>ACTIVE</Text>
              </View>
            </View>

            {/* Quota Progress */}
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#CBD5E1' }}>
                  Customer Database Quota
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700' }}>
                  44 / 500
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: '8.8%', backgroundColor: '#FFC700', borderRadius: 3 }} />
              </View>
            </View>

            {/* Expiry Details */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="infinite" size={14} color="#10B981" />
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#10B981' }}>
                  No Expiry Date
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                Valid until 500 quota used
              </Text>
            </View>
          </View>

          {/* 2. Billing Toggle (Monthly / Annual) */}
          <View style={styles.billingToggleWrapper}>
            <TouchableOpacity 
              style={[styles.billingToggleBtn, billingCycle === 'monthly' && styles.billingToggleBtnActive]}
              onPress={() => setBillingCycle('monthly')}
              activeOpacity={0.8}
            >
              <Text style={[styles.billingToggleText, billingCycle === 'monthly' && styles.billingToggleTextActive]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.billingToggleBtn, billingCycle === 'annually' && styles.billingToggleBtnActive]}
              onPress={() => setBillingCycle('annually')}
              activeOpacity={0.8}
            >
              <Text style={[styles.billingToggleText, billingCycle === 'annually' && styles.billingToggleTextActive]}>
                Annually (Save 20%)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3. Compact Plan Selector (3 Columns Grid) */}
          <Text style={styles.sectionLabel}>Select your plan:</Text>
          <View style={styles.planSelectorRow}>
            {/* Starter Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'starter' && styles.planCardActive
              ]}
              onPress={() => setSelectedPlan('starter')}
              activeOpacity={0.9}
            >
              <Text style={styles.planCardTitle}>Starter</Text>
              <Text style={styles.planCardPrice}>
                {billingCycle === 'monthly' ? 'RM 47' : 'RM 38'}
              </Text>
              <Text style={styles.planCardPeriod}>/mo</Text>
            </TouchableOpacity>

            {/* Pro Plan (Best Seller) */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'pro' && styles.planCardActive,
                styles.proPlanCardHighlight
              ]}
              onPress={() => setSelectedPlan('pro')}
              activeOpacity={0.9}
            >
              <View style={styles.bestSellerTag}>
                <Text style={styles.bestSellerTagText}>POPULAR</Text>
              </View>
              <Text style={styles.planCardTitle}>PRO</Text>
              <Text style={[styles.planCardPrice, { color: '#050505' }]}>
                {billingCycle === 'monthly' ? 'RM 97' : 'RM 78'}
              </Text>
              <Text style={styles.planCardPeriod}>/mo</Text>
            </TouchableOpacity>

            {/* Business Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'enterprise' && styles.planCardActive
              ]}
              onPress={() => setSelectedPlan('enterprise')}
              activeOpacity={0.9}
            >
              <Text style={styles.planCardTitle}>Business</Text>
              <Text style={styles.planCardPrice}>
                {billingCycle === 'monthly' ? 'RM 329' : 'RM 263'}
              </Text>
              <Text style={styles.planCardPeriod}>/mo</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Live Pricing & Urgency block */}
          <View style={styles.priceHighlightCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.highlightPlanName}>{currentPrice.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <Text style={styles.highlightActivePrice}>{currentPrice.price}</Text>
                  <Text style={styles.highlightOriginalPrice}>{currentPrice.originalPrice}</Text>
                  <Text style={styles.highlightPeriod}>/ month</Text>
                </View>
              </View>
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightBadgeText}>BEST VALUE</Text>
              </View>
            </View>

            {/* Info note */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <Ionicons name="information-circle-outline" size={14} color="#64748B" />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                System subscription only. NFC VIP stands sold separately.
              </Text>
            </View>
          </View>

          {/* 5. Features List Box */}
          <Text style={styles.sectionLabel}>Features included:</Text>
          <View style={styles.featuresBox}>
            {getFeaturesList().map((feat, idx) => {
              const isLocked = feat.startsWith('[LOCK]');
              const cleanFeat = feat.replace('[LOCK] ', '');
              return (
                <View key={idx} style={styles.featureRow}>
                  <View style={[styles.checkBadge, { backgroundColor: isLocked ? '#F1F5F9' : '#FEF3C7' }]}>
                    <Ionicons 
                      name={isLocked ? "lock-closed" : "checkmark"} 
                      size={8} 
                      color={isLocked ? "#94A3B8" : "#B45309"} 
                    />
                  </View>
                  <Text style={[styles.featureText, isLocked && { color: '#94A3B8', textDecorationLine: 'line-through' }]}>
                    {cleanFeat}
                    {cleanFeat.includes('WhatsApp Automation') && <Text style={styles.inlineBadge}>  META API </Text>}
                  </Text>
                </View>
              );
            })}
           </View>
        </View>
      </ScrollView>

      {/* 6. Sticky IAP Action Footer — inside SafeAreaView so it always shows */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity 
          style={styles.ctaButton} 
          onPress={handlePurchase}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>
            {selectedPlan === 'starter' 
              ? 'Get Started with Starter' 
              : selectedPlan === 'pro' 
                ? 'Upgrade to PRO (Recommended)' 
                : 'Subscribe to Business Plan'}
          </Text>
        </TouchableOpacity>

        {/* Legal Row */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Alert.alert('Restore Purchases', 'Restoring past purchases...')}><Text style={styles.legalLink}>Restore Purchases</Text></TouchableOpacity>
          <Text style={styles.legalSeparator}>•</Text>
          <TouchableOpacity onPress={() => Alert.alert('Terms of Service', 'Terms of service details...')}><Text style={styles.legalLink}>Terms</Text></TouchableOpacity>
          <Text style={styles.legalSeparator}>•</Text>
          <TouchableOpacity onPress={() => Alert.alert('Privacy Policy', 'Privacy policy details...')}><Text style={styles.legalLink}>Privacy</Text></TouchableOpacity>
        </View>
      </View>

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
                const isBusiness = selectedPlan === 'enterprise';

                return (
                  <>
                    <View style={[
                      styles.vipPlanCard,
                      isPro && styles.vipPlanCardPro,
                      isBusiness && styles.vipPlanCardBusiness,
                    ]}>
                      {/* Top Plan Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.vipIconWrap, { backgroundColor: isPro ? 'rgba(99, 102, 241, 0.2)' : isBusiness ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)' }]}>
                            <Ionicons name={summary.icon} size={20} color={isPro ? '#A5B4FC' : isBusiness ? '#FCD34D' : '#E2E8F0'} />
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

                    {/* Payment Method Selector */}
                    <View style={{ marginTop: 16, marginBottom: 16 }}>
                      <Text style={styles.checkoutSectionLabel}>
                        {locale === 'en' ? 'Select Payment Method' : 'Pilih Kaedah Pembayaran'}
                      </Text>
                      <View style={{ gap: 8 }}>
                        {/* FPX */}
                        <TouchableOpacity
                          style={[
                            styles.modernPaymentCard,
                            selectedPaymentMethod === 'fpx' && styles.modernPaymentCardActive
                          ]}
                          onPress={() => setSelectedPaymentMethod('fpx')}
                          activeOpacity={0.85}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            <View style={[styles.modernPaymentIconBg, selectedPaymentMethod === 'fpx' && styles.modernPaymentIconBgActive]}>
                              <Ionicons name="business" size={18} color={selectedPaymentMethod === 'fpx' ? '#B45309' : '#475569'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.modernPaymentTitle}>FPX Online Banking</Text>
                                <View style={styles.instantPill}><Text style={styles.instantPillText}>POPULAR</Text></View>
                              </View>
                              <Text style={styles.modernPaymentSubtitle}>Maybank2u, CIMB, Bank Islam, RHB, Public Bank</Text>
                            </View>
                          </View>
                          <View style={[styles.modernRadio, selectedPaymentMethod === 'fpx' && styles.modernRadioActive]}>
                            {selectedPaymentMethod === 'fpx' && <View style={styles.modernRadioDot} />}
                          </View>
                        </TouchableOpacity>

                        {/* Card */}
                        <TouchableOpacity
                          style={[
                            styles.modernPaymentCard,
                            selectedPaymentMethod === 'card' && styles.modernPaymentCardActive
                          ]}
                          onPress={() => setSelectedPaymentMethod('card')}
                          activeOpacity={0.85}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            <View style={[styles.modernPaymentIconBg, selectedPaymentMethod === 'card' && styles.modernPaymentIconBgActive]}>
                              <Ionicons name="card" size={18} color={selectedPaymentMethod === 'card' ? '#B45309' : '#475569'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.modernPaymentTitle}>Credit / Debit Card</Text>
                                <View style={styles.feePill}><Text style={styles.feePillText}>0% FEE</Text></View>
                              </View>
                              <Text style={styles.modernPaymentSubtitle}>Visa, Mastercard, MyDebit (Instant Setup)</Text>
                            </View>
                          </View>
                          <View style={[styles.modernRadio, selectedPaymentMethod === 'card' && styles.modernRadioActive]}>
                            {selectedPaymentMethod === 'card' && <View style={styles.modernRadioDot} />}
                          </View>
                        </TouchableOpacity>

                        {/* DuitNow QR */}
                        <TouchableOpacity
                          style={[
                            styles.modernPaymentCard,
                            selectedPaymentMethod === 'duitnow' && styles.modernPaymentCardActive
                          ]}
                          onPress={() => setSelectedPaymentMethod('duitnow')}
                          activeOpacity={0.85}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            <View style={[styles.modernPaymentIconBg, selectedPaymentMethod === 'duitnow' && styles.modernPaymentIconBgActive]}>
                              <Ionicons name="qr-code" size={18} color={selectedPaymentMethod === 'duitnow' ? '#B45309' : '#475569'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.modernPaymentTitle}>DuitNow QR & E-Wallet</Text>
                              <Text style={styles.modernPaymentSubtitle}>Touch 'n Go, GrabPay, ShopeePay</Text>
                            </View>
                          </View>
                          <View style={[styles.modernRadio, selectedPaymentMethod === 'duitnow' && styles.modernRadioActive]}>
                            {selectedPaymentMethod === 'duitnow' && <View style={styles.modernRadioDot} />}
                          </View>
                        </TouchableOpacity>
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
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#10B981' }}>
                          {locale === 'en' ? 'WAIVED' : 'PERCUMA'}
                        </Text>
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
    height: 160,
    backgroundColor: '#050505',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: '#050505',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerUpsell: {
    marginTop: 24,
    width: '100%',
  },
  headerUpsellTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  headerUpsellDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#CBD5E1',
    marginTop: 8,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 28,
    marginTop: -24,
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
    gap: 10,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
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
