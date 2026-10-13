import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  useWindowDimensions,
  Animated,
  Modal,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, storage } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { validateEmailWithTypoCheck, parseAndNormalizeBirthday, formatMalaysianPhone, getFullMalaysianPhone } from '@/lib/emailValidator';
import { TurnstileWidget, TurnstileWidgetRef } from '@/components/TurnstileWidget';

const { width } = Dimensions.get('window');
const COUNTRY_CODE = '+60';

export default function LoginScreen() {
  const router = useRouter();
  const { checkPhone, register, resendVerificationEmail, loginWithIdentifier, requestPasswordReset, isAuthenticated, isLoading: isAuthLoading, activeRole } = useAuth();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetModalIdentifier, setResetModalIdentifier] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = React.useRef<TurnstileWidgetRef>(null);

  const params = useLocalSearchParams<{ ref?: string; prefill_phone?: string; prefill_name?: string; redirect_to?: string; step?: string }>();

  const getRedirectUrl = () => {
    let raw = params?.redirect_to;
    if (!raw && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search);
        raw = sp.get('redirect_to') || '';
      } catch (e) {}
    }
    if (!raw) return '';
    // Must be a relative path starting with a single '/' and not containing '//', '\', or ':'
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !raw.includes(':')) {
      return raw;
    }
    return '';
  };

  useEffect(() => {
    const redirectUrl = getRedirectUrl();
    if (!isAuthLoading && isAuthenticated) {
      setTimeout(() => {
        if (redirectUrl) {
          router.replace(redirectUrl as any);
        } else {
          router.replace(activeRole === 'merchant' ? '/(merchant)' : '/(customer)');
        }
      }, 100);
    }
  }, [isAuthLoading, isAuthenticated, activeRole, params.redirect_to]);

  useEffect(() => {
    if (params.ref) {
      storage.setItem('risev_referral_code', params.ref)
        .then(() => {
          console.log('[Login] Stored referral code:', params.ref);
          pb.send(`/api/risev/agent/click?ref=${encodeURIComponent(params.ref || '')}`, { method: 'GET' })
            .catch(err => console.warn('[Login] Failed to record click:', err));
        });
    }
  }, [params.ref]);

  // Pre-fill phone from NFC claim redirect and auto-advance past phone step
  useEffect(() => {
    if (!params.prefill_phone) return;
    const formatted = formatMalaysianPhone(params.prefill_phone);
    if (formatted.length < 8) return;
    setPhone(formatted);
    // Pre-fill name if passed from NFC page
    if (params.prefill_name && params.prefill_name.trim()) {
      setName(params.prefill_name.trim());
    }
    // Directly check the pre-filled phone (don't rely on stale state)
    const fullPhone = getFullMalaysianPhone(formatted);
    setIsLoading(true);
    checkPhone(fullPhone)
      .then((res) => {
        if (res.exists) {
          const isFullyRegistered = !res.is_shadow && res.verified === true;
          if (isFullyRegistered) {
            setEmail(res.email || fullPhone);
            setStep('password');
          } else {
            if (res.name && !res.name.startsWith('User ') && !res.name.startsWith('Staff (') && !res.name.startsWith('Customer ')) {
              setName(res.name);
            }
            setStep('register-name');
          }
        } else {
          setStep('register-name');
        }
      })
      .catch((e: any) => {
        console.warn('[Login] prefill phone check failed:', e?.message);
      })
      .finally(() => setIsLoading(false));
  }, [params.prefill_phone, params.prefill_name]);
  
  // New Registration fields and state machine steps
  const [step, setStep] = useState<'phone' | 'register-name' | 'register-email' | 'register-password' | 'password' | 'verify-email'>('phone');

  useEffect(() => {
    if (params.step) {
      const validSteps = ['phone', 'register-name', 'register-email', 'register-password', 'password', 'verify-email'];
      if (validSteps.includes(params.step)) {
        setStep(params.step as any);
      }
    }
  }, [params.step]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [datePickerModalVisible, setDatePickerModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const isoToDdMmYyyy = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return iso;
  };

  const ddMmYyyyToIso = (dmy: string) => {
    if (!dmy) return '';
    const parts = dmy.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dmy;
  };

  const formatDisplayBirthday = (dmy: string) => {
    if (!dmy) return '';
    const parts = dmy.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[2];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (months[monthIdx]) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return dmy;
  };

  // Pulsing animation for the verification waiting window
  useEffect(() => {
    if (step !== 'verify-email') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          duration: 900,
          toValue: 1,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  // Live Auto-Detection: Polling verification status in real-time
  useEffect(() => {
    if (step !== 'verify-email' || isAutoLoggingIn || isVerifiedSuccess || !phone || !phone.trim()) return;

    const fullPhone = getFullPhone();
    const interval = setInterval(async () => {
      try {
        const res = await checkPhone(fullPhone);
        if (res && res.exists && res.verified) {
          setIsVerifiedSuccess(true);
          setIsAutoLoggingIn(true);
          clearInterval(interval);

          setTimeout(async () => {
            try {
              const loginIdentifier = email || fullPhone;
              const record: any = await loginWithIdentifier(loginIdentifier, password);
              const userRole = record?.role || 'customer';
              const redirectUrl = getRedirectUrl();
              if (redirectUrl) {
                router.replace(redirectUrl as any);
              } else {
                router.replace(userRole === 'merchant' ? '/(merchant)' : '/(customer)');
              }
            } catch (err: any) {
              console.warn('[Auto-Login Error after Verify]:', err);
              setIsAutoLoggingIn(false);
              setStep('password');
            }
          }, 1200);
        }
      } catch (err) {
        // Ignore transient background errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [step, email, password, isAutoLoggingIn, isVerifiedSuccess]);
  
  const [emailFocused, setEmailFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [birthdayFocused, setBirthdayFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const formatPhone = (text: string) => {
    const clean = formatMalaysianPhone(text);
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return `${clean.slice(0, 2)} ${clean.slice(2)}`;
    if (clean.length <= 9) return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
    return `${clean.slice(0, 2)} ${clean.slice(2, 6)} ${clean.slice(6, 10)}`;
  };
  const getFullPhone = () => getFullMalaysianPhone(phone);
  const cleanPhoneDigits = phone.replace(/\D/g, '');
  const isValid = cleanPhoneDigits.length >= 9 && cleanPhoneDigits.length <= 10;

  const getMaskedPhone = () => {
    const clean = cleanPhoneDigits || phone.replace(/\D/g, '');
    if (clean.length >= 4) {
      return clean.slice(-4);
    }
    return clean || '1414';
  };

  const formatBirthdayDayMonth = (dmy: string) => {
    if (!dmy) return '';
    const parts = dmy.split('-');
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (months[monthIdx]) {
        return `${day} ${months[monthIdx]}`;
      }
    }
    return dmy;
  };

  const openBirthdayPicker = () => {
    if (Platform.OS === 'web') {
      const el = document.getElementById('risev-birthday-input');
      if (el) {
        if (typeof (el as any).showPicker === 'function') {
          (el as any).showPicker();
        } else {
          (el as any).focus();
          (el as any).click();
        }
      }
    } else {
      setDatePickerModalVisible(true);
    }
  };

  const handleGetStarted = async () => {
    if (!isValid) return;
    setIsLoading(true);
    try {
      const fullPhone = getFullPhone();
      const res = await checkPhone(fullPhone);
      if (res.exists) {
        const isFullyRegistered = !res.is_shadow && res.verified === true;
        if (isFullyRegistered) {
          setEmail(res.email || fullPhone);
          setStep('password');
        } else {
          // Quick-registered / Shadow Staff returning to complete account setup!
          if (res.name && !res.name.startsWith('User ') && !res.name.startsWith('Staff (') && !res.name.startsWith('Customer ')) {
            setName(res.name);
          }
          setStep('register-name');
        }
      } else {
        // New user starts registration wizard
        setStep('register-name');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to check phone number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceFromName = () => {
    setErrorMsg('');
    if (!name || name.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!birthday || !birthday.trim()) {
      setErrorMsg('Please add your birthday to continue.');
      return;
    }
    const bdayCheck = parseAndNormalizeBirthday(birthday);
    if (!bdayCheck.isValid) {
      setErrorMsg(bdayCheck.error || 'Please enter a valid birthday (DD-MM-YYYY).');
      return;
    }
    setStep('register-email');
  };

  const handleAdvanceFromEmail = () => {
    setErrorMsg('');
    if (!email || !email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    const check = validateEmailWithTypoCheck(email.trim());
    if (!check.isValid) {
      setErrorMsg(check.error || 'Please enter a valid email address.');
      return;
    }
    setStep('register-password');
  };

  const handleOpenEmailApp = async () => {
    const trimmed = (email || '').toLowerCase().trim();
    if (Platform.OS === 'web') {
      if (trimmed.includes('@gmail.com') || trimmed.includes('@googlemail.com')) {
        window.open('https://mail.google.com', '_blank');
        return;
      }
      if (trimmed.includes('@outlook.com') || trimmed.includes('@hotmail.com') || trimmed.includes('@live.com')) {
        window.open('https://outlook.live.com', '_blank');
        return;
      }
      if (trimmed.includes('@yahoo.com') || trimmed.includes('@ymail.com')) {
        window.open('https://mail.yahoo.com', '_blank');
        return;
      }
      if (trimmed.includes('@icloud.com') || trimmed.includes('@me.com')) {
        window.open('https://www.icloud.com/mail', '_blank');
        return;
      }
      window.open('mailto:', '_blank');
    } else {
      try {
        const supported = await Linking.canOpenURL('message:');
        if (supported) {
          await Linking.openURL('message:');
        } else {
          await Linking.openURL('mailto:');
        }
      } catch {
        Linking.openURL('mailto:');
      }
    }
  };

  const handleResendLink = async () => {
    if (!email || resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    try {
      await resendVerificationEmail(email.trim().toLowerCase());
      setResendSuccess(true);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to resend verification link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBirthdayChange = (text: string) => {
    // If backspacing/deleting, don't auto-format so user can freely delete hyphens and digits
    if (text.length < birthday.length) {
      setBirthday(text);
      setErrorMsg('');
      return;
    }

    const clean = text.replace(/[^0-9\-\/]/g, '');
    // If entering pure digits without separators, auto-format as DD-MM-YYYY
    if (!clean.includes('-') && !clean.includes('/')) {
      let formatted = clean;
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}-${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 8)}`;
      }
      setBirthday(formatted.slice(0, 10));
    } else {
      setBirthday(clean.slice(0, 10));
    }
    setErrorMsg('');
  };

  const handleRegister = async () => {
    setErrorMsg('');

    if (!name || !name.trim()) {
      setErrorMsg('Please enter your name.');
      setStep('register-name');
      return;
    }
    const emailToUse = email.trim().toLowerCase();
    if (!emailToUse) {
      setErrorMsg('Please enter your email address.');
      setStep('register-email');
      return;
    }
    const emailCheck = validateEmailWithTypoCheck(emailToUse);
    if (!emailCheck.isValid) {
      setErrorMsg(emailCheck.error || 'Please enter a valid email address (e.g. user@gmail.com).');
      setStep('register-email');
      return;
    }
    if (!password) {
      setErrorMsg('Please create a password.');
      setStep('register-password');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      setStep('register-password');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      setStep('register-password');
      return;
    }

    if (!birthday || !birthday.trim()) {
      setErrorMsg('Please enter your birthday.');
      setStep('register-name');
      return;
    }
    const bdayCheck = parseAndNormalizeBirthday(birthday);
    if (!bdayCheck.isValid) {
      setErrorMsg(bdayCheck.error || 'Please enter a valid birthday in DD-MM-YYYY format (e.g. 01-09-2000).');
      setStep('register-name');
      return;
    }
    const birthDateToUse = bdayCheck.isoDate || '2000-01-01';

    setIsLoading(true);
    try {
      await register(getFullPhone(), emailToUse, name.trim(), password, 'customer', birthDateToUse);
      // Strict Mode: transition to Verify Email screen
      setStep('verify-email');
    } catch (e: any) {
      const rawMsg = e?.message || '';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('unique') || lower.includes('already exists')) {
        if (lower.includes('phone')) {
          setErrorMsg('This phone number is already registered.');
          setStep('phone');
        } else {
          setErrorMsg('This email address is already registered to another account.');
          setStep('register-email');
        }
      } else {
        setErrorMsg(rawMsg || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetIdentifier = email.trim() || getFullPhone() || phone;
    if (!targetIdentifier) {
      Alert.alert('Info', 'Please enter your phone number or email address first.');
      setStep('phone');
      return;
    }
    try {
      setIsLoading(true);
      await requestPasswordReset(targetIdentifier);
      setResetModalIdentifier(targetIdentifier);
      setResetModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send password reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    const targetIdentifier = email.trim() || getFullPhone() || phone;
    if (!targetIdentifier || !password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    if (Platform.OS === 'web' && !turnstileToken) {
      setErrorMsg('Please wait for security verification to finish.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithIdentifier(targetIdentifier, password, turnstileToken);
      const record = pb.authStore.record;
      const userRole = record?.role || 'customer';
      const redirectUrl = getRedirectUrl();
      if (redirectUrl) {
        router.replace(redirectUrl as any);
      } else {
        router.replace(userRole === 'merchant' ? '/(merchant)' : '/(customer)');
      }
    } catch (e: any) {
      console.warn(e);
      // Single-use token must be reset on any submission attempt / retry
      turnstileRef.current?.reset();
      setTurnstileToken('');
      const raw = e?.message || '';
      if (raw === 'EMAIL_NOT_VERIFIED' || raw.includes('EMAIL_NOT_VERIFIED') || raw.includes('verified')) {
        setErrorMsg('Please verify your email before logging in. Check your inbox for the link.');
      } else if (raw.includes('Security verification') || raw.includes('Human verification')) {
        setErrorMsg('Security check failed. Please complete the verification.');
      } else {
        setErrorMsg('Invalid credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  if (isAuthLoading || isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, isDesktop && { maxWidth: 440, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: (step === 'register-name' || step === 'register-email' || step === 'verify-email' || step === 'register-password' || step === 'password') ? 'space-between' : 'center' }}>
            {/* Main Clean Container (Full-screen native flow on phone, register-name, register-email, verify-email, register-password, password) */}
            <View style={[
              styles.mainCard,
              step === 'phone'
                ? styles.mainCardPhone
                : (step === 'register-name' || step === 'register-email' || step === 'verify-email' || step === 'register-password' || step === 'password') && styles.mainCardBorderlessPhone,
            ]}>
              {/* Header: Exact Mockup for Phone Login, Register Name, Register Email, and Verify Email */}
              {step === 'phone' ? (
                <View style={styles.heroSectionPhoneTop}>
                  <View style={styles.phoneHeroLockupRow}>
                    {/* Risev Logo */}
                    <Image
                      source={require('@/assets/risev logo.png')}
                      style={styles.heroLogoPhone}
                      resizeMode="contain"
                    />

                    {/* 3D Floating Reward Asset */}
                    <Image
                      source={require('@/assets/login-reward-hero.png')}
                      style={styles.hero3dPhoneLarge}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Value Prop Headline & Subtitle */}
                  <View style={styles.phoneHeadlineBlock}>
                    <Text style={styles.heroTitlePhone}>
                      Your favourite places.{'\n'}All together.
                    </Text>
                    <Text style={styles.heroSubtitlePhone}>
                      Collect stamps, unlock rewards, manage bookings, and enjoy birthday treats.
                    </Text>
                  </View>
                </View>
              ) : step === 'register-name' ? (
                <View style={styles.heroSectionRegister}>
                  {/* Official Risev Logo (Replaced WELCOME badge per user request) */}
                  <Image
                    source={require('@/assets/risev logo.png')}
                    style={styles.heroLogoRegister}
                    resizeMode="contain"
                  />

                  {/* 3D Floating Reward Asset */}
                  <Image
                    source={require('@/assets/login-reward-hero.png')}
                    style={styles.hero3dIllustration}
                    resizeMode="contain"
                  />

                  {/* Hero Headline & Subtitle */}
                  <View style={styles.heroTextContainer}>
                    <Text style={styles.heroTitle}>
                      Let’s make{'\n'}it yours.
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      Just one more step before{'\n'}collecting your stamps.
                    </Text>
                  </View>
                </View>
              ) : step === 'register-email' ? (
                <View style={styles.heroSectionEmail}>
                  {/* Top Bar with Risev Logo */}
                  <View style={styles.emailTopBar}>
                    <Image
                      source={require('@/assets/risev logo.png')}
                      style={styles.heroLogoEmail}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered 3D Envelope Illustration */}
                  <View style={styles.envelopeWrapper}>
                    <Image
                      source={require('@/assets/email-envelope-hero.png')}
                      style={styles.envelopeIllustration}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered Headline & Subtitle */}
                  <View style={styles.emailTextContainer}>
                    <Text style={styles.emailHeroTitle}>
                      Your rewards,{'\n'}wherever you go.
                    </Text>
                    <Text style={styles.emailHeroSubtitle}>
                      We’ll send your digital stamps, booking passes,{'\n'}and exclusive treats directly here.
                    </Text>
                  </View>
                </View>
              ) : step === 'verify-email' ? (
                <View style={styles.heroSectionEmail}>
                  {/* Top Bar with Risev Logo */}
                  <View style={styles.emailTopBar}>
                    <Image
                      source={require('@/assets/risev logo.png')}
                      style={styles.heroLogoEmail}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered 3D Checkmark Envelope Illustration */}
                  <View style={styles.envelopeWrapper}>
                    <Image
                      source={require('@/assets/email-verify-hero.png')}
                      style={styles.envelopeIllustration}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered Headline & Subtitle */}
                  <View style={styles.emailTextContainer}>
                    <Text style={styles.emailHeroTitle}>
                      Check your email.
                    </Text>
                    <Text style={styles.emailHeroSubtitle}>
                      We’ve sent you a verification link. Open your email and tap the link to confirm your address.
                    </Text>
                  </View>
                </View>
              ) : (step === 'register-password' || step === 'password') ? (
                <View style={styles.heroSectionPassword}>
                  {/* Top Bar with Risev Logo */}
                  <View style={styles.passwordTopBar}>
                    <Image
                      source={require('@/assets/risev logo.png')}
                      style={styles.heroLogoPassword}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered 3D Security Hero Illustration */}
                  <View style={styles.passwordHeroAssetWrapper}>
                    <Image
                      source={require('@/assets/password-security-hero.png')}
                      style={styles.passwordHeroAsset}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Centered Headline & Subtitle */}
                  <View style={styles.passwordTextContainer}>
                    <Text style={styles.passwordHeroTitle}>
                      {step === 'password' ? 'Welcome Back' : 'Create a Secure Password'}
                    </Text>
                    <Text style={styles.passwordHeroSubtitle}>
                      {step === 'password'
                        ? 'Enter your password to access your loyalty wallet.'
                        : 'Protect your vouchers, stamps, and points\nbalance with a secure password.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cardHeader}>
                  {/* Risev Logo */}
                  <Image
                    source={require('@/assets/risev logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />

                  <Text style={styles.cardTitle}>
                    {step === 'password'
                      ? 'Welcome Back'
                      : 'Your Favorite Spots, Rewarded.'}
                  </Text>

                  <Text style={styles.cardSubtitle}>
                    {step === 'password'
                      ? 'Enter your password to access your loyalty wallet.'
                      : 'Collect stamps, redeem free perks, and enjoy exclusive surprises on your birthday.'}
                  </Text>
                </View>
              )}

              {/* Input Form */}
              <View style={[styles.form, step === 'phone' && styles.phoneFormBottom]}>
                {/* NFC Pre-fill Banner */}
                {params.prefill_phone && step !== 'phone' && step !== 'verify-email' && (
                  <View style={styles.nfcPrefillBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.nfcPrefillText}>
                      📱 +60 {params.prefill_phone} — confirmed from your visit
                    </Text>
                  </View>
                )}

                {step === 'phone' && (
                  <View style={styles.phoneInputSection}>
                    <Text style={styles.phoneInputLabel}>MOBILE NUMBER</Text>
                    <View style={[
                      styles.phoneInputGroup,
                      isFocused && styles.phoneInputGroupFocused,
                    ]}>
                      <View style={styles.prefixBox}>
                        <Text style={styles.flag}>🇲🇾</Text>
                        <Text style={styles.prefixCode}>+60</Text>
                        <View style={styles.prefixDivider} />
                      </View>

                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="12 345 6789"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={phone}
                        onChangeText={(t) => setPhone(formatPhone(t))}
                        keyboardType="phone-pad"
                        editable={step === 'phone'}
                        autoFocus={step === 'phone'}
                        returnKeyType="done"
                        onSubmitEditing={handleGetStarted}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                      />

                      {isValid && (
                        <View style={{ paddingRight: 8 }}>
                          <Ionicons name="checkmark-circle" size={20} color="#000000" />
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {step === 'verify-email' && (
                  <View style={styles.verifyEmailSection}>
                    {isVerifiedSuccess ? (
                      /* Success Celebration State */
                      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                        <View style={styles.verifySuccessCircle}>
                          <Ionicons name="checkmark-circle" size={44} color="#16A34A" />
                        </View>

                        <Text style={styles.verifySuccessTitle}>
                          Email Verified! 🎉
                        </Text>

                        <Text style={styles.verifySuccessSub}>
                          Welcome to Risev! Logging you in now...
                        </Text>

                        <ActivityIndicator size="small" color="#000000" />
                      </View>
                    ) : (
                      <>
                        {resendSuccess && (
                          <View style={[styles.errorContainer, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginBottom: 12 }]}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={[styles.errorText, { color: '#065F46' }]}>Verification link resent! Please check your inbox.</Text>
                          </View>
                        )}

                        {/* Unified Verification Card */}
                        <View style={styles.unifiedVerifyCard}>
                          {/* Row 1: Email Row */}
                          <View style={styles.verifyCardRow}>
                            <View style={styles.verifyMailIconSquircle}>
                              <Ionicons name="mail" size={14} color="#FFFFFF" />
                            </View>
                            <Text style={styles.verifyCardEmailText} numberOfLines={1}>
                              {email || 'your email'}
                            </Text>
                          </View>

                          {/* Subtle Divider */}
                          <View style={styles.verifyCardDivider} />

                          {/* Row 2: Status Row with Risev Yellow Indicator */}
                          <View style={styles.verifyCardRow}>
                            <View style={styles.verifyYellowSpinnerWrapper}>
                              <ActivityIndicator size="small" color="#FFCC00" />
                            </View>
                            <Text style={styles.verifyCardStatusText}>
                              Waiting for confirmation...
                            </Text>
                          </View>
                        </View>

                        {/* Secondary Action 1: Didn't receive it? Resend link */}
                        <View style={styles.verifySecondaryRow}>
                          <Text style={styles.verifySecondaryText}>Didn’t receive it? </Text>
                          <TouchableOpacity
                            disabled={resendCooldown > 0 || isLoading}
                            onPress={handleResendLink}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={[styles.verifySecondaryLink, resendCooldown > 0 && { color: '#94A3B8' }]}>
                              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Secondary Action 2: Wrong email? Change address */}
                        <View style={styles.verifySecondaryRow}>
                          <Text style={styles.verifySecondaryText}>Wrong email? </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setErrorMsg('');
                              setStep('register-email');
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.verifySecondaryLink}>Change address</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Bottom Trust Badge */}
                        <View style={styles.verifyTrustContainer}>
                          <View style={styles.verifyTrustShield}>
                            <Ionicons name="checkmark" size={13} color="#000000" />
                          </View>
                          <View style={styles.verifyTrustDivider} />
                          <Text style={styles.verifyTrustText}>
                            Your account stays protected.
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}


                {/* ============================================================ */}
                {/* STEP 1: PHONE STEP ACTIONS                                    */}
                {/* ============================================================ */}
                {step === 'phone' && (
                  <View style={styles.phoneActionSection}>
                    {/* Primary Action Button */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
                      onPress={handleGetStarted}
                      disabled={!isValid || isLoading}
                      activeOpacity={0.85}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={[styles.primaryBtnText, !isValid && styles.primaryBtnTextDisabled]}>
                            Continue
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Trust Reassurance Badge (Golden Yellow Shield + Black Checkmark) */}
                    <View style={styles.trustBadgeRow}>
                      <View style={styles.yellowShieldWrap}>
                        <Ionicons name="shield" size={19} color="#FFCC00" />
                        <Ionicons name="checkmark" size={11} color="#000000" style={styles.shieldCheckmark} />
                      </View>
                      <Text style={styles.trustBadgeText}>Instant, secure and password-free login</Text>
                    </View>
                  </View>
                )}

                {/* ============================================================ */}
                {/* WIZARD STEP 1: NAME & BIRTHDAY                               */}
                {/* ============================================================ */}
                {step === 'register-name' && (
                  <View style={styles.registerNameSection}>
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Phone verified pill card */}
                    <TouchableOpacity
                      style={styles.phoneVerifiedCard}
                      onPress={() => {
                        setErrorMsg('');
                        setStep('phone');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.phoneVerifiedLeft}>
                        <Ionicons name="phone-portrait-outline" size={24} color="#000000" />
                        <View style={styles.phoneVerifiedTextCol}>
                          <Text style={styles.phoneVerifiedTitle}>Phone verified</Text>
                          <Text style={styles.phoneVerifiedSub}>+60 •••• {getMaskedPhone()}</Text>
                        </View>
                      </View>
                      <View style={styles.phoneChangeBadge}>
                        <Text style={styles.phoneChangeBadgeText}>Change</Text>
                        <Ionicons name="chevron-forward" size={12} color="#000000" />
                      </View>
                    </TouchableOpacity>

                    {/* WHAT SHOULD WE CALL YOU? input */}
                    <View style={styles.nameFieldGroup}>
                      <Text style={styles.nameFieldLabel}>WHAT SHOULD WE CALL YOU?</Text>
                      <View style={[styles.nameInputBox, nameFocused && styles.nameInputBoxFocused]}>
                        <TextInput
                          style={[styles.nameInput, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                          placeholder="e.g. Alex Tan"
                          placeholderTextColor="rgba(0, 0, 0, 0.35)"
                          value={name}
                          onChangeText={(t) => {
                            setName(t);
                            setErrorMsg('');
                          }}
                          autoFocus
                          returnKeyType="done"
                          onFocus={() => setNameFocused(true)}
                          onBlur={() => setNameFocused(false)}
                        />
                      </View>
                    </View>

                    {/* Birthday Celebration Card with Yellow border */}
                    <View style={styles.birthdayCard}>
                      <View style={styles.birthdayCardTopRow}>
                        <View style={styles.birthdayGiftSquircle}>
                          <Ionicons name="gift" size={24} color="#000000" />
                        </View>
                        <View style={styles.birthdayCardTextCol}>
                          <Text style={styles.birthdayCardTitle}>Your birthday deserves a little extra.</Text>
                          <Text style={styles.birthdayCardDesc}>
                            Add your birthday to discover special treats from participating stores.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.birthdayCardBottomRow}>
                        <Text style={styles.birthdayCardRequiredText}>Required · Day and month only</Text>
                        {birthday ? (
                          <View style={styles.birthdayActiveGroup}>
                            <TouchableOpacity
                              onPress={openBirthdayPicker}
                              style={styles.birthdayChipBtn}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.birthdayChipText}>🎉 {formatBirthdayDayMonth(birthday)}</Text>
                              <Ionicons name="chevron-forward" size={13} color="#000000" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setBirthday('')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={openBirthdayPicker}
                            style={styles.birthdayAddBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.birthdayAddBtnText}>Add birthday</Text>
                            <Ionicons name="chevron-forward" size={14} color="#000000" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Hidden Web HTML5 Date Picker */}
                      {Platform.OS === 'web' && (
                        React.createElement('input', {
                          type: 'date',
                          id: 'risev-birthday-input',
                          max: new Date().toISOString().split('T')[0],
                          min: '1920-01-01',
                          value: ddMmYyyyToIso(birthday),
                          onChange: (e: any) => {
                            const iso = e.target.value;
                            if (iso) {
                              setBirthday(isoToDdMmYyyy(iso));
                              setErrorMsg('');
                            } else {
                              setBirthday('');
                            }
                          },
                          style: {
                            position: 'absolute',
                            opacity: 0,
                            pointerEvents: 'none',
                            width: 0,
                            height: 0,
                          },
                        })
                      )}
                    </View>

                    {/* Primary Button: Continue -> */}
                    {(() => {
                      const isNameStepValid = Boolean(name && name.trim().length >= 2 && birthday && birthday.trim().length > 0);
                      return (
                        <TouchableOpacity
                          style={[styles.primaryBtn, !isNameStepValid && styles.primaryBtnDisabled]}
                          onPress={handleAdvanceFromName}
                          disabled={!isNameStepValid}
                          activeOpacity={0.85}
                        >
                          <View style={styles.btnContent}>
                            <Text style={[styles.primaryBtnText, !isNameStepValid && styles.primaryBtnTextDisabled]}>
                              Continue
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color={isNameStepValid ? '#FFFFFF' : '#94A3B8'} />
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Back Button: Change Phone Number */}
                    <TouchableOpacity 
                      onPress={() => {
                        setErrorMsg('');
                        setStep('phone');
                      }} 
                      style={styles.backToPhoneBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={14} color="#0F172A" style={{ marginRight: 6 }} />
                      <Text style={styles.backToPhoneText}>
                        Change phone number
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ============================================================ */}
                {/* WIZARD STEP 2: EMAIL ADDRESS (Your rewards, wherever you go) */}
                {/* ============================================================ */}
                {step === 'register-email' && (
                  <View style={styles.registerEmailSection}>
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Email Card Container */}
                    <View style={styles.emailFormCard}>
                      <Text style={styles.emailFieldLabel}>EMAIL ADDRESS</Text>
                      <View style={[styles.emailInputBox, emailFocused && styles.emailInputBoxFocused]}>
                        <TextInput
                          style={[styles.emailInput, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                          placeholder="you@example.com"
                          placeholderTextColor="rgba(0, 0, 0, 0.35)"
                          value={email}
                          onChangeText={(t) => {
                            setEmail(t);
                            setErrorMsg('');
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={handleAdvanceFromEmail}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                        />
                      </View>

                      {/* Domain Typo Suggestion Helper */}
                      {email.length > 0 && (() => {
                        const check = validateEmailWithTypoCheck(email);
                        if (!check.isValid && check.suggestedEmail) {
                          return (
                            <TouchableOpacity
                              onPress={() => {
                                setEmail(check.suggestedEmail!);
                                setErrorMsg('');
                              }}
                              activeOpacity={0.8}
                              style={styles.emailSuggestionPill}
                            >
                              <Ionicons name="sparkles" size={14} color="#D97706" />
                              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#92400E', flex: 1 }}>
                                Did you mean <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', textDecorationLine: 'underline' }}>{check.suggestedEmail}</Text>? Tap to fix
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                        if (!check.isValid && check.error) {
                          return <Text style={styles.fieldHelperError}>⚠️ {check.error}</Text>;
                        }
                        return null;
                      })()}

                      {/* Benefit Row 1: Booking receipts */}
                      <View style={styles.benefitRow}>
                        <View style={styles.benefitIconSquircle}>
                          <Ionicons name="document-text-outline" size={20} color="#000000" />
                        </View>
                        <View style={styles.benefitTextCol}>
                          <Text style={styles.benefitTitle}>Receive booking receipts</Text>
                          <Text style={styles.benefitDesc}>Get your appointment details by email.</Text>
                        </View>
                      </View>

                      {/* Benefit Row 2: Special offers */}
                      <View style={styles.benefitRow}>
                        <View style={styles.benefitIconSquircle}>
                          <Ionicons name="gift-outline" size={20} color="#000000" />
                        </View>
                        <View style={styles.benefitTextCol}>
                          <Text style={styles.benefitTitle}>Keep a copy of special offers</Text>
                          <Text style={styles.benefitDesc}>We’ll email selected rewards, only with your consent.</Text>
                        </View>
                      </View>
                    </View>

                    {/* Primary Button: Continue to collect -> */}
                    {(() => {
                      const isEmailValid = Boolean(email && email.trim() && validateEmailWithTypoCheck(email.trim()).isValid);
                      return (
                        <TouchableOpacity
                          style={[styles.primaryBtn, !isEmailValid && styles.primaryBtnDisabled]}
                          onPress={handleAdvanceFromEmail}
                          disabled={!isEmailValid}
                          activeOpacity={0.85}
                        >
                          <View style={styles.btnContent}>
                            <Text style={[styles.primaryBtnText, !isEmailValid && styles.primaryBtnTextDisabled]}>
                              Continue
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={18}
                              color={isEmailValid ? '#FFFFFF' : '#94A3B8'}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Back to Name & Birthday Step */}
                    <TouchableOpacity 
                      onPress={() => {
                        setErrorMsg('');
                        setStep('register-name');
                      }} 
                      style={{ alignItems: 'center', marginTop: 14, padding: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ← Back to Name & Birthday
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ============================================================ */}
                {/* WIZARD STEP 3: PASSWORD & SECURITY                           */}
                {/* ============================================================ */}
                {step === 'register-password' && (
                  <View style={styles.registerPasswordSection}>
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Verified Phone Card Container */}
                    <View style={styles.passwordPhoneCard}>
                      <View style={styles.passwordPhoneCardLeft}>
                        <Ionicons name="phone-portrait-outline" size={24} color="#000000" />
                        <View style={styles.passwordPhoneCardTextCol}>
                          <Text style={styles.passwordPhoneCardLabel}>Your phone number</Text>
                          <Text style={styles.passwordPhoneCardNumber}>+60 {phone ? formatMalaysianPhone(phone) : '12 351 6724'}</Text>
                        </View>
                      </View>
                      <View style={styles.passwordPhoneCardVerifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                        <Text style={styles.passwordPhoneCardVerifiedText}>Verified</Text>
                      </View>
                    </View>

                    {/* Field 1: CREATE PASSWORD */}
                    <View style={styles.passwordFieldGroup}>
                      <Text style={styles.passwordFieldLabel}>CREATE PASSWORD</Text>
                      <View style={[styles.passwordInputBox, passwordFocused && styles.passwordInputBoxFocused]}>
                        <TextInput
                          style={[styles.passwordInput, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                          placeholder="Min. 8 characters"
                          placeholderTextColor="#94A3B8"
                          value={password}
                          onChangeText={(t) => {
                            setPassword(t);
                            setErrorMsg('');
                          }}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoFocus
                          returnKeyType="next"
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(prev => !prev)}
                          style={styles.eyeBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                      {/* Helper info banner */}
                      <View style={styles.passwordHelperRow}>
                        <Ionicons name="information-circle-outline" size={15} color="#64748B" />
                        <Text style={styles.passwordHelperText}>Use a unique password to keep your account safe.</Text>
                      </View>
                    </View>

                    {/* Field 2: CONFIRM PASSWORD */}
                    <View style={styles.passwordFieldGroup}>
                      <Text style={styles.passwordFieldLabel}>CONFIRM PASSWORD</Text>
                      <View style={[styles.passwordInputBox, confirmPasswordFocused && styles.passwordInputBoxFocused]}>
                        <TextInput
                          style={[styles.passwordInput, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                          placeholder="Re-enter password"
                          placeholderTextColor="#94A3B8"
                          value={confirmPassword}
                          onChangeText={(t) => {
                            setConfirmPassword(t);
                            setErrorMsg('');
                          }}
                          secureTextEntry={!showConfirmPassword}
                          autoCapitalize="none"
                          returnKeyType="done"
                          onSubmitEditing={handleRegister}
                          onFocus={() => setConfirmPasswordFocused(true)}
                          onBlur={() => setConfirmPasswordFocused(false)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(prev => !prev)}
                          style={styles.eyeBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                      {confirmPassword.length > 0 && password !== confirmPassword && (
                        <Text style={styles.fieldHelperError}>⚠️ Passwords do not match</Text>
                      )}
                      {confirmPassword.length >= 8 && password === confirmPassword && (
                        <Text style={styles.fieldHelperSuccess}>✓ Passwords match</Text>
                      )}
                    </View>

                    {/* Primary Button: Create account & continue -> */}
                    {(() => {
                      const isPasswordValid = Boolean(password && confirmPassword && password.length >= 8 && password === confirmPassword);
                      return (
                        <TouchableOpacity
                          style={[styles.primaryBtn, !isPasswordValid && styles.primaryBtnDisabled]}
                          onPress={handleRegister}
                          disabled={!isPasswordValid || isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <View style={styles.btnContent}>
                              <Text style={[styles.primaryBtnText, !isPasswordValid && styles.primaryBtnTextDisabled]}>
                                Create account & continue
                              </Text>
                              <Ionicons name="arrow-forward" size={18} color={isPasswordValid ? '#FFFFFF' : '#94A3B8'} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Back Link: Back to Email Address */}
                    <TouchableOpacity 
                      onPress={() => {
                        setErrorMsg('');
                        setStep('register-email');
                      }} 
                      style={styles.backToPhoneBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={14} color="#0F172A" style={{ marginRight: 6 }} />
                      <Text style={styles.backToPhoneText}>
                        Back to Email Address
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === 'password' && (
                  <View style={styles.loginPasswordSection}>
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Verified Phone Card Container */}
                    <View style={styles.passwordPhoneCard}>
                      <View style={styles.passwordPhoneCardLeft}>
                        <Ionicons name="phone-portrait-outline" size={24} color="#000000" />
                        <View style={styles.passwordPhoneCardTextCol}>
                          <Text style={styles.passwordPhoneCardLabel}>Your phone number</Text>
                          <Text style={styles.passwordPhoneCardNumber}>
                            +60 {phone ? formatMalaysianPhone(phone) : '12 345 6789'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => setStep('phone')}
                        activeOpacity={0.7}
                        style={styles.passwordPhoneCardVerifiedBadge}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                        <Text style={styles.passwordPhoneCardVerifiedText}>Verified</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Password Input Field with Forgot Password in Header Row */}
                    <View style={styles.passwordFieldGroup}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.passwordFieldLabel}>PASSWORD</Text>
                        <TouchableOpacity
                          onPress={handleForgotPassword}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                            Forgot Password?
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.passwordInputBox, passwordFocused && styles.passwordInputBoxFocused, errorMsg ? styles.inputGroupError : null]}>
                        <TextInput
                          style={[
                            styles.passwordInput,
                            Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                          ]}
                          placeholder="Enter your password"
                          placeholderTextColor="#94A3B8"
                          value={password}
                          onChangeText={(t) => {
                            setPassword(t);
                            setErrorMsg('');
                          }}
                          secureTextEntry={!showLoginPassword}
                          autoCapitalize="none"
                          autoFocus={step === 'password'}
                          returnKeyType="done"
                          onSubmitEditing={handlePasswordLogin}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                        />
                        <TouchableOpacity
                          onPress={() => setShowLoginPassword(prev => !prev)}
                          style={styles.eyeBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={showLoginPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Cloudflare Turnstile Verification */}
                    {Platform.OS === 'web' && (
                      <TurnstileWidget
                        ref={turnstileRef}
                        action="login"
                        onVerify={(token) => {
                          setTurnstileToken(token);
                          setErrorMsg('');
                        }}
                        onError={() => {
                          turnstileRef.current?.reset();
                          setTurnstileToken('');
                        }}
                        onExpire={() => setTurnstileToken('')}
                      />
                    )}

                    {/* Primary Action Button for Password Login */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!password || isLoading || (Platform.OS === 'web' && !turnstileToken)) && styles.primaryBtnDisabled]}
                      onPress={handlePasswordLogin}
                      disabled={!password || isLoading || (Platform.OS === 'web' && !turnstileToken)}
                      activeOpacity={0.85}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={[styles.primaryBtnText, (!password || (Platform.OS === 'web' && !turnstileToken)) && styles.primaryBtnTextDisabled]}>
                            {Platform.OS === 'web' && !turnstileToken ? 'Verifying security...' : 'Sign In'}
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color={(!password || (Platform.OS === 'web' && !turnstileToken)) ? '#94A3B8' : '#FFFFFF'}
                          />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Back to Phone Step */}
                    <TouchableOpacity 
                      onPress={() => setStep('phone')} 
                      style={{ alignItems: 'center', marginTop: 10, padding: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ← Change Phone Number
                      </Text>
                    </TouchableOpacity>

                    {/* Trust Reassurance Badge (Golden Yellow Shield + Black Checkmark) */}
                    <View style={[styles.trustBadgeRow, { marginTop: 10 }]}>
                      <View style={styles.yellowShieldWrap}>
                        <Ionicons name="shield" size={19} color="#FFCC00" />
                        <Ionicons name="checkmark" size={11} color="#000000" style={styles.shieldCheckmark} />
                      </View>
                      <Text style={styles.trustBadgeText}>256-bit encrypted · Official Risev protocol</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password Reset Confirmation Modal */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setResetModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.modalIconCircle}>
              <Ionicons name="mail-unread-outline" size={32} color="#FFC700" />
            </View>

            <Text style={styles.modalTitle}>Check Your Email</Text>
            
            <Text style={styles.modalDescription}>
              If an account is associated with:
            </Text>

            {resetModalIdentifier ? (
              <View style={styles.modalIdentifierBadge}>
                <Ionicons name="person-circle-outline" size={15} color="#FFC700" />
                <Text style={styles.modalIdentifierText} numberOfLines={1}>
                  {resetModalIdentifier}
                </Text>
              </View>
            ) : null}

            <Text style={styles.modalSubDescription}>
              A secure password reset link has been dispatched to your registered email address.
            </Text>

            <View style={styles.modalHintBox}>
              <Ionicons name="information-circle-outline" size={16} color="#94A3B8" style={{ marginTop: 1 }} />
              <Text style={styles.modalHintText}>
                Don't see it? Please check your spam or junk folder.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setResetModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalPrimaryBtnText}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  mainCardBorderlessPhone: {
    flex: 1,
    justifyContent: 'space-between',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  mainCardPhone: {
    flex: 1,
    justifyContent: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  heroSectionPhoneTop: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  phoneHeroLockupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  heroLogoPhone: {
    width: 145,
    height: 44,
    alignSelf: 'center',
  },
  hero3dPhoneLarge: {
    width: 170,
    height: 175,
  },
  phoneHeadlineBlock: {
    marginTop: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  heroTitlePhone: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  heroSubtitlePhone: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 330,
    textAlign: 'center',
  },
  heroSection: {
    position: 'relative',
    marginBottom: 20,
  },
  heroLogo: {
    width: 120,
    height: 36,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  hero3dIllustration: {
    position: 'absolute',
    right: -12,
    top: -14,
    width: 210,
    height: 230,
    zIndex: 1,
    ...Platform.select({
      web: {
        pointerEvents: 'none',
      } as any,
    }),
  },
  heroTextContainer: {
    position: 'relative',
    zIndex: 2,
    paddingRight: 40,
  },
  heroTitle: {
    fontSize: 31,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    lineHeight: 37,
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#334155',
    lineHeight: 22,
    marginTop: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  heroSectionRegister: {
    position: 'relative',
    marginBottom: 16,
  },
  heroLogoRegister: {
    width: 135,
    height: 40,
    marginBottom: 16,
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  heroSectionEmail: {
    position: 'relative',
    marginBottom: 4,
  },
  emailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  heroLogoEmail: {
    width: 115,
    height: 34,
    alignSelf: 'flex-start',
  },
  skipBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  envelopeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  envelopeIllustration: {
    width: 145,
    height: 115,
  },
  emailTextContainer: {
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  emailHeroTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  emailHeroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  verifyEmailSection: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
  },
  unifiedVerifyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  verifyCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifyMailIconSquircle: {
    width: 28,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCardEmailText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    flex: 1,
    letterSpacing: -0.2,
  },
  verifyCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
    width: '100%',
  },
  verifyYellowSpinnerWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCardStatusText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
  },
  verifySecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  verifySecondaryText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  verifySecondaryLink: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  verifyTrustContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    gap: 10,
  },
  verifyTrustShield: {
    width: 22,
    height: 24,
    borderRadius: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTrustDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
  verifyTrustText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  verifySuccessCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  verifySuccessTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  verifySuccessSub: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  perkEmoji: {
    fontSize: 14,
  },
  perkPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 140,
    height: 42,
    marginBottom: 14,
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 6,
  },
  perksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  form: {
    gap: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.8,
    paddingLeft: 2,
    marginTop: 2,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 54,
    paddingRight: 10,
    paddingLeft: 2,
    position: 'relative',
  },
  inputGroupDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  verifiedChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  inputGroupFocused: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  inputWithEye: {
    paddingRight: 44,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
    flexShrink: 0,
  },
  flag: {
    fontSize: 18,
  },
  prefixCode: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    paddingLeft: 8,
    paddingRight: 6,
    letterSpacing: 0.6,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  consentText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
    paddingHorizontal: 6,
  },
  consentLink: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
    textDecorationLine: 'underline',
  },
  phoneFormBottom: {
    marginTop: 22,
    width: '100%',
    paddingBottom: 6,
  },
  phoneInputSection: {
    gap: 8,
    marginTop: 0,
  },
  phoneInputLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingLeft: 2,
    marginBottom: 4,
  },
  phoneInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 60,
    paddingRight: 14,
    paddingLeft: 4,
    position: 'relative',
  },
  phoneInputGroupFocused: {
    borderColor: '#000000',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },
  phoneHelperText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 2,
  },
  phoneActionSection: {
    marginTop: 6,
  },
  registerNameSection: {
    gap: 16,
    marginTop: 26,
  },
  phoneVerifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  phoneVerifiedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  phoneVerifiedTextCol: {
    gap: 2,
  },
  phoneVerifiedTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  phoneVerifiedSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  phoneVerifiedCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  phoneChangeBadgeText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  nameFieldGroup: {
    gap: 8,
  },
  nameFieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.8,
  },
  nameInputBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#000000',
    height: 58,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  nameInputBoxFocused: {
    borderColor: '#000000',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },
  nameInput: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  birthdayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFCC00',
    padding: 16,
    gap: 16,
    position: 'relative',
  },
  birthdayCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  birthdayGiftSquircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  birthdayCardTextCol: {
    flex: 1,
  },
  birthdayCardTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  birthdayCardDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 17,
    marginTop: 3,
  },
  birthdayCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  birthdayCardOptionalText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  birthdayCardRequiredText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  backToPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 8,
  },
  backToPhoneText: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  birthdayAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  birthdayAddBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  birthdayActiveGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  birthdayChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  birthdayChipText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  registerEmailSection: {
    gap: 12,
    marginTop: 2,
  },
  emailFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 11,
  },
  emailFieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.8,
  },
  emailInputBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#000000',
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  emailInputBoxFocused: {
    borderColor: '#000000',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },
  emailInput: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  reassuranceBanner: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reassuranceCheckSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassuranceBannerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    flex: 1,
    lineHeight: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 1,
  },
  benefitIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextCol: {
    flex: 1,
    gap: 1,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  benefitDesc: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
  notNowContainer: {
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 4,
    gap: 2,
  },
  notNowTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  notNowSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#000000',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryBtnDisabled: {
    backgroundColor: '#000000',
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.2,
  },
  primaryBtnTextDisabled: {
    color: '#FFFFFF',
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  yellowShieldWrap: {
    position: 'relative',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCheckmark: {
    position: 'absolute',
    marginTop: 1,
    fontWeight: '900',
  },
  trustBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
  },
  termsNoticeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 10,
  },
  termsLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    textDecorationLine: 'underline',
    color: '#000000',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  birthdayCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -4,
    marginBottom: 8,
  },
  birthdayCalloutText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  wizardHeaderContainer: {
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  wizardProgressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  wizardProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  wizardProgressBarActive: {
    backgroundColor: '#000000',
  },
  wizardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wizardStepText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  verifiedPhoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedPhoneText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  fieldHelperText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
    marginTop: -4,
    marginBottom: 4,
  },
  emailSuggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 6,
    gap: 6,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 54,
    position: 'relative',
  },
  datePickerContainerFilled: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  datePickerLeftIcon: {
    paddingLeft: 14,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerDisplayText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  datePickerPlaceholder: {
    color: '#94A3B8',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  selectedBirthdayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: -8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  selectedBirthdayChipText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  nfcPrefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  nfcPrefillText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  securityBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  fieldHelperError: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#7F1D1D',
    paddingLeft: 4,
    marginTop: -4,
    marginBottom: 2,
  },
  fieldHelperSuccess: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#14532D',
    paddingLeft: 4,
    marginTop: -4,
    marginBottom: 2,
  },
  inputGroupWarning: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
  },
  inputGroupError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.25)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalIdentifierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 199, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: '90%',
  },
  modalIdentifierText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  modalSubDescription: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  modalHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  modalHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 17,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: '#FFC700',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  heroSectionPassword: {
    position: 'relative',
    marginBottom: 6,
  },
  passwordTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroLogoPassword: {
    width: 130,
    height: 38,
    alignSelf: 'flex-start',
  },
  verifiedPhoneTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifiedPhoneTopBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  passwordHeroAssetWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  passwordHeroAsset: {
    width: 140,
    height: 140,
  },
  passwordTextContainer: {
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  passwordHeroTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  passwordHeroSubtitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  registerPasswordSection: {
    gap: 16,
    marginTop: 10,
  },
  loginPasswordSection: {
    gap: 13,
    marginTop: 4,
    width: '100%',
  },
  passwordPhoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  passwordPhoneCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passwordPhoneCardTextCol: {
    gap: 2,
  },
  passwordPhoneCardLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  passwordPhoneCardNumber: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  passwordPhoneCardVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  passwordPhoneCardVerifiedText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  passwordFieldGroup: {
    gap: 2,
  },
  passwordFieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  passwordInputBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInputBoxFocused: {
    borderColor: '#000000',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    height: '100%',
  },
  passwordHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  passwordHelperText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
});
