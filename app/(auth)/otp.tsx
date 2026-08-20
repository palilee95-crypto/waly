import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;

export default function OTPScreen() {
  const router = useRouter();
  const { phone, otpId, role } = useLocalSearchParams<{ phone: string; otpId: string; role: string }>();
  const { requestOTP, resetPassword } = useAuth();

  const [currentOtpId, setCurrentOtpId] = useState(otpId);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State for Reset Password
  const [showNewPasswordField, setShowNewPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPassFocused, setNewPassFocused] = useState(false);
  const [confirmPassFocused, setConfirmPassFocused] = useState(false);
  
  const inputRefs = useRef<TextInput[]>([]);

  // Pulse animation for the background orb
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Keep track of changing params
  useEffect(() => {
    if (otpId) {
      setCurrentOtpId(otpId);
    }
  }, [otpId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { setCanResend(true); clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    setErrorMsg('');
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Haptic feedback could be triggered here using expo-haptics
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== OTP_LENGTH) return;
    
    // Smooth transition to password reset fields
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowNewPasswordField(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await resetPassword(phone!, currentOtpId!, otp.join(''), newPassword);
      if (Platform.OS === 'web') {
        alert('Password reset successful. Please log in.');
        router.replace('/(auth)/login');
      } else {
        Alert.alert('Success', 'Password reset successful. Please log in.', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') }
        ]);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      const newOtpId = await requestOTP(phone!);
      setCurrentOtpId(newOtpId);
      setResendTimer(60);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      const timer = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) { setCanResend(true); clearInterval(timer); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Error', 'Failed to resend OTP.');
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+60)(\d{2})(\d+)(\d{2})/, '$1 $2**** $4')
    : '';

  const filledCount = otp.filter((d) => d !== '').length;

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={styles.container}>
      {/* Dynamic Animated Orb Background */}
      <View style={styles.ambientContainer}>
        <Animated.View
          style={[
            styles.glowOrb,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={styles.ambientLayer} />
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
          {/* Top Navigation */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color="#000000" />
            </TouchableOpacity>
            
            <View style={styles.brandRow}>
              <View style={styles.brandIconWrap}>
                <Ionicons name="shield-checkmark" size={14} color="#000000" />
              </View>
              <Text style={styles.brandText}>RISEV</Text>
            </View>
          </View>

          {/* Bento Grid Layout */}
          <View style={styles.bentoContainer}>
            
            {/* Header Box */}
            <View style={styles.bentoHeaderBox}>
              <View style={styles.iconCircle}>
                <Ionicons name="finger-print-outline" size={26} color="#000000" />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.bentoTitle}>Security Verification</Text>
                <Text style={styles.bentoSubtitle}>Code sent to {maskedPhone || phone}</Text>
              </View>
            </View>

            {/* Main OTP / Reset Password Box */}
            <View style={styles.bentoMainBox}>
              {!showNewPasswordField ? (
                <>
                  <Text style={styles.instructionText}>
                    Enter the 6-digit code to securely verify your identity.
                  </Text>
                  
                  {/* OTP Inputs */}
                  <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                        style={[
                          styles.otpBox,
                          digit ? styles.otpBoxFilled : null,
                          index === filledCount && styles.otpBoxActive,
                          errorMsg ? styles.otpBoxError : null,
                        ]}
                        value={digit}
                        onChangeText={(t) => handleOtpChange(t, index)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        textAlign="center"
                        autoFocus={index === 0}
                        caretHidden
                        selectTextOnFocus
                        placeholderTextColor="#BEC6E0"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                    ))}
                  </View>

                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.primaryBtn, filledCount < OTP_LENGTH && styles.primaryBtnDisabled]}
                    onPress={() => handleVerify()}
                    disabled={filledCount < OTP_LENGTH || isLoading}
                    activeOpacity={0.9}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.btnContent}>
                        <Text style={styles.primaryBtnText}>CONFIRM CODE</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.resetPasswordContainer}>
                  <View style={styles.resetHeader}>
                    <View style={styles.successBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    </View>
                    <Text style={styles.instructionText}>
                      Verification successful. You can now set a new password.
                    </Text>
                  </View>

                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {/* New Password */}
                  <View style={[styles.inputGroup, newPassFocused && styles.inputGroupFocused]}>
                    <Ionicons name="lock-closed-outline" size={18} color={newPassFocused ? "#000000" : "#64748B"} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as any : null]}
                      placeholder="New password (min 8 chars)"
                      placeholderTextColor="#BEC6E0"
                      value={newPassword}
                      onChangeText={(t) => { setNewPassword(t); setErrorMsg(''); }}
                      secureTextEntry
                      autoCapitalize="none"
                      onFocus={() => setNewPassFocused(true)}
                      onBlur={() => setNewPassFocused(false)}
                    />
                  </View>

                  {/* Confirm Password */}
                  <View style={[styles.inputGroup, confirmPassFocused && styles.inputGroupFocused]}>
                    <Ionicons name="lock-closed-outline" size={18} color={confirmPassFocused ? "#000000" : "#64748B"} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as any : null]}
                      placeholder="Confirm password"
                      placeholderTextColor="#BEC6E0"
                      value={confirmNewPassword}
                      onChangeText={(t) => { setConfirmNewPassword(t); setErrorMsg(''); }}
                      secureTextEntry
                      autoCapitalize="none"
                      onFocus={() => setConfirmPassFocused(true)}
                      onBlur={() => setConfirmPassFocused(false)}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, (!newPassword || !confirmNewPassword) && styles.primaryBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={!newPassword || !confirmNewPassword || isLoading}
                    activeOpacity={0.9}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>RESET PASSWORD</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Bottom Row Blocks */}
            <View style={styles.bentoBottomRow}>
              {/* Timer/Resend Box */}
              <View style={[styles.bentoMiniBox, styles.timerBox]}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend} style={styles.resendBtnRow}>
                    <Ionicons name="refresh" size={16} color="#000000" />
                    <Text style={styles.resendActive}>Resend Code</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.timerContent}>
                    <Ionicons name="time-outline" size={16} color="#737686" />
                    <Text style={styles.timerLabel}>Resend in</Text>
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerText}>00:{String(resendTimer).padStart(2, '0')}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Security Box */}
              <View style={[styles.bentoMiniBox, styles.securityBox]}>
                <Ionicons name="lock-closed" size={16} color="#10B981" />
                <Text style={styles.securityText}>256-bit Encrypted</Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
               © 2026 RISEV SYSTEMS INC. • SECURE VERIFICATION PORTAL
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
    backgroundColor: '#FAFAFA', // Slight off-white for better contrast with white boxes
  },
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOrb: {
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#E0E7FF', // Soft indigo/blue glow
    position: 'absolute',
    top: -50,
    right: -100,
    opacity: 0.8,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(250, 250, 250, 0.4)', // Frost overlay
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  brandIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  bentoContainer: {
    gap: 16,
    marginTop: 8,
  },
  bentoHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  bentoTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  bentoSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  bentoMainBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 20,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  otpBox: {
    width: width > 360 ? 46 : 40,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  otpBoxFilled: {
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  otpBoxActive: {
    borderColor: '#000000',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  otpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: '#E2E8F0',
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
    letterSpacing: 1,
  },
  resetPasswordContainer: {
    gap: 16,
  },
  resetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  successBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 56,
  },
  inputGroupFocused: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    paddingHorizontal: 12,
  },
  bentoBottomRow: {
    flexDirection: 'row',
    gap: 16,
  },
  bentoMiniBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBox: {
    flex: 3,
  },
  securityBox: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  resendBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendActive: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  timerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  timerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  securityText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#10B981',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
});

