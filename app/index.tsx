import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, storage } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/theme';
import { pb } from '@/lib/pocketbase';

export default function Index() {
  const { isAuthenticated, isLoading, activeRole } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();

  useEffect(() => {
    if (isLoading) return;

    const handleRedirect = async () => {
      // 1. If there's a ref code in query parameters, store it and record the click
      if (params.ref) {
        try {
          await storage.setItem('waly_referral_code', params.ref);
          console.log('[Index] Stored referral code:', params.ref);
          
          // Send background click tracking request to server
          await pb.send(`/api/risev/agent/click?ref=${encodeURIComponent(params.ref)}`, { method: 'GET' });
          console.log('[Index] Click recorded successfully');
        } catch (err) {
          console.warn('[Index] Error storing ref code or recording click:', err);
        }
      }

      // 2. Perform the redirect
      if (!isAuthenticated) {
        router.replace({
          pathname: '/(auth)/login',
          params: params.ref ? { ref: params.ref } : {}
        });
      } else if (activeRole === 'merchant') {
        router.replace('/(merchant)');
      } else {
        router.replace('/(customer)');
      }
    };

    handleRedirect();
  }, [isLoading, isAuthenticated, activeRole, params.ref]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.bg }}>
      <ActivityIndicator color={colors.primary.DEFAULT} size="large" />
    </View>
  );
}
