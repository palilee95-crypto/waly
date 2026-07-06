import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/theme';

export default function Index() {
  const { isAuthenticated, isLoading, activeRole } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.bg }}>
        <ActivityIndicator color={colors.primary.DEFAULT} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (activeRole === 'merchant') {
    return <Redirect href="/(merchant)" />;
  }

  return <Redirect href="/(customer)" />;
}
