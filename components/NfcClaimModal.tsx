import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
  DeviceEventEmitter,
  Alert,
  Share,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { getRecommendedVisuals } from '@/lib/rewardVisuals';

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatUpcomingDate = (dateStr?: string): string => {
  if (!dateStr) return 'Upcoming';
  try {
    const clean = dateStr.trim().split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (mIdx >= 0 && mIdx < 12 && !isNaN(day)) {
        return `${day} ${months[mIdx]}`;
      }
    }
    return clean.slice(5);
  } catch {
    return dateStr;
  }
};

const getItemImageUrl = (item: any, availableAddons: any[] = []): string | null => {
  if (!item) return null;

  // 1. Direct base64 or absolute URL
  if (typeof item.image === 'string' && (item.image.startsWith('http') || item.image.startsWith('data:'))) {
    return item.image;
  }
  if (typeof item.photo === 'string' && (item.photo.startsWith('http') || item.photo.startsWith('data:'))) {
    return item.photo;
  }
  if (typeof item.image_url === 'string' && (item.image_url.startsWith('http') || item.image_url.startsWith('data:'))) {
    return item.image_url;
  }

  // 2. PocketBase stored file on item record
  if (item.image && item.id && item.id !== 'booking') {
    const colName = item.collectionName || 'merchant_services';
    return `${pb.baseUrl}/api/files/${colName}/${item.id}/${item.image}`;
  }
  if (item.photo && item.id && item.id !== 'booking') {
    const colName = item.collectionName || 'merchant_services';
    return `${pb.baseUrl}/api/files/${colName}/${item.id}/${item.photo}`;
  }

  // 3. Match against available merchant services catalog by name or service ID
  if (item.name && availableAddons && availableAddons.length > 0) {
    const matched = availableAddons.find(
      (a: any) => a.name === item.name || a.id === item.service || a.id === item.service_id
    );
    if (matched) {
      if (typeof matched.image === 'string' && (matched.image.startsWith('http') || matched.image.startsWith('data:'))) {
        return matched.image;
      }
      if (typeof matched.photo === 'string' && (matched.photo.startsWith('http') || matched.photo.startsWith('data:'))) {
        return matched.photo;
      }
      if (matched.image && matched.id) {
        return `${pb.baseUrl}/api/files/merchant_services/${matched.id}/${matched.image}`;
      }
      if (matched.photo && matched.id) {
        return `${pb.baseUrl}/api/files/merchant_services/${matched.id}/${matched.photo}`;
      }
    }
  }

  // 4. Fallback 3D product cutout recommendation from rewardVisuals engine
  const recs = getRecommendedVisuals({
    title: item.name || '',
    merchantCategory: item.item_type || item.category || '',
  });
  if (recs.length > 0 && recs[0]?.asset_url) {
    return recs[0].asset_url;
  }
  return null;
};

