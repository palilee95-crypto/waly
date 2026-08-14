import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Dimensions, 
  Image, 
  Alert, 
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

const BENEFITS = [
  { icon: 'rocket', title: 'Grow 5x Faster', desc: 'Digital loyalty cards that customers love.' },
  { icon: 'chatbubble-ellipses', title: 'WhatsApp Automation', desc: 'Send stamp alerts & broadcasts instantly.' },
  { icon: 'flash', title: 'NFC Magic Stand', desc: 'Collect stamps in 2 seconds at the counter.' }
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [trialEnabled, setTrialEnabled] = useState(true);

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
        price: billingCycle === 'monthly' ? 'RM 79' : 'RM 63',
        originalPrice: billingCycle === 'monthly' ? 'RM 119' : 'RM 95',
        label: 'Starter Plan'
      };
    } else if (selectedPlan === 'pro') {
      return {
        price: billingCycle === 'monthly' ? 'RM 99' : 'RM 79',
        originalPrice: billingCycle === 'monthly' ? 'RM 198' : 'RM 158',
        label: 'Pro Plan'
      };
    } else {
      return {
        price: billingCycle === 'monthly' ? 'RM 349' : 'RM 279',
        originalPrice: billingCycle === 'monthly' ? 'RM 499' : 'RM 399',
        label: 'Enterprise Plan'
      };
    }
  };

  const currentPrice = getPriceDetails();

  const handlePurchase = async () => {
    let merchantId = user?.merchant_id;
    if (!merchantId) {
      try {
        await refreshSession();
        if (user?.merchant_id) {
          merchantId = user.merchant_id;
        }
      } catch (e) {
        console.error("Session refresh failed:", e);
      }
    }

    if (!merchantId) {
      Alert.alert('Error', 'Could not find Merchant ID. Please log in again.');
      return;
    }

    const months = billingCycle === 'annually' ? 12 : 1;
    const cleanMerchantId = merchantId.replace('merchant-', '');
    
    // Telegram start parameters can only have a-z, A-Z, 0-9, _ and -
    const telegramUrl = `https://t.me/RisevBilling_bot?start=${cleanMerchantId}_${months}_${selectedPlan}`;
    
    try {
      if (Platform.OS === 'web') {
        window.open(telegramUrl, '_blank');
      } else {
        await Linking.openURL(telegramUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open Telegram. Please open Telegram and search for @RisevBilling_bot.');
    }
  };

  const getFeaturesList = () => {
    if (selectedPlan === 'starter') {
      return [
        'Digital Loyalty Cards',
        'Basic Analytics Dashboard',
        '1 Free NFC VIP Stand',
        'Email support',
        'Up to 100 active customers',
        '[LOCK] WhatsApp Automations',
        '[LOCK] Promotional Broadcasts',
        '[LOCK] Up to 5 staff accounts'
      ];
    } else if (selectedPlan === 'pro') {
      return [
        'Everything in Starter',
        'Up to 5 staff accounts',
        'WhatsApp Automations',
        'Promotional Broadcasts',
        'Priority support',
        'Unlimited active customers',
        '[LOCK] Multi-Branch Support',
        '[LOCK] Custom integration APIs'
      ];
    } else {
      return [
        'Everything in Pro',
        'Unlimited staff accounts',
        'Multi-Branch Support',
        'Custom integrations',
        '24/7 dedicated support',
        'Custom branding'
      ];
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={{ backgroundColor: '#050505' }}
          contentContainerStyle={{ paddingBottom: 180 }}
        >
          {/* Sticky Header with Logo & Tagline */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Image 
                source={require('../../assets/risev logo.png')}
                style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
              />
            </View>
            <View style={styles.headerUpsell}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="sparkles" size={14} color="#FFC700" />
                <Text style={styles.headerUpsellTitle}>Grow Your Shop on Autopilot</Text>
              </View>
              <Text style={styles.headerUpsellDesc}>
                Turn one-time walk-ins into lifetime regular customers. Unlock automated WhatsApp alerts, custom loyalty programs, and detailed analytics to scale repeat sales without extra effort.
              </Text>
            </View>
          </View>

          <View style={styles.scrollContent}>

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
                {billingCycle === 'monthly' ? 'RM 79' : 'RM 63'}
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
                {billingCycle === 'monthly' ? 'RM 99' : 'RM 79'}
              </Text>
              <Text style={styles.planCardPeriod}>/mo</Text>
            </TouchableOpacity>

            {/* Enterprise Plan */}
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
                {billingCycle === 'monthly' ? 'RM 349' : 'RM 279'}
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
                <Text style={styles.highlightBadgeText}>50% OFF</Text>
              </View>
            </View>

            {/* Timer countdown row */}
            <View style={styles.timerRow}>
              <Ionicons name="time" size={13} color="#EA580C" />
              <Text style={styles.timerText}>Offer ends in: 23h 41m 15s</Text>
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
                    {cleanFeat === 'WhatsApp Automations' && <Text style={styles.inlineBadge}>  AI </Text>}
                  </Text>
                </View>
              );
            })}
           </View>
        </View>
      </ScrollView>
    </SafeAreaView>

      {/* 6. Sticky IAP Action Footer */}
      <View style={styles.stickyFooter}>
        <View style={styles.trialRow}>
          <Text style={styles.trialText}>Enable 7-day free trial on upgrade</Text>
          <Switch 
            value={trialEnabled} 
            onValueChange={setTrialEnabled} 
            trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity 
          style={styles.ctaButton} 
          onPress={handlePurchase}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>Upgrade to PRO today</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505', // Deep dark theme matches iOS App Store Paywall
  },
  safeArea: {
    flex: 1,
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
    paddingBottom: 180, // High bottom padding to avoid overlapping the sticky footer!
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 28,
    marginTop: -24,
    minHeight: '100%',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  trialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trialText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
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
});
