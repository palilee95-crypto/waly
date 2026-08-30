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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, storage } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COUNTRY_CODE = '+60';

export default function LoginScreen() {
  const router = useRouter();
  const { checkPhone, register, resendVerificationEmail, loginWithIdentifier, requestPasswordReset, isAuthenticated, isLoading: isAuthLoading, activeRole } = useAuth();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const params = useLocalSearchParams<{ ref?: string; prefill_phone?: string; prefill_name?: string; redirect_to?: string }>();

  const getRedirectUrl = () => {
    if (params?.redirect_to) return params.redirect_to;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search);
        return sp.get('redirect_to') || '';
      } catch (e) {}
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
      }, 0);
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
    if (!params.prefill_phone || params.prefill_phone.length < 9) return;
    const formatted = params.prefill_phone.replace(/\D/g, '').slice(0, 10);
    setPhone(formatted);
    // Pre-fill name if passed from NFC page
    if (params.prefill_name && params.prefill_name.trim()) {
      setName(params.prefill_name.trim());
    }
    // Directly check the pre-filled phone (don't rely on stale state)
    const fullPhone = `${COUNTRY_CODE}${formatted}`;
    setIsLoading(true);
    checkPhone(fullPhone)
      .then((res) => {
        if (res.exists) {
          const isFullyRegistered = res.verified === true || (res.email && res.email.trim() && !res.email.includes('@risev.app'));
          if (isFullyRegistered) {
            setEmail(res.email || '');
            setStep('password');
          } else {
            if (res.name && !res.name.startsWith('User ') && !res.name.startsWith('Staff (') && !res.name.startsWith('Customer ')) {
              setName(res.name);
            }
            setStep('register');
          }
        } else {
          setStep('register');
        }
      })
      .catch((e: any) => {
        console.warn('[Login] prefill phone check failed:', e?.message);
      })
      .finally(() => setIsLoading(false));
  }, [params.prefill_phone, params.prefill_name]);
  
  // New Registration fields and state machine steps
  const [step, setStep] = useState<'phone' | 'register' | 'password' | 'verify-email'>('phone');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
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
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  // Live Auto-Detection: Polling verification status in real-time
  useEffect(() => {
    if (step !== 'verify-email' || isAutoLoggingIn || isVerifiedSuccess) return;

    const fullPhone = getFullPhone();
    const interval = setInterval(async () => {
      try {
        const res = await checkPhone(fullPhone);
        if (res && res.exists && res.verified) {
          clearInterval(interval);
          setIsVerifiedSuccess(true);
          setIsAutoLoggingIn(true);

          // Automatically log the user in once verified!
          setTimeout(async () => {
            try {
              await loginWithIdentifier(email.trim().toLowerCase(), password);
              const record = pb.authStore.record;
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

  const formatPhone = (text: string) => text.replace(/\D/g, '').slice(0, 10);
  const getFullPhone = () => `${COUNTRY_CODE}${phone}`;
  const isValid = phone.length >= 9;

  const handleGetStarted = async () => {
    if (!isValid) return;
    setIsLoading(true);
    try {
      const fullPhone = getFullPhone();
      const res = await checkPhone(fullPhone);
      if (res.exists) {
        const isFullyRegistered = res.verified === true || (res.email && res.email.trim() && !res.email.includes('@risev.app'));
        if (isFullyRegistered) {
          setEmail(res.email || '');
          setStep('password');
        } else {
          // Quick-registered / Shadow Staff returning to complete account setup!
          if (res.name && !res.name.startsWith('User ') && !res.name.startsWith('Staff (') && !res.name.startsWith('Customer ')) {
            setName(res.name);
          }
          setStep('register');
        }
      } else {
        // New user
        setStep('register');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to check phone number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMsg('');

    if (!name || !name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (!email || !email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address (e.g. user@gmail.com).');
      return;
    }
    if (email.trim().endsWith('@risev.app')) {
      setErrorMsg('Please use your personal email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please create a password.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      return;
    }

    if (birthday && birthday.trim()) {
      const birthRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!birthRegex.test(birthday.trim())) {
        setErrorMsg('Please enter a valid birthday format (YYYY-MM-DD).');
        return;
      }
    }

    setIsLoading(true);
    try {
      const birthDateToUse = birthday && birthday.trim() ? birthday.trim() : '2000-01-01';
      await register(getFullPhone(), email.trim().toLowerCase(), name.trim(), password, 'customer', birthDateToUse);
      // Strict Mode: transition to Verify Email screen
      setStep('verify-email');
    } catch (e: any) {
      const rawMsg = e?.message || '';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('unique') || lower.includes('already exists')) {
        if (lower.includes('phone')) {
          setErrorMsg('This phone number is already registered.');
        } else {
          setErrorMsg('This email address is already registered to another account.');
        }
      } else {
        setErrorMsg(rawMsg || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Try email first, then phone
      await loginWithIdentifier(email.trim(), password);
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
      const raw = e?.message || '';
      if (raw === 'EMAIL_NOT_VERIFIED' || raw.includes('EMAIL_NOT_VERIFIED') || raw.includes('verified')) {
        setErrorMsg('Please verify your email before logging in. Check your inbox for the link.');
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B' }}>
        <ActivityIndicator size="large" color="#FFC700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambient Warm Gold Glow */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.goldGlowCenter} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, isDesktop && { maxWidth: 480, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {/* Main Clean Elevated Card */}
            <View style={styles.mainCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                {/* Risev Logo */}
                <Image
                  source={require('@/assets/risev logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />

                <Text style={styles.cardSubtitle}>
                  {step === 'password'
                    ? 'Enter your password to access your account.'
                    : step === 'register'
                    ? 'Complete your profile to start earning rewards.'
                    : step === 'verify-email'
                    ? 'Check your inbox to verify your email.'
                    : 'Every visit, rewarded.'}
                </Text>
              </View>

              {/* Input Form */}
              <View style={styles.form}>
                {/* NFC Pre-fill Banner */}
                {params.prefill_phone && step !== 'phone' && step !== 'verify-email' && (
                  <View style={styles.nfcPrefillBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.nfcPrefillText}>
                      📱 +60 {params.prefill_phone} — confirmed from your visit
                    </Text>
                  </View>
                )}

                {step !== 'password' && step !== 'verify-email' && (
                  <>
                    <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                    <View style={[
                      styles.inputGroup,
                      isFocused && styles.inputGroupFocused,
                      step === 'register' && styles.inputGroupDisabled
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
                        placeholder="11 234 5678"
                        placeholderTextColor="#94A3B8"
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

                      {step === 'register' ? (
                        <View style={styles.verifiedChip}>
                          <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                          <Text style={styles.verifiedChipText}>Verified</Text>
                        </View>
                      ) : isValid ? (
                        <View style={{ paddingRight: 4 }}>
                          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        </View>
                      ) : null}
                    </View>
                  </>
                )}

                {step === 'verify-email' && (
                  <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                    {isVerifiedSuccess ? (
                      /* Success Celebration State */
                      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                        <View style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: '#DCFCE7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          borderWidth: 2,
                          borderColor: '#86EFAC',
                        }}>
                          <Ionicons name="checkmark-circle" size={44} color="#16A34A" />
                        </View>

                        <Text style={{
                          fontSize: 20,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#0F172A',
                          textAlign: 'center',
                          marginBottom: 8,
                        }}>
                          Email Verified! 🎉
                        </Text>

                        <Text style={{
                          fontSize: 14,
                          fontFamily: 'PlusJakartaSans_500Medium',
                          color: '#475569',
                          textAlign: 'center',
                          marginBottom: 16,
                        }}>
                          Welcome to Risev! Logging you in now...
                        </Text>

                        <ActivityIndicator size="small" color="#0F172A" />
                      </View>
                    ) : (
                      /* Live Waiting State with Radar Pulse */
                      <>
                        {/* Animated Pulsing Icon */}
                        <Animated.View style={{
                          transform: [{ scale: pulseAnim }],
                          width: 76,
                          height: 76,
                          borderRadius: 38,
                          backgroundColor: 'rgba(15, 23, 42, 0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          borderWidth: 2,
                          borderColor: 'rgba(15, 23, 42, 0.15)',
                        }}>
                          <Ionicons name="mail-unread" size={38} color="#0F172A" />
                        </Animated.View>

                        <Text style={{
                          fontSize: 19,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#0F172A',
                          textAlign: 'center',
                          marginBottom: 6,
                        }}>
                          Waiting for Verification
                        </Text>

                        <Text style={{
                          fontSize: 13,
                          fontFamily: 'PlusJakartaSans_500Medium',
                          color: '#475569',
                          textAlign: 'center',
                          lineHeight: 18,
                          marginBottom: 12,
                        }}>
                          We sent a verification link to:
                        </Text>

                        {/* Recipient Email Chip */}
                        <View style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.06)',
                          borderRadius: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          marginBottom: 14,
                          borderWidth: 1,
                          borderColor: 'rgba(15, 23, 42, 0.12)',
                          width: '100%',
                          alignItems: 'center',
                        }}>
                          <Text style={{
                            fontSize: 14,
                            fontFamily: 'PlusJakartaSans_700Bold',
                            color: '#0F172A',
                          }}>
                            {email}
                          </Text>
                        </View>

                        {/* Live Radar Polling Status Indicator */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'rgba(255, 255, 255, 0.65)',
                          borderRadius: 20,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(15, 23, 42, 0.1)',
                          gap: 8,
                        }}>
                          <ActivityIndicator size="small" color="#0F172A" />
                          <Text style={{
                            fontSize: 12,
                            fontFamily: 'PlusJakartaSans_600SemiBold',
                            color: '#0F172A',
                          }}>
                            Listening for your confirmation...
                          </Text>
                        </View>

                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'PlusJakartaSans_400Regular',
                          color: '#64748B',
                          textAlign: 'center',
                          lineHeight: 18,
                          marginBottom: 18,
                        }}>
                          Click the link in your email on any phone or computer. This page will <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>automatically log you in</Text> once clicked.
                        </Text>

                        {resendSuccess && (
                          <View style={[styles.errorContainer, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginBottom: 14 }]}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={[styles.errorText, { color: '#065F46' }]}>Verification email resent! Please check your inbox.</Text>
                          </View>
                        )}

                        {/* Resend Action */}
                        <TouchableOpacity
                          disabled={resendCooldown > 0 || isLoading}
                          onPress={async () => {
                            if (!email || resendCooldown > 0) return;
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
                              Alert.alert('Error', e?.message || 'Failed to resend verification email.');
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                          style={[
                            styles.primaryBtn,
                            resendCooldown > 0 && styles.primaryBtnDisabled,
                            { marginBottom: 10 }
                          ]}
                          activeOpacity={0.9}
                        >
                          <View style={styles.btnContent}>
                            <Text style={[
                              styles.primaryBtnText,
                              resendCooldown > 0 && styles.primaryBtnTextDisabled
                            ]}>
                              {resendCooldown > 0 ? `RESEND IN ${resendCooldown}s` : 'RESEND VERIFICATION EMAIL'}
                            </Text>
                            <Ionicons name="refresh" size={16} color={resendCooldown > 0 ? 'rgba(255,255,255,0.45)' : '#FFFFFF'} />
                          </View>
                        </TouchableOpacity>

                        {/* Back to Phone Input */}
                        <TouchableOpacity 
                          onPress={() => setStep('phone')} 
                          style={{ alignItems: 'center', marginTop: 4, padding: 8 }}
                        >
                          <Text style={{ fontSize: 13, color: '#451A03', fontFamily: 'PlusJakartaSans_700Bold' }}>
                            ← Change Phone / Re-enter
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {step === 'password' && (
                  <>
                    <Text style={styles.inputLabel}>EMAIL OR PHONE</Text>
                    <View style={[styles.inputGroup, emailFocused && styles.inputGroupFocused, errorMsg ? styles.inputGroupError : null]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="user@example.com"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          setErrorMsg('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={[styles.inputGroup, passwordFocused && styles.inputGroupFocused, errorMsg ? styles.inputGroupError : null]}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.inputWithEye,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry={!showLoginPassword}
                        autoCapitalize="none"
                        autoFocus={step === 'password'}
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
                          size={22}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Forgot Password Link */}
                    <TouchableOpacity
                      onPress={async () => {
                        if (!phone) {
                          Alert.alert('Info', 'Please enter your phone number first.');
                          setStep('phone');
                          return;
                        }
                        if (!email || email.trim() === '') {
                          Alert.alert('Error', 'No email address found for this account. Please contact support.');
                          return;
                        }
                        if (email.endsWith('@risev.app') || email.includes('shadow_') || email.includes('quick_')) {
                          Alert.alert('Info', 'This account was created without a personal email. Please contact support or register a new account.');
                          return;
                        }
                        try {
                          setIsLoading(true);
                          await requestPasswordReset(email.trim());
                          if (Platform.OS === 'web') {
                            alert(`A password reset link has been sent to ${email}. Please check your inbox.`);
                          } else {
                            Alert.alert('Reset Sent', `A password reset link has been sent to ${email}. Please check your inbox.`);
                          }
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || 'Failed to send password reset email.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      style={{ alignSelf: 'flex-end', marginTop: 4 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 'register' && (
                  <>
                    {/* Simplified registration form */}
                    <Text style={styles.inputLabel}>FULL NAME</Text>
                    <View style={[styles.inputGroup, nameFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="John Doe"
                        placeholderTextColor="#94A3B8"
                        value={name}
                        onChangeText={(t) => {
                          setName(t);
                          setErrorMsg('');
                        }}
                        autoFocus
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <View style={[
                      styles.inputGroup,
                      emailFocused && styles.inputGroupFocused,
                      email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && styles.inputGroupWarning
                    ]}>
                      <TextInput
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="user@example.com"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          setErrorMsg('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>
                    {email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
                      <Text style={styles.fieldHelperError}>⚠️ Please enter a valid email format</Text>
                    )}

                    <Text style={styles.inputLabel}>BIRTHDAY (FOR REWARDS)</Text>
                    <View style={[
                      styles.inputGroup,
                      birthdayFocused && styles.inputGroupFocused,
                    ]}>
                      <TextInput
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="YYYY-MM-DD (e.g. 1998-05-24)"
                        placeholderTextColor="#94A3B8"
                        value={birthday}
                        onChangeText={(t) => {
                          let cleaned = t.replace(/[^0-9]/g, '');
                          let formatted = cleaned;
                          if (cleaned.length >= 4) formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                          if (cleaned.length >= 6) formatted = formatted.slice(0, 7) + '-' + formatted.slice(7, 10);
                          setBirthday(formatted.slice(0, 10));
                          setErrorMsg('');
                        }}
                        keyboardType="numeric"
                        maxLength={10}
                        onFocus={() => setBirthdayFocused(true)}
                        onBlur={() => setBirthdayFocused(false)}
                      />
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: -4, marginBottom: 12 }}>
                      🎁 Receive exclusive surprise vouchers on your birthday!
                    </Text>

                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={[
                      styles.inputGroup,
                      passwordFocused && styles.inputGroupFocused,
                      password.length > 0 && password.length < 8 && styles.inputGroupWarning
                    ]}>
                      <TextInput
                        style={[styles.input, styles.inputWithEye, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="Min. 8 characters"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
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
                    {password.length > 0 && password.length < 8 && (
                      <Text style={styles.fieldHelperError}>⚠️ Must be at least 8 characters ({password.length}/8)</Text>
                    )}

                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <View style={[
                      styles.inputGroup,
                      confirmPasswordFocused && styles.inputGroupFocused,
                      confirmPassword.length > 0 && password !== confirmPassword && styles.inputGroupWarning
                    ]}>
                      <TextInput
                        style={[styles.input, styles.inputWithEye, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={confirmPassword}
                        onChangeText={(t) => {
                          setConfirmPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
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
                    {confirmPassword.length > 0 && password === confirmPassword && (
                      <Text style={styles.fieldHelperSuccess}>✓ Passwords match</Text>
                    )}
                  </>
                )}

                {step === 'phone' && (
                  <>
                    {/* Clean Privacy Notice */}
                    <Text style={[styles.consentText, { textAlign: 'center', marginVertical: 14 }]}>
                      By continuing, you agree to our <Text style={styles.consentLink}>Terms</Text> & <Text style={styles.consentLink}>Privacy Policy</Text>.
                    </Text>

                    {/* Primary Action Button */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
                      onPress={handleGetStarted}
                      disabled={!isValid || isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={[styles.primaryBtnText, !isValid && styles.primaryBtnTextDisabled]}>GET STARTED</Text>
                          <Ionicons name="arrow-forward" size={16} color={isValid ? '#FFFFFF' : 'rgba(255,255,255,0.45)'} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {step === 'register' && (
                  <>
                    {/* Error Banner on Register Step */}
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Primary Action Button for Registration */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!email || !name || !password || !confirmPassword || password !== confirmPassword || password.length < 8) && styles.primaryBtnDisabled]}
                      onPress={handleRegister}
                      disabled={(!email || !name || !password || !confirmPassword || password !== confirmPassword || password.length < 8) || isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={[styles.primaryBtnText, (!email || !name || !password || !confirmPassword || password !== confirmPassword || password.length < 8) && styles.primaryBtnTextDisabled]}>CREATE ACCOUNT</Text>
                          <Ionicons name="shield-checkmark" size={16} color={(!email || !name || !password || !confirmPassword || password !== confirmPassword || password.length < 8) ? 'rgba(255,255,255,0.45)' : '#FFFFFF'} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Back to Phone Step */}
                    <TouchableOpacity 
                      onPress={() => setStep('phone')} 
                      style={{ alignItems: 'center', marginTop: 8, padding: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: '#451A03', fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ← Back to Phone Input
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 'password' && (
                  <>
                    {errorMsg ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    ) : null}

                    {/* Primary Action Button for Password Login */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!email || !password) && styles.primaryBtnDisabled]}
                      onPress={handlePasswordLogin}
                      disabled={!email || !password || isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={[styles.primaryBtnText, (!email || !password) && styles.primaryBtnTextDisabled]}>SECURE LOGIN</Text>
                          <Ionicons name="lock-closed" size={16} color={(!email || !password) ? 'rgba(255,255,255,0.45)' : '#FFFFFF'} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Back to Phone Step */}
                    <TouchableOpacity 
                      onPress={() => setStep('phone')} 
                      style={{ alignItems: 'center', marginTop: 8, padding: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: '#451A03', fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ← Back to Phone Input
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Security & Protocol Badge */}
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#FFC700" />
            <Text style={styles.securityBadgeText}>256-BIT ENCRYPTED • OFFICIAL RISEV PROTOCOL</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  ambientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 0,
    backgroundColor: '#000000',
  },
  goldGlowCenter: {
    display: 'none',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
    zIndex: 1,
  },
  mainCard: {
    backgroundColor: '#FFC700',
    borderRadius: 30,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 30,
    borderWidth: 1.5,
    borderColor: '#FFE066',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 36,
    elevation: 10,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 22,
    marginTop: 2,
  },
  logoImage: {
    width: 150,
    height: 44,
    marginBottom: 8,
    alignSelf: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#3B1700',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    height: 46,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
  },
  roleTabActive: {
    backgroundColor: '#050505',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  form: {
    gap: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 1,
    paddingLeft: 4,
    marginTop: 2,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    height: 50,
    paddingRight: 10,
    paddingLeft: 2,
    position: 'relative',
  },
  inputGroupDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  verifiedChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  inputGroupFocused: {
    borderColor: '#050505',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.12)',
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
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginLeft: 6,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    paddingLeft: 8,
    paddingRight: 6,
    letterSpacing: 0.5,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  consentText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#451A03',
    lineHeight: 16,
    paddingHorizontal: 6,
  },
  consentLink: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    height: 54,
    backgroundColor: '#050505',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 1.2,
  },
  primaryBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
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
});
