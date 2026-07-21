import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

export default function GiveStampsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [phoneInput, setPhoneInput] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedNfcLink, setCopiedNfcLink] = useState(false);

  const merchantId = user?.merchant_id;
  const nfcUrl = merchantId ? `https://waly-five.vercel.app/nfc?m=${merchantId}` : '';

  // 1. Fetch recent transactions for active merchant
  const fetchTransactions = useCallback(async () => {
    if (!merchantId) return;
    try {
      setLoadingTxns(true);
      const res = await pb.collection('transactions').getList(1, 10, {
        filter: `merchant = '${merchantId}'`,
        sort: '-created',
        expand: 'customer',
      });
      setTransactions(res.items || []);
    } catch (err) {
      console.warn('Failed to fetch recent transactions:', err);
    } finally {
      setLoadingTxns(false);
    }
  }, [merchantId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // 2. Submit Manual Stamp Issuance
  const handleManualIssue = async () => {
    if (!phoneInput.trim()) {
      Alert.alert('Validation Error', 'Please enter customer phone number.');
      return;
    }

    const bill = parseFloat(billAmount) || 0;
    const stamps = parseInt(stampAmount, 10) || 1;
    if (stamps < 1) {
      Alert.alert('Validation Error', 'Stamps to issue must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      const res = await pb.send<{ success: boolean; message: string; customerName: string }>(
        '/api/risev/merchant/give-manual',
        {
          method: 'POST',
          body: {
            phone: phoneInput.trim(),
            bill_amount: bill,
            stamp_amount: stamps,
          },
        }
      );

      setSuccessMsg(res.message || `${stamps} stamp(s) credited successfully!`);
      setPhoneInput('');
      setBillAmount('');
      setStampAmount('1');
      fetchTransactions();
    } catch (err: any) {
      const msg = err?.message || 'Failed to issue stamps manually.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyNfcLink = () => {
    if (!nfcUrl) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(nfcUrl);
      setCopiedNfcLink(true);
      setTimeout(() => setCopiedNfcLink(false), 2500);
    } else {
      Alert.alert('NFC Store Link', nfcUrl);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 860, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.headerTitleGroup}>
          <Ionicons name="card-outline" size={22} color="#1E1B4B" />
          <Text style={styles.headerTitle}>Issue Stamps</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={fetchTransactions} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 860, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />}
      >
        {/* Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="hand-right-sharp" size={12} color="#F4A825" />
            <Text style={styles.heroBadgeText}>MANUAL STAMP ISSUANCE</Text>
          </View>
          <Text style={styles.heroTitle}>Issue Stamps directly to Customer</Text>
          <Text style={styles.heroSubtitle}>
            Enter customer phone number to credit loyalty stamps manually if NFC card is unavailable.
          </Text>
        </View>

        {/* Success Alert */}
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Manual Issue Form Card */}
        <View style={styles.card}>
          {/* Customer Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>CUSTOMER PHONE NUMBER</Text>
            <View style={styles.inputWrap}>
              <View style={styles.prefixBox}>
                <Text style={styles.flag}>🇲🇾</Text>
                <Text style={styles.prefixCode}>+60</Text>
                <View style={styles.prefixDivider} />
              </View>
              <TextInput
                style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                placeholder="11 234 5678"
                placeholderTextColor="#94A3B8"
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Bill Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>BILL AMOUNT (RM)</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>RM</Text>
              <TextInput
                style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                value={billAmount}
                onChangeText={setBillAmount}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Quick Bill Presets */}
            <View style={styles.presetRow}>
              {['10', '20', '50', '100'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetPill, billAmount === amt && styles.presetPillActive]}
                  onPress={() => setBillAmount(amt)}
                >
                  <Text style={[styles.presetText, billAmount === amt && styles.presetTextActive]}>RM {amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Stamps to Issue Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>STAMPS TO ISSUE</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="ribbon-outline" size={20} color="#64748B" style={{ marginLeft: 16, marginRight: 8 }} />
              <TextInput
                style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                placeholder="1"
                placeholderTextColor="#94A3B8"
                value={stampAmount}
                onChangeText={setStampAmount}
                keyboardType="number-pad"
              />
            </View>

            {/* Quick Stamp Presets */}
            <View style={styles.presetRow}>
              {['1', '2', '3', '5'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.presetPill, stampAmount === s && styles.presetPillActive]}
                  onPress={() => setStampAmount(s)}
                >
                  <Text style={[styles.presetText, stampAmount === s && styles.presetTextActive]}>
                    {s} {parseInt(s) === 1 ? 'Stamp' : 'Stamps'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
            onPress={handleManualIssue}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Issue Stamps Directly</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Manual & Activity Log */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity Log</Text>
            <Text style={styles.sectionCount}>{transactions.length} total</Text>
          </View>

          {loadingTxns ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#000000" />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Recent Activity</Text>
              <Text style={styles.emptySubtitle}>Issued stamps will appear here in real time.</Text>
            </View>
          ) : (
            transactions.map((item) => (
              <View key={item.id} style={styles.txnCard}>
                <View style={styles.txnIconBg}>
                  <Ionicons name="ribbon-outline" size={18} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnName}>{item.expand?.customer?.name || item.expand?.customer?.phone || 'Customer'}</Text>
                  <Text style={styles.txnDate}>{new Date(item.created).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.txnStamps}>+{item.stamps} Stamp(s)</Text>
                  <Text style={styles.txnBill}>RM {parseFloat(item.bill_amount || 0).toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scrollContent: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F4A825',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94A3B8',
    lineHeight: 20,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#065F46',
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  flag: {
    fontSize: 16,
    marginRight: 6,
  },
  prefixCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetPill: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetPillActive: {
    backgroundColor: '#0F172A',
  },
  presetText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  primaryBtn: {
    height: 54,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  nfcCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 24,
  },
  nfcHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  nfcIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nfcCardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#312E81',
  },
  nfcCardSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#4338CA',
  },
  nfcLinkBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 12,
  },
  nfcLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#3730A3',
  },
  nfcCopyBtn: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nfcCopyBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  historySection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  txnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txnIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  txnDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  txnStamps: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#4F46E5',
  },
  txnBill: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
});