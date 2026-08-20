import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token found in URL.');
      return;
    }

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
          setErrorMsg(err?.message || 'Verification token is invalid, expired, or already used.');
        }
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.goldGlowCenter} />
      </View>

      <View style={[styles.card, isDesktop && { maxWidth: 460, width: '100%', alignSelf: 'center' }]}>
        {/* Risev Logo */}
        <Image
          source={require('@/assets/risev logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        {status === 'loading' && (
          <View style={styles.contentBox}>
            <View style={styles.iconCircleLoading}>
              <ActivityIndicator size="large" color="#0F172A" />
            </View>
            <Text style={styles.title}>Verifying Your Email</Text>
            <Text style={styles.subtitle}>
              Please wait while we confirm your email address and activate your account...
            </Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.contentBox}>
            <View style={styles.iconCircleSuccess}>
              <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
            </View>
            <Text style={styles.title}>Email Verified! 🎉</Text>
            <Text style={styles.subtitle}>
              Your email address has been successfully verified. Your account is now active and ready to use.
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
            <Text style={styles.title}>Verification Link Issue</Text>
            <Text style={styles.subtitle}>
              {errorMsg.includes('invalid') || errorMsg.includes('expired')
                ? 'This verification link may have expired or already been used. If your account is already active, you can log in directly.'
                : errorMsg}
            </Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    justifyContent: 'center',
    padding: 24,
  },
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldGlowCenter: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
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
  contentBox: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircleLoading: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
