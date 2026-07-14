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
  Modal,
  TextInput,
  Platform,
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
  const [selectedMonths, setSelectedMonths] = useState<1 | 3 | 6 | 9 | 12>(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    if (user) {
      loadPricing();
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

  const handleUpgradePress = () => {
    setShowUpgradeModal(true);
  };

  const proceedWhatsAppUpgrade = async () => {
    const merchantName = merchant?.name || 'My Store';
    
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

    const message = `Hello RISEV Support! I'd like to manually upgrade my Merchant Pro subscription:

🏪 Store Details:
• Store Name: ${merchantName}
• Merchant ID: ${user?.merchant_id || 'N/A'}
• Owner Name: ${user?.name || 'N/A'}
• Contact Phone: ${user?.phone || 'N/A'}

💳 Plan Selection:
• Plan: RISEV Merchant Pro
• Duration: ${months} Month(s)
• Base Price: RM${basePrice}/month
• Raw Total: RM${rawTotal.toFixed(2)}
${durationDiscountPercent > 0 ? `• Multi-month Discount: -${durationDiscountPercent}% (-RM${durationDiscountAmount.toFixed(2)})\n` : ''}${appliedPromo ? `• Promo Voucher (${appliedPromo.code}): -${appliedPromo.discount_type === 'percentage' ? `${appliedPromo.discount_value}%` : `RM${appliedPromo.discount_value}`} (-RM${promoDiscountAmount.toFixed(2)})\n` : ''}• Final Price: RM${finalPrice.toFixed(2)} (Billed manually)

Please guide me with the bank transfer details and receipt upload instructions. Thank you!`;

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
              onPress={async () => {
                setShowUpgradeModal(false);
                await proceedWhatsAppUpgrade();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.payBtnText}>Upgrade via WhatsApp</Text>
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
    shadowColor: '#000000',
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
    borderColor: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
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
});
