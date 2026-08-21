import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
  Image,
  LayoutAnimation,
  UIManager,
  Animated
} from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

interface PackageOption {
  id: string;
  units: number;
  title: string;
  tagline: string;
  price: number;
  originalPrice: number;
  discountBadge: string;
  isPopular?: boolean;
  description: string[];
}

const PACKAGES: PackageOption[] = [
  {
    id: 'single',
    units: 1,
    title: '1x Stand + 500 Customers',
    tagline: 'RM 119',
    price: 119,
    originalPrice: 199,
    discountBadge: '40% OFF',
    description: [
      'Perfect for a single counter',
      '1x Premium NFC Stand',
      '500 Lifetime Customer Quota',
      'Digital Loyalty Card system'
    ]
  },
  {
    id: 'duo',
    units: 2,
    title: '2x Stand + 1,000 Customers',
    tagline: 'RM 198',
    price: 198,
    originalPrice: 396,
    discountBadge: '50% OFF',
    isPopular: true,
    description: [
      'Most popular choice for 2 branches',
      '2x Premium NFC Stands',
      '1,000 Lifetime Customer Quota',
      'Digital Loyalty Card system'
    ]
  },
  {
    id: 'trio',
    units: 3,
    title: '3x Stand + 3,000 Customers',
    tagline: 'RM 247',
    price: 247,
    originalPrice: 514,
    discountBadge: '52% OFF',
    description: [
      'Best value for maximum coverage',
      '3x Premium NFC Stands',
      '3,000 Lifetime Customer Quota',
      'Digital Loyalty Card system'
    ]
  }
];

