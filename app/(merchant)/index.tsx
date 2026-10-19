import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Modal,
  TextInput,
  Platform,
  DeviceEventEmitter,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '@/theme';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import BookingAccessModal from './_components/BookingAccessModal';
import CustomerOverviewCards from './_components/CustomerOverviewCards';
import QuotaTopUpModal from './_components/QuotaTopUpModal';


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
  isBooking?: boolean;
};

export default function MerchantDashboard() {
  const { user, refreshSession, isOwner, staffPermissions } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<'Today' | 'This Week' | 'This Month'>('Today');
  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showBookingAccessModal, setShowBookingAccessModal] = useState(false);
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
  const [standTotalQuota, setStandTotalQuota] = useState<number>(500);
  const [addonQuota, setAddonQuota] = useState<number>(0);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [totalCustomersCount, setTotalCustomersCount] = useState<number | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<any>(null);
  const [activeBookingsCount, setActiveBookingsCount] = useState<number>(0);
  const [todayVouchersCount, setTodayVouchersCount] = useState<number>(0);
  const [monthVouchersCount, setMonthVouchersCount] = useState<number>(0);

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
  const [showAllRequests, setShowAllRequests] = useState(false);
  const queuedClaimReview = useRef<any>(null);
  const reviewClaim = (claim: any) => {
    if (showAllRequests && Platform.OS === 'ios') {
      queuedClaimReview.current = claim;
      setShowAllRequests(false);
      return;
    }
    setShowAllRequests(false);
    DeviceEventEmitter.emit('OPEN_NFC_CLAIM', claim);
  };
  const [claimsSubscribed, setClaimsSubscribed] = useState(false);
  const [claimsLive, setClaimsLive] = useState(false);

  useEffect(() => {
    const updateConnection = () => setClaimsLive(claimsSubscribed && pb.realtime.isConnected);
    updateConnection();
    const timer = setInterval(updateConnection, 2000);
    return () => clearInterval(timer);
  }, [claimsSubscribed]);
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

    const minSpend = parseFloat((loyaltyProgram as any)?.min_spend_amount) || 0;
    if (stampAmt > 0 && minSpend > 0 && billAmt < minSpend) {
      alert(
        locale === 'en'
          ? `A minimum bill of RM ${minSpend.toFixed(2)} is required to approve stamps. Current bill: RM ${billAmt.toFixed(2)}.`
          : `Jumlah bil minimum RM ${minSpend.toFixed(2)} diperlukan untuk meluluskan cop pelanggan. Jumlah bil semasa: RM ${billAmt.toFixed(2)}.`
      );
      return;
    }

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

      // Stand Bundle Quota calculation from redeemed activation codes
      try {
        const codes = await pb.collection('activation_codes').getFullList({
          filter: `redeemed_by = '${user.merchant_id}' && is_redeemed = true`,
          requestKey: null,
        });
        if (codes.length > 0) {
          const sumQuota = codes.reduce((acc: number, c: any) => acc + (Number(c.quota) > 0 ? Number(c.quota) : 500), 0);
          if (sumQuota > 0) setStandTotalQuota(sumQuota);
        }
      } catch (codeErr) {}

      // 1. Fetch merchant details & active loyalty program
      const [mRec, prog] = await Promise.all([
        pb.collection('merchants').getOne(user.merchant_id).catch(() => null),
        pb.collection('loyalty_programs').getFirstListItem(`merchant = '${user.merchant_id}' && is_active = true`).catch(() => null),
      ]);
      if (mRec) setMerchant(mRec);
      if (prog) setLoyaltyProgram(prog);

      // 2. Fetch recent transactions
      const txs = await pb.collection('transactions').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        expand: 'customer',
        sort: '-created'
      });
      setTransactions(txs);

      // 3. Fetch total registered customer cards
      const cardsRes = await pb.collection('loyalty_cards').getList(1, 1, {
        filter: `merchant = '${user.merchant_id}'`,
      });
      setTotalCustomersCount(cardsRes.totalItems);

      // Purchased customer-slot top-ups + server-side quota state. `used` comes
      // from the server so the gauge matches enforcement (distinct customers).
      try {
        const quotaRes = await pb.send<any>('/api/risev/merchant/quota/packages', { method: 'GET' });
        if (quotaRes?.current) {
          setAddonQuota(Number(quotaRes.current.addon_quota) || 0);
          if (typeof quotaRes.current.used === 'number') {
            setTotalCustomersCount(quotaRes.current.used);
          }
        }
      } catch (quotaErr) {
        setAddonQuota(0);
      }

      // 4. Fetch active/upcoming bookings count for Bookings Quick Action badge
      try {
        const bookingsRes = await pb.collection('service_bookings').getList(1, 100, {
          filter: `merchant = '${user.merchant_id}' && status != 'completed' && status != 'cancelled' && status != 'no_show'`,
          requestKey: null,
        });
        setActiveBookingsCount(bookingsRes.totalItems);
      } catch (bErr) {
        try {
          const fallbackRes = await pb.collection('service_bookings').getList(1, 100, {
            filter: `merchant = '${user.merchant_id}'`,
            requestKey: null,
          });
          const activeCount = fallbackRes.items.filter(
            (b: any) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show'
          ).length;
          setActiveBookingsCount(activeCount);
        } catch (err2) {
          setActiveBookingsCount(0);
        }
      }

      // 5. Fetch vouchers redeemed today & this month
      try {
        const now = new Date();
        // Local date parts: toISOString() is UTC and reports yesterday between
        // midnight and 08:00 in Malaysia (UTC+8).
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [vTodayRes, vMonthRes] = await Promise.all([
          pb.collection('vouchers').getList(1, 1, {
            filter: `reward.merchant = '${user.merchant_id}' && status = 'used' && used_at ~ '${todayIso}'`,
            requestKey: null,
          }),
          pb.collection('vouchers').getList(1, 1, {
            filter: `reward.merchant = '${user.merchant_id}' && status = 'used' && used_at ~ '${currentMonthIso}'`,
            requestKey: null,
          }),
        ]);
        setTodayVouchersCount(vTodayRes.totalItems);
        setMonthVouchersCount(vMonthRes.totalItems);
      } catch (vErr) {
        setTodayVouchersCount(0);
        setMonthVouchersCount(0);
      }
    } catch (err) {
      console.warn('Failed to fetch merchant dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMerchantData(), fetchPendingClaims()]);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchMerchantData();
    }, [user])
  );

  useEffect(() => {
    fetchMerchantData();

    // Listen to local completion & decline events from NfcClaimModal
    const txnCompleteSub = DeviceEventEmitter.addListener('merchant_transaction_completed', () => {
      fetchMerchantData();
      fetchPendingClaims();
    });

    const claimDeclinedSub = DeviceEventEmitter.addListener('nfc_claim_declined', (data: any) => {
      if (data?.claim_id) {
        setPendingClaims((prev) => prev.filter((c) => c.id !== data.claim_id));
      }
      fetchPendingClaims();
    });

    let unsubMerchants: any = null;
    let unsubTransactions: any = null;
    let unsubSubscriptions: any = null;
    let unsubClaims: any = null;
    let claimsDisposed = false;
    setClaimsSubscribed(false);
    let unsubBookings: any = null;
    let unsubVouchers: any = null;

    // Subscribe to merchants, transactions, subscriptions, nfc_claims, service_bookings & vouchers
    if (user && user.merchant_id) {
      pb.collection('merchants').subscribe(user.merchant_id, () => {
        fetchMerchantData();
      }).then((u) => { unsubMerchants = u; }).catch(() => {});

      // Realtime transactions - refresh on new records
      pb.collection('transactions').subscribe('*', () => {
        fetchMerchantData();
      }).then((u) => { unsubTransactions = u; }).catch(() => {});

      pb.collection('subscriptions').subscribe('*', () => {
        fetchMerchantData();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).then((u) => { unsubSubscriptions = u; }).catch(() => {});

      pb.collection('nfc_claims').subscribe('*', () => {
        fetchPendingClaims();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).then((u) => {
        if (claimsDisposed) { u(); return; }
        unsubClaims = u;
        setClaimsSubscribed(true);
      }).catch(() => { if (!claimsDisposed) setClaimsSubscribed(false); });

      pb.collection('service_bookings').subscribe('*', () => {
        fetchMerchantData();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      }).then((u) => { unsubBookings = u; }).catch(() => {});

      pb.collection('vouchers').subscribe('*', () => {
        fetchMerchantData();
      }).then((u) => { unsubVouchers = u; }).catch(() => {});
    }

    return () => {
      claimsDisposed = true;
      txnCompleteSub.remove();
      claimDeclinedSub.remove();
      if (typeof unsubMerchants === 'function') { try { unsubMerchants(); } catch (e) {} }
      if (typeof unsubTransactions === 'function') { try { unsubTransactions(); } catch (e) {} }
      if (typeof unsubSubscriptions === 'function') { try { unsubSubscriptions(); } catch (e) {} }
      if (typeof unsubClaims === 'function') { try { unsubClaims(); } catch (e) {} }
      if (typeof unsubBookings === 'function') { try { unsubBookings(); } catch (e) {} }
      if (typeof unsubVouchers === 'function') { try { unsubVouchers(); } catch (e) {} }
    };
  }, [user]);

  // Aggregate stats
  const isPointsOnlyMerchant = loyaltyProgram?.enable_stamps === false && loyaltyProgram?.enable_points === true;
  const totalStampsAwarded = transactions.reduce((acc, tx) => acc + (tx.stamps || 0), 0);
  const totalPointsAwarded = transactions.reduce((acc, tx) => acc + (tx.points || 0), 0);

  // Helper to test if a record is from today (local timezone)
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // 1. Today's Sales
  const todaySales = transactions
    .filter(tx => {
      if (tx.type !== 'earn') return false;
      return isToday(tx.created);
    })
    .reduce((acc, tx) => {
      let meta: any = {};
      try {
        meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || {});
      } catch (e) {}
      const amt = tx.bill_amount ?? meta.bill_amount ?? meta.subtotal ?? meta.amount ?? 0;
      return acc + Number(amt);
    }, 0);

  // 2. Today's Stamps / Points Issued
  const todayStampsIssued = transactions
    .filter(tx => isToday(tx.created))
    .reduce((acc, tx) => acc + (isPointsOnlyMerchant ? (tx.points || 0) : (tx.stamps || 0)), 0);

  // 3. Today's Rewards Redeemed
  const todayRedeemedFromTx = transactions.filter(tx => {
    if (!isToday(tx.created)) return false;
    return tx.type === 'redeem' || tx.type === 'REDEMPTION' || Boolean(tx.voucher);
  }).length;
  const totalTodayRedeemed = Math.max(todayRedeemedFromTx, todayVouchersCount);

  // Helper: check if date is within current month
  const isThisMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // 4. Monthly Stamps / Points Issued
  const monthStampsIssued = transactions
    .filter(tx => isThisMonth(tx.created))
    .reduce((acc, tx) => acc + (isPointsOnlyMerchant ? (tx.points || 0) : (tx.stamps || 0)), 0);

  // 5. Monthly Rewards Redeemed
  const monthRedeemedFromTx = transactions.filter(tx => {
    if (!isThisMonth(tx.created)) return false;
    return tx.type === 'redeem' || tx.type === 'REDEMPTION' || Boolean(tx.voucher);
  }).length;
  const totalMonthRedeemed = Math.max(monthRedeemedFromTx, monthVouchersCount);

  // Filter transactions based on date
  const getFilteredTransactions = () => {
    const now = new Date();
    return transactions.filter(tx => {
      const txDate = new Date(tx.created);
      const diffTime = Math.abs(now.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (activeFilter === 'Today') {
        // Calendar day, not a rolling 24h window (which pulled in yesterday).
        return isToday(tx.created);
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
  const salesMonth = new Date();
  const salesMonthLabel = salesMonth.toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-MY', {
    month: 'long',
    year: 'numeric',
  });
  const getSalesForMonth = (monthOffset: number) => {
    const start = new Date(salesMonth.getFullYear(), salesMonth.getMonth() + monthOffset, 1);
    const end = new Date(salesMonth.getFullYear(), salesMonth.getMonth() + monthOffset + 1, 1);
    return transactions
      .filter(tx => tx.type === 'earn' && new Date(tx.created) >= start && new Date(tx.created) < end)
      .reduce((total, tx) => {
        let meta: any = {};
        try {
          meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || {});
        } catch {}
        const amount = Number(tx.bill_amount ?? meta?.bill_amount ?? meta?.subtotal ?? meta?.amount ?? 0);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0);
  };
  const salesThisMonth = getSalesForMonth(0);
  const salesPreviousMonth = getSalesForMonth(-1);
  // Compare month-to-date sales against the complete previous calendar month.
  // Growth from a zero baseline has no defined percentage.
  const monthlySalesChange = salesPreviousMonth > 0
    ? ((salesThisMonth - salesPreviousMonth) / salesPreviousMonth) * 100
    : salesThisMonth === 0 ? 0 : null;
  const roundedSalesChange = monthlySalesChange === null ? null : Math.round(monthlySalesChange * 10) / 10;
  const salesChangeLabel = loading ? '…' : roundedSalesChange === null
    ? '—'
    : `${roundedSalesChange > 0 ? '+' : ''}${roundedSalesChange.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

  const salesProgressPercentage = Math.min((salesThisMonth / monthlySalesGoal) * 100, 100);
  const remainingSales = Math.max(monthlySalesGoal - salesThisMonth, 0);

  const mappedActivities: ActivityItem[] = filteredTransactions.map((tx: any) => {
    const cust = tx.expand?.customer;
    let meta: any = {};
    try {
      meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || {});
    } catch (e) {}
    const billAmt = tx.bill_amount ?? meta.bill_amount ?? meta.amount ?? 0;
    const isBooking = meta.source === 'booking';
    const customerDisplayName = cust?.name || meta.customer_name || 'Walk-in Customer';

    return {
      id: tx.id,
      name: customerDisplayName,
      avatar: cust?.avatar
        ? `${pb.baseUrl}/api/files/_pb_users_auth_/${cust.id}/${cust.avatar}`
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120',
      date: new Date(tx.created).toLocaleDateString(),
      amount: billAmt > 0 ? `RM ${Number(billAmt).toFixed(2)}` : 'RM 0.00',
      stamps: tx.stamps || 0,
      status: tx.type === 'adjust' ? 'Pending' : 'Success',
      customerId: cust?.id || '',
      isBooking: isBooking,
    };
  });

  const txCustomersCount = new Set(transactions.map((t: any) => t.customer).filter(Boolean)).size || 0;
  const customerCount = totalCustomersCount !== null ? totalCustomersCount : txCustomersCount;
  const isPro = activeSubscription?.plan === 'pro' || activeSubscription?.plan === 'business' || activeSubscription?.plan === 'enterprise';
  const isStarter = activeSubscription?.plan === 'starter';
  const quotaLimit = isPro ? Infinity : (activeSubscription?.plan === 'stand_bundle' ? standTotalQuota + addonQuota : 300);
  const quotaPercentage = isPro ? 100 : Math.min(100, Math.round((customerCount / quotaLimit) * 100));
  const isNearLimit = !isPro && customerCount >= Math.round(quotaLimit * 0.8);
  const isCritical = !isPro && customerCount >= Math.round(quotaLimit * 0.95);

  // Customer Cohorts Calculation (New, Repeat, Churn)
  const customerCohorts = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      // No transaction history: report zeros rather than inventing a split.
      return { newCustomers: 0, repeatCustomers: 0, churnCustomers: 0 };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const customerMap: Record<string, { firstTx: Date; lastTx: Date; count: number }> = {};

    transactions.forEach((tx: any) => {
      const custId = tx.customer;
      if (!custId) return;
      const txDate = new Date(tx.created);

      if (!customerMap[custId]) {
        customerMap[custId] = { firstTx: txDate, lastTx: txDate, count: 1 };
      } else {
        customerMap[custId].count += 1;
        if (txDate < customerMap[custId].firstTx) customerMap[custId].firstTx = txDate;
        if (txDate > customerMap[custId].lastTx) customerMap[custId].lastTx = txDate;
      }
    });

    let newCount = 0;
    let repeatCount = 0;
    let churnCount = 0;

    Object.values(customerMap).forEach(info => {
      const isNewThisMonth =
        info.firstTx.getMonth() === currentMonth &&
        info.firstTx.getFullYear() === currentYear;

      if (isNewThisMonth) {
        newCount++;
      }

      if (info.count >= 2) {
        repeatCount++;
      }

      if (info.lastTx < thirtyDaysAgo) {
        churnCount++;
      }
    });

    if (newCount === 0 && repeatCount === 0 && customerCount > 0) {
      return { newCustomers: 0, repeatCustomers: 0, churnCustomers: 0 };
    }

    return {
      newCustomers: newCount,
      repeatCustomers: repeatCount,
      churnCustomers: churnCount,
    };
  }, [transactions, customerCount]);

  const plan = (activeSubscription?.plan || '').toLowerCase();
  const trialEnd = merchant?.metadata?.booking_trial_ends_at;
  const isTrialExpired = trialEnd && new Date(trialEnd).getTime() <= Date.now();
  const isAddonActive = merchant?.has_booking_addon === true && !isTrialExpired;
  const hasBookingAccess = Boolean(
    plan === 'pro' ||
    plan === 'business' ||
    plan === 'enterprise' ||
    isAddonActive
  );

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const renderPendingClaim = (claim: any) => {
    const timeAgoStr = claim.created ? getTimeAgo(new Date(claim.created)) : 'Just now';
    const nameParts = (claim.customer_name || 'Customer').trim().split(/\s+/);
    const initials = nameParts.length >= 2
      ? (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
      : (claim.customer_name || 'CU').substring(0, 2).toUpperCase();

    return (
      <View key={claim.id} style={styles.pendingCardAppleMinimal}>
        {/* Apple Neutral Avatar */}
        <View style={styles.pendingAvatarApple}>
          <Text style={styles.pendingAvatarAppleText}>{initials}</Text>
        </View>

        {/* Customer Info */}
        <View style={{ flex: 1, paddingRight: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.pendingCustomerNameApple} numberOfLines={1}>
              {claim.customer_name || 'Customer'}
            </Text>
            {claim.session_code && (
              <View style={styles.pendingSessionBadgeApple}>
                <Text style={styles.pendingSessionBadgeText}>{claim.session_code}</Text>
              </View>
            )}
          </View>
          <Text style={styles.pendingCustomerSubApple}>
            {[claim.customer_phone, timeAgoStr].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* Right CTA Action Pill */}
        <TouchableOpacity
          style={styles.pendingReviewBtnApple}
          accessibilityRole="button"
          accessibilityLabel={`${locale === 'ms' ? 'Semak permintaan' : 'Review request from'} ${claim.customer_name || (locale === 'ms' ? 'pelanggan' : 'customer')}`}
          onPress={() => {
            reviewClaim(claim);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.pendingReviewBtnText}>{locale === 'ms' ? 'Semak' : 'Review'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#000000" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      {/* Scrollable Dashboard View */}
      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        contentContainerStyle={[
          { paddingBottom: 110, minHeight: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFC700"
            colors={['#FFC700']}
          />
        }
      >
        {/* Centered Content Wrapper */}
        <View style={[
          { paddingTop: 16 + insets.top, paddingHorizontal: 20, gap: 20 },
          isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
        ]}>
          {/* Header Content - Pure White Minimalist */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, marginBottom: 8, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={{ uri: merchant?.logo ? pb.files.getURL(merchant, merchant.logo) : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' }}
                style={[styles.merchantAvatar, { borderColor: '#E2E8F0', borderWidth: 1.5 }]}
              />
              <View style={styles.profileTextWrap}>
                <Text style={styles.welcomeSub}>{t('welcome_back')}</Text>
                <Text style={styles.merchantName}>{merchant?.name || 'Boutique Royal'}</Text>
              </View>
            </View>

            <Image
              source={require('../../assets/risev logo.png')}
              style={{ width: 96, height: 30, resizeMode: 'contain', tintColor: '#050505' }}
            />
          </View>

        {/* Web Push Notification Enable Prompt */}
        <PushNotificationPrompt merchantId={user?.merchant_id} branchId={user?.branch} />

        {/* Apple × Fresha × Risev 3D Floating Monthly Overview Card */}
        <View style={styles.appleTicketCard}>
          {/* Top Chamber: Sales & Progress */}
          {(isOwner || staffPermissions?.can_view_analytics) && (
            <View style={styles.monthlyTopSection}>
              {/* Monthly title and sales change */}
              <View style={styles.monthlyOverviewHeaderRow}>
                <View style={styles.monthlyOverviewTitleGroup}>
                  <View style={styles.monthlyOverviewTextWrap}>
                    <Text style={styles.monthlyOverviewMainTitle} numberOfLines={1}>
                      {t('monthly_overview') || (locale === 'ms' ? 'Gambaran Bulanan' : 'Monthly Overview')}
                    </Text>
                    <Text style={styles.monthlyOverviewSubtitle} numberOfLines={1}>
                      {`${locale === 'ms' ? 'Prestasi jualan' : 'Sales performance'} · ${salesMonthLabel}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.salesChangeGroup}>
                  <View
                    style={styles.salesPercentChip3d}
                    accessible
                    accessibilityLabel={loading
                      ? (locale === 'ms' ? 'Memuatkan perubahan jualan' : 'Loading sales change')
                      : monthlySalesChange === null
                        ? (locale === 'ms' ? 'Tiada jualan bulan lalu untuk perbandingan peratus' : 'No previous-month sales to calculate percentage change')
                        : `${salesChangeLabel} ${locale === 'ms' ? 'berbanding jumlah jualan bulan lalu' : 'versus total sales last month'}`}
                  >
                    <Text style={styles.salesPercentChip3dText}>{salesChangeLabel}</Text>
                  </View>
                  <Text style={styles.salesChangeCaption}>
                    {!loading && monthlySalesChange === null
                      ? (locale === 'ms' ? 'Bulan lalu RM0' : 'Last month RM0')
                      : (locale === 'ms' ? 'vs bulan lalu' : 'vs last month')}
                  </Text>
                </View>
              </View>

              {/* Big Revenue Figure */}
              <View style={styles.monthlyRevenueWrapper}>
                <Text style={styles.monthlyRevenueAmount}>
                  {loading ? '...' : `RM ${salesThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Text>
              </View>

              {/* Slim Yellow Progress Bar */}
              <View style={styles.monthlyProgressBarTrack}>
                <View
                  style={[
                    styles.monthlyProgressBarFill,
                    { width: `${Math.min(100, Math.max(0, salesProgressPercentage))}%` }
                  ]}
                />
              </View>

              {/* Progress Footnote: Remaining on Left, Goal on Right */}
              <View style={styles.monthlyProgressFooter}>
                <View style={styles.monthlyProgressRemainingWrap}>
                  <Text style={styles.monthlyProgressRemainingAmount}>
                    {remainingSales > 0
                      ? `RM${remainingSales.toLocaleString()}`
                      : (locale === 'ms' ? 'Sasaran tercapai! 🎉' : 'Goal reached! 🎉')}
                  </Text>
                  {remainingSales > 0 && (
                    <Text style={styles.monthlyProgressRemainingLabel}>
                      {' '}{locale === 'ms' ? 'baki' : 'remaining'}
                    </Text>
                  )}
                </View>

                <Text style={styles.monthlyProgressGoalFootnote}>
                  {locale === 'ms' ? `Sasaran: RM${monthlySalesGoal.toLocaleString()}` : `Goal: RM${monthlySalesGoal.toLocaleString()}`}
                </Text>
              </View>
            </View>
          )}

          <CustomerOverviewCards
            customerCount={customerCount}
            quotaLimit={quotaLimit}
            isPro={isPro}
            loading={loading}
            locale={locale}
            cohorts={customerCohorts}
            onUpgrade={() => router.push('/(merchant)/subscription' as any)}
            onAddSlots={!isPro && activeSubscription?.plan === 'stand_bundle' ? () => setShowQuotaModal(true) : undefined}
          />
        </View>

        {/* 5-Icon Quick Actions Hub (Fresha Squircles 50x50px) */}
        <View style={styles.quickActionsHubRow}>
          {/* Action 1: Smart Booking */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => {
              if (hasBookingAccess) {
                router.push('/(merchant)/bookings' as any);
              } else {
                setShowBookingAccessModal(true);
              }
            }}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionSquircle}>
              <Ionicons name="calendar-outline" size={20} color="#0F172A" />
              {activeBookingsCount > 0 ? (
                <View style={styles.quickActionBadgeNumber}>
                  <Text style={styles.quickActionBadgeNumberText}>
                    {activeBookingsCount > 99 ? '99+' : activeBookingsCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.quickActionLabel}>{locale === 'ms' ? 'Tempahan' : 'Bookings'}</Text>
          </TouchableOpacity>

          {/* Action 2: Rewards Studio */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => router.push('/(merchant)/rewards' as any)}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionSquircle}>
              <Ionicons name="gift-outline" size={20} color="#0F172A" />
            </View>
            <Text style={styles.quickActionLabel}>{locale === 'ms' ? 'Ganjaran' : 'Rewards'}</Text>
          </TouchableOpacity>

          {/* Action 3: Customers Directory */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => router.push('/(merchant)/customers' as any)}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionSquircle}>
              <Ionicons name="people-outline" size={20} color="#0F172A" />
            </View>
            <Text style={styles.quickActionLabel}>{locale === 'ms' ? 'Pelanggan' : 'Customers'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            accessibilityRole="button"
            onPress={() => DeviceEventEmitter.emit('OPEN_MANUAL_POS')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionSquircle}>
              <Ionicons name="calculator-outline" size={20} color="#0F172A" />
            </View>
            <Text style={styles.quickActionLabel}>POS System</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            accessibilityRole="button"
            accessibilityLabel={locale === 'ms' ? 'Lihat semua permintaan NFC' : 'View all NFC requests'}
            onPress={() => setShowAllRequests(true)}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionSquircle}>
              <Ionicons name="radio-outline" size={20} color="#0F172A" />
              {pendingClaims.length > 0 && (
                <View style={styles.quickActionBadgeNumber}>
                  <Text style={styles.quickActionBadgeNumberText}>{pendingClaims.length > 99 ? '99+' : pendingClaims.length}</Text>
                </View>
              )}
            </View>
            <Text style={styles.quickActionLabel}>{locale === 'ms' ? 'Permintaan NFC' : 'NFC Requests'}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Completion Callout (if profile is not yet marked completed) */}
        {merchant && !merchant.metadata?.profile_completed && (
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFBEA',
              borderColor: '#FEF08A',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
            onPress={() => router.push('/(merchant)/profile-onboarding' as any)}
            activeOpacity={0.85}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFC700', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={20} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 }}>
                Complete Your Store Profile (3 Steps)
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 16 }}>
                Set your business category, storefront photos & hours to appear on Customer Explore.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0F172A" />
          </TouchableOpacity>
        )}



        {/* Stamp requests: quiet empty state, prominent actions when needed. */}
        <View style={styles.pendingSectionContainer}>
          <View style={styles.pendingHeaderRow}>
            <View style={styles.pendingHeadingGroup}>
              <Text style={styles.pendingSectionTitle}>{locale === 'ms' ? 'Permintaan Cop' : 'Stamp Requests'}</Text>
              {pendingClaims.length > 0 && (
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>{pendingClaims.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.liveRadarPill} accessible accessibilityLiveRegion="polite">
              <View style={[styles.liveRadarDot, { backgroundColor: claimsLive ? '#16A34A' : '#94A3B8' }]} />
              <Text style={styles.liveRadarText}>
                {claimsLive ? 'Live' : (locale === 'ms' ? 'Menyambung…' : 'Connecting…')}
              </Text>
            </View>
          </View>

          {pendingClaims.length === 0 ? (
            <View style={styles.pendingEmptyCard}>
              <View style={styles.pendingEmptyIconWrap}>
                <Ionicons name="radio-outline" size={22} color="#050505" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingEmptyTitle}>{locale === 'ms' ? 'Sedia menerima tap pelanggan' : 'Ready for customer taps'}</Text>
                <Text style={styles.pendingEmptyDesc}>
                  {locale === 'ms' ? 'Permintaan baharu akan muncul di sini.' : 'New requests appear here.'}
                </Text>
              </View>
            </View>
          ) : (
            pendingClaims.slice(0, 3).map(renderPendingClaim)
          )}
          <TouchableOpacity style={styles.requestsViewAll} accessibilityRole="button" onPress={() => setShowAllRequests(true)}>
            <Text style={styles.requestsViewAllText}>{locale === 'ms' ? 'Lihat semua' : 'View all'}</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        </View>

      </ScrollView>

      <Modal
        visible={showAllRequests}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllRequests(false)}
        onDismiss={() => {
          const claim = queuedClaimReview.current;
          queuedClaimReview.current = null;
          if (claim) DeviceEventEmitter.emit('OPEN_NFC_CLAIM', claim);
        }}
      >
        <View style={styles.requestsBackdrop}>
          <View style={[styles.requestsSheet, { paddingBottom: Math.max(insets.bottom, 20), marginTop: insets.top + 20 }]}>
            <View style={styles.requestsSheetHeader}>
              <Text accessibilityRole="header" style={styles.pendingSectionTitle}>
                {locale === 'ms' ? 'Permintaan NFC' : 'NFC Requests'} ({pendingClaims.length})
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={locale === 'ms' ? 'Tutup' : 'Close'} style={styles.requestsClose} onPress={() => setShowAllRequests(false)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pendingClaims}
              keyExtractor={claim => claim.id}
              renderItem={({ item }) => renderPendingClaim(item)}
              contentContainerStyle={styles.requestsList}
              ListEmptyComponent={
                <View style={styles.pendingEmptyCard}>
                  <View style={styles.pendingEmptyIconWrap}><Ionicons name="radio-outline" size={22} color="#050505" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingEmptyTitle}>{locale === 'ms' ? 'Sedia menerima tap pelanggan' : 'Ready for customer taps'}</Text>
                    <Text style={styles.pendingEmptyDesc}>{locale === 'ms' ? 'Permintaan baharu akan muncul di sini.' : 'New requests appear here.'}</Text>
                  </View>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

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

      {/* Booking & PWA Suite Feature Access Gate Modal */}
      <BookingAccessModal
        visible={showBookingAccessModal}
        onClose={() => setShowBookingAccessModal(false)}
        merchantName={merchant?.name}
        merchantId={merchant?.id}
        isOptedIn={Boolean(merchant?.booking_vip_opt_in)}
        onOptedInSuccess={() => {
          setMerchant((prev: any) => (prev ? { ...prev, booking_vip_opt_in: true } : prev));
          fetchMerchantData();
        }}
      />

      <QuotaTopUpModal
        visible={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        onPurchased={fetchMerchantData}
        used={totalCustomersCount ?? 0}
        limit={activeSubscription?.plan === 'stand_bundle' ? standTotalQuota + addonQuota : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  /* ── Apple × Fresha × Risev 3D Floating Monthly Overview Card ── */
  /* ── Apple × Fresha × Risev Soft Neumorphic Monthly Overview Card ── */
  appleTicketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 26,
    elevation: 4,
    padding: 18,
  },
  monthlyTopSection: {
    marginBottom: 0,
  },
  monthlyOverviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  monthlyOverviewTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  monthlyOverviewTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  monthlyOverviewMainTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  monthlyOverviewSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 0.5,
  },
  salesChangeGroup: {
    alignItems: 'center',
    gap: 4,
  },
  salesChangeCaption: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  salesPercentChip3d: {
    backgroundColor: '#FFCC00',
    borderTopColor: '#FEF08A',
    borderLeftColor: '#FACC15',
    borderRightColor: '#FACC15',
    borderBottomColor: '#EAB308',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 999,
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 3.5 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 0,
  },
  salesPercentChip3dText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  monthlyRevenueWrapper: {
    marginVertical: 10,
  },
  monthlyRevenueAmount: {
    fontSize: 34,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.8,
  },
  monthlyProgressBarTrack: {
    width: '100%',
    height: 9,
    backgroundColor: '#F1F5F9',
    borderRadius: 4.5,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  monthlyProgressBarFill: {
    height: '100%',
    backgroundColor: '#FFCC00',
    borderRadius: 4.5,
  },
  monthlyProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyProgressRemainingWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  monthlyProgressRemainingAmount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  monthlyProgressRemainingLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  monthlyProgressGoalFootnote: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  podIconBadgeEmerald: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podIconBadgeGold: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podIconBadgeRose: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podIconBadgeBlue: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  podBigNumber: {
    fontSize: 16.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 3,
    marginBottom: 1,
  },
  podSubText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  ticketColDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },

  /* ── Primary POS Pill Button (Fresha Style) ── */
  primaryPosPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
    marginTop: -4,
  },
  posPillLeftSquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  posPillTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  posPillSubtitle: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  posPillRightArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* ── 5-Icon Quick Actions Hub ── */
  quickActionsHubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: -4,
  },
  quickActionItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  quickActionSquircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionDotAmber: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D97706',
  },
  quickActionBadgeNumber: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#D97706', // Apple-grade warm amber/orange matching user reference
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 3,
  },
  quickActionBadgeNumberText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: 12,
    includeFontPadding: false,
    textAlign: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
    textAlign: 'center',
  },


  /* Realtime connection status */
  liveRadarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveRadarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  liveRadarText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
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
  requestsViewAll: { minHeight: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  requestsViewAllText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' },
  requestsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  requestsSheet: { width: '100%', maxWidth: 640, height: '85%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  requestsSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  requestsClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  requestsList: { padding: 16 },
  // Dedicated Pending Stamp Requests Styles (Monochrome B&W)
  pendingSectionContainer: {
    marginBottom: 40,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  pendingHeadingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCountText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  pendingSectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  pendingEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.025,
    shadowRadius: 10,
    elevation: 1,
  },
  pendingEmptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F5F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingEmptyTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  pendingEmptyDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
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
  pendingCardAppleMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingAvatarApple: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarAppleText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
  },
  pendingCustomerNameApple: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pendingSessionBadgeApple: {
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingSessionBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  pendingCustomerSubApple: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 2,
  },
  pendingReviewBtnApple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFCC00',
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 100,
  },
  pendingReviewBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
