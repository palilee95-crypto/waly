import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
  Image,
  ImageBackground,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';

const stampIcons = [
  { id: 'ticket', family: 'Ionicons', name: 'ticket-sharp' },
  { id: 'star', family: 'FontAwesome', name: 'star' },
  { id: 'heart', family: 'Ionicons', name: 'heart' },
  { id: 'coffee', family: 'MaterialIcons', name: 'local-cafe' },
  { id: 'cake', family: 'MaterialIcons', name: 'cake' },
  { id: 'restaurant', family: 'Ionicons', name: 'restaurant' },
  { id: 'tag', family: 'Ionicons', name: 'pricetag' },
  { id: 'gift', family: 'Ionicons', name: 'gift' },
  { id: 'beer', family: 'Ionicons', name: 'beer' },
  { id: 'pizza', family: 'Ionicons', name: 'pizza' },
  { id: 'card', family: 'Ionicons', name: 'card' },
  { id: 'store', family: 'Ionicons', name: 'storefront' },
  { id: 'car', family: 'Ionicons', name: 'car-sport' },
  { id: 'icecream', family: 'Ionicons', name: 'ice-cream' },
  { id: 'barbell', family: 'Ionicons', name: 'barbell' },
  { id: 'scissors', family: 'Ionicons', name: 'scissors' },
  { id: 'bag', family: 'Ionicons', name: 'bag-handle' },
  { id: 'sparkles', family: 'Ionicons', name: 'sparkles' },
];

const renderStampIcon = (iconId: string, size: number, color: string) => {
  const icon = stampIcons.find(i => i.id === iconId) || stampIcons.find(i => i.id === 'coffee')!;
  if (icon.family === 'Ionicons') {
    return <Ionicons name={icon.name as any} size={size} color={color} />;
  }
  if (icon.family === 'FontAwesome') {
    return <FontAwesome name={icon.name as any} size={size} color={color} />;
  }
  if (icon.family === 'MaterialIcons') {
    return <MaterialIcons name={icon.name as any} size={size} color={color} />;
  }
  return <Ionicons name="cafe" size={size} color={color} />;
};

// ─── Animated Stamp Bubble ──────────────────────────────────────────────────
// Plays a "physical ink press" animation when a new stamp is freshly earned.
interface AnimatedStampBubbleProps {
  isEarned: boolean;
  isNew: boolean;           // true = just received this session
  delay: number;            // stagger delay in ms
  iconId: string;
  bubbleColor: string;      // filled bg color
  iconColor: string;        // icon tint
  borderColor: string;
  emptyBgColor: string;
}

const AnimatedStampBubble: React.FC<AnimatedStampBubbleProps> = ({
  isEarned,
  isNew,
  delay,
  iconId,
  bubbleColor,
  iconColor,
  borderColor,
  emptyBgColor,
}) => {
  const scaleAnim = useRef(new Animated.Value(isNew ? 2.5 : 1.0)).current;
  const ringScale = useRef(new Animated.Value(1.0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isNew && !hasAnimated.current) {
      hasAnimated.current = true;
      const timeout = setTimeout(() => {
        // 1. Slow spring slam: scale 2.5x → 1x
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 12,
          tension: 40,
          useNativeDriver: true,
        }).start();

        // 2. Ring burst: expand ring and fade
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 2.0, duration: 900, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ]).start();
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [isNew]);

  return (
    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ring burst overlay */}
      {isNew && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: '80%',
            aspectRatio: 1,
            borderRadius: 99,
            borderWidth: 2.5,
            borderColor: bubbleColor,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
      )}

      {/* Stamp bubble */}
      <Animated.View
        style={{
          width: '80%',
          aspectRatio: 1,
          borderRadius: 99,
          borderWidth: isEarned ? 0 : 1.5,
          borderColor: isEarned ? 'transparent' : borderColor,
          borderStyle: isEarned ? 'solid' : 'dashed',
          backgroundColor: isEarned ? bubbleColor : emptyBgColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: scaleAnim }],
        }}
      >
        {isEarned
          ? renderStampIcon(iconId, 14, iconColor)
          : renderStampIcon(iconId, 14, borderColor)}
      </Animated.View>
    </View>
  );
};

