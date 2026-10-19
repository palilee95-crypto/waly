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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import FullPosCheckout from './FullPosCheckout';
import { normalizeManualPosPhone } from '@/lib/manualPosPhone';
import { getRecommendedVisuals } from '@/lib/rewardVisuals';

const getCleanCustomerName = (rawName?: string): string => {
  if (!rawName) return 'Customer';
  return rawName.replace(/\s*\[VOUCHER:[^\]]+\]\s*/g, '').trim() || 'Customer';
};

const getInitials = (name: string) => {
  const clean = getCleanCustomerName(name);
  if (!clean) return '??';
  const parts = clean.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
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
  const { locale } = useLanguage();
  const merchantId = user?.merchant_id;

  const [claim, setClaim] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billAmount, setBillAmount] = useState('10');
  const [stampAmount, setStampAmount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [bannerNow, setBannerNow] = useState(Date.now());
  useEffect(() => {
    if (!claim || isVisible || isSuccess || claim.status !== 'pending') return;
    setBannerNow(Date.now());
    const timer = setInterval(() => setBannerNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [claim?.id, claim?.status, isVisible, isSuccess]);

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
      const qRes = await pb.collection('merchant_services').getFullList({
        filter: `merchant = "${merchantId}" && is_active = true`,
        sort: '-item_type,price',
        requestKey: null,
      });
      setQuickAddons(qRes || []);
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
  const [fullPosOpen, setFullPosOpen] = useState(false);
  const [paymentFromPos, setPaymentFromPos] = useState(false);
  const openFullPos = () => {
    if (selectedServices.length === 0 && Number(customBillInput) > 0) {
      setSelectedServices([{ id: 'quick_custom_amount', name: locale === 'ms' ? 'Jumlah manual' : 'Custom amount', price: Number(customBillInput), qty: 1, item_type: 'custom' }]);
    }
    setCustomBillInput('0');
    setFullPosOpen(true);
  };
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
    setStampAmount(prev => prev || '1');
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
        const rawPhone = (claim.customer_phone || '').trim();
        const digits = rawPhone.replace(/\D/g, '');
        const withPlus = rawPhone.startsWith('+') ? rawPhone : (digits ? '+' + digits : '');

        if (!custId && rawPhone) {
          const phoneQueries = [
            `phone = "${rawPhone}"`,
            digits ? `phone = "${digits}"` : '',
            withPlus ? `phone = "${withPlus}"` : '',
          ].filter(Boolean);

          for (const q of phoneQueries) {
            try {
              const uRes = await pb.collection('users').getList(1, 1, { filter: q });
              if (uRes.items.length > 0) {
                custId = uRes.items[0].id;
                break;
              }
            } catch (uErr) {}
          }
        }

        let loadedVouchers: any[] = [];
        if (custId) {
          const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
          const merchantFilter = merchantId
            ? ` && (reward.merchant = "${merchantId}" || campaign.merchant = "${merchantId}")`
            : '';
          try {
            // Active, unexpired, and issued by THIS merchant.
            const vRes = await pb.collection('vouchers').getList(1, 50, {
              filter: `customer = "${custId}" && status = "active" && (expires_at = "" || expires_at > "${nowIso}")${merchantFilter}`,
              expand: 'reward,reward.merchant,campaign,campaign.merchant',
              sort: 'expires_at',
            });
            loadedVouchers = vRes.items;
            setCustomerVouchers(vRes.items);
          } catch (vErr) {
            // Older backend / restrictive rules: fall back to the legacy query.
            const vRes = await pb.collection('vouchers').getList(1, 20, {
              filter: `customer = "${custId}" && status = "active"`,
              expand: 'reward',
            });
            loadedVouchers = vRes.items;
            setCustomerVouchers(vRes.items);
          }
        } else {
          setCustomerVouchers([]);
        }

        // Auto-select voucher if customer requested one via NFC claim
        let targetVoucherId = (claim?.voucher || claim?.voucher_id || '').trim();
        let voucherTitleHint = (claim?.voucher_title || claim?.voucher_name || '').trim();
        const rawName = claim?.customer_name || '';
        const vMatch = rawName.match(/\[VOUCHER:([^#\]]+)(?:#([^\]]*))?\]/);
        if (vMatch) {
          if (!targetVoucherId) targetVoucherId = vMatch[1].trim();
          if (!voucherTitleHint && vMatch[2]) voucherTitleHint = vMatch[2].trim();
        }

        if (targetVoucherId || voucherTitleHint) {
          let matched = null;
          if (loadedVouchers.length > 0) {
            matched = loadedVouchers.find((v: any) =>
              (targetVoucherId && (v.id === targetVoucherId || v.code === targetVoucherId)) ||
              (voucherTitleHint && (v.title === voucherTitleHint || v.expand?.reward?.name === voucherTitleHint))
            );
          }

          // The claim's voucher may be used/expired, so it isn't in the active
          // list. Fetch it by id so the cashier sees its real title/metadata.
          if (!matched && targetVoucherId) {
            try {
              matched = await pb.collection('vouchers').getOne(targetVoucherId, { expand: 'reward' });
            } catch (oneErr) {}
          }

          if (matched) {
            setAppliedVoucher(matched);
          } else {
            // Synthetic fallback so the cashier at least sees the customer's choice.
            setAppliedVoucher({
              id: targetVoucherId || 'v_selected',
              title: voucherTitleHint || 'Selected Customer Voucher',
              code: '',
              status: 'active',
              metadata: { snapshot_title: voucherTitleHint || 'Selected Customer Voucher', discount_type: 'none' },
              _synthetic: true,
            });
          }
        }
      } catch (e) {
        setCustomerVouchers([]);
      }
    })();
  }, [claim?.id, claim?.customer_phone, claim?.customer_name, claim?.voucher, claim?.voucher_id, merchantId]);

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
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (e) {}
      }
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
        if (targetClaim.manual_pos) {
          setFullPosOpen(true);
          setCheckoutStep('review');
          setCustomBillInput('0');
          setSelectedServices([]);
          setAppliedVoucher(null);
        }
        setIsVouchersExpanded(false);
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

  // Why a voucher cannot be applied right now (empty string = usable).
  const getVoucherIssue = (v: any): string => {
    if (!v) return '';
    if (v._synthetic) return locale === 'ms' ? 'Baucar tidak dijumpai' : 'Voucher not found';
    if (v.status && v.status !== 'active') {
      if (v.status === 'used') return locale === 'ms' ? 'Sudah ditebus' : 'Already used';
      if (v.status === 'expired') return locale === 'ms' ? 'Tamat tempoh' : 'Expired';
      return locale === 'ms' ? 'Tidak sah' : 'Not valid';
    }
    const expMs = v.expires_at ? new Date(String(v.expires_at).replace(' ', 'T')).getTime() : NaN;
    if (Number.isFinite(expMs) && expMs <= Date.now()) {
      return locale === 'ms' ? 'Tamat tempoh' : 'Expired';
    }
    const voucherMerchant = v.expand?.reward?.merchant || v.expand?.campaign?.merchant || '';
    if (voucherMerchant && merchantId && voucherMerchant !== merchantId) {
      return locale === 'ms' ? 'Bukan untuk kedai ini' : 'Not valid for this store';
    }
    return '';
  };

  const handleConfirm = async () => {
    if (!claim) return;
    if (claim.manual_pos && !normalizeManualPosPhone(claim.customer_phone || '')) {
      setErrorMsg(locale === 'ms' ? 'Nombor telefon pelanggan diperlukan untuk pembayaran.' : 'A valid customer phone number is required for payment.');
      return;
    }
    const bill = netTotalAmount;
    const stamps = parseInt(stampAmount) || 1;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Voucher validation + consumption is handled atomically by /nfc/complete.
      // (The old flow burned it here and again in the endpoint, and swallowed
      // every rejection.)

      // 2. Complete NFC transaction
      const completeRes = await pb.send<{
        success: boolean;
        voucher_error?: string;
        voucher_code?: string;
      }>('/api/risev/nfc/complete', {
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

      if (appliedVoucher) {
        if (completeRes?.voucher_error) {
          console.warn('[VOUCHER] Not applied:', completeRes.voucher_error);
        } else {
          // The server consumed it; drop it from the local list.
          setCustomerVouchers(prev => prev.filter(v => v.id !== appliedVoucher.id));
        }
      }

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
          line_items: selectedServices.length > 0 ? selectedServices : [{ name: locale === 'en' ? 'Service Payment' : 'Pembayaran Servis', price: subtotalAmount || bill }]
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
    setFullPosOpen(false);
    setIsSuccess(false);
    setErrorMsg(null);
    setBillAmount('20');
    setCustomBillInput('20');
    setAppliedVoucher(null);
    setStampAmount('1');
    setSelectedServices([]);
    setCheckoutStep('review');
    setIsVouchersExpanded(false);
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
      const claimId = claim.id;
      // 1. Optimistically emit to remove from dashboard lists immediately (0ms latency)
      DeviceEventEmitter.emit('nfc_claim_declined', { claim_id: claimId });
      DeviceEventEmitter.emit('merchant_transaction_completed');
      try {
        await pb.collection('nfc_claims').update(claimId, { status: 'cancelled' });
      } catch (err) {
        console.warn('[NFC CLAIM] Failed to cancel claim:', err);
      } finally {
        // 2. Re-trigger sync after backend update completes
        DeviceEventEmitter.emit('merchant_transaction_completed');
      }
    }
    handleClose();
  };

  if (!claim || (!isSuccess && claim.status !== 'pending')) return null;

  const bannerMinutes = Math.max(0, Math.floor((bannerNow - new Date(claim.created).getTime()) / 60000));
  const bannerTime = !Number.isFinite(bannerMinutes) ? ''
    : bannerMinutes < 1 ? (locale === 'ms' ? 'Baru sahaja' : 'Just now')
    : bannerMinutes < 60 ? `${bannerMinutes}${locale === 'ms' ? ' min lalu' : 'm ago'}`
    : bannerMinutes < 1440 ? `${Math.floor(bannerMinutes / 60)}${locale === 'ms' ? ' jam lalu' : 'h ago'}`
    : `${Math.floor(bannerMinutes / 1440)}${locale === 'ms' ? ' hari lalu' : 'd ago'}`;
  const bannerBill = Number.parseFloat(billAmount);
  const bannerStamps = Number.parseInt(stampAmount, 10);
  const bannerSummary = [
    Number.isFinite(bannerBill) ? `RM${bannerBill.toFixed(2)}` : 'RM—',
    Number.isFinite(bannerStamps) ? `${bannerStamps} ${locale === 'ms' ? 'cop' : bannerStamps === 1 ? 'stamp' : 'stamps'}` : '',
    bannerTime,
  ].filter(Boolean).join(' · ');


  return (
    <>
      {/* Floating Minimized Pending Capsule (visible when minimized so cashier can re-open anytime) */}
      {!isVisible && !isSuccess && claim.status === 'pending' && (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingCapsule}
            accessibilityRole="button"
            accessibilityLabel={`${locale === 'ms' ? 'Semak permintaan' : 'Review request from'} ${getCleanCustomerName(claim.customer_name)}. ${bannerSummary}`}
            onPress={() => setIsVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.floatingPulseRing}>
              <Ionicons name="radio-outline" size={20} color="#0F172A" />
            </View>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.floatingTitle} numberOfLines={1}>
                {getCleanCustomerName(claim.customer_name)}
              </Text>
              <Text style={styles.floatingSubtitle} numberOfLines={2}>
                {bannerSummary}
              </Text>
            </View>
            <View style={styles.floatingActionBadge}>
              <Text style={styles.floatingActionText}>{locale === 'ms' ? 'Semak' : 'Review'}</Text>
              <Ionicons name="arrow-forward" size={14} color="#000000" />
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <View style={[styles.overlay, fullPosOpen && { padding: 0 }] }>
        <View style={[styles.modalCard, isProPlan && checkoutStep === 'review' && !isCatalogPickerOpen && !isSuccess && { maxHeight: '96%', paddingTop: 12, paddingBottom: 12 }, fullPosOpen && { flex: 1, maxWidth: '100%', maxHeight: '100%', borderRadius: 0, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 }] }>
          {isSuccess ? (
            // ── In-Modal Success Confirmation Screen ──────────────
            <View style={styles.successWrap}>
              <View style={styles.successIconBg}>
                <Ionicons name="checkmark-circle" size={42} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Stamps Issued Successfully!</Text>
              <Text style={styles.successSubtitle}>
                {stampAmount} stamp(s) credited to <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400' }}>{getCleanCustomerName(claim.customer_name)}</Text>
              </Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{getCleanCustomerName(claim.customer_name)}</Text>
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
          ) : (isProPlan || claim.manual_pos) ? (
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

              if (fullPosOpen) {
                return <FullPosCheckout
                  name={getCleanCustomerName(claim.customer_name)} phone={claim.customer_phone} locale={locale}
                  catalog={quickAddons} items={selectedServices} setItems={setSelectedServices}
                  imageFor={item => getItemImageUrl(item, quickAddons)} onAdd={handleAddItem}
                  onBack={() => setFullPosOpen(false)} onPay={() => { if (claim.manual_pos && !normalizeManualPosPhone(claim.customer_phone || '')) { Alert.alert(locale === 'ms' ? 'Nombor telefon diperlukan' : 'Customer phone required'); return; } setPaymentFromPos(true); setFullPosOpen(false); setCheckoutStep('payment'); }}
                  total={netTotalAmount} subtotal={subtotalAmount} discount={discountAmount}
                  vouchers={customerVouchers} voucher={appliedVoucher} onVoucher={setAppliedVoucher}
                  stamps={stampAmount} onStamps={setStampAmount} points={Math.floor(netTotalAmount / spendPerPoint)}
                />;
              }
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
                          {getCleanCustomerName(claim.customer_name)} · {claim.customer_phone}
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
                      {selectedServices.length > 0 && <View style={{ gap: 8 }}>
                        <Text style={styles.compactLabel}>{locale === 'ms' ? 'Item dipilih' : 'Selected items'}</Text>
                        {selectedServices.map((item, index) => <TouchableOpacity key={`${item.id}-${index}`} style={styles.compactOrderSummary} onPress={() => setItemActionTarget({ item, index })}><View style={{ flex: 1 }}><Text style={styles.compactLabel}>{item.name}</Text><Text style={styles.compactMuted}>{item.qty || 1} × RM{Number(item.price).toFixed(2)}</Text></View><Ionicons name="ellipsis-horizontal" size={20} color="#0F172A" /></TouchableOpacity>)}
                      </View>}
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
                        onPress={() => { setCheckoutStep('review'); if (paymentFromPos) setFullPosOpen(true); }}
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
                          <Text style={styles.payAvatarText}>{getInitials(claim.customer_name) || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payCustomerName}>{getCleanCustomerName(claim.customer_name) || 'Customer'}</Text>
                          <Text style={styles.payCustomerSub}>
                            {claim.customer_phone || '+60 00 000 0000'} · {claim.session_code || '—'}
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

              if (isVouchersExpanded) {
                return (
                  <View style={{ flexShrink: 1 }}>
                    <View style={styles.compactHeader}>
                      <Text style={styles.compactTitle}>{locale === 'ms' ? 'Pilih baucar' : 'Choose voucher'}</Text>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to checkout" style={styles.compactIconButton} onPress={() => setIsVouchersExpanded(false)}><Ionicons name="close" size={22} color="#0F172A" /></TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {customerVouchers.length === 0 && <Text style={styles.compactMuted}>{locale === 'ms' ? 'Tiada baucar tersedia.' : 'No vouchers available.'}</Text>}
                      {customerVouchers.map(v => {
                        let meta: any = {};
                        try { meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata || {}); } catch {}
                        const selected = appliedVoucher?.id === v.id;
                        const issue = getVoucherIssue(v);
                        return <TouchableOpacity key={v.id} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.compactVoucherOption, selected && { borderColor: '#FFCC00', backgroundColor: '#FFFBEA' }, issue && { opacity: 0.6 }]} onPress={() => { if (issue) { Alert.alert(locale === 'ms' ? 'Baucar tidak sah' : 'Voucher unavailable', issue); return; } setAppliedVoucher(selected ? null : v); setIsVouchersExpanded(false); }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.compactLabel}>{meta.snapshot_title || v.expand?.reward?.name || v.code}</Text>
                            <Text style={styles.compactMuted}>{v.code}</Text>
                            {(meta.applicable_items_text || v.expand?.reward?.applicable_items_text) && <Text style={styles.compactMuted}>{meta.applicable_items_text || v.expand?.reward?.applicable_items_text}</Text>}
                            <Text style={styles.compactMuted}>{meta.discount_type === 'percentage' ? `${meta.discount_value}% OFF` : meta.discount_type === 'fixed_amount' ? `RM${meta.discount_value} OFF` : (locale === 'ms' ? 'Item percuma' : 'Free item')}</Text>
                            {issue ? <Text style={[styles.compactMuted, { color: '#DC2626' }]}>{issue}</Text> : null}
                          </View>
                          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color="#0F172A" />
                        </TouchableOpacity>;
                      })}
                    </ScrollView>
                  </View>
                );
              }
              return (
                <>
                  <View style={styles.compactHeader}>
                    <Text style={styles.compactTitle}>{activeBooking ? (locale === 'ms' ? 'Selesaikan tempahan' : 'Complete Booking') : (locale === 'ms' ? 'Checkout Pantas' : 'Quick Checkout')}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open full POS" onPress={openFullPos} style={{ minHeight: 44, paddingHorizontal: 10, backgroundColor: '#F1F5F9', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.compactLink}>Full POS</Text><Ionicons name="expand-outline" size={14} color="#0F172A" /></TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Minimize checkout" style={styles.compactIconButton} onPress={handleMinimize}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
                  </View>
                  {errorMsg && <View style={styles.errorBanner}><Text style={styles.errorText}>{errorMsg}</Text></View>}
                  <ScrollView style={{ flexShrink: 1, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={styles.compactCustomer}>
                      <View style={styles.compactAvatar}><Text style={styles.compactLabel}>{getInitials(claim.customer_name)}</Text></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.compactCustomerName} numberOfLines={1}>{getCleanCustomerName(claim.customer_name)}</Text>
                        <Text style={styles.compactMuted} numberOfLines={1}>{[claim.customer_phone, claim.session_code].filter(Boolean).join(' · ')}</Text>
                      </View>
                      {activeBooking ? <TouchableOpacity accessibilityRole="button" onPress={handleToggleBookingStatus} style={styles.compactStatus}><Text style={styles.compactMuted}>{activeBooking.status === 'in_service' || activeBooking.status === 'arrived' ? 'In-service' : 'Booked'}</Text></TouchableOpacity> : <View style={styles.compactStatus}><Text style={styles.compactMuted}>Walk-in</Text></View>}
                    </View>
                    <View>
                      <View style={styles.compactLine}>
                        <Text style={styles.compactLabel}>{locale === 'ms' ? 'Jumlah bil' : 'Bill amount'}</Text>
                        <TouchableOpacity style={styles.compactTextButton} accessibilityRole="button" onPress={() => setIsCatalogPickerOpen(true)}><Text style={styles.compactLink}>{selectedServices.length ? (locale === 'ms' ? 'Edit item' : 'Edit items') : (locale === 'ms' ? 'Tambah item' : 'Add items')} ›</Text></TouchableOpacity>
                      </View>
                      {selectedServices.length === 0 ? <>
                        <View style={styles.compactAmountInput}>
                          <Text style={styles.compactCurrency}>RM</Text>
                          <TextInput accessibilityLabel={locale === 'ms' ? 'Jumlah bil' : 'Bill amount'} style={styles.compactAmountText} value={customBillInput} onChangeText={text => setCustomBillInput(text.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94A3B8" />
                        </View>
                        <View style={styles.compactPresets}>{['10', '20', '30', '50'].map(amount => <TouchableOpacity key={amount} accessibilityRole="button" accessibilityState={{ selected: customBillInput === amount }} style={[styles.compactPreset, customBillInput === amount && { backgroundColor: '#0F172A', borderColor: '#0F172A' }]} onPress={() => setCustomBillInput(amount)}><Text style={[styles.compactLabel, customBillInput === amount && { color: '#FFFFFF' }]}>RM{amount}</Text></TouchableOpacity>)}</View>
                      </> : <TouchableOpacity accessibilityRole="button" style={styles.compactOrderSummary} onPress={() => setIsCatalogPickerOpen(true)}>
                        <View style={{ flex: 1 }}><Text style={styles.compactLabel}>{selectedServices.reduce((sum, item) => sum + (item.qty || 1), 0)} {locale === 'ms' ? 'item' : 'items'}</Text><Text style={styles.compactMuted} numberOfLines={1}>{selectedServices.map(item => item.name).join(', ')}</Text></View>
                        <Text style={styles.compactCurrency}>RM{subtotalAmount.toFixed(2)}</Text>
                      </TouchableOpacity>}
                    </View>
                    <View style={styles.compactVoucherLine}>
                      <TouchableOpacity accessibilityRole="button" style={[styles.compactLine, { flex: 1, gap: 8, minHeight: 48 }]} onPress={() => setIsVouchersExpanded(true)}>
                        <Text style={styles.compactLabel}>Voucher</Text>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={styles.compactMuted} numberOfLines={1}>{appliedVoucher ? (appliedVoucher.expand?.reward?.name || appliedVoucher.title || appliedVoucher.code) : `${customerVouchers.length} ${locale === 'ms' ? 'tersedia' : 'available'}`}</Text>
                          {appliedVoucher && (getVoucherIssue(appliedVoucher)
                            ? <Text style={[styles.compactLink, { color: '#DC2626' }]}>{getVoucherIssue(appliedVoucher)}</Text>
                            : <Text style={styles.compactLink}>{discountAmount > 0 ? `−RM${discountAmount.toFixed(2)}` : (locale === 'ms' ? 'Item percuma' : 'Free item')}</Text>)}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#64748B" />
                      </TouchableOpacity>
                      {appliedVoucher && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove voucher" style={styles.compactIconButton} onPress={() => setAppliedVoucher(null)}><Ionicons name="close-circle-outline" size={20} color="#64748B" /></TouchableOpacity>}
                    </View>
                    <View style={styles.compactLine}>
                      <Text style={styles.compactLabel}>{locale === 'ms' ? 'Cop diberikan' : 'Stamps to give'}</Text>
                      <View style={styles.compactStepper}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease stamps" style={styles.compactIconButton} onPress={() => setStampAmount(String(Math.max(1, (parseInt(stampAmount, 10) || 1) - 1)))}><Ionicons name="remove" size={18} color="#0F172A" /></TouchableOpacity>
                        <TextInput accessibilityLabel="Stamps to give" value={stampAmount} onChangeText={text => setStampAmount(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} style={styles.compactStampInput} />
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase stamps" style={styles.compactIconButton} onPress={() => setStampAmount(String(Math.min(99, (parseInt(stampAmount, 10) || 1) + 1)))}><Ionicons name="add" size={18} color="#0F172A" /></TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.compactLine}><Text style={styles.compactMuted}>{locale === 'ms' ? 'Mata diperoleh' : 'Points earned'}</Text><Text style={styles.compactLabel}>+{Math.floor(netTotalAmount / spendPerPoint).toLocaleString()}</Text></View>
                  </ScrollView>
                  <View style={styles.compactFooter}>
                    <View style={styles.compactLine}><Text style={styles.compactLabel}>{locale === 'ms' ? 'Jumlah' : 'Total'}</Text><Text style={styles.compactTotal}>RM{netTotalAmount.toFixed(2)}</Text></View>
                    <TouchableOpacity accessibilityRole="button" style={styles.compactPayButton} onPress={() => { setPaymentFromPos(false); setCheckoutStep('payment'); }} disabled={isLoading} activeOpacity={0.8}><Text style={styles.compactPayText}>{locale === 'ms' ? 'Teruskan pembayaran' : 'Continue to payment'} →</Text></TouchableOpacity>
                    <View style={styles.compactLine}>
                      <TouchableOpacity style={styles.compactTextButton} onPress={handleMinimize} disabled={isLoading}><Text style={styles.compactMuted}>{locale === 'ms' ? 'Simpan dahulu' : 'Save for later'}</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.compactTextButton} onPress={handleDecline} disabled={isLoading}><Text style={[styles.compactMuted, { color: '#DC2626' }]}>{locale === 'ms' ? 'Tolak' : 'Decline'}</Text></TouchableOpacity>
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
                        <Text style={styles.customerName}>{getCleanCustomerName(claim.customer_name)}</Text>
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

        {/* ── Item Actions Bottom Sheet Overlay (Rendered directly on top inside Main Modal) ── */}
        {!!itemActionTarget && (
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
        )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
    )}
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
  stampIssueCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  stampIssueLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  stampStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
    flexShrink: 0,
  },
  stampStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stampStepperInput: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    width: 32,
    maxWidth: 36,
    height: 26,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
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
  compactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  compactTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', flexShrink: 1 },
  compactIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  compactCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  compactAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  compactCustomerName: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  compactLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' },
  compactMuted: { fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' },
  compactStatus: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F5F6F8', borderRadius: 8 },
  compactLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compactTextButton: { minHeight: 44, justifyContent: 'center' },
  compactLink: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  compactAmountInput: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14 },
  compactCurrency: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  compactAmountText: { flex: 1, fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', height: '100%' },
  compactPresets: { flexDirection: 'row', gap: 8, marginTop: 8 },
  compactPreset: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  compactOrderSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },
  compactVoucherLine: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  compactStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6F8', borderRadius: 10 },
  compactStampInput: { width: 32, fontSize: 16, textAlign: 'center', fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  compactFooter: { paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: '#EEF0F3', gap: 4 },
  compactTotal: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
  compactPayButton: { minHeight: 50, backgroundColor: '#FFCC00', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  compactPayText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  compactVoucherOption: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E8ECF1',
  },
  floatingPulseRing: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F5F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  floatingSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
  },
  floatingActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFCC00',
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 999,
    flexShrink: 0,
  },
  floatingActionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
    elevation: 99999,
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
  chosenVoucherCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE047',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  chosenVoucherHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chosenVoucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  chosenVoucherBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  chosenVoucherRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chosenVoucherRemoveText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
  },
  chosenVoucherContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chosenVoucherIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chosenVoucherTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  chosenVoucherCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  chosenVoucherCodeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  chosenVoucherDiscountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  chosenVoucherDiscountText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  chosenVoucherActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  chosenVoucherActiveText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#059669',
  },
  navRowCardWithVoucher: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FDE68A',
  },
  customerVoucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  customerVoucherBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
});
