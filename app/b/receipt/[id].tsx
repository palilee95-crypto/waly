import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { PaidReceipt } from '@/lib/paidReceipt';
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
        const numberOrUndefined = (value: any) => (value === null || value === undefined || value === ''
          ? undefined
          : Number(value));
        setReceipt({
          id,
          receipt_number: String(record.receipt_number || ''),
          created: String(record.created || ''),
          merchant: '',
          customer_name: String(record.customer_name || ''),
          staff_name: String(record.staff_name || ''),
          branch_name: String(record.branch_name || ''),
          line_items: Array.isArray(record.line_items) ? record.line_items : [],
          subtotal: Number(record.subtotal) || 0,
          discount_amount: Number(record.discount_amount) || 0,
          total_amount: Number(record.total_amount) || 0,
          payment_method: String(record.payment_method || ''),
          payment_status: String(record.payment_status || ''),
          stamps_earned: Number(record.stamps_earned) || 0,
          stamps_before: numberOrUndefined(record.stamps_before),
          stamps_balance: numberOrUndefined(record.stamps_balance),
          stamp_goal: numberOrUndefined(record.stamp_goal),
          reward_name: String(record.reward_name || ''),
          expand: {
            merchant: {
              id: String(record.merchant_id || ''),
              name: String(record.merchant_name || ''),
              logo: String(record.merchant_logo || ''),
            },
          },
        });
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