export default function NfcClaimModal() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id;

  const [claim, setClaim] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billAmount, setBillAmount] = useState('10');
  const [stampAmount, setStampAmount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [merchantColor, setMerchantColor] = useState('#5C3BCC');
  const [merchantSlug, setMerchantSlug] = useState('');
  const [activePlan, setActivePlan] = useState<string>('stand_bundle');
  const [merchantData, setMerchantData] = useState<any>(null);

  const isProPlan = Boolean(
    activePlan === 'pro' ||
    activePlan === 'business' ||
    activePlan === 'enterprise' ||
    merchantData?.has_booking_addon === true ||
    merchantData?.is_pro === true
  );

  // Booking & Quick Add-on states
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [upcomingFutureBooking, setUpcomingFutureBooking] = useState<any>(null);
  const [quickAddons, setQuickAddons] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [itemActionTarget, setItemActionTarget] = useState<{ item: any; index: number } | null>(null);

  const fetchMerchantServices = useCallback(async () => {
    if (!merchantId) {
      setQuickAddons([]);
      return;
    }
    try {
      const qRes = await pb.collection('merchant_services').getList(1, 100, {
        filter: `merchant = "${merchantId}" && is_active = true`,
        sort: '-item_type,price',
        requestKey: null,
      });
      setQuickAddons(qRes.items || []);
    } catch (e) {
      setQuickAddons([]);
    }
  }, [merchantId]);

  const handleRemoveItemByIndex = (indexToRemove: number) => {
    setSelectedServices(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Customer Vouchers & Smart Discount Engine states
  const [customerVouchers, setCustomerVouchers] = useState<any[]>([]);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [isVouchersExpanded, setIsVouchersExpanded] = useState<boolean>(false);
  const [customBillInput, setCustomBillInput] = useState<string>('20');
  const [subtotalAmount, setSubtotalAmount] = useState<number>(20);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [netTotalAmount, setNetTotalAmount] = useState<number>(20);
  const [spendPerPoint, setSpendPerPoint] = useState<number>(1);

  // Option A: Catalog Picker states
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerCategory, setPickerCategory] = useState('all');
  const [customItemTitle, setCustomItemTitle] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Payment Method Screen states
  const [checkoutStep, setCheckoutStep] = useState<'review' | 'payment'>('review');
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'card' | 'cash' | 'transfer'>('qr');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    let subtotal = 0;
    if (selectedServices.length > 0) {
      selectedServices.forEach(s => subtotal += (parseFloat(s.price) || 0) * (parseInt(s.qty) || 1));
    } else {
      subtotal = parseFloat(customBillInput) || 0;
    }
    setSubtotalAmount(subtotal);

    let disc = 0;
    if (appliedVoucher) {
      let meta: any = {};
      try {
        meta = typeof appliedVoucher.metadata === 'string'
          ? JSON.parse(appliedVoucher.metadata)
          : (appliedVoucher.metadata || {});
      } catch (e) {}

      const discType = meta.discount_type || 'none';
      const discVal = parseFloat(meta.discount_value) || 0;
      const minSpend = parseFloat(meta.min_spend) || 0;
      const maxDisc = parseFloat(meta.max_discount) || 0;

      if (subtotal >= minSpend) {
        if (discType === 'percentage' && discVal > 0) {
          disc = (subtotal * discVal) / 100;
          if (maxDisc > 0 && disc > maxDisc) disc = maxDisc;
        } else if (discType === 'fixed_amount' && discVal > 0) {
          disc = discVal;
        } else if (meta.snapshot_type === 'free_item' || appliedVoucher.reward) {
          disc = selectedServices.length > 0 ? (parseFloat(selectedServices[0].price) || 0) : subtotal;
        }
      }
    }

    if (disc > subtotal) disc = subtotal;
    setDiscountAmount(disc);
    const net = Math.max(0, subtotal - disc);
    setNetTotalAmount(net);

    setBillAmount(net.toFixed(2));
    setStampAmount('1');
  }, [selectedServices, appliedVoucher, customBillInput]);

  const handleAddItem = (catalogItem: any) => {
    setSelectedServices((prev) => {
      const idx = prev.findIndex(s => s.id === catalogItem.id || s.name === catalogItem.name);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: (updated[idx].qty || 1) + 1 };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: catalogItem.id || catalogItem.name,
            name: catalogItem.name,
            price: parseFloat(catalogItem.price || 0),
            qty: 1,
            isBooking: false,
            item_type: catalogItem.item_type || 'addon',
          }
        ];
      }
    });
  };

  const handleRemoveItem = (catalogItem: any) => {
    setSelectedServices((prev) => {
      const idx = prev.findIndex(s => s.id === catalogItem.id || s.name === catalogItem.name);
      if (idx >= 0) {
        const item = prev[idx];
        if ((item.qty || 1) > 1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], qty: updated[idx].qty - 1 };
          return updated;
        } else {
          return prev.filter((_, i) => i !== idx);
        }
      }
      return prev;
    });
  };

  const handleAddCustomItem = () => {
    if (!customItemTitle.trim()) return;
    const priceNum = parseFloat(customItemPrice) || 0;
    const customObj = {
      id: 'custom_' + Date.now(),
      name: customItemTitle.trim(),
      price: priceNum,
      qty: 1,
      isBooking: false,
      item_type: 'custom',
    };
    setSelectedServices(prev => [...prev, customObj]);
    setCustomItemTitle('');
    setCustomItemPrice('');
    setIsAddingCustom(false);
  };

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      try {
        const m = await pb.collection('merchants').getOne(merchantId);
        setMerchantData(m);
        if (m?.slug) {
          setMerchantSlug(m.slug);
        }
        if (m?.onboarding_primary_color) {
          setMerchantColor(m.onboarding_primary_color);
        }
      } catch (e) {}

      try {
        const subs = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = "${merchantId}" && (status = "active" || status = "trialing")`,
          sort: '-created',
          requestKey: null
        });
        if (subs.items.length > 0) {
          setActivePlan((subs.items[0].plan || 'stand_bundle').toLowerCase());
        } else {
          setActivePlan('stand_bundle');
        }
      } catch (sErr) {}

      try {
        const progRes = await pb.collection('loyalty_programs').getList(1, 1, {
          filter: `merchant = "${merchantId}" && is_active = true`,
        });
        if (progRes.items.length > 0) {
          const spp = parseFloat(progRes.items[0].spend_per_point) || 1;
          setSpendPerPoint(spp > 0 ? spp : 1);
        }
      } catch (e) {}
    })();
  }, [merchantId]);

  const handleToggleBookingStatus = async () => {
    if (!activeBooking) return;
    const nextStatus = (activeBooking.status === 'booked') ? 'in_service' : 'booked';
    try {
      await pb.collection('service_bookings').update(activeBooking.id, {
        status: nextStatus
      });
      setActiveBooking((prev: any) => ({ ...prev, status: nextStatus }));
    } catch (err) {
      console.warn('Failed to update booking status:', err);
    }
  };

  // Check active booking & quick add-ons when customer taps
  useEffect(() => {
    if (!claim?.customer_phone || !merchantId) {
      setActiveBooking(null);
      return;
    }
    (async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      let bk: any = null;

      try {
        // 1. Query TODAY's active booking (booked, arrived, in_service)
        const bRes = await pb.collection('service_bookings').getList(1, 1, {
          filter: `merchant = "${merchantId}" && customer_phone = "${claim.customer_phone}" && (status = "booked" || status = "arrived" || status = "in_service") && booking_date ~ "${todayStr}"`,
          sort: '-created',
        });
        if (bRes.items.length > 0) {
          bk = bRes.items[0];
        } else {
          // Fallback if booking_date is not strictly formatted but status is arrived/in_service
          const fallbackRes = await pb.collection('service_bookings').getList(1, 1, {
            filter: `merchant = "${merchantId}" && customer_phone = "${claim.customer_phone}" && (status = "arrived" || status = "in_service")`,
            sort: '-created',
          });
          if (fallbackRes.items.length > 0) {
            bk = fallbackRes.items[0];
          }
        }
      } catch (bErr) {
        console.warn('Booking query note:', bErr);
      }

      if (bk) {
        setActiveBooking(bk);
        setUpcomingFutureBooking(null);
        let basePrice = bk.total_price || 0;
        let serviceName = bk.items_summary?.[0]?.name || 'Temujanji Servis';
        setSelectedServices([{ id: 'booking', name: serviceName, price: basePrice, isBooking: true, qty: 1 }]);
      } else {
        setActiveBooking(null);
        setSelectedServices([]);

        // 2. Check if customer has a future upcoming booking for informational display
        try {
          const fRes = await pb.collection('service_bookings').getList(1, 1, {
            filter: `merchant = "${merchantId}" && customer_phone = "${claim.customer_phone}" && status = "booked" && booking_date > "${todayStr}"`,
            sort: 'booking_date',
          });
          if (fRes.items.length > 0) {
            setUpcomingFutureBooking(fRes.items[0]);
          } else {
            setUpcomingFutureBooking(null);
          }
        } catch (fErr) {
          setUpcomingFutureBooking(null);
        }
      }

      // Fetch active merchant services (up-to-date catalog)
      await fetchMerchantServices();

      // Fetch active customer vouchers
      try {
        let custId = claim.customer;
        if (!custId && claim.customer_phone) {
          const uRes = await pb.collection('users').getList(1, 1, {
            filter: `phone = "${claim.customer_phone}"`,
          });
          if (uRes.items.length > 0) custId = uRes.items[0].id;
        }
        if (custId) {
          const vRes = await pb.collection('vouchers').getList(1, 10, {
            filter: `customer = "${custId}" && status = "active"`,
            expand: 'reward',
          });
          setCustomerVouchers(vRes.items);
        } else {
          setCustomerVouchers([]);
        }
      } catch (e) {
        setCustomerVouchers([]);
      }
    })();
  }, [claim?.id, claim?.customer_phone, merchantId]);

  const activeClaimRef = React.useRef<any>(null);
  activeClaimRef.current = claim;
  const isSuccessRef = React.useRef(false);
  isSuccessRef.current = isSuccess;

  useEffect(() => {
    if (!merchantId) return;

    // 1. Initial fetch for any unhandled pending claims
    const fetchPendingClaims = async () => {
      try {
        const records = await pb.collection('nfc_claims').getList(1, 1, {
          filter: `merchant = '${merchantId}' && status = 'pending'`,
          sort: '-created',
        });
        if (records.items.length > 0) {
          setClaim(records.items[0]);
          setIsVisible(true);
        }
      } catch (err) {
        /* ignore */
      }
    };

    fetchPendingClaims();

    // 2. Realtime PocketBase SSE Subscription
    let unsubscribe: any = null;
    pb.collection('nfc_claims').subscribe('*', (e: any) => {
      const record = e.record;
      const action = e.action;
      if (!record || record.merchant !== merchantId) return;

      if (record.status === 'pending') {
        setClaim(record);
        setIsSuccess(false);
        setErrorMsg(null);
        setIsVisible(true);
      } else if (
        (activeClaimRef.current &&
        record.id === activeClaimRef.current.id &&
        (record.status === 'completed' || record.status === 'cancelled' || action === 'delete')) ||
        (record.status === 'completed' || record.status === 'cancelled')
      ) {
        if (record.id === activeClaimRef.current?.id && isSuccessRef.current) {
          // Cashier is looking at in-modal success view, retain until Done is pressed
        } else if (activeClaimRef.current && record.id === activeClaimRef.current.id) {
          setIsVisible(false);
          setClaim(null);
          setErrorMsg(null);
        }
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    }).catch(() => {});

    return () => {
      if (unsubscribe) unsubscribe();
      pb.collection('nfc_claims').unsubscribe('*').catch(() => {});
    };
  }, [merchantId]);

  // Realtime PocketBase & Local event listener for merchant_services
  useEffect(() => {
    if (!merchantId) {
      setQuickAddons([]);
      return;
    }

    fetchMerchantServices();

    let unsubServices: any = null;
    pb.collection('merchant_services').subscribe('*', (e: any) => {
      const rec = e.record;
      if (rec && rec.merchant && rec.merchant !== merchantId) return;

      if (e.action === 'delete') {
        const deletedId = rec?.id || e.id;
        setQuickAddons((prev) => (prev || []).filter((item: any) => item.id !== deletedId));
        setSelectedServices((prev) => (prev || []).filter((item: any) => item.id !== deletedId));
      } else {
        fetchMerchantServices();
      }
    }).then((unsub) => {
      unsubServices = unsub;
    }).catch(() => {});

    const localSub = DeviceEventEmitter.addListener('MERCHANT_SERVICES_UPDATED', () => {
      fetchMerchantServices();
    });

    return () => {
      if (unsubServices) unsubServices();
      pb.collection('merchant_services').unsubscribe('*').catch(() => {});
      localSub.remove();
    };
  }, [merchantId, fetchMerchantServices]);

  // Fresh refetch whenever claim modal opens or catalog picker opens
  useEffect(() => {
    if (isVisible || isCatalogPickerOpen) {
      fetchMerchantServices();
    }
  }, [isVisible, isCatalogPickerOpen, fetchMerchantServices]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_NFC_CLAIM', (targetClaim) => {
      if (targetClaim && targetClaim.status === 'pending') {
        setClaim(targetClaim);
        if (targetClaim.bill_amount) setBillAmount(String(targetClaim.bill_amount));
        else setBillAmount('10');
        if (targetClaim.stamp_amount) setStampAmount(String(targetClaim.stamp_amount));
        else setStampAmount('1');
        setIsSuccess(false);
        setErrorMsg(null);
        setIsVisible(true);
      } else {
        // If claim is already completed or cancelled, clear state and do not open
        setClaim(null);
        setIsVisible(false);
        setErrorMsg(null);
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  const handleConfirmClassic = async () => {
    if (!claim) return;
    const bill = parseFloat(billAmount) || 0;
    const stamps = parseInt(stampAmount) || 1;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await pb.send('/api/risev/nfc/complete', {
        method: 'POST',
        body: {
          claim_id: claim.id,
          bill_amount: bill,
          stamp_amount: stamps,
          handled_by: user?.id,
          staff_name: user?.name || 'Staff',
          branch_name: user?.branch_name || '',
          branch_id: user?.branch || '',
        },
      });

      DeviceEventEmitter.emit('merchant_transaction_completed', {
        bill_amount: bill,
      });

      setIsSuccess(true);
    } catch (err: any) {
      if (err?.message?.includes('already been completed') || err?.message?.includes('completed')) {
        DeviceEventEmitter.emit('merchant_transaction_completed');
        handleClose();
        return;
      }
      setErrorMsg(err?.message || 'Failed to issue stamps.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!claim) return;
    const bill = netTotalAmount;
    const stamps = parseInt(stampAmount) || 1;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. If voucher was applied, redeem it via the dedicated endpoint AND update status
      if (appliedVoucher) {
        if (appliedVoucher.code) {
          try {
            await pb.send('/api/risev/merchant/vouchers/redeem', {
              method: 'POST',
              body: { code: appliedVoucher.code },
            });
          } catch (vErr) {
            console.warn('[VOUCHER REDEEM] Dedicated endpoint note:', vErr);
          }
        }
        try {
          await pb.collection('vouchers').update(appliedVoucher.id, {
            status: 'used',
            used_at: new Date().toISOString(),
          });
        } catch (vDirectErr) {
          console.warn('[VOUCHER REDEEM] Direct update note:', vDirectErr);
        }
        // Remove from local list so it instantly vanishes from UI
        setCustomerVouchers(prev => prev.filter(v => v.id !== appliedVoucher.id));
      }

      // 2. Complete NFC transaction
      await pb.send('/api/risev/nfc/complete', {
        method: 'POST',
        body: {
          claim_id: claim.id,
          bill_amount: netTotalAmount,
          subtotal: subtotalAmount,
          discount_amount: discountAmount,
          voucher_id: appliedVoucher?.id || '',
          stamp_amount: stamps,
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim(),
          branch_name: user?.branch_name || '',
          branch_id: user?.branch || '',
        },
      });

      // 3. Notify merchant dashboard to refresh sales immediately
      DeviceEventEmitter.emit('merchant_transaction_completed', {
        bill_amount: netTotalAmount,
        subtotal: subtotalAmount,
      });

      // If customer had an active booking, mark completed
      if (activeBooking?.id) {
        try {
          await pb.collection('service_bookings').update(activeBooking.id, {
            status: 'completed'
          });
        } catch (bErr) {
          console.warn('Booking reconciliation note:', bErr);
        }
      }

      // ALWAYS create a digital receipt
      try {
        const receiptPayload: any = {
          merchant: merchantId,
          customer_phone: claim.customer_phone,
          receipt_number: `REC-${Date.now().toString().slice(-6)}`,
          total_amount: bill,
          payment_method: paymentMethod || 'nfc_counter',
          payment_reference: paymentReference.trim(),
          stamps_earned: stamps,
          line_items: selectedServices.length > 0 ? selectedServices : [{ name: 'Pembayaran Servis', price: subtotalAmount || bill }]
        };
        if (activeBooking?.id) receiptPayload.booking = activeBooking.id;
        
        await pb.collection('digital_receipts').create(receiptPayload);
      } catch (bErr) {
        console.warn('Receipt creation note:', bErr);
      }

      // Show sleek in-modal success view
      setIsSuccess(true);
    } catch (err: any) {
      if (err?.message?.includes('already been completed') || err?.message?.includes('completed')) {
        DeviceEventEmitter.emit('merchant_transaction_completed');
        handleClose();
        return;
      }
      setErrorMsg(err?.message || 'Failed to issue stamps.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setClaim(null);
    setIsSuccess(false);
    setErrorMsg(null);
    setBillAmount('20');
    setCustomBillInput('20');
    setAppliedVoucher(null);
    setStampAmount('1');
    setSelectedServices([]);
    setCheckoutStep('review');
    setPaymentMethod('qr');
    setPaymentReference('');
    setIsCatalogPickerOpen(false);
  };

  const handleMinimize = () => {
    // If the active claim is already completed or cancelled, dismiss it completely instead of keeping banner
    if (!claim || claim.status !== 'pending') {
      handleClose();
    } else {
      setIsVisible(false);
    }
  };

  const handleDecline = async () => {
    if (claim && !isSuccess) {
      try {
        await pb.collection('nfc_claims').update(claim.id, { status: 'cancelled' });
      } catch (err) { /* ignore */ }
    }
    handleClose();
  };

  if (!claim || (!isSuccess && claim.status !== 'pending')) return null;

  return (
    <>
      {/* Floating Minimized Pending Capsule (visible when minimized so cashier can re-open anytime) */}
      {!isVisible && !isSuccess && claim.status === 'pending' && (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingCapsule}
            onPress={() => setIsVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.floatingPulseRing}>
              <Ionicons name="wifi" size={15} color="#B45309" />
            </View>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.floatingTitle} numberOfLines={1}>
                Pending Tap: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>{claim.customer_name || 'Customer'}</Text>
              </Text>
              <Text style={styles.floatingSubtitle}>
                {claim.customer_phone} · RM {billAmount || '10'} ({stampAmount || '1'} stamp)
              </Text>
            </View>
            <View style={[styles.floatingActionBadge, { backgroundColor: merchantColor }]}>
              <Text style={styles.floatingActionText}>Open</Text>
              <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Claim Modal */}
      {isVisible && (
        <Modal
          visible={isVisible}
          transparent
          animationType="fade"
          onRequestClose={handleMinimize}
        >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {isSuccess ? (
            // ── In-Modal Success Confirmation Screen ──────────────
            <View style={styles.successWrap}>
              <View style={styles.successIconBg}>
                <Ionicons name="checkmark-circle" size={42} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Stamps Issued Successfully!</Text>
              <Text style={styles.successSubtitle}>
                {stampAmount} stamp(s) credited to <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400' }}>{claim.customer_name || 'Customer'}</Text>
              </Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{claim.customer_name || 'Customer'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phone</Text>
                  <Text style={styles.summaryValue}>{claim.customer_phone}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bill Amount</Text>
                  <Text style={styles.summaryValue}>RM {parseFloat(billAmount || '0').toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Handled by</Text>
                  <Text style={[styles.summaryValue, { color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                    {user?.name || 'Staff'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stamps Added</Text>
                  <View style={styles.stampPillBadge}>
                    <Ionicons name="ribbon" size={12} color="#10B981" />
                    <Text style={styles.summaryValueStamps}>+{stampAmount} stamps</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : isProPlan ? (
            // ── Main Claim Form View (PRO Flow) ──────────────────────────────
            (() => {
              const getIsLight = (color: string) => {
                const hex = (color || '#ffffff').replace('#', '');
                if (hex.length === 3) {
                  const r = parseInt(hex[0] + hex[0], 16);
                  const g = parseInt(hex[1] + hex[1], 16);
                  const b = parseInt(hex[2] + hex[2], 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                if (hex.length === 6) {
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                return true;
              };

              const isLightColor = getIsLight(merchantColor);
              const contrastTextColor = isLightColor ? '#050505' : '#FFFFFF';
              const iconBgColor = merchantColor + '10'; // 10% opacity
              const boxBgColor = merchantColor + '07'; // 7% opacity
              const boxBorderColor = merchantColor + '15'; // 15% opacity

              const filteredCatalog = (quickAddons || []).filter((item: any) => {
                const q = pickerSearchQuery.trim().toLowerCase();
                const matchesSearch = !q || (item.name && item.name.toLowerCase().includes(q));
                const matchesCategory =
                  pickerCategory === 'all' ||
                  (pickerCategory === 'services' && (item.item_type === 'service' || item.category === 'service')) ||
                  (pickerCategory === 'addons' && (item.item_type !== 'service' && item.category !== 'service'));
                return matchesSearch && matchesCategory;
              });

              if (isCatalogPickerOpen) {
                return (
                  <View style={{ flex: 1, width: '100%' }}>
                    {/* Top iOS Drag Handle Indicator */}
                    <View style={styles.topDragHandleBar} />

                    {/* Slide-Over Header */}
                    <View style={styles.pickerHeaderRow}>
                      <TouchableOpacity
                        style={styles.pickerBackBtn}
                        onPress={() => setIsCatalogPickerOpen(false)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chevron-back" size={18} color="#1D1D1F" />
                        <Text style={styles.pickerBackText}>Back</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={styles.pickerTitle}>Edit Order & Add Items</Text>
                        <Text style={styles.pickerSubTitle} numberOfLines={1}>
                          {claim.customer_name || 'Customer'} · {claim.customer_phone}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.pickerDoneBtn}
                        onPress={() => setIsCatalogPickerOpen(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.pickerSearchWrap}>
                      <Ionicons name="search-outline" size={16} color="#86868B" />
                      <TextInput
                        style={styles.pickerSearchInput}
                        placeholder="Search products or services..."
                        placeholderTextColor="#86868B"
                        value={pickerSearchQuery}
                        onChangeText={setPickerSearchQuery}
                      />
                      {pickerSearchQuery ? (
                        <TouchableOpacity onPress={() => setPickerSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color="#86868B" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Category Pills */}
                    <View style={styles.pickerCategoryRow}>
                      {[
                        { id: 'all', label: 'All Items' },
                        { id: 'services', label: 'Services' },
                        { id: 'addons', label: 'Add-ons' },
                      ].map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.pickerCategoryChip,
                            pickerCategory === cat.id && styles.pickerCategoryChipActive,
                          ]}
                          onPress={() => setPickerCategory(cat.id)}
                        >
                          <Text
                            style={[
                              styles.pickerCategoryText,
                              pickerCategory === cat.id && styles.pickerCategoryTextActive,
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Catalog List */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
                      {/* Custom Line Item Accordion */}
                      <View style={styles.pickerCustomCard}>
                        <TouchableOpacity
                          style={styles.pickerCustomHeader}
                          onPress={() => setIsAddingCustom(!isAddingCustom)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add-circle-outline" size={18} color="#1D1D1F" />
                          <Text style={styles.pickerCustomTitle}>Add Custom Charge / Line Item</Text>
                          <Ionicons name={isAddingCustom ? 'chevron-up' : 'chevron-down'} size={16} color="#86868B" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        {isAddingCustom && (
                          <View style={{ gap: 8, marginTop: 10 }}>
                            <TextInput
                              style={styles.pickerCustomInput}
                              placeholder="Item Name (e.g. Delivery Fee, Ice Bag)"
                              placeholderTextColor="#86868B"
                              value={customItemTitle}
                              onChangeText={setCustomItemTitle}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TextInput
                                style={[styles.pickerCustomInput, { flex: 1 }]}
                                placeholder="Price (RM)"
                                placeholderTextColor="#86868B"
                                keyboardType="decimal-pad"
                                value={customItemPrice}
                                onChangeText={setCustomItemPrice}
                              />
                              <TouchableOpacity
                                style={styles.pickerCustomAddBtn}
                                onPress={handleAddCustomItem}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.pickerCustomAddBtnText}>+ Add Line Item</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Catalog Items */}
                      {filteredCatalog.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }}>
                          <Ionicons name="cube-outline" size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
                          <Text style={styles.pickerEmptyText}>
                            {pickerSearchQuery
                              ? 'No catalog items found matching search.'
                              : 'Your catalog has no active services or products.\nAdd items in Services & Catalog to select them here.'}
                          </Text>
                        </View>
                      ) : (
                        filteredCatalog.map((item: any) => {
                          const selectedMatch = selectedServices.find(s => s.id === item.id || s.name === item.name);
                          const qty = selectedMatch ? (selectedMatch.qty || 1) : 0;
                          const imgUrl = getItemImageUrl(item, quickAddons);

                          return (
                            <View key={item.id} style={styles.pickerCatalogItemCard}>
                              {imgUrl ? (
                                <Image source={{ uri: imgUrl }} style={styles.pickerItemImg} resizeMode="cover" />
                              ) : (
                                <View style={styles.pickerItemIconBox}>
                                  <Ionicons name="cube-outline" size={18} color="#D97706" />
                                </View>
                              )}

                              <View style={{ flex: 1, paddingRight: 6 }}>
                                <Text style={styles.pickerItemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.pickerItemCategory}>
                                  {item.item_type === 'service' ? 'Booking Service' : 'Catalog Add-on'}
                                </Text>
                                <Text style={styles.pickerItemPrice}>
                                  RM {parseFloat(item.price || 0).toFixed(2)}
                                </Text>
                              </View>

                              {qty > 0 ? (
                                <View style={styles.pickerStepperWrap}>
                                  <TouchableOpacity style={styles.pickerStepperBtn} onPress={() => handleRemoveItem(item)}>
                                    <Ionicons name="remove" size={14} color="#1D1D1F" />
                                  </TouchableOpacity>
                                  <Text style={styles.pickerStepperVal}>{qty}</Text>
                                  <TouchableOpacity style={styles.pickerStepperBtn} onPress={() => handleAddItem(item)}>
                                    <Ionicons name="add" size={14} color="#1D1D1F" />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity style={styles.pickerAddBtn} onPress={() => handleAddItem(item)} activeOpacity={0.8}>
                                  <Ionicons name="add" size={14} color="#1D1D1F" />
                                  <Text style={styles.pickerAddBtnText}>Add</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })
                      )}
                    </ScrollView>

                    {/* Sticky Bottom Save Button */}
                    <View style={styles.pickerFooter}>
                      <TouchableOpacity
                        style={styles.pickerSaveBtn}
                        onPress={() => setIsCatalogPickerOpen(false)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.pickerSaveBtnText}>
                          Save & Update Order ({selectedServices.length} items — RM {netTotalAmount.toFixed(2)}) →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              if (checkoutStep === 'payment') {
                return (
                  <View style={{ flex: 1, width: '100%' }}>
                    {/* Top iOS Drag Handle Indicator */}
                    <View style={styles.topDragHandleBar} />

                    {/* Header Navigation */}
                    <View style={styles.payHeaderRow}>
                      <TouchableOpacity
                        style={styles.payBackBtn}
                        onPress={() => setCheckoutStep('review')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chevron-back" size={20} color="#1D1D1F" />
                      </TouchableOpacity>
                      <Text style={styles.payTitle}>Payment</Text>
                      <View style={{ width: 28 }} />
                    </View>

                    {/* Error Banner if any */}
                    {errorMsg ? (
                      <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={18} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
                      {/* Customer Badge Row */}
                      <View style={styles.payCustomerCard}>
                        <View style={styles.payAvatarCircle}>
                          <Text style={styles.payAvatarText}>{getInitials(claim.customer_name || 'Fazli')}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payCustomerName}>{claim.customer_name || 'Fazli'}</Text>
                          <Text style={styles.payCustomerSub}>
                            {claim.customer_phone || '+601110209669'} · {claim.session_code || 'ZGKPS6'}
                          </Text>
                        </View>
                      </View>

                      {/* Total Amount Banner */}
                      <View style={styles.payTotalBanner}>
                        <Text style={styles.payTotalLabel}>Total Amount</Text>
                        <Text style={styles.payTotalValue}>
                          RM {netTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>

                      {/* Payment Methods Section */}
                      <View style={{ gap: 8 }}>
                        <Text style={styles.paySectionHeading}>Select Payment Method</Text>

                        {/* Option 1: QR Payment */}
                        <TouchableOpacity
                          style={[styles.payMethodCard, paymentMethod === 'qr' && styles.payMethodCardSelected]}
                          onPress={() => setPaymentMethod('qr')}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.payRadioOuter, paymentMethod === 'qr' && styles.payRadioOuterSelected]}>
                            {paymentMethod === 'qr' && <View style={styles.payRadioInner} />}
                          </View>
                          <View style={styles.payMethodIconBox}>
                            <Ionicons name="qr-code-outline" size={20} color="#1D1D1F" />
                          </View>
                          <View style={{ flex: 1, paddingRight: 4 }}>
                            <Text style={styles.payMethodTitle}>QR Payment</Text>
                            <Text style={styles.payMethodSub}>DuitNow, TNG eWallet, GrabPay</Text>
                          </View>
                          <View style={styles.duitnowBadgeBox}>
                            <View style={styles.duitnowDot} />
                            <Text style={styles.duitnowBadgeText}>DuitNow</Text>
                          </View>
                        </TouchableOpacity>

                        {/* Option 2: Card Payment */}
                        <TouchableOpacity
                          style={[styles.payMethodCard, paymentMethod === 'card' && styles.payMethodCardSelected]}
                          onPress={() => setPaymentMethod('card')}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.payRadioOuter, paymentMethod === 'card' && styles.payRadioOuterSelected]}>
                            {paymentMethod === 'card' && <View style={styles.payRadioInner} />}
                          </View>
                          <View style={styles.payMethodIconBox}>
                            <Ionicons name="card-outline" size={20} color="#1D1D1F" />
                          </View>
                          <View style={{ flex: 1, paddingRight: 4 }}>
                            <Text style={styles.payMethodTitle}>Card Payment</Text>
                            <Text style={styles.payMethodSub}>Visa, Mastercard, MyDebit</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <View style={styles.cardBrandBadge}><Text style={styles.cardBrandText}>VISA</Text></View>
                            <View style={[styles.cardBrandBadge, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.cardBrandText, { color: '#EF4444' }]}>MC</Text></View>
                          </View>
                        </TouchableOpacity>

                        {/* Option 3: Cash */}
                        <TouchableOpacity
                          style={[styles.payMethodCard, paymentMethod === 'cash' && styles.payMethodCardSelected]}
                          onPress={() => setPaymentMethod('cash')}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.payRadioOuter, paymentMethod === 'cash' && styles.payRadioOuterSelected]}>
                            {paymentMethod === 'cash' && <View style={styles.payRadioInner} />}
                          </View>
                          <View style={[styles.payMethodIconBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="cash-outline" size={20} color="#059669" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.payMethodTitle}>Cash</Text>
                            <Text style={styles.payMethodSub}>Counter cash settlement</Text>
                          </View>
                        </TouchableOpacity>

                        {/* Option 4: Bank Transfer */}
                        <TouchableOpacity
                          style={[styles.payMethodCard, paymentMethod === 'transfer' && styles.payMethodCardSelected]}
                          onPress={() => setPaymentMethod('transfer')}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.payRadioOuter, paymentMethod === 'transfer' && styles.payRadioOuterSelected]}>
                            {paymentMethod === 'transfer' && <View style={styles.payRadioInner} />}
                          </View>
                          <View style={styles.payMethodIconBox}>
                            <Ionicons name="business-outline" size={20} color="#1D1D1F" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.payMethodTitle}>Bank Transfer</Text>
                            <Text style={styles.payMethodSub}>Direct online transfer</Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Optional Payment Reference Field */}
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <Text style={styles.payRefLabel}>Payment Reference (Optional)</Text>
                        <TextInput
                          style={styles.payRefInput}
                          placeholder="e.g. Reference number / receipt ID"
                          placeholderTextColor="#86868B"
                          value={paymentReference}
                          onChangeText={setPaymentReference}
                        />
                      </View>
                    </ScrollView>

                    {/* Action Footer */}
                    <View style={styles.payFooter}>
                      <TouchableOpacity
                        style={styles.payConfirmBtn}
                        onPress={handleConfirm}
                        disabled={isLoading}
                        activeOpacity={0.88}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                            <Text style={styles.payConfirmBtnText}>Confirm Payment</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.payDisclaimerRow}>
                        <Ionicons name="information-circle-outline" size={13} color="#86868B" />
                        <Text style={styles.payDisclaimerText}>
                          Loyalty points/stamps will be awarded after payment is confirmed.
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <>
                  {/* Top iOS Drag Handle Indicator */}
                  <View style={styles.topDragHandleBar} />

                  {/* Modal Header */}
                  <View style={styles.headerRow}>
                    <View style={styles.headerYellowIconBox}>
                      <Ionicons name="calendar" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{activeBooking ? "Complete Booking" : "Customer Checkout"}</Text>
                      <Text style={styles.subtitle}>{activeBooking ? "Review before checkout" : "Walk-in checkout via NFC"}</Text>
                    </View>
                    <TouchableOpacity onPress={handleMinimize} style={styles.closeBtnCircle} accessibilityLabel="Minimize">
                      <Ionicons name="close" size={18} color="#86868B" />
                    </TouchableOpacity>
                  </View>

                  {/* Error Banner */}
                  {errorMsg ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {/* Scrollable Main Content Body */}
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10, gap: 12 }} showsVerticalScrollIndicator={false}>
                    
                    {/* 1. CUSTOMER & BOOKING SINGLE HORIZONTAL CARD */}
                    <View style={styles.customerRowCard}>
                      <View style={styles.figmaAvatarCircle}>
                        <Text style={styles.figmaAvatarText}>
                          {getInitials(claim.customer_name || 'Fazli')}
                        </Text>
                      </View>
                      
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text style={styles.figmaCustomerName} numberOfLines={1}>
                            {claim.customer_name || 'Fazli'}
                          </Text>
                          <View style={styles.sessionPillBadge}>
                            <Text style={styles.sessionPillText}>{claim.session_code || 'ZX2Z8R'}</Text>
                          </View>
                        </View>
                        <Text style={styles.figmaCustomerPhone} numberOfLines={1}>
                          {claim.customer_phone || '+601110209669'}
                        </Text>
                      </View>

                      <View style={styles.customerColDivider} />

                      {activeBooking ? (
                        <TouchableOpacity
                          style={{ flex: 1.15, minWidth: 0, paddingLeft: 2 }}
                          onPress={handleToggleBookingStatus}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={[
                              styles.statusMiniBadge,
                              (activeBooking.status === 'in_service' || activeBooking.status === 'arrived') 
                                ? styles.statusBadgeInService 
                                : styles.statusBadgeScheduled
                            ]}>
                              <Ionicons
                                name={activeBooking.status === 'in_service' || activeBooking.status === 'arrived' ? 'time' : 'calendar'}
                                size={10}
                                color={activeBooking.status === 'in_service' || activeBooking.status === 'arrived' ? '#059669' : '#475569'}
                              />
                              <Text style={[
                                styles.statusMiniBadgeText,
                                (activeBooking.status === 'in_service' || activeBooking.status === 'arrived') 
                                  ? styles.statusTextInService 
                                  : styles.statusTextScheduled
                              ]}>
                                {activeBooking.status === 'in_service' || activeBooking.status === 'arrived' 
                                  ? 'In-Service' 
                                  : `Today, ${activeBooking.start_time || '03:00 PM'}`}
                              </Text>
                            </View>
                            <View style={[
                              styles.statusIndicatorPill,
                              (activeBooking.status === 'in_service' || activeBooking.status === 'arrived') 
                                ? styles.statusIndicatorOngoing 
                                : styles.statusIndicatorScheduled
                            ]}>
                              <Text style={[
                                styles.statusIndicatorText,
                                (activeBooking.status === 'in_service' || activeBooking.status === 'arrived') 
                                  ? styles.statusTextInService 
                                  : styles.statusTextScheduled
                              ]}>
                                {activeBooking.status === 'in_service' || activeBooking.status === 'arrived' ? 'Ongoing' : 'Scheduled'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.bookingServiceSubText} numberOfLines={1}>
                            {activeBooking.items_summary?.[0]?.name || selectedServices[0]?.name || 'Catering Aiskrim 300pax'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flex: 1.15, minWidth: 0, paddingLeft: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={styles.figmaWalkinPill}>
                              <View style={styles.walkinDot} />
                              <Text style={styles.figmaWalkinText}>Walk-in</Text>
                            </View>
                            {upcomingFutureBooking ? (
                              <View style={styles.futureBookingChip}>
                                <Ionicons name="calendar-outline" size={10} color="#2563EB" />
                                <Text style={styles.futureBookingChipText} numberOfLines={1}>
                                  Booked: {formatUpcomingDate(upcomingFutureBooking.booking_date)}
                                </Text>
                              </View>
                            ) : merchantSlug ? (
                              <TouchableOpacity
                                style={styles.shareBookingBtnMini}
                                onPress={() => {
                                  const url = `https://risev.app/b/${merchantSlug}`;
                                  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                                    navigator.clipboard.writeText(url);
                                    Alert.alert('Link Copied', `Pautan booking ${url} telah disalin!`);
                                  } else {
                                    Share.share({ message: `Tempah slot temujanji online kami di: ${url}` }).catch(() => {});
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="link-outline" size={10} color="#2563EB" />
                                <Text style={styles.shareBookingTextMini}>Share Link</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                          <Text style={styles.bookingServiceSubText} numberOfLines={1}>
                            {upcomingFutureBooking ? `Next: ${upcomingFutureBooking.items_summary?.[0]?.name || 'Service'}` : 'Counter checkout'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 2. BOOKING SUMMARY SECTION */}
                    <View style={{ gap: 8 }}>
                      <Text style={styles.bookingSummaryTitle}>Booking Summary</Text>
                      
                      {selectedServices.length === 0 ? (
                        <View style={styles.quickBillCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={styles.quickBillLabel}>ORDER / BILL AMOUNT</Text>
                            <TouchableOpacity onPress={() => setIsCatalogPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="list-outline" size={13} color="#2563EB" />
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#2563EB' }}>Choose Items ›</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={styles.quickBillInputRow}>
                            <Text style={styles.quickBillCurrency}>RM</Text>
                            <TextInput
                              style={styles.quickBillInputField}
                              value={customBillInput}
                              onChangeText={(text) => {
                                const clean = text.replace(/[^0-9.]/g, '');
                                setCustomBillInput(clean);
                              }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                          {/* Quick amount shortcut chips */}
                          <View style={styles.quickBillChipsRow}>
                            {['10', '20', '30', '50'].map((amt) => (
                              <TouchableOpacity
                                key={amt}
                                style={[styles.quickBillChip, customBillInput === amt && styles.quickBillChipActive]}
                                onPress={() => setCustomBillInput(amt)}
                                activeOpacity={0.75}
                              >
                                <Text style={[styles.quickBillChipText, customBillInput === amt && styles.quickBillChipTextActive]}>
                                  RM {amt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ) : (
                        <View style={{ gap: 6 }}>
                          {selectedServices.map((item, idx) => {
                            const imgUrl = getItemImageUrl(item, quickAddons);
                            return (
                              <View key={idx} style={styles.figmaServiceItemRow}>
                                {imgUrl ? (
                                  <Image source={{ uri: imgUrl }} style={styles.productThumbnailImg} resizeMode="cover" />
                                ) : (
                                  <View style={styles.figmaServiceIconBox}>
                                    <Ionicons name="ice-cream-outline" size={18} color="#D97706" />
                                  </View>
                                )}
                                
                                <View style={{ flex: 1, paddingRight: 6 }}>
                                  <Text style={styles.figmaServiceName} numberOfLines={1}>{item.name}</Text>
                                  <Text style={styles.figmaServiceSub}>
                                    {item.qty && item.qty > 1 ? `${item.qty} × ` : ''}{item.isBooking ? 'Booking service' : 'Add-on service'}
                                  </Text>
                                </View>
                                
                                <Text style={styles.figmaServicePrice}>
                                  RM {((parseFloat(item.price || 0)) * (item.qty || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>

                                <TouchableOpacity 
                                  style={styles.figmaServiceMoreBtn}
                                  onPress={() => setItemActionTarget({ item, index: idx })}
                                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                  activeOpacity={0.7}
                                  accessibilityLabel="Manage item"
                                >
                                  <Ionicons name="ellipsis-vertical" size={17} color="#64748B" />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Voucher Discount Breakdown Line */}
                      {appliedVoucher && (
                        <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: '#86868B', fontFamily: 'PlusJakartaSans_500Medium' }}>Subtotal</Text>
                            <Text style={{ fontSize: 11, color: '#1D1D1F', fontFamily: 'PlusJakartaSans_700Bold' }}>RM {subtotalAmount.toFixed(2)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: '#059669', fontFamily: 'PlusJakartaSans_700Bold' }}>Voucher Discount</Text>
                            <Text style={{ fontSize: 11, color: '#059669', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>-RM {discountAmount.toFixed(2)}</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 3. AVAILABLE VOUCHERS NAVIGATION ROW */}
                    <TouchableOpacity
                      style={styles.navRowCard}
                      onPress={() => setIsVouchersExpanded(!isVouchersExpanded)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="gift-outline" size={20} color="#1D1D1F" />
                      <Text style={styles.navRowTitle}>Available vouchers</Text>
                      {customerVouchers.length > 0 && (
                        <View style={styles.figmaCountBadge}>
                          <Text style={styles.figmaCountText}>{customerVouchers.length}</Text>
                        </View>
                      )}
                      {appliedVoucher ? (
                        <View style={styles.appliedVoucherBadge}>
                          <Text style={styles.appliedVoucherBadgeText} numberOfLines={1}>
                            ✓ (-RM {discountAmount.toFixed(2)})
                          </Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color="#86868B" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>

                    {/* Collapsible Vouchers Drawer when expanded */}
                    {isVouchersExpanded && (
                      <View style={styles.figmaVoucherSectionCard}>
                        <View style={{ gap: 6 }}>
                          {customerVouchers.map((v) => {
                            let meta: any = {};
                            try {
                              meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata || {});
                            } catch (e) {}

                            const title = meta.snapshot_title || v.expand?.reward?.name || v.code;
                            const isApplied = appliedVoucher?.id === v.id;
                            const discType = meta.discount_type || 'none';
                            const discVal = parseFloat(meta.discount_value) || 0;
                            const badgeText = discType === 'percentage'
                              ? `${discVal}% OFF`
                              : discType === 'fixed_amount'
                              ? `RM ${discVal} OFF`
                              : 'FREE ITEM';

                            return (
                              <View key={v.id} style={[styles.figmaVoucherItemRow, isApplied && styles.figmaVoucherItemApplied]}>
                                <View style={{ flex: 1, paddingRight: 6 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={styles.figmaVoucherTitle} numberOfLines={1}>{title}</Text>
                                    <View style={styles.figmaTagBadge}>
                                      <Text style={styles.figmaTagText}>{badgeText}</Text>
                                    </View>
                                  </View>
                                  <Text style={styles.figmaVoucherCode}>Code: {v.code}</Text>
                                </View>

                                <TouchableOpacity
                                  style={[styles.figmaRedeemBtn, isApplied && styles.figmaRedeemBtnApplied]}
                                  onPress={() => {
                                    setAppliedVoucher(isApplied ? null : v);
                                    if (!isApplied) setIsVouchersExpanded(false);
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <Text style={styles.figmaRedeemBtnText}>{isApplied ? 'Applied ✓' : 'Redeem'}</Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* 4. EDIT ORDER / ADD ITEMS NAVIGATION ROW */}
                    <TouchableOpacity
                      style={styles.navRowCard}
                      onPress={() => setIsCatalogPickerOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={20} color="#1D1D1F" />
                      <Text style={styles.navRowTitle}>Edit Order / Add Items</Text>
                      <Ionicons name="chevron-forward" size={16} color="#86868B" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>

                    {/* 5. LOYALTY REWARDS PREVIEW CARD */}
                    <View style={styles.loyaltyCardApple}>
                      {/* Column 1: Rewards Info */}
                      <View style={styles.loyaltyColMain}>
                        <View style={styles.loyaltyStarBox}>
                          <Ionicons name="star" size={15} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.loyaltyTitleApple} numberOfLines={1}>Rewards after payment</Text>
                          <Text style={styles.loyaltySubApple} numberOfLines={1}>You'll earn the following rewards</Text>
                        </View>
                      </View>

                      <View style={styles.loyaltyDividerLight} />

                      {/* Column 2: Stamp */}
                      <View style={styles.loyaltyColPill}>
                        <Ionicons name="person-outline" size={14} color="#D97706" />
                        <Text style={styles.loyaltyValApple}>+1 Stamp</Text>
                      </View>

                      <View style={styles.loyaltyDividerLight} />

                      {/* Column 3: Points */}
                      <View style={styles.loyaltyColPill}>
                        <Ionicons name="cash-outline" size={14} color="#B45309" />
                        <Text style={styles.loyaltyValApple}>
                          +{Math.floor(netTotalAmount / spendPerPoint).toLocaleString()} pts
                        </Text>
                      </View>
                    </View>

                  </ScrollView>

                  {/* 7. STICKY CHECKOUT FOOTER */}
                  <View style={styles.figmaStickyCheckoutFooter}>
                    {/* Total Amount Row */}
                    <View style={styles.figmaTotalRow}>
                      <Text style={styles.figmaTotalLabel}>Total Amount</Text>
                      <Text style={styles.figmaTotalValue}>
                        RM {netTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>

                    {/* Main Dark Action Button */}
                    <TouchableOpacity 
                      style={styles.figmaPrimaryActionBtn} 
                      onPress={() => setCheckoutStep('payment')} 
                      disabled={isLoading} 
                      activeOpacity={0.88}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Ionicons name="card" size={18} color="#FFCA05" />
                          <Text style={styles.figmaPrimaryActionBtnText}>Proceed to Payment →</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Secondary Actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 4 }}>
                      <TouchableOpacity onPress={handleMinimize} disabled={isLoading} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="time-outline" size={13} color="#64748B" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Save for Later</Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#CBD5E1' }}>|</Text>
                      <TouchableOpacity onPress={handleDecline} disabled={isLoading} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="remove-circle-outline" size={13} color="#EF4444" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#EF4444' }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              );
            })()
          ) : (
            // ── Classic Stamp Claim View (Flow Lama: Stand Bundle & Starter) ──
            (() => {
              const getIsLight = (color: string) => {
                const hex = (color || '#ffffff').replace('#', '');
                if (hex.length === 3) {
                  const r = parseInt(hex[0] + hex[0], 16);
                  const g = parseInt(hex[1] + hex[1], 16);
                  const b = parseInt(hex[2] + hex[2], 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                if (hex.length === 6) {
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                return true;
              };

              const isLightColor = getIsLight(merchantColor);
              const contrastTextColor = isLightColor ? '#050505' : '#FFFFFF';
              const iconBgColor = merchantColor + '10'; // 10% opacity
              const boxBgColor = merchantColor + '07'; // 7% opacity
              const boxBorderColor = merchantColor + '15'; // 15% opacity

              return (
                <>
                  {/* Header */}
                  <View style={styles.headerRow}>
                    <View style={[styles.iconBg, { backgroundColor: iconBgColor, borderColor: boxBorderColor }]}>
                      <Ionicons name="wifi" size={22} color={merchantColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>NFC Stamp Claim!</Text>
                      <Text style={styles.subtitle}>Customer scanned store NFC card</Text>
                    </View>
                    <TouchableOpacity onPress={handleMinimize} style={styles.closeBtn} accessibilityLabel="Minimize">
                      <Ionicons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Error Banner */}
                  {errorMsg ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {/* Customer Details Box as VIP Pass */}
                  <View style={[styles.customerBox, { backgroundColor: boxBgColor, borderColor: boxBorderColor }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
                      <View style={[styles.initialsBadge, { backgroundColor: merchantColor, borderColor: 'transparent' }]}>
                        <Text style={[styles.initialsText, { color: contrastTextColor }]}>
                          {getInitials(claim.customer_name || 'Customer')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{claim.customer_name || 'Customer'}</Text>
                        <Text style={styles.customerPhone}>{claim.customer_phone}</Text>
                      </View>
                      {claim.session_code ? (
                        <View style={[styles.sessionBadge, { backgroundColor: iconBgColor, borderColor: boxBorderColor }]}>
                          <Text style={[styles.sessionText, { color: merchantColor }]}>{claim.session_code}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Inputs */}
                  <View style={styles.inputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>BILL AMOUNT (RM)</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="cash-outline" size={16} color={merchantColor} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.inputField, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
                          keyboardType="numeric"
                          value={billAmount}
                          onChangeText={setBillAmount}
                          placeholder="10"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>STAMPS TO GIVE</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="star-outline" size={16} color={merchantColor} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.inputField, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
                          keyboardType="numeric"
                          value={stampAmount}
                          onChangeText={setStampAmount}
                          placeholder="1"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Staff Acting Badge */}
                  <View style={styles.staffPillRow}>
                    <View style={styles.staffPill}>
                      <Ionicons name="person-circle" size={14} color="#64748B" />
                      <Text style={styles.staffPillText}>
                        Issuing as <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{user?.name || 'Staff'}</Text>
                      </Text>
                    </View>
                    {user?.branch_name ? (
                      <View style={styles.branchPill}>
                        <Ionicons name="location-outline" size={12} color="#64748B" />
                        <Text style={styles.branchPillText}>{user.branch_name}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={isLoading} activeOpacity={0.8}>
                      <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.laterBtn} onPress={handleMinimize} disabled={isLoading} activeOpacity={0.8}>
                      <Ionicons name="time-outline" size={14} color="#64748B" />
                      <Text style={styles.laterBtnText}>Later</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.confirmBtn, { backgroundColor: merchantColor, borderColor: merchantColor }]} 
                      onPress={handleConfirmClassic} 
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={contrastTextColor} />
                      ) : (
                        <Text style={[styles.confirmBtnText, { color: contrastTextColor }]}>Issue Stamps</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()
          )}
        </View>
      </View>
    </Modal>
    )}

    {/* ── Item Actions Bottom Sheet Modal ────────────── */}
    <Modal
      visible={!!itemActionTarget}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setItemActionTarget(null)}
    >
      <Pressable style={styles.itemActionOverlay} onPress={() => setItemActionTarget(null)}>
        <Pressable style={styles.itemActionSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.topDragHandleBar} />
          
          <View style={styles.itemActionHeader}>
            <Text style={styles.itemActionTitle} numberOfLines={1}>
              {itemActionTarget?.item?.name}
            </Text>
            <Text style={styles.itemActionSub}>
              RM {((parseFloat(itemActionTarget?.item?.price || 0)) * (itemActionTarget?.item?.qty || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {itemActionTarget?.item?.isBooking ? 'Booking service' : 'Add-on service'}
            </Text>
          </View>

          {/* Stepper if quantity > 1 */}
          {(itemActionTarget?.item?.qty || 1) > 1 && (
            <View style={styles.itemActionStepperRow}>
              <Text style={styles.itemActionStepperLabel}>Quantity ({itemActionTarget?.item?.qty})</Text>
              <View style={styles.pickerStepperWrap}>
                <TouchableOpacity
                  style={styles.pickerStepperBtn}
                  onPress={() => {
                    if (itemActionTarget) {
                      const targetIdx = itemActionTarget.index;
                      setSelectedServices(prev => {
                        const updated = [...prev];
                        if (updated[targetIdx] && (updated[targetIdx].qty || 1) > 1) {
                          updated[targetIdx] = { ...updated[targetIdx], qty: (updated[targetIdx].qty || 1) - 1 };
                          setItemActionTarget(cur => cur ? { ...cur, item: updated[targetIdx] } : null);
                        }
                        return updated;
                      });
                    }
                  }}
                >
                  <Ionicons name="remove" size={14} color="#1D1D1F" />
                </TouchableOpacity>
                <Text style={styles.pickerStepperVal}>{itemActionTarget?.item?.qty || 1}</Text>
                <TouchableOpacity
                  style={styles.pickerStepperBtn}
                  onPress={() => {
                    if (itemActionTarget) {
                      const targetIdx = itemActionTarget.index;
                      setSelectedServices(prev => {
                        const updated = [...prev];
                        if (updated[targetIdx]) {
                          updated[targetIdx] = { ...updated[targetIdx], qty: (updated[targetIdx].qty || 1) + 1 };
                          setItemActionTarget(cur => cur ? { ...cur, item: updated[targetIdx] } : null);
                        }
                        return updated;
                      });
                    }
                  }}
                >
                  <Ionicons name="add" size={14} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Red Delete Button */}
          <TouchableOpacity
            style={styles.itemActionDeleteBtn}
            onPress={() => {
              if (itemActionTarget !== null) {
                handleRemoveItemByIndex(itemActionTarget.index);
                setItemActionTarget(null);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.itemActionDeleteText}>Remove from Order</Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.itemActionCancelBtn}
            onPress={() => setItemActionTarget(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.itemActionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  // ── FIGMA UI REVAMP STYLES ──
  topDragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerYellowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  customerColDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  bookingSummaryTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
    marginTop: 4,
    marginBottom: 4,
  },
  navRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navRowTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  loyaltyCardApple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  loyaltyColMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  loyaltyStarBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loyaltyTitleApple: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  loyaltySubApple: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 1,
  },
  loyaltyDividerLight: {
    width: 1,
    height: 24,
    backgroundColor: '#FDE68A',
    marginHorizontal: 8,
  },
  loyaltyColPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loyaltyValApple: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
  },
  sessionPillBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  sessionPillText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  bookingTimeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  bookingServiceSubText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
  figmaOpenPosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
  },
  figmaOpenPosText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  productThumbnailImg: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  loyaltyPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  loyaltyCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loyaltyIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loyaltyLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  loyaltyVal: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  loyaltyDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#FDE68A',
    marginHorizontal: 8,
  },
  quickAddSectionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  browseAllText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  productTileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 140,
  },
  productTileIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productTileName: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  productTilePrice: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  issuingRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  issuingText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  figmaCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  figmaAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  figmaAvatarText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaCustomerName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaCustomerPhone: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  figmaSessionBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  figmaSessionText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  figmaBookingMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 100,
  },
  figmaBookingMiniText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  figmaWalkinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: 100,
  },
  walkinDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#64748B',
  },
  figmaWalkinText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  figmaVoucherSectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
  },
  figmaSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figmaSectionTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaCountBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaCountText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  appliedVoucherBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    maxWidth: 160,
  },
  appliedVoucherBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  figmaVoucherItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 9,
  },
  figmaVoucherItemApplied: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  figmaVoucherTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaTagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  figmaTagText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  figmaVoucherCode: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  figmaRedeemBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  figmaRedeemBtnApplied: {
    backgroundColor: '#10B981',
  },
  figmaRedeemBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  figmaServicesSectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 10,
  },
  figmaAddItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  figmaAddItemText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  figmaServiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 8,
  },
  figmaServiceIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaServiceName: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaServiceSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  figmaServicePrice: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  figmaStampsBoxCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  figmaStampCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  figmaStampColTitle: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  figmaStampColVal: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  figmaStampColDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#FDE68A',
    marginHorizontal: 8,
  },
  figmaAddonChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  figmaAddonChipText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  figmaStickyCheckoutFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  figmaTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  figmaTotalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  figmaTotalValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  figmaPrimaryActionBtn: {
    backgroundColor: '#0F172A',
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  figmaPrimaryActionBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },

  // ── OPTION A: CATALOG PICKER STYLES ──
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  pickerBackText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1D1D1F',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pickerSubTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 1,
    maxWidth: 180,
  },
  pickerDoneBtn: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  pickerDoneText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1D1D1F',
  },
  pickerCategoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  pickerCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pickerCategoryChipActive: {
    backgroundColor: '#1D1D1F',
    borderColor: '#1D1D1F',
  },
  pickerCategoryText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#86868B',
  },
  pickerCategoryTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  pickerCustomCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    padding: 10,
    marginBottom: 4,
  },
  pickerCustomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerCustomTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pickerCustomInput: {
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1D1D1F',
  },
  pickerCustomAddBtn: {
    backgroundColor: '#1D1D1F',
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCustomAddBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  pickerCatalogItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 14,
    padding: 10,
  },
  pickerItemImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  pickerItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pickerItemCategory: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 1,
  },
  pickerItemPrice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
    marginTop: 2,
  },
  pickerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pickerAddBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  pickerStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pickerStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pickerStepperVal: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
    minWidth: 16,
    textAlign: 'center',
  },
  pickerEmptyText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    textAlign: 'center',
    paddingVertical: 20,
  },
  pickerFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 10,
    marginTop: 6,
  },
  pickerSaveBtn: {
    backgroundColor: '#1D1D1F',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSaveBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },

  // ── PAYMENT METHOD SCREEN STYLES ──
  payHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  payBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  payCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  payAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payAvatarText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
  },
  payCustomerName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
  },
  payCustomerSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 1,
  },
  payTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  payTotalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#86868B',
  },
  payTotalValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1D1D1F',
    letterSpacing: -0.5,
  },
  paySectionHeading: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  payMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  payMethodCardSelected: {
    borderColor: '#FFCA05',
    backgroundColor: '#FFFDF0',
  },
  payRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  payRadioOuterSelected: {
    borderColor: '#FFCA05',
    backgroundColor: '#FFCA05',
  },
  payRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D1D1F',
  },
  payMethodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payMethodTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  payMethodSub: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    marginTop: 1,
  },
  duitnowBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  duitnowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
  },
  duitnowBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#E11D48',
  },
  cardBrandBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  cardBrandText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#2563EB',
  },
  payRefLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D1D1F',
  },
  payRefInput: {
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1D1D1F',
  },
  payFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 10,
    marginTop: 6,
    gap: 8,
  },
  payConfirmBtn: {
    backgroundColor: '#1D1D1F',
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  payConfirmBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  payDisclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  payDisclaimerText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#86868B',
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'column',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  stickyFooterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#991B1B',
    flex: 1,
  },
  customerBox: {
    backgroundColor: '#FFFDF0',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 16,
  },
  initialsBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  initialsText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  customerName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
  },
  customerPhone: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  sessionBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.2)',
  },
  sessionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1400',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  declineBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  laterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  laterBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1A1400',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },

  /* Success Screen Styles */
  successWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    borderWidth: 4,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
    marginBottom: 4,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1400',
  },
  stampPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  summaryValueStamps: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  doneBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#1A1400',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  staffPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  branchPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  floatingContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  floatingCapsule: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
  },
  floatingPulseRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  floatingSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 1,
  },
  floatingActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#050505',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  floatingActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  activeBookingBanner: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1.5,
    borderColor: '#FFC700',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  activeBookingTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  activeBookingSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1A1400',
  },
  quickAddonLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  quickAddonChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  quickAddonChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  cartContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cartItemName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1E293B',
    paddingRight: 10,
  },
  cartItemPrice: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  cartDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartTotalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
  },
  cartTotalValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
  },
  cartStampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartStampLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  cartStampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cartStampValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusBadgeScheduled: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBadgeInService: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusMiniBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  statusTextScheduled: {
    color: '#475569',
  },
  statusTextInService: {
    color: '#059669',
  },
  statusIndicatorPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  statusIndicatorScheduled: {
    backgroundColor: '#F1F5F9',
  },
  statusIndicatorOngoing: {
    backgroundColor: '#D1FAE5',
  },
  statusIndicatorText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  futureBookingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: 100,
    flexShrink: 1,
  },
  futureBookingChipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D4ED8',
  },
  shareBookingBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: 100,
  },
  shareBookingTextMini: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#2563EB',
  },
  quickBillCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  quickBillLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  quickBillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  quickBillCurrency: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  quickBillInputField: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    padding: 0,
  },
  quickBillChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickBillChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  quickBillChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  quickBillChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  quickBillChipTextActive: {
    color: '#FFFFFF',
  },
  figmaServiceMoreBtn: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
  },
  itemActionSheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    gap: 12,
  },
  itemActionHeader: {
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  itemActionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
  },
  itemActionSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  itemActionStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemActionStepperLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  itemActionDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
  },
  itemActionDeleteText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#EF4444',
  },
  itemActionCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  itemActionCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
});
