import { useEffect, useState } from 'react';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import NotificationBanner from '@/components/NotificationBanner';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import { hideBootSplash, markPrefetchDone } from '@/lib/boot-splash';
import { prefetchForRole } from '@/lib/boot-prefetch';

import { LogBox, Platform } from 'react-native';

LogBox.ignoreLogs(['"shadow*" style props are deprecated', '"elevation" style props are deprecated']);

if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && (args[0].includes('shadow*') || args[0].includes('elevation'))) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync();

/** Routes that never wait on app data, so the splash can lift as soon as auth settles. */
const PUBLIC_ROUTE_PREFIXES = [
  '(auth)',
  'b',
  'nfc',
  'join',
  'activate',
  'landing',
  'privacy',
  'terms',
  'confirm-email',
  'confirm-verification',
  'confirm-password-reset',
  'password-reset',
];

function AppContent() {
  const { user, isLoading, isAuthenticated, activeRole } = useAuth();
  const segments = useSegments() as string[];
  const segmentKey = segments.join('/');
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerBody, setBannerBody] = useState('');
  const [bannerType, setBannerType] = useState<'points' | 'reward' | 'campaign' | 'tier' | 'badge' | 'voucher' | 'system'>('system');

  // Keep the boot splash up until the destination screen is meaningful. The app's data
  // screens call markAppReady() once their first-paint fetches settle. Only routes that
  // never wait on data are listed here — anything unrecognised keeps the splash (the
  // 4s cap below guarantees it cannot get stuck).
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      hideBootSplash();
      return;
    }
    const root = segmentKey.split('/')[0] || '';
    if (PUBLIC_ROUTE_PREFIXES.includes(root)) {
      hideBootSplash();
      return;
    }
    // Warm every tab's data. Memoised per role+user, so repeated calls are free.
    prefetchForRole(activeRole, user).finally(markPrefetchDone);
  }, [isLoading, isAuthenticated, segmentKey, activeRole, user]);

  // Hard cap: a screen that never signals ready (onboarding gates, errors) must not
  // hold the splash indefinitely. Generous enough to prefer waiting over showing a
  // half-loaded dashboard; the inline HTML net behind it is 12s.
  useEffect(() => {
    if (isLoading) return;
    const cap = setTimeout(() => hideBootSplash(), 8000);
    return () => clearTimeout(cap);
  }, [isLoading]);

  return (
    <>
      <NotificationBanner
        visible={bannerVisible}
        title={bannerTitle}
        body={bannerBody}
        type={bannerType}
        onDismiss={() => setBannerVisible(false)}
      />
      <PwaInstallPrompt />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(merchant)" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
