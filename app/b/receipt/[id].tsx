import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { PaidReceipt, receiptFromPublicPayload } from '@/lib/paidReceipt';
import ThermalReceiptScreen from '@/components/ThermalReceiptScreen';

// A receipt link carries a share token, not the record id: the id is not a
// credential and the collection itself is no longer public. The public route
// returns only the fields a receipt needs (no customer phone or account ids).
export default function DigitalReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<PaidReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    let mounted = true;
    if (!id || !/^[A-Za-z0-9]{16,64}$/.test(id)) {
      setLoading(false); setError('This receipt link is invalid.');
      return;
    }
    setLoading(true); setError('');
    pb.send<{ receipt?: any }>('/api/risev/receipt/public', {
      method: 'GET', params: { token: id }, requestKey: null,
    })
      .then((res) => {
        if (!mounted) return;
        const record = res?.receipt;
        if (!record) {
          setError('A receipt is not available for this transaction.');
          return;
        }
        // Same mapper the customer's in-app slip uses, so this page and the
        // merchant's receipt render the identical slip (logo, transaction row,
        // payment reference and all).
        const mapped = receiptFromPublicPayload(record, String(id));
        if (!mapped) {
          setError('A receipt is not available for this transaction.');
          return;
        }
        setReceipt(mapped);
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
