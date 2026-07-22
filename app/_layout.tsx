import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
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
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import NotificationBanner from '@/components/NotificationBanner';

import { LogBox, Platform } from 'react-native';

LogBox.ignoreLogs(['"shadow*" style props are deprecated']);

if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('shadow*')) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user } = useAuth();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerBody, setBannerBody] = useState('');
  const [bannerType, setBannerType] = useState<'points' | 'reward' | 'campaign' | 'tier' | 'badge' | 'voucher' | 'system'>('system');

  useEffect(() => {
    if (!user) return;

    // Subscribe to notification database events for this user (safely handled if collection removed)
    pb.collection('notifications').subscribe('*', (e) => {
      if (e.action === 'create') {
        const record = e.record;
        setBannerTitle(record.title || 'Notification');
        setBannerBody(record.body || '');
        setBannerType(record.type || 'system');
        setBannerVisible(true);
      }
    }, {
      filter: `recipient = '${user.id}'`,
    }).catch(() => {});

    return () => {
      pb.collection('notifications').unsubscribe('*').catch(() => {});
    };
  }, [user]);

  return (
    <>
      <NotificationBanner
        visible={bannerVisible}
        title={bannerTitle}
        body={bannerBody}
        type={bannerType}
        onDismiss={() => setBannerVisible(false)}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(merchant)" />
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