export default function NfcLandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ m?: string; merchant?: string; c?: string; s?: string; code?: string; tag?: string }>();
  const { user, logout, refreshSession } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth > 768;

  // Contrast calculations for text color overlay on dynamic brand primary colors
  const getContrastColor = (hex: string) => {
    if (!hex) return '#FFFFFF';
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 170 ? '#1A1400' : '#FFFFFF';
    }
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 170 ? '#1A1400' : '#FFFFFF';
    }
    return '#FFFFFF';
  };

  const [merchant, setMerchant] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);
  const [reward, setReward] = useState<any>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<any>(null);
  const [approvedStamps, setApprovedStamps] = useState<number | null>(null);
  const [step, setStep] = useState<'loading' | 'form' | 'sent' | 'card' | 'pairing' | 'invalid'>('loading');
  const [invalidReason, setInvalidReason] = useState('');

  // Unclaimed stand pairing state
  const [unclaimedStand, setUnclaimedStand] = useState<{ code: string; plan?: string; quota?: number } | null>(null);
  const [isPairing, setIsPairing] = useState(false);

  const [phoneInput, setPhoneInput] = useState(user?.phone ? user.phone.replace('+60', '').replace('+', '') : '');
  const [nameInput, setNameInput] = useState(user?.name || '');

  const [showNameField, setShowNameField] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const pulseAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (step === 'pairing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [step]);

  // Realtime listening & WhatsApp state
  const [isWaitingConfirm, setIsWaitingConfirm] = useState(false);
  const [claimId, setClaimId] = useState<string>('');
  const [hasSentWhatsapp, setHasSentWhatsapp] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [showBack, setShowBack] = useState<boolean>(false);
  // Tracks which stamp slot indices are "newly earned" this session for animation
  const [newlyEarnedIndices, setNewlyEarnedIndices] = useState<Set<number>>(new Set());
  const prevStampsRef = useRef<number>(-1); // -1 = not yet initialised

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isApproved) {
      setShowBack(true);
    }
  }, [isApproved]);

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: showBack ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showBack]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const handleViewStampCard = () => {
    // Always redirect to login page with phone pre-filled
    // Registered users will see password step; new users will see register step
    const rawPhone = phoneInput || user?.phone || '';
    // Strip country code prefix — login page prepends +60 itself
    const strippedPhone = rawPhone.startsWith('+60')
      ? rawPhone.slice(3)
      : rawPhone.startsWith('60')
      ? rawPhone.slice(2)
      : rawPhone;
    // Also pass the name they typed on the NFC page (if any)
    const prefillName = nameInput.trim() || '';
    router.push({
      pathname: '/(auth)/login' as any,
      params: { prefill_phone: strippedPhone, prefill_name: prefillName },
    });
  };

  const handleSendWhatsapp = async () => {
    if (claimId) {
      try {
        await pb.send('/api/risev/nfc/whatsapp-sent', {
          method: 'POST',
          body: { claim_id: claimId },
        });
      } catch (err) {
        console.warn('[NFC] whatsapp-sent endpoint error:', err);
      }
    }
    setHasSentWhatsapp(true);
    if (waUrl) {
      if (Platform.OS === 'web') {
        window.location.href = waUrl;
      } else {
        await Linking.openURL(waUrl);
      }
    }
  };

  // Helper to load Merchant, Loyalty Program & Rewards
  const loadMerchantAndPrograms = async (merchantId: string, isMounted: boolean) => {
    try {
      const m = await pb.collection('merchants').getOne(merchantId, { expand: 'owner' });
      if (!m || m.status === 'suspended' || m.status === 'rejected') {
        if (isMounted) {
          setInvalidReason('This store is currently not accepting stamps.');
          setStep('invalid');
        }
        return;
      }
      if (isMounted) setMerchant(m);

      // Fetch primary loyalty program for this merchant (with linked_reward expansion)
      try {
        const progs = await pb.collection('loyalty_programs').getFullList({
          filter: `merchant = "${merchantId}" && is_active = true`,
          sort: '-created',
          expand: 'linked_reward',
        });
        if (progs.length > 0 && isMounted) {
          setProgram(progs[0]);
          // Fetch rewards for this program
          try {
            const rws = await pb.collection('rewards').getFullList({
              filter: `merchant = "${merchantId}"`,
              sort: '-created',
            });
            if (rws.length > 0 && isMounted) setReward(rws[0]);
          } catch (rErr) {}
        }
      } catch (pErr) {}

      if (isMounted) {
        setStep((prev) => (prev === 'loading' || prev === 'pairing' ? 'form' : prev));
      }
    } catch (err) {
      if (isMounted) {
        setInvalidReason('Invalid or expired NFC merchant link.');
        setStep('invalid');
      }
    }
  };

  // 1. Fetch & Resolve Stand / Merchant on Mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const getSearchParam = (key: string): string => {
        if (params && (params as any)[key]) return String((params as any)[key]).trim();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            const sp = new URLSearchParams(window.location.search);
            const val = sp.get(key);
            if (val) return val.trim();
          } catch (e) {}
        }
        return '';
      };

      const rawCode = (getSearchParam('c') || getSearchParam('s') || getSearchParam('code') || getSearchParam('tag')).toUpperCase();
      const rawMerchantId = getSearchParam('m') || getSearchParam('merchant');

      if (!rawCode && !rawMerchantId) {
        if (isMounted) {
          setInvalidReason('No NFC Stand code or merchant ID provided.');
          setStep('invalid');
        }
        return;
      }

      try {
        const resolveRes = await pb.send<{
          success: boolean;
          is_paired: boolean;
          merchant_id?: string;
          code?: string;
          quota?: number;
          plan?: string;
        }>(`/api/risev/nfc/resolve?c=${encodeURIComponent(rawCode)}&m=${encodeURIComponent(rawMerchantId)}`, {
          method: 'GET',
        });

        if (resolveRes.success) {
          if (resolveRes.is_paired && resolveRes.merchant_id) {
            // Paired Stand: load merchant details
            await loadMerchantAndPrograms(resolveRes.merchant_id, isMounted);
          } else {
            // Unpaired Stand (Fresh Out-of-Box: Merchant Pairing Mode)
            if (isMounted) {
              setUnclaimedStand({
                code: resolveRes.code || rawCode,
                quota: resolveRes.quota || 500,
                plan: resolveRes.plan || 'stand_bundle',
              });
              setStep('pairing');
            }
          }
        } else {
          if (isMounted) {
            setInvalidReason('NFC Stand code was not recognized.');
            setStep('invalid');
          }
        }
      } catch (resErr) {
        // Fallback: direct merchant lookup
        if (rawMerchantId) {
          await loadMerchantAndPrograms(rawMerchantId, isMounted);
        } else {
          if (isMounted) {
            setInvalidReason('Invalid or unrecognized NFC Stand link.');
            setStep('invalid');
          }
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params.m, params.merchant, params.c, params.s, params.code, params.tag]);

  // Merchant Pairing Execution Handler
  const handlePairStand = async () => {
    if (!unclaimedStand?.code) return;
    if (!user) {
      router.push({
        pathname: '/(auth)/login' as any,
        params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
      });
      return;
    }

    setIsPairing(true);
    try {
      const token = pb.authStore.token;
      const res = await pb.send<{ success: boolean; message: string }>('/api/risev/merchant/redeem-stand-code', {
        method: 'POST',
        body: { code: unclaimedStand.code },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.success) {
        await refreshSession();
        const updatedRec = pb.authStore.record;
        const targetMerchId = updatedRec?.merchant_id || user?.merchant_id;
        if (targetMerchId) {
          await loadMerchantAndPrograms(targetMerchId, true);
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.reload();
        }
      } else {
        alert(res.message || 'Failed to activate stand code.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to pair stand.');
    } finally {
      setIsPairing(false);
    }
  };

  // 2. Fetch User Loyalty Card when Merchant & User are available
  useEffect(() => {
    const merchantId = params.m;
    const customerId = user?.id || pb.authStore.record?.id;
    if (merchantId && customerId) {
      fetchUserLoyaltyCard(merchantId, customerId);
    }
  }, [params.m, user?.id]);

  // 3. Auto-populate phone/name input if user state updates
  useEffect(() => {
    if (user?.phone && !phoneInput) {
      setPhoneInput(user.phone.replace('+60', '').replace('+', ''));
    }
    if (user?.name && !nameInput) {
      setNameInput(user.name);
    }
  }, [user]);

  const fetchUserLoyaltyCard = async (merchantId: string, customerId: string) => {
    try {
      const cards = await pb.collection('loyalty_cards').getFullList({
        filter: `merchant = "${merchantId}" && customer = "${customerId}" && status = "active"`,
        sort: '-updated'
      });
      if (cards.length > 0) {
        setLoyaltyCard(cards[0]);
      }
    } catch (err) {}
  };

  const [waUrl, setWaUrl] = useState('');

  // 2. Realtime SSE Subscriptions for Instant Merchant Confirmation Reveal
  useEffect(() => {
    if (!merchant) return;

    let isSubscribed = true;

    // Subscribe to loyalty_cards updates for this user & merchant
    pb.collection('loyalty_cards').subscribe('*', (e) => {
      if (!isSubscribed) return;
      if (e.action === 'update' || e.action === 'create') {
        const cardRecord = e.record;
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (cardRecord.merchant === merchant.id && currentCustId && cardRecord.customer === currentCustId) {
          setLoyaltyCard(cardRecord);
          setIsApproved(true);
          setIsWaitingConfirm(false);
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    // Subscribe to transactions updates
    pb.collection('transactions').subscribe('*', (e) => {
      if (!isSubscribed) return;
      if (e.action === 'create') {
        const tx = e.record;
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (tx.merchant === merchant.id && currentCustId && tx.customer === currentCustId) {
          fetchUserLoyaltyCard(merchant.id, currentCustId);
          setIsApproved(true);
          setIsWaitingConfirm(false);
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    // Subscribe to nfc_claims updates for instant auto-reveal when WhatsApp is verified or merchant approves
    pb.collection('nfc_claims').subscribe('*', (e: any) => {
      if (!isSubscribed) return;
      const record = e.record;
      if (record && (record.id === claimId || record.merchant === merchant.id)) {
        if (record.status === 'pending') {
          setHasSentWhatsapp(true);
        }
        if (record.status === 'completed') {
          if (typeof record.total_stamps === 'number') {
            setApprovedStamps(record.total_stamps);
          } else if (typeof record.stamp_amount === 'number') {
            setApprovedStamps(prev => (prev || 0) + record.stamp_amount);
          }
          const currentCustId = user?.id || pb.authStore.record?.id;
          if (currentCustId) {
            fetchUserLoyaltyCard(merchant.id, currentCustId);
          }
          setIsApproved(true);
          setIsWaitingConfirm(false);
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    return () => {
      isSubscribed = false;
      pb.collection('loyalty_cards').unsubscribe('*').catch(() => {});
      pb.collection('transactions').unsubscribe('*').catch(() => {});
      pb.collection('nfc_claims').unsubscribe('*').catch(() => {});
    };
  }, [merchant, user, claimId]);

  // 3. Robust Polling & Tab Visibility Listener for Mobile Browsers (iOS Safari / Android Chrome)
  useEffect(() => {
    if (step !== 'sent' || !merchant) return;

    let isMounted = true;

    const checkApprovalStatus = async () => {
      try {
        // 1. Check claim status endpoint
        if (claimId) {
          try {
            const res = await pb.send<any>('/api/risev/nfc/claim-status', {
              method: 'GET',
              params: { claim_id: claimId },
              requestKey: null,
            });
            if (res && res.status === 'completed' && isMounted) {
              if (typeof res.total_stamps === 'number') {
                setApprovedStamps(res.total_stamps);
              }
              const currentCustId = user?.id || pb.authStore.record?.id;
              if (currentCustId) {
                await fetchUserLoyaltyCard(merchant.id, currentCustId);
              }
              setIsApproved(true);
              setIsWaitingConfirm(false);
              return;
            }
          } catch (cErr) {}
        }

        // 2. Check if customer's loyalty card stamps updated (stamps increased)
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (currentCustId) {
          const cards = await pb.collection('loyalty_cards').getFullList({
            filter: `merchant = "${merchant.id}" && customer = "${currentCustId}"`,
            requestKey: null,
          });
          if (cards.length > 0 && isMounted) {
            const cardRec = cards[0];
            if (loyaltyCard && cardRec.stamps_collected > loyaltyCard.stamps_collected) {
              setLoyaltyCard(cardRec);
              setIsApproved(true);
              setIsWaitingConfirm(false);
            }
          }
        }
      } catch (err) {}
    };

    // Active polling every 2 seconds while waiting for approval
    const interval = setInterval(checkApprovalStatus, 2000);

    // Immediately trigger check when returning from WhatsApp app to browser tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkApprovalStatus();
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', checkApprovalStatus);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', checkApprovalStatus);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      }
    };
  }, [step, merchant, claimId, user, loyaltyCard]);

  // Brand Tokens & Assets
  const merchantName = merchant?.name || 'Risev Merchant';
  const merchantPhone = merchant?.phone || merchant?.metadata?.phone || merchant?.expand?.owner?.phone || '';
  
  const merchantLogoUrl = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : (merchant?.onboarding_logo_url || null);

  const merchantBgUrl = merchant?.background_image
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.background_image}`
    : (merchant?.onboarding_bg_url || null);

  const primaryColor = merchant?.onboarding_primary_color || program?.card_color || '#5C3BCC';
  const contrastTextColor = getContrastColor(primaryColor);
  
  // Exact Loyalty Card Tokens configured by Merchant
  const cardBgColor = program?.card_color || merchant?.onboarding_primary_color || '#5C3BCC';
  const cardFontColor = program?.font_color || '#FFFFFF';
  const stampColor = program?.stamp_color || '#000000';
  const cardIcon = program?.card_icon || 'coffee';

  const welcomeText = merchant?.onboarding_welcome_text || `Welcome to ${merchantName}! Tap below to claim your stamps.`;
  const stampGoal = program?.stamp_goal || 10;
  const currentStamps = approvedStamps !== null ? approvedStamps : (loyaltyCard?.stamps_collected || 0);

  // Detect newly-earned stamps and store their 0-based indices for animation
  useEffect(() => {
    if (prevStampsRef.current === -1) {
      // First initialisation — set baseline without animating
      prevStampsRef.current = currentStamps;
      return;
    }
    const prev = prevStampsRef.current;
    if (currentStamps > prev) {
      const newIndices = new Set<number>();
      for (let i = prev; i < currentStamps; i++) {
        newIndices.add(i); // 0-based index of each newly earned slot
      }
      setNewlyEarnedIndices(newIndices);
    }
    prevStampsRef.current = currentStamps;
  }, [currentStamps]);

  // Real Merchant Reward Title & Image Resolution
  const linkedReward = program?.expand?.linked_reward;
  const rewardTitle =
    reward?.title ||
    reward?.name ||
    reward?.reward_name ||
    linkedReward?.title ||
    linkedReward?.name ||
    program?.reward_name ||
    program?.reward_description ||
    'Free Reward';

  let rewardImageUrl = '';
  if (reward?.image) {
    rewardImageUrl = `${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`;
  } else if (linkedReward?.image) {
    rewardImageUrl = `${pb.baseUrl}/api/files/rewards/${linkedReward.id}/${linkedReward.image}`;
  } else if (merchantLogoUrl) {
    rewardImageUrl = merchantLogoUrl;
  }

  // 3. Submit Direct NFC Claim & Setup Optional WhatsApp Redirect
  const handleNfcSubmit = async () => {
    if (!phoneInput.trim()) {
      setErrorMsg('Please enter your phone number.');
      return;
    }

    let digits = phoneInput.trim().replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const cleanPhone = '+' + digits;

    setErrorMsg('');

    if (showNameField && !nameInput.trim()) {
      setErrorMsg('Please enter your full name to complete your claim.');
      return;
    }

    setIsLoading(true);

    try {
      let finalName = nameInput.trim();

      // Always check the entered phone against DB unless:
      // 1. Name field is already showing (user already filled it in), OR
      // 2. The entered phone matches the currently logged-in user's own phone
      const enteredPhoneMatchesUser = user?.phone && (user.phone === cleanPhone || user.phone === cleanPhone.replace('+', ''));
      const shouldCheckPhone = !showNameField && !enteredPhoneMatchesUser;

      if (shouldCheckPhone) {
        setIsCheckingPhone(true);
        try {
          const res = await pb.send<{ exists: boolean; name?: string }>('/api/risev/check-phone', {
            method: 'GET',
            params: { phone: cleanPhone },
            requestKey: null,
          });

          if (res.exists && res.name) {
            finalName = res.name;
          } else if (!res.exists) {
            // New customer — ask for their name
            setShowNameField(true);
            setNameInput('');
            setIsLoading(false);
            setIsCheckingPhone(false);
            return;
          }
        } catch (checkErr) {
          console.warn('[NFC] check-phone error:', checkErr);
        } finally {
          setIsCheckingPhone(false);
        }
      } else if (enteredPhoneMatchesUser && user?.name) {
        finalName = user.name;
      }

      // Fallback name if still empty
      if (!finalName) finalName = 'Customer ' + digits.slice(-4);
      const displayName = finalName;

      // 1. Send Direct API Request to PocketBase (INSTANT & FAIL-SAFE)
      // NOTE: We do NOT auto-login or quickRegister session onto the browser to prevent security hijack.
      let claimSessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      let createdClaimId = '';
      try {
        const reqRes = await pb.send<{ success: boolean; claim_id: string; session_code: string; current_stamps?: number }>('/api/risev/nfc/request', {
          method: 'POST',
          body: {
            merchant_id: merchant.id,
            phone: cleanPhone,
            name: displayName,
          },
        });
        if (reqRes?.claim_id) {
          setClaimId(reqRes.claim_id);
          createdClaimId = reqRes.claim_id;
        }
        if (reqRes?.session_code) claimSessionCode = reqRes.session_code;
        if (typeof reqRes?.current_stamps === 'number') {
          setApprovedStamps(reqRes.current_stamps);
        }
      } catch (apiErr) {
        console.warn('[NFC] /api/risev/nfc/request error:', apiErr);
      }

      setIsWaitingConfirm(true);
      setHasSentWhatsapp(true);
      setStep('sent');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit NFC claim.');
    } finally {
      setIsLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER STATES
  // ══════════════════════════════════════════════════════════════════

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Loading store details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // UNCLAIMED STAND ACTIVATION & PAIRING STATE (BLACK IAP STYLE)
  // ══════════════════════════════════════════════════════════════════
  if (step === 'pairing' && unclaimedStand) {
    return (
      <SafeAreaView style={styles.pairingContainer} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[styles.pairingScrollContent, isDesktop && styles.desktopScrollContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Split Background that scrolls with content */}
          <View style={{ position: 'absolute', top: -500, left: 0, right: 0, height: 750, backgroundColor: '#FFC700' }} />
          
          <View style={[styles.pairingContentCard, isDesktop && styles.pairingDesktopCard]}>
            {/* 1. Row Header (Logo Left, Text Right) */}
            <View style={styles.pairingHeaderDashboard}>
              <Image
                source={require('../assets/risev logo.png')}
                style={{ height: 30, width: 90, tintColor: '#000000' }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 13, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0, flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>Smart Risev Tap Activation</Text>
            </View>

            {/* 2. Yellow Hero Card */}
            <View style={[styles.pairingYellowCard, !isDesktop && { width: windowWidth, marginHorizontal: -20, borderRadius: 30 }]}>
              <View style={styles.pairingHeroContainer}>
                <Image
                  source={require('../assets/imej nfc.png')}
                  style={styles.pairingHeroImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.pairingCodeBox}>
                <View style={styles.pairingCodeTopRow}>
                  <Text style={styles.pairingCodeLabel}>STAND ACTIVATION SERIAL</Text>
                  <View style={styles.pairingVerifiedBadge}>
                    <Animated.View style={[styles.pairingPulseDot, { opacity: pulseAnim }]} />
                    <Text style={styles.pairingVerifiedText}>OFFICIAL HARDWARE</Text>
                  </View>
                </View>
                <Text style={styles.pairingCodeValue}>{unclaimedStand.code}</Text>
                {/* Tech Watermark */}
                <Ionicons 
                  name="hardware-chip-outline" 
                  size={120} 
                  color="rgba(255, 255, 255, 0.02)" 
                  style={{ position: 'absolute', right: -20, bottom: -40, transform: [{ rotate: '-15deg' }] }}
                />
              </View>
            </View>

            {/* 3. Title Section on Light Background */}
            <View style={styles.pairingTitleSectionLight}>
              <Text style={styles.pairingTitleLight}>Activate Your Smart Stand</Text>
              <Text style={styles.pairingSubtitleLight}>
                Pair this physical NFC counter stand to your store to start collecting customer visits and loyalty stamps instantly.
              </Text>
            </View>

            {/* 4. Dark Perks List */}
            <View style={styles.pairingPerksListDark}>
              <View style={styles.pairingPerkItem}>
                <View style={styles.pairingPerkIconBoxDark}>
                  <Ionicons name="people" size={18} color="#FFC700" />
                </View>
                <View style={styles.pairingPerkContent}>
                  <Text style={styles.pairingPerkTitleDark}>500 Customer Database Capacity</Text>
                  <Text style={styles.pairingPerkDescDark}>Collect member profiles, contact numbers & lifetime visit history.</Text>
                </View>
              </View>

              <View style={styles.pairingPerkDividerDark} />

              <View style={styles.pairingPerkItem}>
                <View style={styles.pairingPerkIconBoxDark}>
                  <Ionicons name="infinite" size={18} color="#10B981" />
                </View>
                <View style={styles.pairingPerkContent}>
                  <Text style={styles.pairingPerkTitleDark}>Lifetime Hardware License</Text>
                  <Text style={styles.pairingPerkDescDark}>Zero monthly hardware fees. Permanent counter stand activation.</Text>
                </View>
              </View>

              <View style={styles.pairingPerkDividerDark} />

              <View style={styles.pairingPerkItem}>
                <View style={styles.pairingPerkIconBoxDark}>
                  <Ionicons name="flash" size={18} color="#38BDF8" />
                </View>
                <View style={styles.pairingPerkContent}>
                  <Text style={styles.pairingPerkTitleDark}>Instant Counter Tap & Dynamic QR</Text>
                  <Text style={styles.pairingPerkDescDark}>Customers tap phone to stamp instantly without downloading any app.</Text>
                </View>
              </View>
            </View>

            {/* 6. Context-Aware Merchant Account & Action Buttons */}
            {user ? (
              <View style={styles.pairingActionWrap}>
                {/* Store Context Card */}
                <View style={styles.pairingAccountCard}>
                  <View style={styles.pairingAccountAvatar}>
                    <Ionicons name="storefront" size={18} color="#FFC700" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.pairingAccountLabel}>PAIRING TO YOUR ACCOUNT</Text>
                    <Text style={styles.pairingAccountName} numberOfLines={1}>
                      {user.name || user.email || 'Store Owner'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      if (logout) await logout();
                      router.push({
                        pathname: '/(auth)/login' as any,
                        params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
                      });
                    }}
                    style={styles.pairingSwitchBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pairingSwitchBtnText}>Switch</Text>
                  </TouchableOpacity>
                </View>

                {/* Primary Bind CTA */}
                <TouchableOpacity
                  style={[styles.pairingBtnPrimary, isPairing && { opacity: 0.7 }]}
                  onPress={handlePairStand}
                  disabled={isPairing}
                  activeOpacity={0.85}
                >
                  {isPairing ? (
                    <ActivityIndicator color="#0F172A" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#0F172A" style={{ marginRight: 8 }} />
                      <Text style={styles.pairingBtnPrimaryText}>
                        Bind Stand to My Store
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.pairingHelperText}>
                  Instant pairing • Stand activates immediately on your counter
                </Text>
              </View>
            ) : (
              <View style={styles.pairingActionWrap}>
                <TouchableOpacity
                  style={styles.pairingBtnPrimary}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/login' as any,
                      params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.pairingBtnPrimaryText}>
                    Store Owner Log In →
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pairingBtnSecondary}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/login' as any,
                      params: { redirect_to: `/nfc?c=${unclaimedStand.code}`, isRegister: '1' },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.pairingBtnSecondaryText}>
                    Create New Store Account (2 min)
                  </Text>
                </TouchableOpacity>
                <Text style={styles.pairingHelperText}>
                  Are you the business owner? Log in or create an account to pair this stand.
                </Text>
              </View>
            )}

            {/* 7. Trust Footer */}
            <View style={styles.pairingTrustFooter}>
              <Ionicons name="shield-checkmark" size={12} color="#64748B" />
              <Text style={styles.pairingTrustText}>Official Risev Hardware Protocol • 256-Bit Encrypted</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'invalid') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.invalidWrap}>
          <View style={styles.invalidIconBg}>
            <Ionicons name="close-circle-outline" size={48} color="#EF4444" />
          </View>
          <Text style={styles.invalidTitle}>NFC Link Invalid</Text>
          <Text style={styles.invalidSubtitle}>{invalidReason}</Text>
          <TouchableOpacity style={[styles.primaryActionBtn, { backgroundColor: '#000000', paddingHorizontal: 24 }]} onPress={() => router.replace('/')} activeOpacity={0.8}>
            <Text style={styles.primaryActionBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 9:16 CUSTOMIZABLE CARD CONTAINER
  // ══════════════════════════════════════════════════════════════════
  const renderCardContent = () => (
    <>
      {/* Top Navigation & Action Bar */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity 
              style={styles.iconCircleBtn} 
              onPress={handleViewStampCard}
            >
              <Ionicons name="chevron-back" size={20} color="#000000" />
            </TouchableOpacity>
            {step !== 'form' && (
              <TouchableOpacity 
                style={[styles.iconCircleBtn, { backgroundColor: '#000000' }]} 
                onPress={() => setShowBack(prev => !prev)}
              >
                <Ionicons name={showBack ? 'time-outline' : 'card-outline'} size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Merchant Brand Logo & Header / Animated Flipping Loyalty Card */}
          {step === 'form' || step === 'sent' ? (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => setShowBack(prev => !prev)}
              style={{ marginBottom: 20, position: 'relative' }}
            >
              {/* Front Card Panel */}
              <Animated.View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: [{ rotateY: frontInterpolate }],
                  },
                ]}
              >
                {program?.card_background ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}



                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  <View style={{ position: 'absolute', top: -160, left: -80, width: '150%', height: 260, backgroundColor: 'rgba(255, 255, 255, 0.04)', transform: [{ rotate: '-30deg' }] }} />
                  <View style={{ position: 'absolute', top: -160, left: 25, width: 28, height: 600, backgroundColor: 'rgba(255, 255, 255, 0.16)', transform: [{ rotate: '-30deg' }] }} />
                </View>

                {/* Header: Shop Name & Logo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                    {merchantLogoUrl && !merchantLogoUrl.includes('placeholder') ? (
                      <Image source={{ uri: merchantLogoUrl }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="storefront" size={20} color="#64748B" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: cardFontColor }} numberOfLines={1}>
                      {merchantName}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: cardFontColor, opacity: 0.65 }} numberOfLines={1}>
                      {(merchant?.category || 'store').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: cardFontColor }}>
                      {currentStamps}/{program?.stamp_goal || 10}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: cardFontColor, opacity: 0.75 }}>
                      STAMPS
                    </Text>
                  </View>
                </View>

                {/* Middle row: EMV Chip & Wifi Contactless Symbol */}
                <View style={[styles.cardMidRow, { zIndex: 2 }]}>
                  <View style={{ width: 32, height: 24, borderRadius: 6, backgroundColor: '#F59E0B', position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#D97706' }}>
                    <View style={{ position: 'absolute', top: 11, left: 0, width: '100%', height: 1, backgroundColor: '#B45309' }} />
                    <View style={{ position: 'absolute', top: 0, left: 15, width: 1, height: '100%', backgroundColor: '#B45309' }} />
                    <View style={{ position: 'absolute', top: 6, left: 10, width: 12, height: 12, borderRadius: 2, backgroundColor: '#FBBF24', borderWidth: 1, borderColor: '#B45309' }} />
                  </View>
                  <Ionicons 
                    name="wifi" 
                    size={18} 
                    color={cardFontColor ? cardFontColor : "rgba(255, 255, 255, 0.35)"} 
                    style={{ opacity: 0.45 }} 
                  />
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer row: Holder Name, Expiration, CVV, and brand logo */}
                <View style={[styles.largeCardFooter, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 }]}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      CARD HOLDER
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' }} numberOfLines={1}>
                      {isApproved ? (user?.name || 'VALUED CUSTOMER').toUpperCase() : '----'}
                    </Text>
                  </View>

                  <View style={{ flex: 0.8 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      VALID
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5 }}>
                      12/30
                    </Text>
                  </View>

                  <View style={{ flex: 0.6 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      CVV
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5 }}>
                      888
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Image
                      source={require('../assets/risev logo.png')}
                      style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: cardFontColor || '#FFFFFF' }}
                    />
                  </View>
                </View>
              </Animated.View>

              {/* Back Card Panel */}
              <Animated.View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: 0,
                    gap: 0,
                    backfaceVisibility: 'hidden',
                    transform: [{ rotateY: backInterpolate }],
                  },
                ]}
              >
                {program?.card_background_back ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background_back}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  <View style={{ position: 'absolute', top: -160, left: -80, width: '150%', height: 260, backgroundColor: 'rgba(255, 255, 255, 0.04)', transform: [{ rotate: '-30deg' }] }} />
                  <View style={{ position: 'absolute', top: -160, left: 25, width: 28, height: 600, backgroundColor: 'rgba(255, 255, 255, 0.16)', transform: [{ rotate: '-30deg' }] }} />
                </View>


                {/* Magnetic Stripe overlay */}
                <View style={{ width: '100%', height: 44, backgroundColor: '#111827', marginTop: 16, opacity: 0.95, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.15)', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, letterSpacing: 6 }} numberOfLines={1}>
                    {merchantName.toUpperCase()}
                  </Text>
                </View>

                <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, flex: 1 }}>
                  {/* Minimalist Status Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: cardFontColor, letterSpacing: 0.5, opacity: 0.7 }}>
                      YOUR STAMPS
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: cardFontColor }}>
                      {currentStamps}/{stampGoal}
                    </Text>
                  </View>

                  {/* Stamps Grid Row */}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    {stampGoal === 10 ? (
                      <View style={{ gap: 6, marginVertical: 6 }}>
                        {/* Row 1 (6 Stamps) */}
                        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', width: '100%' }}>
                          {Array.from({ length: 6 }).map((_, idx) => {
                            const isEarned = (idx + 1) <= currentStamps;
                            const isNew = newlyEarnedIndices.has(idx);
                            const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                            const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                            return (
                              <View key={idx} style={{ width: '13.5%', aspectRatio: 1 }}>
                                <AnimatedStampBubble
                                  isEarned={isEarned}
                                  isNew={isNew}
                                  delay={isNew ? (idx - minIdx) * 400 : 0}
                                  iconId={cardIcon}
                                  bubbleColor={bubbleColor}
                                  iconColor={cardBgColor}
                                  borderColor={cardFontColor + '30'}
                                  emptyBgColor={cardFontColor + '08'}
                                />
                              </View>
                            );
                          })}
                        </View>

                        {/* Row 2 (4 Stamps, Centered) */}
                        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', width: '100%' }}>
                          {Array.from({ length: 4 }).map((_, idx) => {
                            const globalIdx = idx + 6;
                            const isEarned = (globalIdx + 1) <= currentStamps;
                            const isNew = newlyEarnedIndices.has(globalIdx);
                            const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                            const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                            return (
                              <View key={idx} style={{ width: '13.5%', aspectRatio: 1 }}>
                                <AnimatedStampBubble
                                  isEarned={isEarned}
                                  isNew={isNew}
                                  delay={isNew ? (globalIdx - minIdx) * 400 : 0}
                                  iconId={cardIcon}
                                  bubbleColor={bubbleColor}
                                  iconColor={cardBgColor}
                                  borderColor={cardFontColor + '30'}
                                  emptyBgColor={cardFontColor + '08'}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6, justifyContent: 'center' }}>
                        {Array.from({ length: stampGoal }).map((_, idx) => {
                          const isEarned = (idx + 1) <= currentStamps;
                          const isNew = newlyEarnedIndices.has(idx);
                          const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                          const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                          return (
                            <View key={idx} style={{ width: '17%', aspectRatio: 1 }}>
                              <AnimatedStampBubble
                                isEarned={isEarned}
                                isNew={isNew}
                                delay={isNew ? (idx - minIdx) * 400 : 0}
                                iconId={cardIcon}
                                bubbleColor={bubbleColor}
                                iconColor={cardBgColor}
                                borderColor={cardFontColor + '30'}
                                emptyBgColor={cardFontColor + '08'}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={{ position: 'absolute', bottom: 16, right: 24 }}>
                    <Image
                      source={require('../assets/risev logo.png')}
                      style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: cardFontColor || '#FFFFFF' }}
                    />
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <View style={styles.brandHeaderSection}>
              {merchantLogoUrl ? (
                <Image source={{ uri: merchantLogoUrl }} style={styles.brandLogoImage} resizeMode="contain" />
              ) : (
                <View style={[styles.brandLogoFallback, { backgroundColor: primaryColor }]}>
                  <Ionicons name="storefront" size={32} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.brandNameText}>{merchantName}</Text>
            </View>
          )}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 1: Phone Input Form */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'form' && (() => {
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

            const isLightBrandColor = getIsLight(primaryColor);
            const brandTextColor = isLightBrandColor ? '#0F172A' : '#FFFFFF';
            const brandSubtextColor = isLightBrandColor ? '#475569' : 'rgba(255, 255, 255, 0.75)';
            const brandInputBorderColor = isLightBrandColor ? '#E2E8F0' : 'rgba(255, 255, 255, 0.2)';
            const brandInputBgColor = isLightBrandColor ? '#F8FAFC' : 'rgba(255, 255, 255, 0.08)';

            return (
              <>
                <View style={[styles.innerFormCard, { backgroundColor: primaryColor, borderColor: brandInputBorderColor, borderWidth: isLightBrandColor ? 1 : 0 }]}>
                  <View style={[styles.nfcBadgeRow, { backgroundColor: isLightBrandColor ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.15)' }]}>
                    <View style={[styles.nfcBadgeDot, { backgroundColor: isLightBrandColor ? '#10B981' : '#FFFFFF' }]} />
                    <Text style={[styles.nfcBadgeTitle, { color: isLightBrandColor ? '#10B981' : '#FFFFFF' }]}>VERIFIED NFC SCAN</Text>
                  </View>

                  <Text style={[styles.formWelcomeTitle, { color: brandTextColor }]}>Claim Your Stamps</Text>

                  {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                  {/* Phone Input */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: brandSubtextColor }]}>PHONE NUMBER</Text>
                    <View style={[styles.inputGroup, { backgroundColor: brandInputBgColor, borderColor: brandInputBorderColor, paddingLeft: 6 }]}>
                      <View style={[styles.prefixBox, { borderColor: brandInputBorderColor, backgroundColor: '#FFFFFF', borderRadius: 8, height: 30, paddingHorizontal: 6, marginVertical: 3 }]}>
                        <Text style={styles.flag}>🇲🇾</Text>
                        <Text style={styles.prefixCode}>+60</Text>
                      </View>
                      <TextInput
                        style={[
                          styles.input, 
                          { color: brandTextColor, fontSize: 13, marginLeft: 8 },
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="11-234 5678"
                        placeholderTextColor={brandSubtextColor}
                        value={phoneInput}
                        onChangeText={(text) => {
                          setPhoneInput(text);
                          setErrorMsg('');
                        }}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  {/* Full Name Input (New Customer) */}
                  {showNameField && (
                    <View style={{ marginTop: 4 }}>
                      {/* Welcome hint banner */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isLightBrandColor ? 'rgba(99, 102, 241, 0.07)' : 'rgba(255,255,255,0.10)',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: isLightBrandColor ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.15)',
                      }}>
                        <Text style={{ fontSize: 16, marginRight: 8 }}>👋</Text>
                        <Text style={{ flex: 1, fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: brandSubtextColor, lineHeight: 17 }}>
                          Looks like you're new here! Just tell us your name to claim.
                        </Text>
                      </View>

                      <Text style={[styles.inputLabel, { color: brandSubtextColor }]}>YOUR NAME</Text>
                      <View style={[styles.inputGroup, { backgroundColor: brandInputBgColor, borderColor: brandInputBorderColor, paddingLeft: 12 }]}>
                        <Ionicons name="person-outline" size={16} color={brandSubtextColor} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[
                            styles.input,
                            { color: brandTextColor, fontSize: 13 },
                            Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                          ]}
                          placeholder="e.g. Ahmad Rizal"
                          placeholderTextColor={brandSubtextColor}
                          value={nameInput}
                          onChangeText={setNameInput}
                          autoFocus
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryActionBtn,
                      { backgroundColor: isLightBrandColor ? '#050505' : '#FFFFFF', borderRadius: 12, height: 40 },
                      (isLoading || isCheckingPhone) && { opacity: 0.5 }
                    ]}
                    onPress={handleNfcSubmit}
                    disabled={isLoading || isCheckingPhone}
                    activeOpacity={0.85}
                  >
                    {isLoading || isCheckingPhone ? (
                      <ActivityIndicator color={isLightBrandColor ? '#FFFFFF' : '#0F172A'} />
                    ) : (
                      <>
                        <Text style={[styles.primaryActionBtnText, { color: isLightBrandColor ? '#FFFFFF' : '#0F172A', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, marginRight: 6 }]}>
                          {showNameField ? 'Complete Stamp Claim' : 'Claim Stamps Now'}
                        </Text>
                        <Ionicons 
                          name="arrow-forward" 
                          size={15} 
                          color={isLightBrandColor ? '#FFFFFF' : '#0F172A'} 
                        />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Trust Footer */}
                  <View style={styles.fakeTrustFooter}>
                    <Ionicons name="lock-closed" size={10} color={brandSubtextColor} />
                    <Text style={[styles.fakeTrustText, { color: brandSubtextColor }]}>Secure connection by risev.app</Text>
                  </View>
                </View>

                {/* Risev Logo below the card */}
                <Image 
                  source={require('../assets/risev logo.png')}
                  style={styles.fakeRisevLogoPhoneBg}
                  resizeMode="contain"
                />
              </>
            );
          })()}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 2: Real-Time Store Approval View */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'sent' && (() => {
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

            const isLightBrandColor = getIsLight(primaryColor);
            const brandTextColor = isLightBrandColor ? '#0F172A' : '#FFFFFF';
            const brandSubtextColor = isLightBrandColor ? '#475569' : 'rgba(255, 255, 255, 0.75)';
            const brandInputBorderColor = isLightBrandColor ? '#E2E8F0' : 'rgba(255, 255, 255, 0.2)';
            
            const badgeBg = isApproved 
              ? (isLightBrandColor ? '#DEF7EC' : 'rgba(16, 185, 129, 0.15)') 
              : (isLightBrandColor ? '#FEF3C7' : 'rgba(245, 158, 11, 0.15)');
              
            const badgeColor = isApproved 
              ? '#10B981' 
              : (isLightBrandColor ? '#D97706' : '#FFC700');

            const syncBg = isLightBrandColor ? '#FEF9C3' : 'rgba(254, 240, 138, 0.12)';
            const syncBorder = isLightBrandColor ? '#FEF08A' : 'rgba(254, 240, 138, 0.25)';
            const syncText = isLightBrandColor ? '#854D0E' : '#FEF08A';
            const syncSpinner = isLightBrandColor ? '#A16207' : '#FFC700';

            const instructionBg = isLightBrandColor ? '#F8FAFC' : 'rgba(255, 255, 255, 0.08)';
            const instructionBorder = isLightBrandColor ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)';

            return (
              <View style={[styles.innerFormCard, { backgroundColor: primaryColor, borderColor: brandInputBorderColor, borderWidth: isLightBrandColor ? 1 : 0 }]}>
                {/* Header Status Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons
                      name={isApproved ? "checkmark-circle" : "sync-outline"}
                      size={18}
                      color={badgeColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor }}>
                      {isApproved ? 'Claim Approved!' : 'Stamp Request Sent'}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: brandSubtextColor }}>
                      {isApproved ? 'Stamps credited successfully.' : 'Waiting for cashier confirmation...'}
                    </Text>
                  </View>
                </View>

                {/* Status Indicator Banner (Only if pending) */}
                {!isApproved && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: syncBg,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: syncBorder,
                      marginBottom: 12,
                    }}
                  >
                    <ActivityIndicator size="small" color={syncSpinner} />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: syncText, flex: 1 }}>
                      Keep this screen open for real-time sync
                    </Text>
                  </View>
                )}

                {/* Cashier/Staff Instruction Card (Only if pending) */}
                {!isApproved && (
                  <View
                    style={{
                      backgroundColor: instructionBg,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: instructionBorder,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="storefront" size={14} color={brandSubtextColor} />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandSubtextColor, letterSpacing: 0.5 }}>
                        CASHIER INSTRUCTION
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: brandSubtextColor, lineHeight: 16 }}>
                      Ask staff to approve your pending stamp claim on their merchant dashboard.
                    </Text>
                  </View>
                )}

                {/* Action Button (If approved) */}
                {isApproved && (
                  <TouchableOpacity
                    style={[
                      styles.primaryActionBtn,
                      { backgroundColor: isLightBrandColor ? '#050505' : '#FFFFFF', marginTop: 4, borderRadius: 12, height: 40 },
                    ]}
                    onPress={handleViewStampCard}
                    activeOpacity={0.85}
                  >
                    <Ionicons 
                      name="card" 
                      size={18} 
                      color={isLightBrandColor ? '#FFFFFF' : '#0F172A'} 
                      style={{ marginRight: 8 }} 
                    />
                    <Text style={[styles.primaryActionBtnText, { color: isLightBrandColor ? '#FFFFFF' : '#0F172A', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13 }]}>
                      View My Stamp Card
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 3: 1:1 CUSTOMER VIEW LOYALTY CARD */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'card' && (
            <View style={styles.cardSectionWrap}>
              {/* STAMP GRID CARD (1:1 with Customer View) */}
              <View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                  },
                ]}
              >
                {program?.card_background ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  {/* Soft wide reflection zone */}
                  <View
                    style={{
                      position: 'absolute',
                      top: -160,
                      left: -80,
                      width: '150%',
                      height: 260,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      transform: [{ rotate: '-30deg' }],
                    }}
                  />
                  {/* Sharp bright specular highlight line */}
                  <View
                    style={{
                      position: 'absolute',
                      top: -160,
                      left: 25,
                      width: 28,
                      height: 600,
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      transform: [{ rotate: '-30deg' }],
                    }}
                  />
                </View>

                {/* Card Header: Shop Name, Category & Gold Badge */}
                <View style={styles.largeCardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.largeCardMerchant,
                        { color: cardFontColor },
                      ]}
                      numberOfLines={1}
                    >
                      {merchantName}
                    </Text>
                    <Text
                      style={[
                        styles.shopCategoryText,
                        { color: cardFontColor + 'B3' },
                      ]}
                    >
                      {(merchant?.category || 'store').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.goldBadge}>
                    <Text style={styles.goldBadgeText}>LOYALTY CARD</Text>
                  </View>
                </View>

                {/* EMV Microchip & Contactless Wifi */}
                <View style={styles.cardMidRow}>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLineHoriz} />
                    <View style={styles.chipLineVert} />
                    <View style={styles.chipCenterPin} />
                  </View>
                  <Ionicons
                    name="wifi"
                    size={18}
                    color={cardFontColor + '66'}
                    style={{ opacity: 0.5 }}
                  />
                </View>

                {/* Stamps grid details (Exact 5-per-row grid matching customer view) */}
                <View style={styles.largeStampsGrid}>
                  {Array.from({ length: stampGoal }).map((_, idx) => {
                    const num = idx + 1;
                    const isEarned = num <= currentStamps;
                    const isRewardPos = num === stampGoal;
                    const fontC = cardFontColor;

                    if (isEarned) {
                      return (
                        <View
                          key={num}
                          style={[
                            styles.largeStampEarned,
                            { backgroundColor: stampColor },
                          ]}
                        >
                          {renderStampIcon(cardIcon, 16, '#FFFFFF')}
                        </View>
                      );
                    } else if (isRewardPos) {
                      return (
                        <View
                          key={num}
                          style={[
                            styles.largeStampGift,
                            { borderColor: fontC + '40' },
                          ]}
                        >
                          <Text style={{ fontSize: 13 }}>🎁</Text>
                        </View>
                      );
                    } else {
                      return (
                        <View
                          key={num}
                          style={[
                            styles.largeStampEmpty,
                            { borderColor: fontC + '30' },
                          ]}
                        >
                          {renderStampIcon(cardIcon, 14, fontC + '40')}
                        </View>
                      );
                    }
                  })}
                </View>

                {/* Card Footer Row */}
                <View style={styles.largeCardFooter}>
                  <View style={styles.holderCol}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      CARD HOLDER
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                      numberOfLines={1}
                    >
                      {(user?.name || 'Valued Customer').toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ width: 45 }}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      VALID
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                    >
                      12/30
                    </Text>
                  </View>

                  <View style={{ width: 35 }}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      CVV
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                    >
                      888
                    </Text>
                  </View>

                  <View style={styles.brandBadge}>
                    <View style={styles.mastercardBadge}>
                      <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]} />
                      <View style={[styles.badgeCircle, { backgroundColor: '#F59E0B', marginLeft: -9, opacity: 0.9 }]} />
                    </View>
                    <Text
                      style={[
                        styles.largeProgressPercentage,
                        { color: cardFontColor + 'CC' },
                      ]}
                    >
                      {currentStamps}/{stampGoal} STAMPS
                    </Text>
                  </View>
                </View>
              </View>

              {/* NEXT REWARD CARD */}
              <View style={styles.nextRewardCard}>
                <View style={styles.nextRewardHeader}>
                  {rewardImageUrl ? (
                    <Image source={{ uri: rewardImageUrl }} style={styles.nextRewardImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.nextRewardIconBadge, { backgroundColor: primaryColor + '20' }]}>
                      <Ionicons name="gift" size={24} color={primaryColor} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextRewardSublabel}>
                      {stampGoal - currentStamps > 0
                        ? `${stampGoal - currentStamps} more stamps to:`
                        : 'Stamp card completed! 🎉'}
                    </Text>
                    <Text style={styles.nextRewardMainTitle}>{rewardTitle}</Text>
                  </View>
                </View>

                {/* Lock / Unlock Status Action Button */}
                <TouchableOpacity
                  style={[
                    styles.unlockBtn,
                    currentStamps >= stampGoal
                      ? { backgroundColor: '#10B981' }
                      : { backgroundColor: '#000000' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unlockBtnText, { color: '#FFFFFF' }]}>
                    {currentStamps >= stampGoal
                      ? '🎉 Redeem Reward Now'
                      : `Collect ${stampGoal - currentStamps} stamps to unlock`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
    </>
  );

  return (
    <View style={[styles.fullPageContainer, !merchantBgUrl && { backgroundColor: primaryColor }]}>
      <StatusBar style="light" />
      {merchantBgUrl ? (
        <ImageBackground
          source={{ uri: merchantBgUrl }}
          resizeMode="cover"
          style={styles.fullPageBackground}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                isDesktop && styles.desktopScrollContent
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.contentCard, isDesktop && styles.desktopCard]}>
                {renderCardContent()}
              </View>
            </ScrollView>
          </SafeAreaView>
        </ImageBackground>
      ) : (
        <View style={[styles.fullPageBackground, { backgroundColor: primaryColor }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)', zIndex: -1 }]} />
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                isDesktop && styles.desktopScrollContent
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.contentCard, isDesktop && styles.desktopCard]}>
                {renderCardContent()}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullPageBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  invalidWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  invalidIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  invalidTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  invalidSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  desktopScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  contentCard: {
    width: '100%',
  },
  desktopCard: {
    maxWidth: 440,
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  portrait916Card: {
    borderRadius: 32,
    overflow: 'hidden',
    padding: 20,
    minHeight: 680,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAF9F6',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Brand Header
  brandHeaderSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogoImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 10,
  },
  brandLogoFallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandNameText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Form Container
  innerFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  nfcBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
  },
  nfcBadgeTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
    color: '#B45309',
  },
  formWelcomeTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  formWelcomeSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  flag: {
    fontSize: 16,
    marginRight: 6,
  },
  prefixCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginBottom: 12,
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Sent State
  sentIconWrap: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  sentHeaderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  sentHeaderDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  liveSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveSyncText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },

  // 1:1 Customer View Loyalty Card Styles
  cardSectionWrap: {
    gap: 16,
  },
  largeCardView: {
    borderRadius: 24,
    padding: 24,
    paddingBottom: 24,
    gap: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
    aspectRatio: 1.586,
    width: '100%',
  },
  largeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeCardMerchant: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  shopCategoryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.8,
  },
  goldBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  goldBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    zIndex: 2,
  },
  cardChip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#D97706',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B45309',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#92400E',
  },
  chipLineVert: {
    position: 'absolute',
    left: 17,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#92400E',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 8,
    left: 13,
    width: 10,
    height: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#92400E',
  },
  largeStampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    width: '100%',
    marginVertical: 4,
  },
  largeStampEarned: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  largeStampGift: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  largeStampEmpty: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  holderCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  holderLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  brandBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  mastercardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  largeProgressPercentage: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Next Reward Card
  nextRewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  nextRewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  nextRewardImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  nextRewardIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRewardSublabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  nextRewardMainTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  unlockBtn: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  unlockBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  nfcBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  fakeTrustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
  },
  fakeTrustText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  fakeRisevLogoPhoneBg: {
    height: 32,
    width: 128,
    alignSelf: 'center',
    marginTop: 50,
    marginBottom: 50,
    tintColor: '#FFFFFF',
  },
  // ─── SMART PAIRING / ONBOARDING STYLES (DARK IAP STYLE) ──────────
  pairingContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pairingScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  pairingContentCard: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  pairingDesktopCard: {
    maxWidth: 480,
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  pairingHeaderDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  pairingYellowCard: {
    backgroundColor: '#000000',
    borderRadius: 36,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  pairingLogo: {
    height: 32,
    width: 120,
    marginBottom: 12,
    tintColor: '#FFFFFF',
  },
  pairingHardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pairingPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  pairingHardwareBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  pairingHeroContainer: {
    width: '100%',
    height: 230,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  pairingHeroImage: {
    width: '100%',
    height: 220,
    zIndex: 2,
  },
  pairingTitleSectionLight: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  pairingTitleLight: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pairingSubtitleLight: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  pairingCodeBox: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  pairingCodeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pairingCodeLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 0.8,
  },
  pairingVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pairingVerifiedText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  pairingCodeValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
    paddingTop: 2,
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  pairingPerksListDark: {
    width: '100%',
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: '#27272A',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
  },
  pairingPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pairingPerkIconBoxDark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingPerkContent: {
    flex: 1,
  },
  pairingPerkTitleDark: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pairingPerkDescDark: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
  },
  pairingPerkDividerDark: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 16,
    marginLeft: 52,
  },
  pairingActionWrap: {
    width: '100%',
    marginBottom: 14,
    gap: 10,
  },
  pairingAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: '#27272A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 2,
  },
  pairingAccountAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pairingAccountLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pairingAccountName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  pairingSwitchBtn: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pairingSwitchBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
  },
  pairingBtnPrimary: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFC700',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  pairingBtnPrimaryText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.2,
  },
  pairingBtnSecondary: {
    width: '100%',
    height: 50,
    backgroundColor: '#27272A',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingBtnSecondaryText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  pairingHelperText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  pairingTrustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  pairingTrustText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
});
