import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ActivateStandPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; c?: string }>();
  const { user, refreshSession } = useAuth();
  const { locale } = useLanguage();

  const incomingCode = (params.code || params.c || '').trim().toUpperCase();
  const [code, setCode] = useState(incomingCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (incomingCode) {
      // Forward directly to the smart NFC self-pairing & stamp card screen
      router.replace({
        pathname: '/nfc' as any,
        params: { c: incomingCode },
      });
    }
  }, [incomingCode]);

  const handleRedeem = async () => {
    const formattedCode = code.trim().toUpperCase();
    if (!formattedCode) {
      setError(locale === 'en' ? 'Please enter your activation code' : 'Sila masukkan kod pengaktifan anda');
      return;
    }

    if (!user) {
      // Prompt user to login or register first
      Alert.alert(
        locale === 'en' ? 'Sign In Required' : 'Log Masuk Diperlukan',
        locale === 'en'
          ? 'Please log in or create your Risev merchant account first to link your stand.'
          : 'Sila log masuk atau daftar akaun peniaga Risev terlebih dahulu untuk mengaktifkan stand anda.',
        [
          { text: locale === 'en' ? 'Sign In' : 'Log Masuk', onPress: () => router.push('/(auth)/login' as any) },
          { text: locale === 'en' ? 'Cancel' : 'Batal', style: 'cancel' }
        ]
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await pb.send<{ success: boolean; message: string; plan?: string }>('/api/risev/merchant/redeem-stand-code', {
        method: 'POST',
        body: { code: formattedCode }
      });

      if (res.success) {
        setSuccess(true);
        await refreshSession();
      } else {
        setError(res.message || 'Invalid activation code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate stand.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Branding */}
        <View style={styles.header}>
          <Image
            source={require('../assets/risev logo.png')}
            style={styles.logo}
          />
          <View style={styles.badge}>
            <Ionicons name="hardware-chip" size={14} color="#D97706" />
            <Text style={styles.badgeText}>OFFICIAL HARDWARE ACTIVATION</Text>
          </View>
        </View>

        {success ? (
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>
              {locale === 'en' ? 'NFC Stand Activated!' : 'Stand NFC Diaktifkan!'}
            </Text>
            <Text style={styles.successDesc}>
              {locale === 'en'
                ? 'Your 500 customer database capacity is now active with no expiration date. Place your stand at your counter and start collecting members!'
                : 'Kapasiti 500 pelanggan anda kini aktif tanpa tarikh luput. Letakkan stand di kaunter anda dan mula kumpul ahli!'}
            </Text>

            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => router.replace('/(merchant)')}
              activeOpacity={0.85}
            >
              <Text style={styles.dashboardBtnText}>
                {locale === 'en' ? 'Go to Merchant Dashboard →' : 'Buka Papan Pemuka Peniaga →'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>
              {locale === 'en' ? 'Activate Your Risev NFC Stand' : 'Aktifkan Stand NFC Risev Anda'}
            </Text>
            <Text style={styles.subtitle}>
              {locale === 'en'
                ? 'Enter the unique Activation Code found on your package card to unlock 500 free customer database capacity.'
                : 'Masukkan Kod Pengaktifan dari kad bungkusan anda untuk membuka kuota 500 pelanggan percuma.'}
            </Text>

            {/* Code Input */}
            <Text style={styles.inputLabel}>
              {locale === 'en' ? 'STAND ACTIVATION CODE' : 'KOD PENGAKTIFAN STAND'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. STAND-9482-K7L1"
              placeholderTextColor="#94A3B8"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Redeem Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleRedeem}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {locale === 'en' ? 'Unlock 500 Customer Quota' : 'Buka Kuota 500 Pelanggan'}
                </Text>
              )}
            </TouchableOpacity>

            {!user && (
              <View style={styles.authNotice}>
                <Text style={styles.authNoticeText}>
                  {locale === 'en' ? 'New to Risev? ' : 'Baru di Risev? '}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
                  <Text style={styles.authLinkText}>
                    {locale === 'en' ? 'Register / Log in here' : 'Daftar / Log masuk di sini'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    padding: 24,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 20,
  },
  logo: {
    width: 120,
    height: 36,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  authNotice: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  authNoticeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  authLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    textDecorationLine: 'underline',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  dashboardBtn: {
    backgroundColor: '#050505',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  dashboardBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
});
