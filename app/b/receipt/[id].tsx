import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { PaidReceipt } from '@/lib/paidReceipt';
import ThermalReceiptScreen from '@/components/ThermalReceiptScreen';

// A receipt URL is a read-only view of the same server record used at checkout.
// Never invent demo receipt data when a request fails.
export default function DigitalReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<PaidReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    let mounted = true;
    if (!id || !/^[a-z0-9]{15}$/.test(id)) {
      setLoading(false); setError('This receipt link is invalid.');
      return;
    }
    setLoading(true); setError('');
    pb.collection('digital_receipts').getOne<PaidReceipt>(id, { expand: 'merchant', requestKey: null })
      .then((record) => {
        if (!mounted) return;
        if (record.payment_status !== 'paid' || Number(record.total_amount) <= 0) {
          setError('A paid receipt is not available for this transaction.');
        } else setReceipt(record);
      })
      .catch(() => { if (mounted) setError('Could not load this receipt. Please try again later.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  return <SafeAreaView style={styles.page}>
    {loading ? <ActivityIndicator color="#FFCC00" /> : error ? <View style={styles.errorWrap}>
      <Ionicons name="receipt-outline" size={38} color="#A4ACB7" />
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.back} onPress={goBack}><Text style={styles.backText}>Go back</Text></TouchableOpacity>
    </View> : null}
    <ThermalReceiptScreen visible={!!receipt} receipt={receipt} mode="customer" onClose={goBack} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  errorWrap: { alignItems: 'center', padding: 24, gap: 16 }, error: { textAlign: 'center', color: '#596273', fontSize: 15 },
  back: { backgroundColor: '#FFCC00', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 }, backText: { color: '#111', fontWeight: '800' },
});
