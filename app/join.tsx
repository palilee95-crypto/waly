import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { useRouter, useLocalSearchParams } from 'expo-router';

type Step = 'loading' | 'invalid' | 'phone_entry' | 'login' | 'register' | 'send_whatsapp' | 'sent';

export default function JoinScreen() {
  const router = useRouter();
  const { user, isAuthenticated, loginWithIdentifier, register, checkPhone, quickRegister } = useAuth();
  const params = useLocalSearchParams<{ m: string; bill: string; stamps: string; t: string }>();

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [step, setStep] = useState<Step>('loading');
  const [invalidReason, setInvalidReason] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantPhone, setMerchantPhone] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('');

  // Auth form state
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [birthdayInput, setBirthdayInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Validate QR on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!params.t || !params.m) {
        setInvalidReason('Invalid QR code');
        setStep('invalid');
        return;
      }

      try {
        const res = await pb.send<{ valid: boolean; reason?: string; merchantName?: string; merchantPhone?: string; billAmount?: number; stampAmount?: number }>(
          '/api/risev/qr/validate',
          { method: 'GET', params: { t: params.t, m: params.m }, requestKey: null }
        );

        if (!res.valid) {
          setInvalidReason(res.reason === 'already_used' ? 'This QR code has already been used.' : 'This QR code has expired.');
          setStep('invalid');
          return;
        }

        setMerchantName(res.merchantName || '');
        setMerchantPhone(res.merchantPhone || '');
        setBillAmount(String(res.billAmount || params.bill || ''));
        setStampAmount(String(res.stampAmount || params.stamps || ''));

        // If already authenticated, go straight to send
        if (isAuthenticated) {
          setStep('send_whatsapp');
        } else {
          setStep('phone_entry');
        }
      } catch (err) {
        setInvalidReason('Failed to validate QR code.');
        setStep('invalid');
      }
    })();
  }, []);

  // ── If user logs in during the flow, advance to send ─────────────
  useEffect(() => {
    if (isAuthenticated && (step === 'phone_entry' || step === 'login' || step === 'register')) {
      setStep('send_whatsapp');
    }
  }, [isAuthenticated, step]);

  // ── Phone entry → check if exists ─────────────────────────────────
  const handlePhoneCheck = async () => {
    if (!phoneInput.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Format phone with +60 prefix (e.g. +60123456789)
      let digits = phoneInput.trim().replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const phone = '+' + digits;

      const res = await checkPhone(phone);
      if (res.exists) {
        // Existing user → login
        setPhoneInput(phone);
        setStep('login');
      } else {
        // New user → register
        setPhoneInput(phone);
        setStep('register');
      }
    } catch (err) {
      setErrorMsg('Failed to check phone number.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!passwordInput) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithIdentifier(phoneInput, passwordInput);
      // useEffect will advance to send_whatsapp
    } catch (err: any) {
      setErrorMsg('Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!emailInput || !nameInput || !passwordInput || !confirmPassword || !birthdayInput) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (passwordInput !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (passwordInput.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await register(phoneInput, emailInput, nameInput, passwordInput, 'customer', birthdayInput);
      // useEffect will advance to send_whatsapp
    } catch (err: any) {
      setErrorMsg(err?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send WhatsApp ─────────────────────────────────────────────────
  const buildWhatsAppMessage = () => {
    const customerName = user?.name || nameInput || 'Customer';
    const customerPhone = user?.phone || phoneInput || '';
    return (
      `Hi ${merchantName}, I'd like to claim my stamps.\n\n` +
      `Name: ${customerName}\n` +
      `Phone: ${customerPhone}\n` +
      `Bill: RM${billAmount}\n` +
      `Stamps: ${stampAmount}\n` +
      `TxID: ${params.t}`
    );
  };

  const handleSendWhatsApp = async () => {
    // Mark QR as sent
    try {
      await pb.send('/api/risev/qr/mark-sent', {
        method: 'POST',
        body: { tx_code: params.t, customer_phone: user?.phone || phoneInput },
        requestKey: null,
      });
    } catch (err) {
      // Non-fatal — continue to WhatsApp
    }

    // Open WhatsApp with pre-filled message
    const message = buildWhatsAppMessage();
    let cleanPhone = merchantPhone.replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '6' + cleanPhone;
    if (!cleanPhone.startsWith('60') && cleanPhone.length >= 9) cleanPhone = '60' + cleanPhone;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web') {
      window.open(waUrl, '_blank');
    } else {
      await Linking.openURL(waUrl);
    }

    setStep('sent');
  };

  // ── Auto-format birthday ──────────────────────────────────────────
  const formatBirthday = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length >= 4) formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    if (cleaned.length >= 6) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7, 10);
    return formatted.slice(0, 10);
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Validating QR code...</Text>
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
          <Text style={styles.invalidTitle}>QR Invalid</Text>
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
        {/* Merchant Info Card */}
        <View style={styles.merchantCard}>
          {merchantName ? (
            <Text style={styles.merchantName}>{merchantName}</Text>
          ) : null}
          <View style={styles.merchantInfoRow}>
            <View style={styles.merchantInfoItem}>
              <Text style={styles.merchantInfoLabel}>BILL</Text>
              <Text style={styles.merchantInfoValue}>RM {billAmount}</Text>
            </View>
            <View style={styles.merchantInfoDivider} />
            <View style={styles.merchantInfoItem}>
              <Text style={styles.merchantInfoLabel}>STAMPS</Text>
              <Text style={styles.merchantInfoValue}>{stampAmount}</Text>
            </View>
          </View>
        </View>

        {/* Step Content */}
        {(step === 'phone_entry' || step === 'register') && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Claim Your Stamps</Text>
            <Text style={styles.formSubtitle}>Enter your details to receive stamps from {merchantName}.</Text>

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
              onPress={async () => {
                if (!nameInput.trim() || !phoneInput.trim()) {
                  setErrorMsg('Please enter your name and phone number.');
                  return;
                }
                setIsLoading(true);
                setErrorMsg('');
                try {
                  let digits = phoneInput.trim().replace(/\D/g, '');
                  if (digits.startsWith('0')) digits = '6' + digits;
                  if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
                  const phone = '+' + digits;

                  await quickRegister(nameInput.trim(), phone);
                  await handleSendWhatsApp();
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Failed to claim stamps.');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={!nameInput.trim() || !phoneInput.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Claim Stamps via WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === 'send_whatsapp' && (
          <View style={styles.formCard}>
            <View style={styles.whatsappIconWrap}>
              <Ionicons name="logo-whatsapp" size={40} color="#000000" />
            </View>
            <Text style={styles.formTitle}>Send to {merchantName}</Text>
            <Text style={styles.formSubtitle}>
              Tap send to open WhatsApp and deliver your stamp request. {merchantName} will confirm your stamps automatically.
            </Text>

            {/* Pre-filled message preview */}
            <View style={styles.messagePreview}>
              <Text style={styles.messagePreviewText}>{buildWhatsAppMessage()}</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendWhatsApp} activeOpacity={0.8}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Send via WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'sent' && (
          <View style={styles.formCard}>
            <View style={styles.sentIconWrap}>
              <Ionicons name="checkmark-circle" size={48} color="#000000" />
            </View>
            <Text style={styles.formTitle}>Message sent!</Text>
            <Text style={styles.formSubtitle}>
              We've opened WhatsApp with your message. After you send it, {merchantName} will confirm your stamps automatically.
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(customer)')} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 12 },
  invalidWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  invalidIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  invalidTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: 8 },
  invalidSubtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 56, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  // Merchant card
  merchantCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' },
  merchantName: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 12 },
  merchantInfoRow: { flexDirection: 'row', alignItems: 'center' },
  merchantInfoItem: { alignItems: 'center', paddingHorizontal: 20 },
  merchantInfoLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5, marginBottom: 4 },
  merchantInfoValue: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  merchantInfoDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  // Form card
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, marginBottom: 20 },
  formTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: 6, textAlign: 'center' },
  formSubtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  // Input
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, height: 52 },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000', paddingHorizontal: 12 },
  prefixBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  flag: { fontSize: 18 },
  prefixCode: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginLeft: 4 },
  prefixDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginLeft: 10 },
  // Button
  primaryBtn: { backgroundColor: '#000000', height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  primaryBtnDisabled: { backgroundColor: '#E2E8F0' },
  primaryBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' },
  // Error
  errorText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#EF4444', marginTop: 8 },
  // Link
  linkText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', textAlign: 'center', marginTop: 16 },
  // WhatsApp preview
  whatsappIconWrap: { alignItems: 'center', marginBottom: 16 },
  messagePreview: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 20 },
  messagePreviewText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', lineHeight: 20 },
  // Sent
  sentIconWrap: { alignItems: 'center', marginBottom: 16 },
});