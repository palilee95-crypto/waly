import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { handleSmartBack } from '@/lib/navigation';
import { colors, iconSizes, radii, spacing } from '@/theme';
import CustomerManagePanel from '@/components/customer-workspace/manage/CustomerManagePanel';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => handleSmartBack(router, '/(merchant)/manage-customers')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Back to customers"
        >
          <Ionicons name="arrow-back" size={iconSizes.lg} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.title}>Customer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        {customerId ? (
          <CustomerManagePanel
            customerId={String(customerId)}
            onDeleted={() => handleSmartBack(router, '/(merchant)/manage-customers')}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Customer not found.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.accent[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 17,
    color: colors.black,
  },
  headerSpacer: { width: 40 },
  body: { flex: 1, paddingHorizontal: spacing[4] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: colors.accent[500] },
});
