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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { colors, radii } from '@/theme';

export default function NfcLandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ m: string }>();
  const { user, quickRegister } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth > 768;

  const [merchant, setMerchant] = useState<any>(null);
  const [step, setStep] = useState<'loading' | 'form' | 'sent' | 'invalid'>('loading');
  const [invalidReason, setInvalidReason] = useState('');

  const [nameInput, setNameInput] = useState(user?.name || '');
  const [phoneInput, setPhoneInput] = useState(user?.phone ? user.phone.replace('+60', '').replace('+', '') : '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch & Validate Merchant on Mount
  useEffect(() => {
    (async () => {
      const merchantId = params.m;
      if (!merchantId) {
        setInvalidReason('No merchant ID provided in NFC link.');
        setStep('invalid');
        return;
      }

      try {
        const m = await pb.collection('merchants').getOne(merchantId);
        if (!m || m.status === 'suspended' || m.status === 'rejected') {
          setInvalidReason('This store is currently not accepting stamps.');
          setStep('invalid');
          return;
        }
        setMerchant(m);
        setStep('form');
      } catch (err) {
        setInvalidReason('Invalid or expired NFC merchant link.');
        setStep('invalid');
      }
    })();
  }, [params.m]);

  const merchantName = merchant?.name || 'Risev Merchant';
  const merchantPhone = merchant?.phone || '';

  // 2. Submit NFC Notification & Open WhatsApp
  const handleNfcSubmit = async () => {
    if (!nameInput.trim() || !phoneInput.trim()) {
      setErrorMsg('Please enter your full name and phone number.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      let digits = phoneInput.trim().replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const cleanPhone = '+' + digits;

      // Quick register or retrieve account in background
      await quickRegister(nameInput.trim(), cleanPhone);

      // Generate random 6-char NFC session code
      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Build WhatsApp message
      const message =
        `Hi ${merchantName}! I scanned your NFC card to claim stamps.\n\n` +
        `Name: ${nameInput.trim()}\n` +
        `Phone: ${cleanPhone}\n` +
        `Merchant: ${merchant.id}\n` +
        `NFC: ${sessionCode}`;

      let waPhone = merchantPhone.replace(/[^\d]/g, '');
      if (waPhone.startsWith('0')) waPhone = '6' + waPhone;
      if (!waPhone.startsWith('60') && waPhone.length >= 9) waPhone = '60' + waPhone;

      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

      if (Platform.OS === 'web') {
        window.open(waUrl, '_blank');
      } else {
        await Linking.openURL(waUrl);
      }

      setStep('sent');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit NFC claim.');
    } finally {
      setIsLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
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
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.headerRow, isDesktop && { maxWidth: 520, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{merchantName}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 520, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Store Card Header */}
        <View style={styles.merchantCard}>
          <View style={styles.nfcBadge}>
            <Ionicons name="wifi-outline" size={16} color="#0F172A" />
            <Text style={styles.nfcBadgeText}>NFC CARD SCANNED</Text>
          </View>
          <Text style={styles.merchantName}>{merchantName}</Text>
          <Text style={styles.merchantSubtext}>Tap below to notify store & receive your stamps</Text>
        </View>

        {/* Step 1: Form */}
        {step === 'form' && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Claim Your Stamps</Text>
            <Text style={styles.formSubtitle}>Enter your details to notify {merchantName}.</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={20} color="#64748B" style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                  placeholder="e.g. Fazli"
                  placeholderTextColor="#BEC6E0"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                />
              </View>
            </View>

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
                  placeholderTextColor="#BEC6E0"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (!nameInput.trim() || !phoneInput.trim() || isLoading) && styles.primaryBtnDisabled]}
              onPress={handleNfcSubmit}
              disabled={!nameInput.trim() || !phoneInput.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Notify Merchant via WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Sent Confirmation */}
        {step === 'sent' && (
          <View style={styles.formCard}>
            <View style={styles.sentIconWrap}>
              <Ionicons name="checkmark-circle" size={54} color="#10B981" />
            </View>
            <Text style={styles.formTitle}>Notification Sent!</Text>
            <Text style={styles.sentBody}>
              {merchantName} has been notified on their screen. They will confirm your stamps shortly!
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
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
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  invalidSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
  },
  merchantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nfcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  nfcBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  merchantName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  merchantSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
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
    fontWeight: '700',
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
    color: '#0F172A',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 12,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#000000',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sentIconWrap: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  sentBody: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
});
