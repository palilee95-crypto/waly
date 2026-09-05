import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb } from '@/lib/pocketbase';
import { Ionicons } from '@expo/vector-icons';

export default function PasswordResetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');

  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleResetPassword = async () => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No reset token found in URL. Please check your reset link.');
      return;
    }

    if (!password || password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
      setStatus('success');
    } catch (err: any) {
      console.warn('[PasswordReset] Reset error:', err?.message || err);
      const rawMsg = err?.data?.message || err?.message || '';
      if (rawMsg.toLowerCase().includes('invalid') || rawMsg.toLowerCase().includes('expired') || rawMsg.toLowerCase().includes('token')) {
        setErrorMsg('This reset link has expired or has already been used. Please request a new link.');
      } else {
        setErrorMsg(rawMsg || 'Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.goldGlowCenter} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, isDesktop && { maxWidth: 440, width: '100%', alignSelf: 'center' }]}>
            {/* Risev Logo */}
            <Image
              source={require('@/assets/risev logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            {status === 'form' && (
              <View style={styles.formContainer}>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>
                  Create a new, secure password for your Risev account.
                </Text>

                {/* Error Banner */}
                {!!errorMsg && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                {/* New Password Field */}
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <View style={[styles.inputGroup, passwordFocused && styles.inputGroupFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="At least 8 characters"
                    placeholderTextColor="rgba(0, 0, 0, 0.35)"
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
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password Field */}
                <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                <View style={[styles.inputGroup, confirmFocused && styles.inputGroupFocused]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor="rgba(0, 0, 0, 0.35)"
                    value={passwordConfirm}
                    onChangeText={(t) => {
                      setPasswordConfirm(t);
                      setErrorMsg('');
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, (!password || !passwordConfirm || isLoading) && styles.primaryBtnDisabled]}
                  onPress={handleResetPassword}
                  disabled={!password || !passwordConfirm || isLoading}
                  activeOpacity={0.9}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Text style={styles.primaryBtnText}>UPDATE PASSWORD</Text>
                      <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Back to Login Link */}
                <TouchableOpacity
                  onPress={() => router.replace('/login')}
                  style={{ alignItems: 'center', marginTop: 16, padding: 8 }}
                >
                  <Text style={{ fontSize: 13, color: '#451A03', fontFamily: 'PlusJakartaSans_700Bold' }}>
                    ← Back to Login
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.contentBox}>
                <View style={styles.iconCircleSuccess}>
                  <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                </View>
                <Text style={styles.title}>Password Updated! 🎉</Text>
                <Text style={styles.subtitle}>
                  Your password has been successfully reset. You can now securely log in to your account with your new credentials.
                </Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.9}
                >
                  <View style={styles.btnContent}>
                    <Text style={styles.primaryBtnText}>GO TO LOGIN</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {status === 'error' && (
              <View style={styles.contentBox}>
                <View style={styles.iconCircleError}>
                  <Ionicons name="alert-circle" size={48} color="#DC2626" />
                </View>
                <Text style={styles.title}>Reset Link Issue</Text>
                <Text style={styles.subtitle}>{errorMsg}</Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.9}
                >
                  <View style={styles.btnContent}>
                    <Text style={styles.primaryBtnText}>BACK TO LOGIN</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldGlowCenter: {
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFC700',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  logoImage: {
    width: 140,
    height: 48,
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
  },
  contentBox: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircleSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircleError: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#451A03',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  inputGroupFocused: {
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
  },
  primaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
