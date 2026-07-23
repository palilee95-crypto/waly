import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function NfcLandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ m: string }>();
  const { user, quickRegister } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth > 768;

  const [merchant, setMerchant] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);
  const [reward, setReward] = useState<any>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<any>(null);
  const [step, setStep] = useState<'loading' | 'form' | 'sent' | 'card' | 'invalid'>('loading');
  const [invalidReason, setInvalidReason] = useState('');

  const [phoneInput, setPhoneInput] = useState(user?.phone ? user.phone.replace('+60', '').replace('+', '') : '');
  const [nameInput, setNameInput] = useState(user?.name || '');

  const [showNameField, setShowNameField] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Realtime listening state
  const [isWaitingConfirm, setIsWaitingConfirm] = useState(false);

  // 1. Fetch Merchant, Program & Rewards on Mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const merchantId = params.m;
      if (!merchantId) {
        if (isMounted) {
          setInvalidReason('No merchant ID provided in NFC link.');
          setStep('invalid');
        }
        return;
      }

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

        // Fetch primary loyalty program for this merchant
        try {
          const progs = await pb.collection('loyalty_programs').getFullList({
            filter: `merchant = "${merchantId}" && is_active = true`,
            sort: '-created'
          });
          if (progs.length > 0 && isMounted) {
            setProgram(progs[0]);
            // Fetch rewards for this program
            try {
              const rws = await pb.collection('rewards').getFullList({
                filter: `merchant = "${merchantId}"`,
                sort: '-created'
              });
              if (rws.length > 0 && isMounted) setReward(rws[0]);
            } catch (rErr) {}
          }
        } catch (pErr) {}

        if (isMounted) {
          setStep((prev) => (prev === 'loading' ? 'form' : prev));
        }
      } catch (err) {
        if (isMounted) {
          setInvalidReason('Invalid or expired NFC merchant link.');
          setStep('invalid');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params.m]);

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
          setStep('card');
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
          setStep('card');
          setIsWaitingConfirm(false);
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    // Subscribe to nfc_claims updates for instant auto-reveal when merchant approves
    pb.collection('nfc_claims').subscribe('*', (e: any) => {
      if (!isSubscribed) return;
      const record = e.record;
      if (record && record.merchant === merchant.id && record.status === 'completed') {
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (currentCustId) {
          fetchUserLoyaltyCard(merchant.id, currentCustId);
        }
        setStep('card');
        setIsWaitingConfirm(false);
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
  }, [merchant, user]);

  // Brand Tokens & Assets
  const merchantName = merchant?.name || 'Risev Merchant';
  const merchantPhone = merchant?.phone || merchant?.metadata?.phone || merchant?.expand?.owner?.phone || '';
  
  const merchantLogoUrl = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : (merchant?.onboarding_logo_url || null);

  const merchantBgUrl = merchant?.background_image
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.background_image}`
    : (merchant?.onboarding_bg_url || null);

  const primaryColor = merchant?.onboarding_primary_color || program?.card_color || '#F97316';
  const welcomeText = merchant?.onboarding_welcome_text || `Welcome to ${merchantName}! Tap below to claim your stamps.`;
  const stampGoal = program?.stamp_goal || 10;
  const currentStamps = loyaltyCard?.stamps_collected || 0;
  const rewardTitle = reward?.title || program?.reward_title || 'Free Special Reward';
  const rewardImageUrl = reward?.image 
    ? `${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`
    : 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=300';

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

      if (!showNameField && !user) {
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
            setShowNameField(true);
            setIsLoading(false);
            setIsCheckingPhone(false);
            return;
          }
        } catch (checkErr) {
          console.warn('[NFC] check-phone error:', checkErr);
        } finally {
          setIsCheckingPhone(false);
        }
      }

      if (!finalName) finalName = 'Customer ' + digits.slice(-4);

      // Quick register or retrieve account
      await quickRegister(finalName, cleanPhone);

      const authRecord = pb.authStore.record;
      const displayName = (authRecord?.name && !authRecord.name.startsWith('Customer '))
        ? authRecord.name
        : (finalName || ('Customer ' + digits.slice(-4)));

      // 1. Send Direct API Request to PocketBase (INSTANT & FAIL-SAFE)
      let claimSessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        const reqRes = await pb.send<{ success: boolean; claim_id: string; session_code: string }>('/api/risev/nfc/request', {
          method: 'POST',
          body: {
            merchant_id: merchant.id,
            phone: cleanPhone,
            name: displayName,
          },
        });
        if (reqRes?.session_code) claimSessionCode = reqRes.session_code;
      } catch (apiErr) {
        console.warn('[NFC] /api/risev/nfc/request error:', apiErr);
      }

      // 2. Prepare Optional WhatsApp Message Link
      const message =
        `Hi ${merchantName}! I scanned your NFC card to claim stamps.\n\n` +
        `Name: ${displayName}\n` +
        `Phone: ${cleanPhone}\n` +
        `Merchant: ${merchant.id}\n` +
        `NFC: ${claimSessionCode}`;

      let waPhone = merchantPhone.replace(/[^\d]/g, '');
      if (waPhone.startsWith('0')) waPhone = '6' + waPhone;
      if (!waPhone.startsWith('60') && waPhone.length >= 9) waPhone = '60' + waPhone;

      const generatedWaUrl = waPhone
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      setWaUrl(generatedWaUrl);

      setIsWaitingConfirm(true);
      setStep('sent');

      // Fetch user's loyalty card
      if (authRecord?.id) {
        fetchUserLoyaltyCard(merchant.id, authRecord.id);
      }
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
            <TouchableOpacity style={styles.iconCircleBtn} onPress={() => router.replace('/')}>
              <Ionicons name="chevron-back" size={20} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconCircleBtn, { backgroundColor: '#000000' }]} 
              onPress={() => setStep(step === 'card' ? 'form' : 'card')}
            >
              <Ionicons name={step === 'card' ? 'qr-code-outline' : 'card-outline'} size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Merchant Brand Logo & Header */}
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

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 1: Phone Input Form */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'form' && (
            <View style={styles.innerFormCard}>
              <View style={styles.nfcBadgeRow}>
                <Ionicons name="wifi-outline" size={14} color={primaryColor} />
                <Text style={[styles.nfcBadgeTitle, { color: primaryColor }]}>NFC CARD SCANNED</Text>
              </View>

              <Text style={styles.formWelcomeTitle}>Claim Your Stamps</Text>
              <Text style={styles.formWelcomeSubtitle}>{welcomeText}</Text>

              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                <View style={styles.inputGroup}>
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
                    onChangeText={(text) => {
                      setPhoneInput(text);
                      setErrorMsg('');
                    }}
                    keyboardType="phone-pad"
                    autoFocus={!showNameField}
                    editable={!showNameField}
                  />
                </View>
              </View>

              {/* Full Name Input (New Customer) */}
              {showNameField && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>FULL NAME (NEW CUSTOMER)</Text>
                  <View style={styles.inputGroup}>
                    <Ionicons name="person-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                      placeholder="e.g. Fazli"
                      placeholderTextColor="#94A3B8"
                      value={nameInput}
                      onChangeText={(text) => {
                        setNameInput(text);
                        setErrorMsg('');
                      }}
                      autoFocus
                    />
                  </View>
                </View>
              )}

              {/* Submit Button with Custom Primary Color */}
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: primaryColor },
                  (isLoading || isCheckingPhone) && { opacity: 0.5 }
                ]}
                onPress={handleNfcSubmit}
                disabled={isLoading || isCheckingPhone}
                activeOpacity={0.85}
              >
                {isLoading || isCheckingPhone ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>
                      {showNameField ? 'Complete Stamp Claim' : 'Claim Stamps Now'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 2: Sent & Waiting Confirmation View */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'sent' && (
            <View style={styles.innerFormCard}>
              <View style={styles.sentIconWrap}>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              </View>
              <Text style={styles.sentHeaderTitle}>Stamp Claim Requested! 🎉</Text>
              <Text style={styles.sentHeaderDesc}>
                Your claim is live on <Text style={{ fontWeight: '800', color: '#000000' }}>{merchantName}</Text>'s terminal. Please tell the staff your phone number to approve your stamps.
              </Text>

              {/* Pulse / Loading Live Sync */}
              <View style={styles.liveSyncBanner}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={styles.liveSyncText}>Waiting for store approval in real-time...</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: primaryColor, marginTop: 16 }]}
                onPress={() => setStep('card')}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionBtnText}>View My Stamp Card</Text>
              </TouchableOpacity>

              {waUrl ? (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#25D366', marginTop: 10 }]}
                  onPress={async () => {
                    if (Platform.OS === 'web') {
                      window.location.href = waUrl;
                    } else {
                      await Linking.openURL(waUrl);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionBtnText}>Open WhatsApp Chat (Optional)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 3: DEDICATED REAL MERCHANT LOYALTY CARD VIEW */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'card' && (
            <View style={styles.cardSectionWrap}>
              {/* STAMP GRID CARD */}
              <View style={[styles.stampGridCard, { backgroundColor: program?.card_color || primaryColor, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', position: 'relative' }]}>
                {program?.card_background ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Stamp Counter Header */}
                <View style={styles.stampCounterRow}>
                  <Text style={styles.stampFractionText}>
                    <Text style={{ fontSize: 38, fontFamily: 'PlusJakartaSans_800ExtraBold', color: program?.font_color || '#FFFFFF' }}>{currentStamps}</Text>
                    <Text style={{ fontSize: 24, color: (program?.font_color || '#FFFFFF') + 'AA' }}> /{stampGoal}</Text>
                  </Text>

                  {/* Stamp Grid Pills with Real Custom Stamp Icon */}
                  <View style={styles.pillsWrap}>
                    {Array.from({ length: stampGoal }).map((_, idx) => {
                      const num = idx + 1;
                      const isFilled = num <= currentStamps;
                      const isRewardPos = num === stampGoal || num === Math.floor(stampGoal / 2);

                      return (
                        <View
                          key={num}
                          style={[
                            styles.stampPill,
                            isFilled ? { backgroundColor: '#FFFFFF' } : { backgroundColor: 'rgba(255,255,255,0.25)' },
                          ]}
                        >
                          {isFilled ? (
                            renderStampIcon(program?.card_icon || 'coffee', 16, program?.stamp_color || '#3B82F6')
                          ) : isRewardPos ? (
                            <Text style={{ fontSize: 13 }}>🎁</Text>
                          ) : (
                            <Text style={[styles.stampPillText, { color: program?.font_color || '#FFFFFF' }]}>{num}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Sub Card: Stamps Remaining to Reward */}
                <View style={styles.stampSubRewardCard}>
                  <Image source={{ uri: rewardImageUrl }} style={styles.rewardSubImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardSubSubtitle}>
                      {stampGoal - currentStamps > 0
                        ? `${stampGoal - currentStamps} more stamps to:`
                        : 'Stamp card completed! 🎉'}
                    </Text>
                    <Text style={styles.rewardSubTitle} numberOfLines={2}>
                      {rewardTitle}
                    </Text>
                  </View>
                </View>
              </View>

              {/* NEXT REWARD CARD */}
              <View style={styles.nextRewardCard}>
                <View style={styles.nextRewardHeader}>
                  <Image source={{ uri: rewardImageUrl }} style={styles.nextRewardImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextRewardSublabel}>Your Next Reward</Text>
                    <Text style={styles.nextRewardMainTitle}>{rewardTitle}</Text>
                  </View>
                </View>

                {/* Lock / Unlock Status Action Button */}
                <TouchableOpacity
                  style={[
                    styles.unlockBtn,
                    currentStamps >= stampGoal
                      ? { backgroundColor: '#10B981' }
                      : { backgroundColor: '#000000' }
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
    <View style={[styles.fullPageContainer, !merchantBgUrl && { backgroundColor: primaryColor + '20' }]}>
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
        <View style={styles.fullPageBackground}>
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
    gap: 6,
    marginBottom: 10,
  },
  nfcBadgeTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
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

  // 9:16 Loyalty Card View (Images 2 & 3)
  cardSectionWrap: {
    gap: 16,
  },
  stampGridCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  stampCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stampFractionText: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 160,
    justifyContent: 'flex-end',
  },
  stampPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stampPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  stampSubRewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  rewardSubImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  rewardSubSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  rewardSubTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
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
});