export default function NfcPaywallScreen() {
  const router = useRouter();
  const { user, refreshSession, switchRole } = useAuth();

  // State
  const [selectedPackageId, setSelectedPackageId] = useState<string>('duo');
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);

  // Activation Code States (TikTok / Shopee redemption)
  const [standCodeInput, setStandCodeInput] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');

  // UI States
  const [showPricingPackages, setShowPricingPackages] = useState(false);

  // Bouncing arrow animation
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 6, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [bounceAnim]);

  // Dynamic Package State
  const [packages, setPackages] = useState<PackageOption[]>(PACKAGES);

  // Existing Order State
  const [existingOrder, setExistingOrder] = useState<any | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(true);
  const [showOrderNewPurchase, setShowOrderNewPurchase] = useState<boolean>(false);

  // Load Custom NFC Stand Pricing from PocketBase (pricesettings02)
  useEffect(() => {
    async function loadNfcPricing() {
      try {
        const pricing = await pb.collection('pricing_settings').getOne('pricesettings02');
        if (pricing) {
          const singlePrice = Number(pricing.base_price_1m) || 119;
          const duoPrice = Number(pricing.discount_3m) || 198;
          const enterprisePrice = Number(pricing.discount_6m) || 469;

          setPackages([
            {
              id: 'single',
              units: 1,
              title: '1x Stand + 500 Customers',
              tagline: `RM ${singlePrice}`,
              price: singlePrice,
              originalPrice: Math.round(singlePrice * 1.6),
              discountBadge: '40% OFF',
              description: [
                'Perfect for a single counter',
                '1x Premium NFC Stand',
                '500 Lifetime Customer Quota',
                'Digital Loyalty Card system'
              ]
            },
            {
              id: 'duo',
              units: 2,
              title: '2x Stand + 1,000 Customers',
              tagline: `RM ${duoPrice}`,
              price: duoPrice,
              originalPrice: Math.round(duoPrice * 2),
              discountBadge: '50% OFF',
              isPopular: true,
              description: [
                'Most popular choice for 2 branches',
                '2x Premium NFC Stands',
                '1,000 Lifetime Customer Quota',
                'Digital Loyalty Card system'
              ]
            },
            {
              id: 'enterprise',
              units: 5,
              title: '5x Stand + 5,000 Customers',
              tagline: `RM ${enterprisePrice}`,
              price: enterprisePrice,
              originalPrice: Math.round(enterprisePrice * 1.8),
              discountBadge: '55% OFF',
              description: [
                'Best for multi-outlet franchises',
                '5x Premium NFC Stands',
                '5,000 Lifetime Customer Quota',
                'Digital Loyalty Card system'
              ]
            }
          ]);
        }
      } catch (err) {
        // Fallback to static PACKAGES if pricesettings02 not found
      }
    }

    loadNfcPricing();
  }, []);

  useEffect(() => {
    async function checkExistingOrders() {
      if (!user?.id && !user?.phone) {
        setIsLoadingOrder(false);
        return;
      }

      try {
        let filterParts: string[] = [];
        if (user?.id) filterParts.push(`user = "${user.id}"`);
        if (user?.merchant_id) filterParts.push(`merchant = "${user.merchant_id}"`);
        if (user?.phone) {
          const rawDigits = user.phone.replace(/\D/g, '');
          if (rawDigits.length >= 8) {
            filterParts.push(`whatsapp_phone ~ "${rawDigits.slice(-8)}"`);
          }
        }

        const filter = filterParts.join(' || ');
        if (filter) {
          const records = await pb.collection('hardware_orders').getList(1, 1, {
            filter: filter,
            sort: '-created',
          });

          if (records.items.length > 0) {
            setExistingOrder(records.items[0]);
          }
        }
      } catch (err) {
        console.warn('[NFC Marketplace] Error checking existing hardware orders:', err);
      } finally {
        setIsLoadingOrder(false);
      }
    }

    checkExistingOrders();
  }, [user]);

  // Form State
  const [storeName, setStoreName] = useState('');
  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [whatsappPhone, setWhatsappPhone] = useState(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Selangor');
  const [paymentMethod, setPaymentMethod] = useState<'fpx' | 'card' | 'whatsapp'>('fpx');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPkg = packages.find(p => p.id === selectedPackageId) || packages[1] || PACKAGES[1];

  const handleRedeemCode = async () => {
    if (!standCodeInput.trim()) {
      setCodeError('Please enter your stand activation code.');
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
        await switchRole('merchant');
        Alert.alert('Stand Activated! 🎉', 'Your NFC Stand & Merchant account are now active.', [
          { text: 'Go to Dashboard', onPress: () => router.replace('/(merchant)') }
        ]);
      } else {
        setCodeError(res.message || 'Invalid activation code.');
      }
    } catch (err: any) {
      setCodeError(err.message || 'Failed to redeem activation code.');
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/profile');
    }
  };

  const handleCheckout = async () => {
    if (!recipientName.trim() || !whatsappPhone.trim() || !addressLine1.trim() || !postcode.trim() || !city.trim() || !state.trim()) {
      Alert.alert('Perhatian', 'Sila lengkapkan semua butiran penghantaran (Nama, No Telefon, Alamat, Poskod, Bandar & Negeri).');
      return;
    }

    const fullAddress = [
      addressLine1.trim(),
      addressLine2.trim(),
      `${postcode.trim()} ${city.trim()}`,
      state.trim(),
    ].filter(Boolean).join(', ');

    const generatedOrderNo = `NFC-${Date.now().toString(36).toUpperCase()}`;

    // Save to PocketBase hardware_orders collection
    try {
      await pb.collection('hardware_orders').create({
        order_no: generatedOrderNo,
        user: user?.id || null,
        merchant: user?.merchant_id || null,
        package_title: selectedPkg.title,
        units: selectedPkg.units,
        amount: selectedPkg.price,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'whatsapp' ? 'pending' : 'paid',
        fulfillment_status: 'pending',
        recipient_name: recipientName.trim(),
        whatsapp_phone: whatsappPhone.trim(),
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        postcode: postcode.trim(),
        city: city.trim(),
        state: state.trim(),
        full_address: fullAddress,
      });
    } catch (saveErr) {
      console.warn('[NFC Marketplace] Order record save notice:', saveErr);
    }

    const orderData = {
      orderId: generatedOrderNo,
      package: selectedPkg.title,
      amount: selectedPkg.price,
      storeName: storeName.trim(),
      recipientName: recipientName.trim(),
      phone: whatsappPhone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      postcode: postcode.trim(),
      city: city.trim(),
      state: state.trim(),
      fullAddress: fullAddress,
      paymentMethod: paymentMethod,
    };

    if (paymentMethod === 'whatsapp') {
      setIsSubmitting(false);
      const textMsg = encodeURIComponent(
        `*Tempahan RiseV Smart Stand*\n\n` +
        `🔖 *No. Pesanan:* ${orderData.orderId}\n` +
        `📦 *Pakej:* ${selectedPkg.title} (RM ${selectedPkg.price})\n` +
        `👤 *Penerima:* ${orderData.recipientName}\n` +
        `📞 *WhatsApp:* ${orderData.phone}\n` +
        `📍 *Alamat:* ${orderData.fullAddress}\n\n` +
        `Saya ingin sahkan tempahan ini.`
      );
      const waUrl = `https://wa.me/601156221568?text=${textMsg}`;
      if (Platform.OS === 'web') window.open(waUrl, '_blank');
      else Linking.openURL(waUrl);
      
      setShowCheckoutSheet(false);
      setCompletedOrder(orderData);
      return;
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setShowCheckoutSheet(false);
      setCompletedOrder(orderData);
    }, 800);
  };

  return (
    <View style={styles.container}>
      {/* Absolute Back Button */}
      <TouchableOpacity 
        style={styles.backBtnAbsolute} 
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <View style={styles.backBtnCircle}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {isLoadingOrder ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFC700" />
        </View>
      ) : existingOrder && !showOrderNewPurchase ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: 60, paddingHorizontal: 20 }]}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ 
              width: 72, height: 72, borderRadius: 36, 
              backgroundColor: 'rgba(255, 199, 0, 0.08)', 
              alignItems: 'center', justifyContent: 'center', 
              marginBottom: 16, 
              borderWidth: 1, borderColor: 'rgba(255, 199, 0, 0.4)',
              shadowColor: '#FFC700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
            }}>
              <Ionicons name="cube" size={36} color="#FFC700" />
            </View>
            
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#E2E8F0', letterSpacing: 1 }}>
                ORDER #{existingOrder.order_no}
              </Text>
            </View>

            <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5 }}>
              Your Stand is on its way! 🚚
            </Text>
            
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFD700', textAlign: 'center', marginTop: 6 }}>
              {existingOrder.package_title}
            </Text>
          </View>

          {/* Fulfillment Status Progress Box */}
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#222225', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Shipment Status</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: existingOrder.fulfillment_status === 'shipped' ? 'rgba(139, 92, 246, 0.2)' : existingOrder.fulfillment_status === 'delivered' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.15)' }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: existingOrder.fulfillment_status === 'shipped' ? '#A78BFA' : existingOrder.fulfillment_status === 'delivered' ? '#34D399' : '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {existingOrder.fulfillment_status || 'PROCESSING'}
                </Text>
              </View>
            </View>

            {/* Courier & Tracking info */}
            {existingOrder.tracking_number ? (
              <View style={{ backgroundColor: '#18181B', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#27272A' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#A1A1AA' }}>Courier Partner</Text>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', marginTop: 2 }}>
                  {existingOrder.courier_name || 'Courier Express'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'monospace', color: '#38BDF8', fontWeight: '700' }}>
                    {existingOrder.tracking_number}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => {
                      const url = `https://www.google.com/search?q=${encodeURIComponent(`${existingOrder.courier_name || ''} tracking ${existingOrder.tracking_number}`)}`;
                      if (Platform.OS === 'web') window.open(url, '_blank');
                      else Linking.openURL(url);
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Track Live 🌐</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: '#0A0A0A', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1C1C1E', borderLeftWidth: 3, borderLeftColor: '#FFC700' }}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#F4F4F5' }}>
                  📦 Parcel is being prepared at HQ
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#A1A1AA', marginTop: 4, lineHeight: 18 }}>
                  Tracking number will appear here once picked up by our courier partner.
                </Text>
              </View>
            )}

            {/* Destination Address */}
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery To</Text>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', marginTop: 6 }}>{existingOrder.recipient_name} <Text style={{ color: '#94A3B8', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 }}>({existingOrder.whatsapp_phone})</Text></Text>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#A1A1AA', marginTop: 4, lineHeight: 18 }}>
                {existingOrder.full_address || `${existingOrder.address_line1}, ${existingOrder.postcode} ${existingOrder.city}`}
              </Text>
            </View>
          </View>

          {/* Primary Action: Go to Merchant Dashboard */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={async () => {
              await switchRole('merchant');
              router.replace('/(merchant)');
            }}
            style={{ marginBottom: 16 }}
          >
            <LinearGradient
              colors={['#FACC15', '#EAB308']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                shadowColor: '#EAB308',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 0.5 }}>
                Enter Merchant Console 🚀
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary Action: Order Additional Stand */}
          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 14 }}
            onPress={() => setShowOrderNewPurchase(true)}
          >
            <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#A1A1AA' }}>
              Need more stands for extra branches? <Text style={{ color: '#FFC700', textDecorationLine: 'underline' }}>Order Another Bundle</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Back to active order link if available */}
          {existingOrder && showOrderNewPurchase && (
            <TouchableOpacity 
              style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }} 
              onPress={() => setShowOrderNewPurchase(false)}
            >
              <Text style={{ fontSize: 12, color: '#FFC700', fontFamily: 'PlusJakartaSans_700Bold' }}>
                ← View My Active Order ({existingOrder.order_no})
              </Text>
            </TouchableOpacity>
          )}
        
        {/* Massive Hero Section Fading Into Black */}
        <View style={styles.heroWrapper}>
          <Image 
            source={require('../../assets/imej nfc.png')} 
            style={styles.heroImage} 
            resizeMode="contain" 
          />
          {/* Smooth Gradient Fade Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
            locations={[0, 0.6, 1]}
            style={styles.fadeOverlayBottom}
          />
        </View>

        {/* Title & Subtitle Area */}
        <View style={styles.titleArea}>
          <View style={styles.titleRow}>
            <Image 
              source={require('../../assets/risev logo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>NFC Bundle</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Turn walk-ins into regulars.{"\n"}
            Includes <Ionicons name="people" size={13} color="#94A3B8" /> <Text style={{ color: '#E2E8F0' }}>Lifetime Customer Quota</Text>
          </Text>
        </View>

        {/* Stand Code Redemption Box */}
        {!showPricingPackages && (
        <View style={styles.activationCard}>
          <View style={styles.activationHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.chipIconContainer}>
                <Ionicons name="hardware-chip-outline" size={18} color="#FFC700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationTitle}>
                  Have an NFC Stand Activation Code?
                </Text>
                <Text style={styles.activationSubtitle}>
                  TikTok Shop / Shopee / Package Box
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.activationBody}>
            <View style={styles.activationInputRow}>
              <TextInput
                style={styles.activationInput}
                placeholder="STAND-XXXX-XXXX"
                placeholderTextColor="#64748B"
                value={standCodeInput}
                onChangeText={setStandCodeInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                onPress={handleRedeemCode}
                disabled={isRedeemingCode}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FACC15', '#EAB308']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.redeemBtn}
                >
                  {isRedeemingCode ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.redeemBtnText}>Redeem</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {codeError ? (
              <Text style={styles.codeErrorText}>{codeError}</Text>
            ) : null}

            {codeSuccess ? (
              <Text style={styles.codeSuccessText}>{codeSuccess}</Text>
            ) : null}
          </View>
        </View>
        )}

        {/* Curiosity Button (shown if pricing is hidden) */}
        {!showPricingPackages && (
          <TouchableOpacity 
            style={styles.curiosityBtn}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowPricingPackages(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.curiosityBtnText}>Don't have a stand? Get Yours Here</Text>
            <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
              <Ionicons name="arrow-down-circle" size={20} color="#FFC700" />
            </Animated.View>
          </TouchableOpacity>
        )}

        {/* Packages List (Vidart Pro Style) */}
        {showPricingPackages && (
        <View style={styles.packagesContainer}>
          <TouchableOpacity 
            style={{ alignSelf: 'center', marginBottom: 12, paddingVertical: 4 }}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowPricingPackages(false);
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8', textDecorationLine: 'underline' }}>
              Already have an activation code?
            </Text>
          </TouchableOpacity>

          <View style={styles.trustBadgeRow}>
            <View style={styles.trustBadge}>
              <Ionicons name="sparkles" size={14} color="#FFD700" />
              <Text style={styles.trustBadgeText}>One-Time Payment</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFD700" />
              <Text style={styles.trustBadgeText}>No Monthly Fees</Text>
            </View>
          </View>

          {packages.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.pkgCard, isSelected && styles.pkgCardSelected, pkg.isPopular && { marginTop: 14 }]}
                onPress={() => setSelectedPackageId(pkg.id)}
                activeOpacity={0.9}
              >
                {pkg.isPopular && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                  </View>
                )}
                <View style={styles.pkgRow}>
                  <View style={styles.pkgLeft}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <Ionicons name="checkmark-sharp" size={14} color="#000" />}
                    </View>
                    <View>
                      <Text style={[styles.pkgTitle, isSelected && { color: '#FFF' }]}>{pkg.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 }}>
                        <Text style={[styles.pkgFinalPrice, isSelected && { color: '#FFD700' }]}>RM {pkg.price}</Text>
                        <Text style={styles.pkgOriginalPrice}>RM {pkg.originalPrice}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.discountPill, isSelected && styles.discountPillActive]}>
                    <Text style={[styles.discountPillText, isSelected && { color: '#000' }]}>
                      {pkg.discountBadge}
                    </Text>
                  </View>
                </View>
                
                {isSelected && (
                  <View style={styles.pkgDescriptionBox}>
                    {pkg.description.map((item, index) => (
                      <View key={index} style={styles.pkgDescRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#FFC700" />
                        <Text style={styles.pkgDescriptionText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={styles.disclaimerBox}>
            <Ionicons name="information-circle" size={18} color="#64748B" style={{ marginTop: 2 }} />
            <Text style={styles.disclaimerText}>
              <Text style={{ color: '#E2E8F0', fontFamily: 'PlusJakartaSans_700Bold' }}>Optional Add-ons: </Text>
              WhatsApp Automation, Additional Branches, and Extra Database Quota can be added later via your dashboard if needed.
            </Text>
          </View>
        </View>
        )}

        <View style={styles.footerLinks}>
          <Text style={styles.footerLinkText}>How it works</Text>
          <Text style={styles.footerLinkText}>Restore Purchase</Text>
          <Text style={styles.footerLinkText}>Privacy Policy</Text>
        </View>

      </ScrollView>
      )}

      {/* Massive Bottom CTA (only shown if ordering new stand and pricing is shown) */}
      {showPricingPackages && (!existingOrder || showOrderNewPurchase) && (
        <View style={styles.bottomCtaArea}>
          <TouchableOpacity
            onPress={() => setShowCheckoutSheet(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#FACC15', '#EAB308']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.massiveBtn}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={styles.massiveBtnText}>Order Smart Stand Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ======================================= */}
      {/* SHIPPING & PAYMENT BOTTOM SHEET MODAL */}
      {/* ======================================= */}
      <Modal visible={showCheckoutSheet} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowCheckoutSheet(false)} />
          
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Shipping Details</Text>
              <TouchableOpacity onPress={() => setShowCheckoutSheet(false)} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Recipient Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Full Name"
                  placeholderTextColor="#475569"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.inputLabel}>WhatsApp Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={whatsappPhone}
                  onChangeText={setWhatsappPhone}
                  placeholder="e.g. 012345678"
                  placeholderTextColor="#475569"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Address Line 1 */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Street Address (Line 1)</Text>
                <TextInput
                  style={styles.textInput}
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="House / Unit No, Building, Street Name"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* Address Line 2 */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Unit / Area (Line 2 - Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  placeholder="Floor, Taman, Apartment, Landmark"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* Postcode & City (2 Columns) */}
              <View style={styles.rowInputs}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Postcode</Text>
                  <TextInput
                    style={styles.textInput}
                    value={postcode}
                    onChangeText={(t) => setPostcode(t.replace(/\D/g, '').slice(0, 5))}
                    placeholder="e.g. 50470"
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>

                <View style={[styles.formField, { flex: 1.4 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. Kuala Lumpur"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              {/* State */}
              <View style={styles.formField}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.textInput}
                  value={state}
                  onChangeText={setState}
                  placeholder="e.g. Selangor / WP Kuala Lumpur"
                  placeholderTextColor="#475569"
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 10, marginBottom: 8 }]}>Payment Method</Text>
              <View style={styles.paymentGrid}>
                {['fpx', 'card', 'whatsapp'].map((method) => {
                  const isActive = paymentMethod === method;
                  let icon = "business-outline";
                  let label = "FPX Online";
                  if (method === 'card') { icon = "card-outline"; label = "Card"; }
                  if (method === 'whatsapp') { icon = "logo-whatsapp"; label = "WhatsApp"; }
                  
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[styles.payOption, isActive && styles.payOptionActive]}
                      onPress={() => setPaymentMethod(method as any)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon as any} size={20} color={isActive ? '#FFC700' : '#64748B'} />
                      <Text style={[styles.payOptionText, isActive && { color: '#FFF' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                onPress={handleCheckout}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#FFD700', '#F59E0B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.finalPayBtn, isSubmitting && { opacity: 0.8 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.finalPayBtnText}>Pay RM {selectedPkg.price} Now</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={completedOrder !== null} transparent={true} animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-sharp" size={32} color="#000" />
            </View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSub}>Thank you. Your smart stand will be shipped out within 24 hours.</Text>
            <TouchableOpacity
              style={styles.finalPayBtn}
              onPress={() => {
                setCompletedOrder(null);
                router.back();
              }}
            >
              <Text style={styles.finalPayBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure pitch black
  },
  backBtnAbsolute: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 100,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroWrapper: {
    width: '100%',
    height: 380, // Optimized height to showcase stand while bringing packages into view
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  fadeOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 180,
    zIndex: 3,
  },
  titleArea: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -55, // Smooth blend into gradient
    zIndex: 10,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  logoImage: {
    height: 28,
    width: 95,
    tintColor: '#FFFFFF',
  },
  proBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
  },
  proBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  packagesContainer: {
    paddingHorizontal: 20,
    marginTop: 6,
    gap: 10,
  },
  pkgCard: {
    position: 'relative',
    backgroundColor: '#111114',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
  },
  pkgCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: 'rgba(255, 199, 0, 0.04)',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 10,
  },
  recommendedBadgeText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pkgLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFC700',
  },
  pkgTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#E5E5E5',
    letterSpacing: -0.3,
  },
  pkgFinalPrice: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#A1A1AA',
  },
  pkgOriginalPrice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    textDecorationLine: 'line-through',
    color: '#555',
  },
  discountPill: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountPillActive: {
    backgroundColor: '#FFC700',
  },
  discountPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#888',
  },
  pkgDescriptionBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  pkgDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pkgDescriptionText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 199, 0, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.15)',
  },
  trustBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#222225',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginHorizontal: 4,
    gap: 10,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerLinkText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#666',
    textDecorationLine: 'underline',
  },
  bottomCtaArea: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(0,0,0,0.85)', // Slight dark blur to contrast button
  },
  massiveBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  massiveBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 20,
    padding: 8,
  },
  sheetContent: {
    padding: 24,
  },
  formField: {
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 14,
    padding: 16,
    color: '#FFF',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  payOption: {
    flex: 1,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  payOptionActive: {
    borderColor: '#FFC700',
    backgroundColor: 'rgba(255,199,0,0.08)',
    borderWidth: 1.5,
  },
  payOptionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  sheetFooter: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  finalPayBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  finalPayBtnText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  curiosityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 30,
    marginTop: 20,
    borderRadius: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  curiosityBtnText: {
    color: '#FFC700',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.2,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },

  // Stand Activation Code Card (Dark Aesthetic)
  activationCard: {
    backgroundColor: '#111114',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  activationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  activationSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A1A1AA',
    marginTop: 2,
  },
  activationBody: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  activationInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activationInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  redeemBtn: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  codeErrorText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 8,
  },
  codeSuccessText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#10B981',
    marginTop: 8,
  },
});
