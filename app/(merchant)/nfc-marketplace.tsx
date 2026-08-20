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
  Image
} from 'react-native';
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
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [standCodeInput, setStandCodeInput] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');

  // Form State
  const [storeName, setStoreName] = useState('');
  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [whatsappPhone, setWhatsappPhone] = useState(user?.phone || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'fpx' | 'card' | 'whatsapp'>('fpx');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPkg = PACKAGES.find(p => p.id === selectedPackageId) || PACKAGES[1];

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
    if (!recipientName.trim() || !whatsappPhone.trim() || !shippingAddress.trim()) {
      Alert.alert('Perhatian', 'Sila lengkapkan semua butiran penghantaran.');
      return;
    }

    setIsSubmitting(true);
    const orderData = {
      orderId: `NFC-${Date.now().toString(36).toUpperCase()}`,
      package: selectedPkg.title,
      amount: selectedPkg.price,
      storeName: storeName.trim(),
      recipientName: recipientName.trim(),
      phone: whatsappPhone.trim(),
      fullAddress: shippingAddress.trim(),
      paymentMethod: paymentMethod,
    };

    if (paymentMethod === 'whatsapp') {
      setIsSubmitting(false);
      const textMsg = encodeURIComponent(
        `*Tempahan RiseV Smart Stand*\n\n` +
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
    }, 1200);
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Massive Hero Section Fading Into Black */}
        <View style={styles.heroWrapper}>
          <Image 
            source={require('../../assets/nfc-hero.png')} 
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

        {/* Stand Code Redemption Box (TikTok Shop / Shopee package fulfillment) */}
        <View style={styles.activationCard}>
          <TouchableOpacity 
            style={styles.activationHeader}
            onPress={() => setShowCodeBox(!showCodeBox)}
            activeOpacity={0.85}
          >
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
            <View style={styles.chevronCircle}>
              <Ionicons name={showCodeBox ? "chevron-up" : "chevron-down"} size={16} color="#CBD5E1" />
            </View>
          </TouchableOpacity>

          {showCodeBox && (
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
                  style={styles.redeemBtn}
                  onPress={handleRedeemCode}
                  disabled={isRedeemingCode}
                  activeOpacity={0.85}
                >
                  {isRedeemingCode ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.redeemBtnText}>Redeem</Text>
                  )}
                </TouchableOpacity>
              </View>

              {codeError ? (
                <Text style={styles.codeErrorText}>{codeError}</Text>
              ) : null}

              {codeSuccess ? (
                <Text style={styles.codeSuccessText}>{codeSuccess}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Packages List (Vidart Pro Style) */}
        <View style={styles.packagesContainer}>
          {PACKAGES.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.pkgCard, isSelected && styles.pkgCardSelected]}
                onPress={() => setSelectedPackageId(pkg.id)}
                activeOpacity={0.9}
              >
                <View style={styles.pkgRow}>
                  <View style={styles.pkgLeft}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <Ionicons name="checkmark-sharp" size={12} color="#000" />}
                    </View>
                    <View>
                      <Text style={[styles.pkgTitle, isSelected && { color: '#FFF' }]}>{pkg.title}</Text>
                      <Text style={styles.pkgTagline}>{pkg.tagline}  <Text style={styles.pkgOriginalPrice}>RM{pkg.originalPrice}</Text></Text>
                    </View>
                  </View>

                  <View style={[styles.discountPill, isSelected && styles.discountPillActive]}>
                    <Text style={[styles.discountPillText, isSelected && { color: '#FFF' }]}>
                      {pkg.discountBadge}
                    </Text>
                  </View>
                </View>
                
                {isSelected && (
                  <View style={styles.pkgDescriptionBox}>
                    {pkg.description.map((item, index) => (
                      <View key={index} style={styles.pkgDescRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text style={styles.pkgDescriptionText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={styles.disclaimerText}>
            *Note: WhatsApp Automation, Additional Branches, and Extra Database Quota can be added later via monthly subscription plans in your dashboard.
          </Text>
        </View>

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <Text style={styles.footerLinkText}>How it works</Text>
          <Text style={styles.footerLinkText}>Restore Purchase</Text>
          <Text style={styles.footerLinkText}>Privacy Policy</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Massive Bottom CTA */}
      <View style={styles.bottomCtaArea}>
        <TouchableOpacity
          onPress={() => setShowCheckoutSheet(true)}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#FF4B72', '#E11D48']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.massiveBtn}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={styles.massiveBtnText}>Order Smart Stand Now</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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

              <View style={styles.formField}>
                <Text style={styles.inputLabel}>Full Address & Postcode</Text>
                <TextInput
                  style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                  value={shippingAddress}
                  onChangeText={setShippingAddress}
                  placeholder="Detailed shipping address..."
                  placeholderTextColor="#475569"
                  multiline
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  packagesContainer: {
    paddingHorizontal: 20,
    marginTop: 6,
    gap: 10,
  },
  pkgCard: {
    backgroundColor: '#141415',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
    overflow: 'hidden',
  },
  pkgCardSelected: {
    borderColor: '#333',
    backgroundColor: '#1A1A1C',
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
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  pkgTitle: {
    fontSize: 14, // Smaller to be more compact
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#E5E5E5',
    letterSpacing: -0.3, // Pull letters closer
  },
  pkgTagline: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#888',
    marginTop: 4,
  },
  pkgOriginalPrice: {
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
    backgroundColor: '#FF3366', // Vidart hot pink
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
  disclaimerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 10,
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
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  massiveBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
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
    marginBottom: 20,
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
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000',
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
    backgroundColor: '#111113',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  activationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 199, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  activationSubtitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 1,
  },
  chevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  activationInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activationInput: {
    flex: 1,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#242428',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  redeemBtn: {
    backgroundColor: '#FFC700',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  codeErrorText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 6,
  },
  codeSuccessText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#10B981',
    marginTop: 6,
  },
});
