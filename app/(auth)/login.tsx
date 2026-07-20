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
  const { checkPhone, register, requestOTP, loginWithIdentifier } = useAuth();
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const params = useLocalSearchParams<{ ref?: string }>();

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
        // Pre-fill user email/phone identifier for password login
        if (res.email) {
          setEmail(res.email);
        } else {
          setEmail(fullPhone);
        }
        setStep('password');
      } else {
        // New user, show registration inputs
        setStep('register');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to check phone number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !name || !password || !confirmPassword || !birthday) {
      Alert.alert('Error', 'Please fill in all fields including birthday.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    // Validate birthday format YYYY-MM-DD and reasonable age
    const birthdayRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthdayRegex.test(birthday)) {
      Alert.alert('Error', 'Please enter birthday as YYYY-MM-DD.');
      return;
    }
    const [year, month, day] = birthday.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      Alert.alert('Error', 'Please enter a valid birthday date.');
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - year;
    if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) {
      age--;
    }
    if (age < 13) {
      Alert.alert('Error', 'You must be at least 13 years old to use Risev.');
      return;
    }
    if (year < 1900 || age > 120) {
      Alert.alert('Error', 'Please enter a valid birthday.');
      return;
    }
    setIsLoading(true);
    try {
      await register(getFullPhone(), email, name, password, role, birthday);
      // Auto-login happens inside register() — redirect based on role
      const record = pb.authStore.record;
      const userRole = record?.role || 'customer';
      router.replace(userRole === 'merchant' ? '/(merchant)' : '/(customer)');
    } catch (e: any) {
      Alert.alert('Registration Error', e?.message || 'Failed to register user. Please try again.');
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambient Blur Blobs */}
      <View style={styles.ambientContainer}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, isDesktop && { maxWidth: 520, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {/* Main Card Container with decorative overlapping layers behind it */}
          <View style={styles.cardWrapper}>
            {/* Back Layer 2 (Rotated slightly) */}
            <View style={[styles.backLayer, styles.backLayer2]} />
            {/* Back Layer 1 (Rotated slightly) */}
            <View style={[styles.backLayer, styles.backLayer1]} />

            {/* Main Glass-panel Form Card */}
            <View style={styles.mainCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <Image
                  source={require('@/assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.cardSubtitle}>
                  Every visit, rewarded.
                </Text>
              </View>

              {/* Input Form */}
              <View style={styles.form}>

                {step !== 'password' && (
                  <>
                    <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                    <View style={[styles.inputGroup, isFocused && styles.inputGroupFocused, step === 'register' && { backgroundColor: '#F1F5F9', opacity: 0.8 }]}>
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
                        placeholderTextColor="#BEC6E0"
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
                        placeholderTextColor="#BEC6E0"
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
                        placeholderTextColor="#BEC6E0"
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
                        try {
                          setIsLoading(true);
                          const otpId = await requestOTP(getFullPhone());
                          router.push({
                            pathname: '/(auth)/otp',
                            params: { phone: getFullPhone(), otpId: otpId, role: role }
                          });
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || 'Failed to send OTP.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      style={{ alignSelf: 'flex-end', marginTop: 8 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 'register' && (
                  <>
                    <Text style={styles.inputLabel}>{role === 'merchant' ? 'STORE NAME' : 'FULL NAME'}</Text>
                    <View style={[styles.inputGroup, nameFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder={role === 'merchant' ? "e.g. Boutique Royal" : "John Doe"}
                        placeholderTextColor="#BEC6E0"
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <View style={[styles.inputGroup, emailFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="user@example.com"
                        placeholderTextColor="#BEC6E0"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>DATE OF BIRTH</Text>
                    <View style={[styles.inputGroup, birthdayFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#BEC6E0"
                        value={birthday}
                        onChangeText={(text) => {
                          // Auto-format as user types: YYYY-MM-DD
                          let cleaned = text.replace(/[^0-9]/g, '');
                          let formatted = cleaned;
                          if (cleaned.length >= 4) {
                            formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                          }
                          if (cleaned.length >= 6) {
                            formatted = formatted.slice(0, 7) + '-' + formatted.slice(7, 10);
                          }
                          setBirthday(formatted.slice(0, 10));
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
                        autoCapitalize="none"
                        onFocus={() => setBirthdayFocused(true)}
                        onBlur={() => setBirthdayFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={[styles.inputGroup, passwordFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor="#BEC6E0"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
                    </View>

                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <View style={[styles.inputGroup, confirmPasswordFocused && styles.inputGroupFocused]}>
                      <TextInput
                        style={[
                          styles.input,
                          Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor="#BEC6E0"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        onFocus={() => setConfirmPasswordFocused(true)}
                        onBlur={() => setConfirmPasswordFocused(false)}
                      />
                    </View>
                  </>
                )}

                {step === 'phone' && (
                  <>
                    {/* Clean Privacy Notice */}
                    <Text style={[styles.consentText, { textAlign: 'center', marginBottom: 16 }]}>
                      By continuing, you agree to our Terms & Privacy Policy.
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
                          <Text style={styles.primaryBtnText}>GET STARTED</Text>
                          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {step === 'register' && (
                  <>
                    {/* Primary Action Button for Registration */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, (!email || !name || !password || !confirmPassword) && styles.primaryBtnDisabled]}
                      onPress={handleRegister}
                      disabled={!email || !name || !password || !confirmPassword || isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.btnContent}>
                          <Text style={styles.primaryBtnText}>REGISTER & VERIFY</Text>
                          <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Back to Phone Step */}
                    <TouchableOpacity 
                      onPress={() => setStep('phone')} 
                      style={{ alignItems: 'center', marginTop: 4, padding: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: '#6B7280', textDecorationLine: 'underline' }}>
                        Back to Phone Input
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
                          <Text style={styles.primaryBtnText}>SECURE LOGIN</Text>
                          <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Back to Phone Step */}
                    <TouchableOpacity 
                      onPress={() => setStep('phone')} 
                      style={{ alignItems: 'center', marginTop: 4, padding: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: '#6B7280', textDecorationLine: 'underline' }}>
                        Back to Phone Input
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
          </View>
          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2026 RISEV SYSTEMS INC. • ALL ENCRYPTED PROTOCOLS ACTIVE
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean pure white surface
  },
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
  },
  blob1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'transparent',
    top: '10%',
    left: -100,
  },
  blob2: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'transparent',
    bottom: '20%',
    right: -100,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 24,
    zIndex: 1,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9', // Minimalist light gray
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Black text
    letterSpacing: -0.5,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  supportText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  cardWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  backLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  backLayer2: {
    transform: [{ rotate: '2.5deg' }],
    opacity: 0.3,
    top: -6,
    right: -6,
  },
  backLayer1: {
    transform: [{ rotate: '-1.5deg' }],
    opacity: 0.2,
    bottom: -4,
    left: -4,
  },
  mainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Neo-glass layout fill
    borderRadius: 32,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  logoImage: {
    width: 200,
    height: 64,
    marginBottom: 6,
    alignSelf: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#434655',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  form: {
    gap: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9', // Gray slate background
    borderRadius: 12,
    padding: 4,
    height: 46,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#565e74',
  },
  segmentTextActive: {
    color: '#000000', // Active black text
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#434655',
    letterSpacing: 1,
    paddingLeft: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3c6d7',
    height: 52,
    paddingRight: 16,
  },
  inputGroupFocused: {
    borderColor: '#000000', // Solid black focused border
    borderWidth: 2,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  prefixCode: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
  },
  prefixDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#c3c6d7',
    marginLeft: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0b1c30',
    paddingLeft: 8,
    letterSpacing: 0.5,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  consentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  checkboxActive: {
    marginTop: 1,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#434655',
    lineHeight: 16,
  },
  linkText: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#000000', // Solid black button
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: '#E2E8F0', // Disabled slate gray
    shadowOpacity: 0,
    elevation: 0,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5,
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(195, 198, 215, 0.3)',
  },
  dividerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#737686',
    letterSpacing: 0.5,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#c3c6d7',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
  },
  alternativeLinkWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  alternativeLinkText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#434655',
  },
  boldLink: {
    color: '#000000', // Black link
    fontFamily: 'PlusJakartaSans_700Bold',
    textDecorationLine: 'underline',
  },
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  bentoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#565e74',
    letterSpacing: 0.5,
  },
  bentoValue: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  bentoUnit: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#565e74',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#737686',
    opacity: 0.6,
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
