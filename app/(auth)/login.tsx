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
  const { checkPhone, register, loginWithIdentifier, requestPasswordReset, isAuthenticated, isLoading: isAuthLoading, activeRole } = useAuth();
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const params = useLocalSearchParams<{ ref?: string; prefill_phone?: string; prefill_name?: string }>();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      setTimeout(() => {
        router.replace(activeRole === 'merchant' ? '/(merchant)' : '/(customer)');
      }, 0);
    }
  }, [isAuthLoading, isAuthenticated, activeRole]);

  useEffect(() => {
    if (params.ref) {
      storage.setItem('risev_referral_code', params.ref)
        .then(() => {
          console.log('[Login] Stored referral code:', params.ref);
          setRole('merchant'); // Pre-select Merchant role!
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
  const [step, setStep] = useState<'phone' | 'register' | 'password'>('phone');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
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
          // Quick-registered QR user returning to complete account setup!
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

    setIsLoading(true);
    try {
      const birthDateToUse = birthday && birthday.trim() ? birthday.trim() : '2000-01-01';
      await register(getFullPhone(), email.trim().toLowerCase(), name.trim(), password, role, birthDateToUse);
      
      const record = pb.authStore.record;
      const userRole = record?.role || role || 'customer';
      router.replace(userRole === 'merchant' ? '/(merchant)' : '/(customer)');
    } catch (e: any) {
      const rawMsg = e?.message || '';
      if (rawMsg.toLowerCase().includes('email') || rawMsg.toLowerCase().includes('unique')) {
        setErrorMsg('This email address is already registered to another account.');
      } else if (rawMsg.toLowerCase().includes('phone')) {
        setErrorMsg('This phone number is already registered.');
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
      router.replace(userRole === 'merchant' ? '/(merchant)' : '/(customer)');
    } catch (e: any) {
      console.warn(e);
      setErrorMsg('Invalid credentials. Please try again.');
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
                    : 'Every visit, rewarded.'}
                </Text>
              </View>

              {/* Role Switcher Pill (Phone Step Only) */}
              {step === 'phone' && (
                <View style={styles.roleSwitcher}>
                  <TouchableOpacity
                    style={[styles.roleTab, role === 'customer' && styles.roleTabActive]}
                    onPress={() => setRole('customer')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person" size={13} color={role === 'customer' ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.roleTabText, role === 'customer' && styles.roleTabTextActive]}>Customer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleTab, role === 'merchant' && styles.roleTabActive]}
                    onPress={() => setRole('merchant')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="storefront" size={13} color={role === 'merchant' ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.roleTabText, role === 'merchant' && styles.roleTabTextActive]}>Merchant</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Input Form */}
              <View style={styles.form}>
                {/* NFC Pre-fill Banner */}
                {params.prefill_phone && step !== 'phone' && (
                  <View style={styles.nfcPrefillBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.nfcPrefillText}>
                      📱 +60 {params.prefill_phone} — confirmed from your visit
                    </Text>
                  </View>
                )}

                {step !== 'password' && (
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
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        autoFocus={step === 'password'}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
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
                    <Text style={styles.inputLabel}>{role === 'merchant' ? 'STORE NAME' : 'FULL NAME'}</Text>
                    <View style={[styles.inputGroup, nameFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder={role === 'merchant' ? "e.g. Boutique Royal" : "John Doe"}
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

                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={[
                      styles.inputGroup,
                      passwordFocused && styles.inputGroupFocused,
                      password.length > 0 && password.length < 8 && styles.inputGroupWarning
                    ]}>
                      <TextInput
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="Min. 8 characters"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
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
                        style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={confirmPassword}
                        onChangeText={(t) => {
                          setConfirmPassword(t);
                          setErrorMsg('');
                        }}
                        secureTextEntry
                        autoCapitalize="none"
                        onFocus={() => setConfirmPasswordFocused(true)}
                        onBlur={() => setConfirmPasswordFocused(false)}
                      />
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
    gap: 10,
  },
  inputLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#3B1700',
    letterSpacing: 0.6,
    paddingLeft: 2,
    marginTop: 1,
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
    overflow: 'hidden',
  },
  inputGroupDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
    backgroundColor: 'rgba(5, 5, 5, 0.4)',
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
