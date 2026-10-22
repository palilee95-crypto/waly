import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Modal,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { cachedFetch, invalidate } from '@/lib/data-cache';
import { cacheKeys, TTL } from '@/lib/cache-keys';
import { formatMalaysianPhone } from '@/lib/emailValidator';
import type { ReceiptData } from '@/components/DigitalStampReceiptModal';
import RisevRewardBanner from '@/components/RisevRewardBanner';
import StampIssueSuccessModal from '@/components/StampIssueSuccessModal';
import ThermalReceiptScreen from '@/components/ThermalReceiptScreen';
import { inkOn } from '@/components/LoyaltyCardBack';
import type { PaidReceipt } from '@/lib/paidReceipt';
import { parsePassScan } from '@/lib/bookingPass';
import { colors, radii, spacing, iconSizes, shadows } from '@/theme';

export default function GiveStampsScreen() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Default to Scan Voucher QR tab first (per user request)
  const [activeTab, setActiveTab] = useState<'voucher' | 'manual'>('voucher');

  // Camera Scanner States
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const isProcessingScan = React.useRef(false);

  // Lifecycle Scoping: Automatically unmount camera when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsCameraActive(false);
      };
    }, [])
  );

  // Lifecycle Scoping: Automatically unmount camera when app is backgrounded/inactive
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') {
        setIsCameraActive(false);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Voucher Scanner States
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [manualCodeOpen, setManualCodeOpen] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<{ code: string; voucher?: any; loading?: boolean } | null>(null);
  const [redeemedDetails, setRedeemedDetails] = useState<{
    id?: string;
    code: string;
    customer_id?: string;
    customer_name: string;
    customer_phone?: string;
    reward_title: string;
    discount_type?: string;
    discount_value?: string;
    used_at?: string;
  } | null>(null);

  // Manual Issuance States
  const [phoneInput, setPhoneInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [focusedField, setFocusedField] = useState<'phone' | 'name' | 'bill' | null>(null);
  const [existingCustomer, setExistingCustomer] = useState<{ id: string; name: string; stamps?: number; points?: number } | null>(null);
  const [customerLookup, setCustomerLookup] = useState<'idle' | 'checking' | 'found' | 'new' | 'error'>('idle');
  const [lookupNameRequired, setLookupNameRequired] = useState(false);
  const [lookupRetry, setLookupRetry] = useState(0);
  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Outlet selection — staff are bound to their outlet (users.branch); the owner
  // is brand-wide and must pick an outlet at the point of sale.
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  useEffect(() => {
    const mid = (user as any)?.merchant_id;
    if (!mid) return;
    cachedFetch(
      cacheKeys.merchantBranches(mid),
      () => pb.collection('branches').getFullList({ filter: `merchant = "${mid}"`, sort: '-is_hq,-created', requestKey: null }),
      { ttl: TTL.catalog }
    )
      .then((list: any[]) => {
        setBranches(list || []);
        const hq = (list || []).find((b: any) => b.is_hq) || (list || [])[0];
        if (hq) setSelectedBranchId(hq.id);
      })
      .catch(() => {});
  }, [user]);

  const isBrandWide = !(user as any)?.branch;

  // Active Loyalty Program & Mode Configuration
  const [program, setProgram] = useState<any>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [issueSuccessVisible, setIssueSuccessVisible] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [activePaidReceipt, setActivePaidReceipt] = useState<PaidReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [merchantIdentity, setMerchantIdentity] = useState<{ name: string; logo: string }>({ name: '', logo: '' });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const merchantId = user?.merchant_id;

  useEffect(() => {
    if (!merchantId) return;
    let active = true;
    pb.collection('merchants').getOne(merchantId, { requestKey: null }).then((merchant) => {
      if (!active) return;
      setMerchantIdentity({
        name: merchant.name || merchant.store_name || '',
        logo: merchant.logo ? pb.files.getURL(merchant, merchant.logo) : '',
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [merchantId]);

  // Mode helpers
  const isPointsOnly = program?.enable_stamps === false && program?.enable_points === true;
  const isStampsOnly = program?.enable_stamps !== false && program?.enable_points === false;
  const isBoth = !isPointsOnly && !isStampsOnly;
  const cardMilestones = useMemo(() => {
    let rewards = program?.sub_rewards;
    if (typeof rewards === 'string') {
      try { rewards = JSON.parse(rewards); } catch { rewards = []; }
    }
    return Array.isArray(rewards)
      ? rewards.map((reward: any) => Number(reward?.at_stamp)).filter((value: number) => Number.isInteger(value) && value > 0)
      : [];
  }, [program?.sub_rewards]);

  // 1. Fetch recent transactions & active loyalty program for merchant
  const fetchTransactions = useCallback(async () => {
    if (!merchantId) return;
    try {
      setLoadingTxns(true);
      const [txRows, progRes] = await Promise.all([
        cachedFetch(
          cacheKeys.merchantTxns(merchantId),
          () =>
            pb
              .collection('transactions')
              .getList(1, 1000, {
                filter: `merchant = '${merchantId}'`,
                sort: '-created',
                expand: 'customer',
                requestKey: null,
              })
              .then((r) => r.items),
          { ttl: TTL.own }
        ).catch(() => [] as any[]),
        cachedFetch(
          cacheKeys.merchantProgram(merchantId),
          () => pb.collection('loyalty_programs').getFirstListItem(`merchant = '${merchantId}' && is_active = true`, { sort: '-created', requestKey: null }),
          { ttl: TTL.catalog }
        ).catch(() => null),
      ]);
      setTransactions((txRows || []).slice(0, 10));
      if (progRes) setProgram(progRes);
    } catch (err) {
      console.warn('Failed to fetch transactions/program:', err);
    } finally {
      setLoadingTxns(false);
    }
  }, [merchantId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Merchant lookup is authoritative for name and loyalty status. Keep stale
  // responses from a previous phone number out of the form.
  useEffect(() => {
    const rawDigits = phoneInput.replace(/\D/g, '');
    const complete = rawDigits.length >= 9 && (!rawDigits.startsWith('11') || rawDigits.length === 10);
    if (!complete) {
      setExistingCustomer(null);
      setCustomerLookup('idle');
      setLookupNameRequired(false);
      return;
    }

    let isMounted = true;
    setCustomerLookup('checking');
    const timeout = setTimeout(async () => {
      try {
        const res = await pb.send<{
          found: boolean;
          requiresName: boolean;
          customer?: { id: string; name: string; stamps: number; points: number };
        }>(`/api/risev/merchant/give-customer?phone=${encodeURIComponent(phoneInput)}`, { method: 'GET', requestKey: null });

        if (isMounted) {
          if (res.found && res.customer) {
            setExistingCustomer(res.customer);
            setLookupNameRequired(res.requiresName);
            setCustomerLookup('found');
            if (!res.requiresName) {
              setCustomerName(res.customer.name);
            }
          } else {
            setExistingCustomer(null);
            setLookupNameRequired(true);
            setCustomerLookup('new');
          }
        }
      } catch (err) {
        if (isMounted) {
          setExistingCustomer(null);
          setCustomerLookup('error');
          setLookupNameRequired(false);
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [phoneInput, lookupRetry]);

  // 2. Submit Voucher Code Redemption via Backend Endpoint
  const executeRedemption = async (targetCode: string) => {
    const cleanCode = (targetCode || '').trim().toUpperCase();
    if (!cleanCode) {
      setVoucherError('Please enter or scan a voucher code.');
      return;
    }

    setIsRedeemingVoucher(true);
    setVoucherError('');
    setSuccessMsg(null);
    setRedeemedDetails(null);

    try {
      const res = await pb.send<{
        success: boolean;
        message: string;
        voucher: {
          id: string;
          code: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          reward_title: string;
          discount_type: string;
          discount_value: string;
          used_at: string;
        };
      }>('/api/risev/merchant/vouchers/redeem', {
        method: 'POST',
        // The bill lets the server enforce the store's max_redeem_percent limit;
        // without it the voucher is redeemed with no cap check.
        body: { code: cleanCode, bill_amount: Number(billAmount) || 0 },
      });

      if (res.success && res.voucher) {
        setRedeemedDetails(res.voucher);
        setPendingVoucher(null);
        setSuccessMsg(res.message || `Voucher ${res.voucher.code} redeemed successfully!`);
        setVoucherCode('');
        setManualCodeOpen(false);
        if (merchantId) invalidate(cacheKeys.merchantTxns(merchantId));
        fetchTransactions();
      } else {
        setVoucherError(res.message || 'Failed to redeem voucher.');
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Invalid, expired, or already used voucher code.';
      setVoucherError(msg);
    } finally {
      setIsRedeemingVoucher(false);
      setTimeout(() => {
        isProcessingScan.current = false;
      }, 800);
    }
  };

  const prepareVoucherReview = async (targetCode: string) => {
    const clean = String(targetCode || '').trim().toUpperCase();
    if (!clean) {
      setVoucherError('Please enter or scan a voucher code.');
      return;
    }
    setVoucherError('');
    setPendingVoucher({ code: clean, loading: true });
    try {
      const voucher = await pb.collection('vouchers').getFirstListItem(`code = '${clean}'`, {
        expand: 'reward,customer',
        requestKey: null,
      });
      setPendingVoucher({ code: clean, voucher });
    } catch (lookupErr) {
      // The server remains authoritative on redemption; still let the cashier
      // review the code when the read-only lookup is restricted.
      setPendingVoucher({ code: clean });
    }
  };

  const handleRedeemVoucher = () => {
    prepareVoucherReview(voucherCode);
  };

  const openCamera = async () => {
    setVoucherError('');
    setIsCameraActive(true);
    if (!permission?.granted) {
      await requestPermission();
    }
  };

  const closeCamera = () => {
    setIsCameraActive(false);
    setTorchOn(false);
  };

  const scanFromGallery = async () => {
    closeCamera();
    try {
      // Native image pickers need the camera modal to finish dismissing first.
      if (Platform.OS !== 'web') await new Promise((resolve) => setTimeout(resolve, 380));
      const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (selected.canceled || !selected.assets?.[0]?.uri) return;
      const results = await Camera.scanFromURLAsync(selected.assets[0].uri, ['qr']);
      if (results[0]?.data) handleBarCodeScanned({ data: results[0].data });
      else setVoucherError('No voucher QR code was found in that image. Try another image or enter the code manually.');
    } catch {
      setVoucherError('Could not read that image. Try scanning with the camera or enter the code manually.');
    }
  };

  const closeReview = () => {
    setPendingVoucher(null);
    setTimeout(() => {
      isProcessingScan.current = false;
    }, 300);
  };

  const openSupport = () => {
    const url = 'https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20some%20help%20with%20my%20merchant%20account.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  // A customer appointment pass QR opens that booking in the POS.
  const openScannedBookingPass = async (bookingId: string) => {
    try {
      const res = await pb.send<{ booking: any }>('/api/risev/merchant/booking-pass', {
        method: 'POST',
        body: { booking_id: bookingId },
        requestKey: null,
      });
      const booking = res?.booking;
      if (!booking) throw new Error('Booking not found.');
      DeviceEventEmitter.emit('OPEN_NFC_CLAIM', {
        id: '',
        merchant: booking.merchant_id,
        status: 'pending',
        manual_pos: true,
        _local_pos_draft: true,
        customer_name: booking.customer_name || '',
        customer_phone: booking.customer_phone || '',
        booking_id: booking.id,
        created: new Date().toISOString(),
      });
    } catch (err: any) {
      const code = err?.response?.code || '';
      const message = code === 'BOOKING_FORBIDDEN'
        ? 'That appointment belongs to another store.'
        : code === 'BOOKING_NOT_ACTIVE'
        ? 'That appointment is already closed.'
        : code === 'BOOKING_NOT_FOUND'
        ? 'Booking not found.'
        : err?.message || 'Could not load that appointment pass.';
      Alert.alert('Appointment Pass', message);
    } finally {
      setTimeout(() => { isProcessingScan.current = false; }, 800);
    }
  };

  // 3. Camera Scan Handler (Auto-executes redemption upon QR detection)
  const handleBarCodeScanned = (event: any) => {
    const raw = event?.data || event?.nativeEvent?.data || (typeof event === 'string' ? event : '');
    if (!raw || isRedeemingVoucher || isProcessingScan.current) return;

    // A booking pass is resolved server-side (auth + merchant ownership); a
    // voucher or loyalty QR falls through to the redemption path below.
    const scannedPass = parsePassScan(raw);
    if (scannedPass) {
      isProcessingScan.current = true;
      setIsCameraActive(false);
      openScannedBookingPass(scannedPass.bookingId);
      return;
    }

    isProcessingScan.current = true;
    setIsCameraActive(false);

    let code = raw.trim();
    if (code.includes('?code=')) {
      code = code.split('?code=')[1].split('&')[0];
    } else if (code.includes('/')) {
      code = code.substring(code.lastIndexOf('/') + 1);
    }
    code = code.trim().toUpperCase();
    setVoucherCode(code);
    prepareVoucherReview(code);
    setTimeout(() => {
      isProcessingScan.current = false;
    }, 900);
  };

  // 4. Submit Manual Stamp or Points Issuance
  const handleManualIssue = async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 9 || (digits.startsWith('11') && digits.length !== 10)) {
      Alert.alert('Customer phone', 'Enter a complete Malaysian mobile number.');
      return;
    }
    if (customerLookup === 'checking' || customerLookup === 'idle') {
      Alert.alert('Checking customer', 'Wait for the phone number lookup to finish.');
      return;
    }
    if (customerLookup === 'error') {
      Alert.alert('Customer lookup failed', 'Retry the phone number lookup before issuing rewards.');
      return;
    }
    if (lookupNameRequired && !customerName.trim()) {
      Alert.alert('Customer name required', 'Enter a name for this phone number before issuing rewards.');
      return;
    }

    const bill = parseFloat(billAmount) || 0;
    const stamps = isPointsOnly ? 0 : parseInt(stampAmount, 10);

    if (isPointsOnly && bill <= 0) {
      Alert.alert('Validation Error', 'Please enter a bill amount to calculate points.');
      return;
    }

    if (!isPointsOnly && (!Number.isInteger(stamps) || stamps < 1 || stamps > 99)) {
      Alert.alert('Validation Error', 'Stamps to issue must be between 1 and 99.');
      return;
    }

    const minSpend = parseFloat((program as any)?.min_spend_amount) || 0;
    if (!isPointsOnly && stamps > 0 && minSpend > 0 && bill < minSpend) {
      Alert.alert(
        locale === 'en' ? 'Minimum Spend Required' : 'Syarat Belanja Minimum',
        locale === 'en'
          ? `A minimum bill of RM ${minSpend.toFixed(2)} is required to issue stamps. Current bill: RM ${bill.toFixed(2)}.`
          : `Jumlah bil minimum RM ${minSpend.toFixed(2)} diperlukan untuk memberikan cop. Jumlah bil semasa: RM ${bill.toFixed(2)}.`
      );
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      const res = await pb.send<{
        success: boolean; message: string; customerName: string; phone?: string;
        transactionId?: string; receiptId?: string; totalStamps?: number; goal?: number;
        pointsEarned?: number; pointsBalance?: number; stampsEarned?: number; storeName?: string;
        branchName?: string; nextRewardName?: string; created?: string;
      }>(
        '/api/risev/merchant/give-manual',
        {
          method: 'POST',
          body: {
            phone: phoneInput.trim(),
            customer_name: customerName.trim(),
            bill_amount: bill,
            stamp_amount: stamps,
            branch_id: selectedBranchId || undefined,
          },
        }
      );

      if (!res.success) throw new Error(res.message || 'Could not issue the reward.');

      const resolvedName = res.customerName || customerName.trim() || 'Customer';
      // Use the transaction and card balance returned by this request. A latest-
      // transaction lookup can belong to a different customer at a busy counter.
      const pointsEarnedCalc = typeof res.pointsEarned === 'number' ? res.pointsEarned : 0;

      const receiptInfo: ReceiptData = {
        id: res.transactionId || '',
        receiptId: res.receiptId || '',
        storeName: res.storeName || merchantIdentity.name || 'Risev Partner Store',
        branchName: res.branchName || branches.find((b: any) => b.id === selectedBranchId)?.name || 'Main Counter',
        date: new Date(String(res.created || new Date().toISOString()).replace(' ', 'T')).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
        billAmount: bill,
        stampsEarned: Number(res.stampsEarned) || 0,
        currentStamps: typeof res.totalStamps === 'number' ? res.totalStamps : 0,
        stampGoal: Number(res.goal) || Number(program?.stamp_goal) || 10,
        nextRewardName: res.nextRewardName || program?.reward_name || '',
        customerPhone: res.phone || phoneInput.trim(),
        customerName: resolvedName,
        cashierName: user?.name,
        pointsEarned: pointsEarnedCalc,
        currentPoints: Number(res.pointsBalance) || 0,
        isPointsOnly,
      };
      setActiveReceipt(receiptInfo);
      setActivePaidReceipt(null);
      setReceiptError('');
      setIssueSuccessVisible(true);
      setSuccessMsg(null);

      setPhoneInput('');
      setCustomerName('');
      setCustomerLookup('idle');
      setLookupNameRequired(false);
      setExistingCustomer(null);
      setBillAmount('');
      setStampAmount('1');
      if (merchantId) invalidate(cacheKeys.merchantTxns(merchantId));
      fetchTransactions();
    } catch (err: any) {
      const msg = err?.message || (isPointsOnly ? 'Failed to award points manually.' : 'Failed to issue stamps manually.');
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (merchantId) invalidate(cacheKeys.merchantTxns(merchantId));
    await fetchTransactions();
    setRefreshing(false);
  };

  const billValue = parseFloat(billAmount) || 0;
  const stampsValue = isPointsOnly ? 0 : (parseInt(stampAmount, 10) || 1);
  const pointsRate = Number(program?.spend_per_point) > 0 ? Number(program.spend_per_point) : 1;
  const previewPoints = isStampsOnly ? 0 : Math.floor(billValue / pointsRate);
  const customerLabel = customerName.trim() || existingCustomer?.name || phoneInput.trim() || 'Customer';
  const manualCtaLabel = isPointsOnly ? 'Award Points' : stampsValue === 1 ? 'Issue Stamp' : 'Issue Stamps';
  const canIssue = (customerLookup === 'found' || customerLookup === 'new') && (!lookupNameRequired || !!customerName.trim());
  const issueHint = customerLookup === 'checking' ? 'Checking number…'
    : customerLookup === 'error' ? 'Retry number lookup'
    : lookupNameRequired && !customerName.trim() ? 'Enter customer name'
    : customerLookup === 'idle' ? 'Enter customer phone'
    : isPointsOnly ? (previewPoints > 0 ? `+${previewPoints} points` : 'Points from sale')
    : `${stampsValue} stamp${stampsValue === 1 ? '' : 's'}`;
  const pendingVoucherRecord = pendingVoucher?.voucher;
  const pendingRewardName = pendingVoucherRecord?.expand?.reward?.name || pendingVoucherRecord?.title || 'Reward voucher';
  const pendingCustomerName = pendingVoucherRecord?.expand?.customer?.name || pendingVoucherRecord?.customer_name || 'Customer';
  const pendingExpiry = pendingVoucherRecord?.expires_at
    ? new Date(String(pendingVoucherRecord.expires_at).replace(' ', 'T')).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No expiry';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: activeTab === 'manual' ? 10 + insets.top : 16 + insets.top, paddingBottom: activeTab === 'manual' ? 108 : 120 },
          isDesktop && { maxWidth: 860, alignSelf: 'center', width: '100%' }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFC700" />}
      >
        <View style={[styles.headerSheet, { paddingTop: 16 + insets.top, marginTop: -(16 + insets.top) }]}>
          {activeTab === 'voucher' ? (
            <View style={styles.merchantBrandRow}>
              <View style={styles.merchantBrandLeft}>
                <View style={styles.merchantBrandMark}>
                  {merchantIdentity.logo ? (
                    <Image source={{ uri: merchantIdentity.logo }} style={styles.merchantBrandImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="storefront" size={19} color="#111111" />
                  )}
                </View>
                <Text style={styles.merchantBrandName} numberOfLines={1}>{merchantIdentity.name || 'Your store'}</Text>
              </View>
              <Image source={require('../../assets/risev logo.png')} style={styles.risevBrandImage} resizeMode="contain" accessibilityLabel="Risev" />
            </View>
          ) : null}
          <View style={[styles.headerRow, activeTab === 'manual' && styles.manualHeaderRow]}>
            <View style={styles.headerTitleGroup}>
              {activeTab === 'manual' ? (
                <TouchableOpacity style={styles.headerIcon} onPress={() => setActiveTab('voucher')} accessibilityRole="button" accessibilityLabel="Back to Issue and Redeem">
                  <Ionicons name="arrow-back" size={iconSizes.lg} color={colors.black} />
                </TouchableOpacity>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{activeTab === 'manual' ? (isPointsOnly ? 'Award Points' : 'Give Stamps') : 'Issue & Redeem'}</Text>
                {activeTab === 'voucher' && <Text style={styles.headerSubtitle} numberOfLines={1}>Customer rewards made simple.</Text>}
              </View>
            </View>
            {activeTab === 'voucher' && <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerAction} onPress={openSupport} accessibilityRole="button" accessibilityLabel="Help">
                <Ionicons name="help-circle-outline" size={iconSizes.md} color={colors.accent[600]} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerAction} onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Refresh">
                <Ionicons name="refresh" size={iconSizes.md} color={colors.accent[600]} />
              </TouchableOpacity>
            </View>}
          </View>

          {activeTab === 'voucher' ? <View style={styles.tabBarWrap}>
            <TouchableOpacity
              accessibilityRole="button"
              testID="voucher-scan-tab"
              style={[styles.tabBtn, activeTab === 'voucher' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('voucher');
                setSuccessMsg(null);
                setVoucherError('');
                setIsCameraActive(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={iconSizes.md} color={activeTab === 'voucher' ? colors.white : colors.accent[500]} />
              <Text style={[styles.tabBtnText, activeTab === 'voucher' && styles.tabBtnTextActive]}>Redeem Voucher</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              testID="manual-give-tab"
              style={styles.tabBtn}
              onPress={() => {
                setActiveTab('manual');
                setSuccessMsg(null);
                setVoucherError('');
                setIsCameraActive(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name={isPointsOnly ? 'sparkles-outline' : 'ribbon-outline'} size={iconSizes.md} color={colors.accent[500]} />
              <Text style={styles.tabBtnText}>
                {isPointsOnly ? 'Award Points' : 'Give Stamps'}
              </Text>
            </TouchableOpacity>
          </View> : null}
        </View>

        {/* Rich Redemption Success Card */}
        {redeemedDetails ? (
          <View style={styles.redeemedCard}>
            <View style={styles.redeemedHeader}>
              <View style={styles.redeemedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.redeemedBadgeText}>VOUCHER REDEEMED</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setRedeemedDetails(null);
                  setSuccessMsg(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.redeemedRewardTitle}>{redeemedDetails.reward_title}</Text>
            
            <View style={styles.redeemedCodeBox}>
              <Text style={styles.redeemedCodeLabel}>CODE</Text>
              <Text style={styles.redeemedCodeValue}>{redeemedDetails.code}</Text>
            </View>

            <View style={styles.redeemedInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.redeemedMetaLabel}>CUSTOMER</Text>
                <Text style={styles.redeemedMetaValue}>{redeemedDetails.customer_name}</Text>
                {redeemedDetails.customer_phone ? (
                  <Text style={styles.redeemedMetaSub}>{redeemedDetails.customer_phone}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.redeemedMetaLabel}>STATUS</Text>
                <View style={styles.redeemedStatusPill}>
                  <Text style={styles.redeemedStatusText}>USED / APPLIED</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.scanNextBtn}
              onPress={() => {
                setRedeemedDetails(null);
                setSuccessMsg(null);
                setVoucherCode('');
                setIsCameraActive(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={18} color="#050505" />
              <Text style={styles.scanNextBtnText}>Scan Next Voucher</Text>
            </TouchableOpacity>
          </View>
        ) : successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 1: VOUCHER QR SCANNER & REDEMPTION FORM */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'voucher' && (
          <View style={styles.voucherArea}>
            <RisevRewardBanner mode="voucher" onPress={openCamera} />

            <TouchableOpacity style={styles.actionRow} onPress={openCamera} activeOpacity={0.85} accessibilityRole="button">
              <View style={styles.actionIcon}><Ionicons name="camera-outline" size={20} color="#111111" /></View>
              <Text style={styles.actionText}>Open Camera Scanner</Text>
              <Ionicons name="chevron-forward" size={18} color="#6B788B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => setManualCodeOpen((value) => !value)} activeOpacity={0.85} accessibilityRole="button">
              <View style={styles.actionIcon}><Ionicons name="keypad-outline" size={20} color="#111111" /></View>
              <Text style={styles.actionText}>{manualCodeOpen ? 'Hide Voucher Code' : 'Enter Voucher Code Manually'}</Text>
              <Ionicons name={manualCodeOpen ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B788B" />
            </TouchableOpacity>

            {manualCodeOpen && (
              <View style={{ marginTop: 12 }}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>VOUCHER CODE</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="qr-code-outline" size={iconSizes.md} color={colors.accent[700]} style={{ marginLeft: 16, marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                      placeholder="e.g. WV-1234-5678"
                      placeholderTextColor={colors.accent[400]}
                      value={voucherCode}
                      onChangeText={(text) => {
                        setVoucherCode(text);
                        setVoucherError('');
                      }}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, isRedeemingVoucher && styles.primaryBtnDisabled]}
                  onPress={handleRedeemVoucher}
                  disabled={isRedeemingVoucher}
                  activeOpacity={0.85}
                >
                  {isRedeemingVoucher ? (
                    <ActivityIndicator color={colors.primary[400]} />
                  ) : (
                    <>
                      <Ionicons name="gift-outline" size={iconSizes.md} color={colors.primary[400]} style={{ marginRight: 8 }} />
                      <Text style={styles.primaryBtnText}>Review & redeem</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {voucherError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={iconSizes.md} color={colors.error.DEFAULT} />
                <Text style={styles.errorBannerText}>{voucherError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {activeTab === 'voucher' && transactions.length > 0 ? (
          <View style={styles.recentBlock}>
            <Text style={styles.recentHeading}>Recent activity</Text>
            {transactions.slice(0, 2).map((txn) => {
              const redeemed = String(txn.type || '').toLowerCase().includes('redeem');
              const stampCount = Number(txn.stamps) || 0;
              const pointCount = Number(txn.points) || 0;
              return (
                <View key={txn.id} style={styles.recentRow}>
                  <View style={[styles.recentIcon, redeemed ? styles.recentRedeemed : styles.recentEarned]}>
                    <Ionicons name={redeemed ? 'checkmark' : 'ribbon'} size={17} color={redeemed ? '#087A53' : '#111111'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>{redeemed ? 'Voucher redeemed' : stampCount > 0 ? `${stampCount} stamp${stampCount === 1 ? '' : 's'} issued` : pointCount > 0 ? `${pointCount} points awarded` : 'Customer visit recorded'}</Text>
                    <Text style={styles.recentMeta} numberOfLines={1}>{txn.expand?.customer?.name || 'Customer'}</Text>
                  </View>
                  <Text style={styles.recentTime}>{new Date(String(txn.created).replace(' ', 'T')).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* TAB 2: MANUAL ISSUANCE FORM */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'manual' && (
          <View style={[styles.card, styles.manualCard]}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>01 / CUSTOMER</Text>
                <Text style={styles.cardTitle}>Who visited today?</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert(
                  isPointsOnly ? 'Award points' : isStampsOnly ? 'Issue stamps' : 'Issue stamps & points',
                  isPointsOnly
                    ? 'Enter the customer phone and bill to award points directly.'
                    : isStampsOnly
                    ? 'Enter the customer phone to issue stamps when the NFC card is unavailable.'
                    : 'Enter the customer phone and bill to issue stamps and points.'
                )}
                style={styles.cardHelpBtn}
                accessibilityRole="button"
                accessibilityLabel="Manual issuance help"
              >
                <Ionicons name="help-circle-outline" size={iconSizes.md} color={colors.accent[400]} />
              </TouchableOpacity>
            </View>

            {/* Customer Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>CUSTOMER PHONE NUMBER</Text>
              <View style={[styles.inputWrap, focusedField === 'phone' && styles.inputWrapFocused]}>
                <View style={styles.prefixBox}>
                  <Text style={styles.flag}>🇲🇾</Text>
                  <Text style={styles.prefixCode}>+60</Text>
                  <View style={styles.prefixDivider} />
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                  placeholder="11 234 5678"
                  placeholderTextColor="#94A3B8"
                  value={phoneInput}
                  onChangeText={(t) => {
                    const nextPhone = formatMalaysianPhone(t);
                    if (nextPhone !== phoneInput) {
                      if (customerLookup !== 'idle') setCustomerName('');
                      setExistingCustomer(null);
                      setCustomerLookup('idle');
                      setLookupNameRequired(false);
                    }
                    setPhoneInput(nextPhone);
                  }}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="phone-pad"
                  accessibilityLabel="Customer phone number"
                />
              </View>
            </View>

            {customerLookup === 'checking' && (
              <View style={styles.lookupNotice}>
                <ActivityIndicator size="small" color="#A67A00" />
                <Text style={styles.lookupNoticeText}>Checking customer number…</Text>
              </View>
            )}
            {customerLookup === 'error' && (
              <View style={[styles.lookupNotice, styles.lookupError]}>
                <Ionicons name="alert-circle-outline" size={16} color="#B42318" />
                <Text style={[styles.lookupNoticeText, { color: '#B42318' }]}>Could not check this number.</Text>
                <TouchableOpacity onPress={() => setLookupRetry((value) => value + 1)} accessibilityRole="button" accessibilityLabel="Retry customer lookup">
                  <Text style={styles.lookupRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {lookupNameRequired && (customerLookup === 'new' || customerLookup === 'found') && (
            <View style={styles.inputContainer}>
              <View style={styles.nameLabelRow}>
                <Text style={styles.label}>CUSTOMER NAME *</Text>
                <Text style={styles.nameRequiredBadge}>{customerLookup === 'new' ? 'NEW CUSTOMER' : 'NAME REQUIRED'}</Text>
              </View>
              <View style={[styles.inputWrap, focusedField === 'name' && styles.inputWrapFocused]}>
                <Ionicons name="person-outline" size={20} color="#050505" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                  placeholder={t('customer_name_placeholder') || 'Enter name (e.g. Adam)'}
                  placeholderTextColor="#94A3B8"
                  value={customerName}
                  onChangeText={setCustomerName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  accessibilityLabel="Customer name, required"
                />
              </View>
            </View>
            )}

            {existingCustomer && !lookupNameRequired ? (
              <View style={styles.customerPreview}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {(existingCustomer.name || customerName || 'C').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'C'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerPreviewName}>{existingCustomer.name || customerName || 'Customer'}</Text>
                  <Text style={styles.customerPreviewMeta}>
                    {existingCustomer.stamps ?? 0}/{Number(program?.stamp_goal) || 10} stamps · {existingCustomer.points ?? 0} pts
                  </Text>
                  {!isPointsOnly && <View style={styles.customerProgressTrack}>
                    <View style={[styles.customerProgressFill, { width: `${Math.min(100, ((existingCustomer.stamps || 0) / (Number(program?.stamp_goal) || 10)) * 100)}%` }]} />
                  </View>}
                </View>
                <Ionicons name="checkmark-circle" size={iconSizes.md} color={colors.success.DEFAULT} />
              </View>
            ) : null}

            <View style={styles.sectionDivider} />
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>02</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.manualSectionTitle}>Record this visit</Text>
                <Text style={styles.sectionSubtitle}>Stamp count and sale</Text>
              </View>
            </View>

            {/* Stamps to Issue Input (Hidden if Points-Only) */}
            {!isPointsOnly && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>STAMPS TO ISSUE</Text>
                <View style={styles.stampStepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setStampAmount(String(Math.max(1, stampsValue - 1)))}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease stamps"
                  >
                    <Ionicons name="remove" size={21} color="#111111" />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.stepperInput, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                    value={stampAmount}
                    onChangeText={(value) => setStampAmount(value.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    accessibilityLabel="Number of stamps to issue"
                  />
                  <TouchableOpacity
                    style={[styles.stepperButton, styles.stepperButtonAdd]}
                    onPress={() => setStampAmount(String(Math.min(99, stampsValue + 1)))}
                    accessibilityRole="button"
                    accessibilityLabel="Increase stamps"
                  >
                    <Ionicons name="add" size={22} color="#111111" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Bill Amount Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                {isPointsOnly ? 'BILL AMOUNT (RM) *' : isStampsOnly ? 'BILL AMOUNT (RM) - OPTIONAL (TRACKS SALES)' : 'BILL AMOUNT (RM)'}
              </Text>
              {Number((program as any)?.min_spend_amount) > 0 && !isPointsOnly ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}>
                  <Ionicons name="information-circle" size={14} color="#1D4ED8" />
                  <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1D4ED8' }}>
                    {locale === 'en'
                      ? `Min. spend requirement: RM ${Number((program as any).min_spend_amount).toFixed(2)} to earn a stamp`
                      : `Syarat bil minimum: RM ${Number((program as any).min_spend_amount).toFixed(2)} untuk menerima cop`}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.inputWrap, focusedField === 'bill' && styles.inputWrapFocused]}>
                <Text style={styles.currencyPrefix}>RM</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  value={billAmount}
                  onChangeText={setBillAmount}
                  onFocus={() => setFocusedField('bill')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Points Preview for Points-Enabled Programs */}
              {!isStampsOnly && parseFloat(billAmount || '0') > 0 ? (() => {
                const spp = Number(program?.spend_per_point) > 0 ? Number(program.spend_per_point) : 1;
                const earnedPts = Math.floor(parseFloat(billAmount || '0') / spp);
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFDF0', borderRadius: 8, borderWidth: 1, borderColor: '#FEF08A' }}>
                    <Ionicons name="sparkles" size={14} color="#B45309" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                      Customer will earn +{earnedPts} Points{spp !== 1 ? ` (RM ${spp} = 1 Pt)` : ''}
                    </Text>
                  </View>
                );
              })() : null}

              {/* Quick Bill Presets */}
              <View style={styles.presetRow}>
                {['10', '20', '50', '100'].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.presetPill, billAmount === amt && styles.presetPillActive]}
                    onPress={() => setBillAmount(amt)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetText, billAmount === amt && styles.presetTextActive]}>RM {amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Outlet picker — brand-wide users (the owner) choose where this sale happened */}
            {isBrandWide && branches.length > 1 && (
              <View style={{ marginBottom: 5 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6, letterSpacing: 0.5 }}>
                  {locale === 'en' ? 'OUTLET' : 'CAWANGAN'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {branches.map((b: any) => {
                    const selected = selectedBranchId === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        onPress={() => setSelectedBranchId(b.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          backgroundColor: selected ? '#000000' : '#F1F5F9',
                          borderWidth: 1,
                          borderColor: selected ? '#000000' : '#E2E8F0',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: selected ? '#FFFFFF' : '#475569' }}>
                          {b.name.replace(' (HQ)', '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.manualActionRow}>
              <View style={styles.manualActionSummary}>
                <Text style={styles.manualActionCustomer} numberOfLines={1}>{customerLabel}</Text>
                <Text style={styles.manualActionDetail} numberOfLines={1}>{issueHint}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                testID="submit-manual-give"
                style={[styles.manualIssueButton, (!canIssue || isSubmitting) && styles.manualIssueDisabled]}
                onPress={handleManualIssue}
                disabled={!canIssue || isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? <ActivityIndicator color={colors.black} /> : <>
                  <Text style={styles.manualIssueText}>{manualCtaLabel}</Text>
                  <Ionicons name="arrow-forward" size={17} color="#111111" />
                </>}
              </TouchableOpacity>
            </View>

          </View>
        )}
      </ScrollView>

      <Modal visible={isCameraActive} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeCamera}>
        <View style={styles.cameraModal}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraFrame}>
                  <View style={[styles.cornerBracket, styles.topLeft]} />
                  <View style={[styles.cornerBracket, styles.topRight]} />
                  <View style={[styles.cornerBracket, styles.bottomLeft]} />
                  <View style={[styles.cornerBracket, styles.bottomRight]} />
                </View>
                <Text style={styles.cameraHint}>Align the customer's QR inside the frame</Text>
              </View>
            </CameraView>

            <View style={styles.cameraTopbar}>
              <TouchableOpacity style={styles.cameraRoundBtn} onPress={closeCamera} accessibilityRole="button" accessibilityLabel="Close scanner">
                <Ionicons name="close" size={iconSizes.lg} color={colors.white} />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>Scan voucher</Text>
              <TouchableOpacity style={styles.cameraRoundBtn} onPress={() => setTorchOn((value) => !value)} accessibilityRole="button" accessibilityLabel="Toggle torch">
                <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={iconSizes.md} color={colors.white} />
              </TouchableOpacity>
            </View>

            {!permission?.granted && (
              <View style={styles.cameraPermission}>
                <Ionicons name="camera-outline" size={iconSizes.display} color={colors.white} />
                <Text style={styles.cameraPermissionText}>Camera access is needed to scan vouchers.</Text>
                <TouchableOpacity style={styles.cameraPermissionBtn} onPress={requestPermission} activeOpacity={0.85}>
                  <Text style={styles.cameraPermissionBtnText}>Allow camera</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.cameraBottomPanel}>
              <View style={styles.cameraHandle} />
              <View style={styles.cameraFallbackIcon}><Ionicons name="qr-code" size={23} color="#111111" /></View>
              <Text style={styles.cameraFallbackTitle}>Having trouble scanning?</Text>
              <Text style={styles.cameraFallbackCopy}>Enter the customer's voucher code manually.</Text>
              <TouchableOpacity style={styles.cameraGalleryButton} onPress={scanFromGallery} accessibilityRole="button">
                <Ionicons name="images-outline" size={17} color="#17202B" />
                <Text style={styles.cameraGalleryText}>Choose QR Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraManualButton}
                onPress={() => { closeCamera(); setActiveTab('voucher'); setManualCodeOpen(true); }}
                accessibilityRole="button"
              >
                <Text style={styles.cameraManualText}>Enter Voucher Code</Text>
                <Ionicons name="chevron-forward" size={18} color="#111111" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={!!pendingVoucher} transparent animationType="slide" onRequestClose={closeReview}>
        <View style={styles.reviewOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeReview} />
          <View style={[styles.reviewSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.reviewHandle} />
            <Text style={styles.reviewTitle}>Redeem this voucher?</Text>
            <View style={styles.reviewCodeBox}>
              <Text style={styles.reviewCodeLabel}>VOUCHER</Text>
              <Text style={styles.reviewCodeValue}>{pendingVoucher?.code}</Text>
            </View>
            {pendingVoucher?.loading ? (
              <View style={styles.reviewLoading}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : pendingVoucher?.voucher ? (
              <View style={styles.reviewDetails}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewRowLabel}>Reward</Text>
                  <Text style={styles.reviewRowValue}>{pendingRewardName}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewRowLabel}>Customer</Text>
                  <Text style={styles.reviewRowValue}>{pendingCustomerName}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewRowLabel}>Expires</Text>
                  <Text style={styles.reviewRowValue}>{pendingExpiry}</Text>
                </View>
              </View>
            ) : null}
            {voucherError ? <Text style={styles.reviewError}>{voucherError}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, isRedeemingVoucher && styles.primaryBtnDisabled]}
              onPress={() => pendingVoucher && executeRedemption(pendingVoucher.code)}
              disabled={isRedeemingVoucher}
              activeOpacity={0.85}
            >
              {isRedeemingVoucher ? (
                <ActivityIndicator color={colors.primary[400]} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={iconSizes.md} color={colors.primary[400]} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Redeem voucher</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewCancel} onPress={closeReview} activeOpacity={0.7}>
              <Text style={styles.reviewCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* POS receipt presentation, backed by this manual transaction's recorded receipt. */}
      <ThermalReceiptScreen
        visible={receiptModalVisible}
        onClose={() => setReceiptModalVisible(false)}
        receipt={activePaidReceipt}
        mode="merchant"
        animate
      />
      <StampIssueSuccessModal
        visible={issueSuccessVisible}
        receipt={activeReceipt}
        cardDesign={{
          backgroundImage: program?.card_background_back ? pb.files.getURL(program, program.card_background_back) : undefined,
          color: program?.card_color || '#FFCC00',
          fontColor: program?.font_color || inkOn(program?.card_color || '#FFCC00'),
          icon: program?.card_icon || 'coffee',
          milestones: cardMilestones,
          spendPerPoint: Number(program?.spend_per_point) || 1,
        }}
        receiptBusy={receiptLoading}
        receiptError={receiptError}
        onReceipt={async () => {
          const id = activeReceipt?.receiptId;
          if (!id || receiptLoading) return;
          setReceiptLoading(true);
          setReceiptError('');
          try {
            const saved = await pb.collection('digital_receipts').getOne<PaidReceipt>(id, { expand: 'merchant', requestKey: null });
            if (saved.payment_status !== 'recorded' && saved.payment_status !== 'paid') throw new Error('Invalid receipt status');
            setActivePaidReceipt(saved);
            setIssueSuccessVisible(false);
            // Let the confirmation modal dismiss before presenting the receipt on iOS.
            setTimeout(() => setReceiptModalVisible(true), 380);
          } catch {
            setReceiptError('Could not load the receipt. Please try again.');
          } finally {
            setReceiptLoading(false);
          }
        }}
        onAnother={() => { setIssueSuccessVisible(false); setActiveTab('manual'); }}
        onDone={() => { setIssueSuccessVisible(false); setActiveTab('voucher'); setActiveReceipt(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  manualHeaderRow: { marginBottom: 9 },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 21,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.3,
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFDF0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  scrollContent: {
    padding: 16,
  },

  // Segment Tab Selector (Capsule Style)
  tabBarWrap: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  tabBtnActive: {
    backgroundColor: colors.black,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.accent[500],
  },
  tabBtnTextActive: {
    color: colors.white,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#065F46',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
    flex: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.accent[100],
    marginBottom: 20,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  manualCard: {
    padding: 15,
    borderRadius: 24,
    borderColor: '#E8ECF1',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.4,
    marginBottom: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },

  // Viewfinder & Camera Scanner Card
  viewfinderCard: {
    backgroundColor: '#050505',
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 24,
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cameraView: {
    width: '100%',
    height: 240,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanTargetBox: {
    width: 180,
    height: 180,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,199,0,0.3)',
    borderRadius: 16,
  },
  viewfinderPlaceholder: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  scannerTargetGraphic: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFC700',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  viewfinderHint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  activateCameraBtn: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFC700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  activateCameraBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  cameraFallbackWrap: {
    padding: 20,
    alignItems: 'center',
  },
  cameraFallbackText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#050505',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  inputContainer: {
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.accent[500],
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.accent[50],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent[100],
    overflow: 'hidden',
  },
  inputWrapFocused: {
    borderColor: '#E9B900',
    backgroundColor: '#FFFDF5',
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  flag: {
    fontSize: 16,
    marginRight: 6,
  },
  prefixCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginLeft: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  presetPill: {
    flex: 1,
    height: 31,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  presetText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  presetTextActive: {
    color: '#FFC700',
  },
  primaryBtn: {
    height: 52,
    backgroundColor: colors.black,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary[400],
    shadowColor: colors.primary[400],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  historySection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginTop: 8,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  txnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txnIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  txnDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  txnStamps: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  txnBill: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },

  // Redeemed Confirmation Card
  redeemedCard: {
    backgroundColor: '#050505',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  redeemedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  redeemedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redeemedBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  redeemedRewardTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  redeemedCodeBox: {
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#262626',
  },
  redeemedCodeLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  redeemedCodeValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 1,
  },
  redeemedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    marginBottom: 18,
  },
  redeemedMetaLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  redeemedMetaValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  redeemedMetaSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  redeemedStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  redeemedStatusText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  scanNextBtn: {
    backgroundColor: '#FFC700',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanNextBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  // Close Camera Overlay Button
  closeCameraOverlayBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  closeCameraOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  headerSheet: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent[100],
  },
  merchantBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  merchantBrandLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  merchantBrandMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFC700', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  merchantBrandImage: { width: 40, height: 40 },
  merchantBrandName: { flex: 1, fontSize: 12.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#151515' },
  risevBrandImage: { width: 66, height: 20, marginLeft: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardEyebrow: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.accent[500],
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  cardHelpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupNotice: { minHeight: 32, marginTop: -1, marginBottom: 9, paddingHorizontal: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFBEC' },
  lookupNoticeText: { flex: 1, color: '#756236', fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold' },
  lookupError: { backgroundColor: '#FFF0EE' },
  lookupRetry: { color: '#B42318', fontSize: 10.5, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  nameLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  nameRequiredBadge: { color: '#9B6E00', fontSize: 9, letterSpacing: 0.3, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sectionDivider: { height: 1, backgroundColor: '#EFF0F2', marginVertical: 7 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  sectionNumber: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#FFE998', alignItems: 'center', justifyContent: 'center' },
  sectionNumberText: { color: '#493600', fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  manualSectionTitle: { color: '#151515', fontSize: 14, letterSpacing: -0.2, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sectionSubtitle: { color: '#7A8798', fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 1 },
  voucherArea: { paddingTop: 16 },
  actionRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: '#E4E8EF', backgroundColor: '#FFFFFF', paddingHorizontal: 13, marginBottom: 7 },
  actionIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#18202B' },
  recentBlock: { marginTop: 13, paddingHorizontal: 3 },
  recentHeading: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#67758B', marginBottom: 8 },
  recentRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#E8ECF2', paddingVertical: 7 },
  recentIcon: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  recentRedeemed: { backgroundColor: '#DCFBE9' },
  recentEarned: { backgroundColor: '#FFE68C' },
  recentName: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#16202C' },
  recentMeta: { fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#7A8799' },
  recentTime: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#8C98A9' },
  scanHero: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 12,
  },
  scanIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanCaption: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
    lineHeight: 18,
    textAlign: 'center',
  },
  textBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  textBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.accent[600],
  },
  customerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  customerPreviewName: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  customerPreviewMeta: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
    marginTop: 2,
  },
  customerProgressTrack: { width: '100%', height: 4, borderRadius: 2, backgroundColor: '#E2E7EF', overflow: 'hidden', marginTop: 6 },
  customerProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#FFC700' },
  stampStepper: { minHeight: 44, paddingHorizontal: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF9DF', borderWidth: 1, borderColor: '#FFE48C', borderRadius: 13 },
  stepperButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E5EC', alignItems: 'center', justifyContent: 'center' },
  stepperButtonAdd: { backgroundColor: '#FFC700' },
  stepperInput: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', minWidth: 45, paddingVertical: 0 },
  manualActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#ECEFF3', paddingTop: 10, marginTop: 2 },
  manualActionSummary: { flex: 1, minWidth: 0 },
  manualActionCustomer: { color: '#273344', fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold' },
  manualActionDetail: { color: '#7A8797', fontSize: 10.5, marginTop: 2, fontFamily: 'PlusJakartaSans_600SemiBold' },
  manualIssueButton: { minWidth: 142, height: 43, borderRadius: 13, backgroundColor: '#FFC700', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#B88A00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 3 },
  manualIssueDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  manualIssueText: { color: '#111111', fontSize: 12.5, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  cameraModal: {
    flex: 1,
    backgroundColor: colors.black,
  },
  cameraTopbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraRoundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.white,
  },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 180,
  },
  cameraFrame: {
    width: 230,
    height: 230,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 24,
    position: 'relative',
  },
  cameraHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 16,
    textAlign: 'center',
  },
  cameraPermission: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraPermissionText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  cameraPermissionBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPermissionBtnText: {
    color: colors.black,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  cameraBottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, alignItems: 'center' },
  cameraHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8DEE7', marginBottom: 12 },
  cameraFallbackIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#FFF4CD', alignItems: 'center', justifyContent: 'center' },
  cameraFallbackTitle: { marginTop: 7, fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#17202B' },
  cameraFallbackCopy: { marginTop: 3, fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#728096' },
  cameraGalleryButton: { marginTop: 10, minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cameraGalleryText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#17202B' },
  cameraManualButton: { marginTop: 12, width: '100%', minHeight: 43, borderRadius: 13, backgroundColor: '#F4F6F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  cameraManualText: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111' },
  reviewOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  reviewSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  reviewHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent[200],
    alignSelf: 'center',
    marginBottom: 14,
  },
  reviewTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  reviewCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  reviewCodeLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.accent[500],
    letterSpacing: 0.8,
  },
  reviewCodeValue: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: 1,
  },
  reviewLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  reviewDetails: {
    gap: 4,
    marginBottom: 14,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent[100],
  },
  reviewRowLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },
  reviewRowValue: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
    textAlign: 'right',
  },
  reviewError: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.error.DEFAULT,
    marginBottom: 10,
  },
  reviewCancel: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reviewCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.accent[500],
  },
});
