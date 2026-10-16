import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb } from '@/lib/pocketbase';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(4);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const hasAttemptedRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (token === 'preview-success') {
      setStatus('success');
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token found in URL.');
      return;
    }

    if (hasAttemptedRef.current === token) {
      return;
    }
    hasAttemptedRef.current = token;

    let isMounted = true;

    const verify = async () => {
      try {
        await pb.collection('users').confirmVerification(token);
        if (isMounted) {
          setStatus('success');
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[ConfirmEmail] Verification error:', err?.message || err);
          setStatus('error');
          const raw = String(err?.message || '');
          if (
            raw.toLowerCase().includes('validating') ||
            raw.toLowerCase().includes('invalid') ||
            raw.toLowerCase().includes('expired') ||
            raw.toLowerCase().includes('token')
          ) {
            setErrorMsg(
              'This verification link is invalid, expired, or belongs to an earlier registration attempt. If you received multiple emails, please open the latest one.'
            );
          } else {
            setErrorMsg(raw || 'Verification token is invalid, expired, or already used.');
          }
        }
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Smooth auto-redirect countdown on success
  useEffect(() => {
    if (status !== 'success') return;

    if (countdown <= 0) {
      router.replace('/login');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status, countdown, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <View style={[styles.mainCard, isDesktop && styles.desktopCard]}>
          
          {/* Top Brand Lockup (Risev Logo) */}
          <View style={styles.headerLockup}>
            <Image
              source={require('@/assets/risev logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* ========================================================= */}
          {/* LOADING STATE                                             */}
          {/* ========================================================= */}
          {status === 'loading' && (
            <View style={styles.contentSection}>
              <View style={styles.heroAssetWrap}>
                <Image
                  source={require('@/assets/email-envelope-hero.png')}
                  style={styles.hero3dImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.heroTitle}>Verifying Your Email</Text>
              <Text style={styles.heroSubtitle}>
                Please wait while we confirm your email address and activate your account...
              </Text>

              <View style={styles.loadingSpinnerWrap}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.loadingSpinnerText}>Connecting to Risev protocol...</Text>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* SUCCESS CELEBRATION STATE (Pure White + 3D Hero)          */}
          {/* ========================================================= */}
          {status === 'success' && (
            <View style={styles.contentSection}>
              {/* 3D Floating Celebration Envelope Asset */}
              <View style={styles.heroAssetWrap}>
                <Image
                  source={require('@/assets/email-verify-hero.png')}
                  style={styles.hero3dImage}
                  resizeMode="contain"
                />
              </View>

              {/* Celebration Headline & Description */}
              <Text style={styles.heroTitle}>You’re all set! 🎉</Text>
              <Text style={styles.heroSubtitle}>
                Your email address has been successfully verified. Your digital stamps and rewards are ready to collect.
              </Text>

              {/* Status Verification Badge */}
              <View style={styles.verifiedBadgePill}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.verifiedBadgeText}>Email verified & account active</Text>
              </View>

              {/* Primary CTA Button */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/login')}
                activeOpacity={0.85}
              >
                <View style={styles.btnContent}>
                  <Text style={styles.primaryBtnText}>Continue to Risev</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Auto-redirect Helper Subtext */}
              <TouchableOpacity
                onPress={() => router.replace('/login')}
                activeOpacity={0.7}
                style={styles.redirectHelperBtn}
              >
                <Text style={styles.redirectHelperText}>
                  Redirecting automatically in {countdown}s · Tap to continue now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================= */}
          {/* ERROR STATE                                               */}
          {/* ========================================================= */}
          {status === 'error' && (
            <View style={styles.contentSection}>
              <View style={styles.heroAssetWrap}>
                <View style={styles.errorIconSquircle}>
                  <Ionicons name="alert-circle" size={44} color="#EF4444" />
                </View>
              </View>

              <Text style={styles.heroTitle}>Verification Link Issue</Text>
              <Text style={styles.heroSubtitle}>
                {errorMsg.includes('invalid') || errorMsg.includes('expired')
                  ? 'This verification link may have expired or already been used. If your account is already active, you can sign in directly.'
                  : errorMsg}
              </Text>

              {/* Primary CTA Button */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/login')}
                activeOpacity={0.85}
              >
                <View style={styles.btnContent}>
                  <Text style={styles.primaryBtnText}>Back to Login</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Trust Reassurance Badge (Golden Yellow Shield + Black Checkmark) */}
          <View style={styles.trustBadgeRow}>
            <View style={styles.yellowShieldWrap}>
              <Ionicons name="shield" size={19} color="#FFCC00" />
              <Ionicons name="checkmark" size={11} color="#000000" style={styles.shieldCheckmark} />
            </View>
            <Text style={styles.trustBadgeText}>Instant, secure and password-free login</Text>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  mainCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  desktopCard: {
    flex: undefined,
    borderRadius: 28,
    padding: 36,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  headerLockup: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: 145,
    height: 44,
  },
  contentSection: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  heroAssetWrap: {
    width: 175,
    height: 165,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  hero3dImage: {
    width: 170,
    height: 160,
  },
  errorIconSquircle: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.6,
    marginTop: 4,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 330,
    marginBottom: 20,
  },
  loadingSpinnerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  loadingSpinnerText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  verifiedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 24,
  },
  verifiedBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  primaryBtn: {
    backgroundColor: '#000000',
    borderRadius: 999,
    height: 58,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  redirectHelperBtn: {
    marginTop: 14,
    padding: 6,
  },
  redirectHelperText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 4,
  },
  yellowShieldWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shieldCheckmark: {
    position: 'absolute',
    top: 5.5,
    alignSelf: 'center',
  },
  trustBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
});
