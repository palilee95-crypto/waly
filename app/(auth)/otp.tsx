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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radii } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

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
  const [showNewPasswordField, setShowNewPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const inputRefs = useRef<TextInput[]>([]);

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
    setIsLoading(true);
    setErrorMsg('');
    // OTP verified — now show new password field
    setShowNewPasswordField(true);
    setIsLoading(false);
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
      Alert.alert('Success', 'Password reset successful. Please log in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
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
          {/* Top Navigation Header */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color="#000000" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            
            <View style={styles.brandRow}>
              <View style={styles.brandIconWrap}>
                <Ionicons name="shield-checkmark" size={14} color="#000000" />
              </View>
              <Text style={styles.brandText}>RISEV</Text>
            </View>
          </View>

          {/* Main Card Container */}
          <View style={styles.cardWrapper}>
            {/* Back Layer 2 (Rotated slightly) */}
            <View style={[styles.backLayer, styles.backLayer2]} />
            {/* Back Layer 1 (Rotated slightly) */}
            <View style={[styles.backLayer, styles.backLayer1]} />

            {/* Main Glass Form Card */}
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color="#000000" />
                </View>
                <Text style={styles.cardTitle}>Verify Code</Text>
                <Text style={styles.cardSubtitle}>
                  Please enter the 6-digit verification code sent to:
                </Text>
                <View style={styles.phoneBadgeContainer}>
                  <Text style={styles.phoneBadge}>{maskedPhone || phone}</Text>
                </View>
              </View>

              {/* OTP Inputs */}
              <View style={styles.otpSection}>
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
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  ))}
                </View>
              </View>

              {/* Error Message Container */}
              {errorMsg ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Verify button */}
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
                    <Text style={styles.primaryBtnText}>VERIFY CODE</Text>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Timer & resend */}
              <View style={styles.resendArea}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
                    <Text style={styles.resendActive}>Resend OTP code</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.timerRow}>
                    <Text style={styles.timerLabel}>Resend in </Text>
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerText}>00:{String(resendTimer).padStart(2, '0')}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Security info box */}
              <View style={styles.infoBox}>
                <Ionicons name="warning-outline" size={16} color="#92400E" style={{ marginTop: 1 }} />
                <Text style={styles.infoText}>
                  Do not share this code with anyone. RISEV will never ask for your OTP code.
                </Text>
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    gap: 16,
  },
  cardHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#434655',
    textAlign: 'center',
    lineHeight: 18,
  },
  phoneBadgeContainer: {
    marginTop: 4,
  },
  phoneBadge: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  otpSection: {
    alignItems: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 6,
  },
  otpBox: {
    width: width > 360 ? 44 : 38,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3c6d7',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  otpBoxFilled: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  otpBoxActive: {
    borderColor: '#000000',
    borderWidth: 2,
  },
  otpBoxError: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 12,
    width: '100%',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#000000',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
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
    letterSpacing: 1.5,
  },
  resendArea: {
    alignItems: 'center',
    marginVertical: 4,
  },
  resendBtn: {
    paddingVertical: 4,
  },
  resendActive: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#737686',
  },
  timerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 99,
  },
  timerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#92400E',
    lineHeight: 16,
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
});
