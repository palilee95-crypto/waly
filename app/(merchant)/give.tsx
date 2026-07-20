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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

// QR code rendering — uses a simple image-based approach via public API
function QRCodeImage({ url, size }: { url: string; size: number }) {
  const encoded = encodeURIComponent(url);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=FFFFFF&color=000000&qzone=1`;
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore
      <img src={qrSrc} width={size} height={size} style={{ borderRadius: 12 }} alt="QR Code" />
    );
  }
  return (
    <Image source={{ uri: qrSrc }} style={{ width: size, height: size, borderRadius: 12 }} resizeMode="contain" />
  );
}

export default function QRGenerationScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [txCode, setTxCode] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingTxns(true);
      const res = await pb.send<{ transactions: any[] }>('/api/risev/qr/list', {
        method: 'GET',
        requestKey: null,
      });
      setTransactions(res.transactions || []);
    } catch (err) {
      console.warn('Failed to fetch QR transactions:', err);
    } finally {
      setLoadingTxns(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleGenerate = async () => {
    const bill = parseFloat(billAmount) || 0;
    const stamps = parseInt(stampAmount, 10) || 0;

    if (bill < 0) {
      return;
    }
    if (stamps < 1) {
      return;
    }

    setGenerating(true);
    try {
      const res = await pb.send<{ qrUrl: string; txCode: string }>('/api/risev/qr/generate', {
        method: 'POST',
        body: { bill_amount: bill, stamp_amount: stamps },
        requestKey: null,
      });
      setQrUrl(res.qrUrl);
      setTxCode(res.txCode);
      fetchTransactions();
    } catch (err: any) {
      console.warn('QR generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleNewQR = () => {
    setQrUrl(null);
    setTxCode(null);
    setBillAmount('');
    setStampAmount('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const statusColors: Record<string, string> = {
    pending: '#64748B',
    sent: '#475569',
    completed: '#000000',
    expired: '#EF4444',
  };

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <Text style={styles.headerTitle}>QR Code</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={styles.title}>Generate QR Code</Text>
          <Text style={styles.subtitle}>
            Enter the bill amount and stamps to issue. Customer scans this QR to send a WhatsApp message and claim their stamps.
          </Text>
        </View>

        {/* QR Generation Card */}
        <View style={styles.card}>
          {qrUrl ? (
            // ── QR Display ──────────────────────────────
            <View style={styles.qrDisplaySection}>
              <View style={styles.qrImageWrap}>
                <QRCodeImage url={qrUrl} size={240} />
              </View>

              <View style={styles.qrInfoRow}>
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>BILL</Text>
                  <Text style={styles.qrInfoValue}>RM {billAmount}</Text>
                </View>
                <View style={styles.qrInfoDivider} />
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>STAMPS</Text>
                  <Text style={styles.qrInfoValue}>{stampAmount}</Text>
                </View>
                <View style={styles.qrInfoDivider} />
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>CODE</Text>
                  <Text style={styles.qrInfoValue}>{txCode}</Text>
                </View>
              </View>

              <Text style={styles.qrHint}>
                Show this QR to your customer. It expires after they send the WhatsApp message.
              </Text>

              <TouchableOpacity style={styles.newQrBtn} onPress={handleNewQR} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.newQrBtnText}>Generate New QR</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Input Form ──────────────────────────────
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>BILL AMOUNT (RM)</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputPrefix}>RM</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                    value={billAmount}
                    onChangeText={(text) => setBillAmount(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor="#BEC6E0"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>STAMPS TO ISSUE</Text>
                <View style={styles.inputGroup}>
                  <Ionicons name="ribbon-outline" size={20} color="#64748B" style={{ marginLeft: 12 }} />
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                    value={stampAmount}
                    onChangeText={(text) => setStampAmount(text.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 2"
                    placeholderTextColor="#BEC6E0"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.generateBtn, (!stampAmount || generating) && styles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={!stampAmount || generating}
                activeOpacity={0.8}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.generateBtnText}>Generate QR Code</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Recent QR Codes</Text>

          {loadingTxns ? (
            <ActivityIndicator size="small" color="#000000" style={{ marginVertical: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="qr-code-outline" size={36} color="#E2E8F0" />
              <Text style={styles.emptyText}>No QR codes generated yet.</Text>
            </View>
          ) : (
            <View style={styles.txnList}>
              {transactions.map((tx) => (
                <View key={tx.id} style={styles.txnRow}>
                  <View style={styles.txnLeft}>
                    <Text style={styles.txnCode}>{tx.tx_code}</Text>
                    <Text style={styles.txnMeta}>
                      RM {tx.bill_amount} · {tx.stamp_amount} stamps
                      {tx.customer_phone ? ` · ${tx.customer_phone}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (statusColors[tx.status] || '#64748B') + '15' }]}>
                    <Text style={[styles.statusText, { color: statusColors[tx.status] || '#64748B' }]}>
                      {tx.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  introSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
  },
  inputPrefix: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    paddingHorizontal: 8,
  },
  generateBtn: {
    backgroundColor: '#000000',
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // QR Display
  qrDisplaySection: {
    alignItems: 'center',
  },
  qrImageWrap: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  qrPlaceholder: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrInfoItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  qrInfoLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  qrInfoValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  qrInfoDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  qrHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  newQrBtn: {
    backgroundColor: '#000000',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  newQrBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // History
  historySection: {
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 8,
  },
  txnList: {
    gap: 8,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  txnLeft: {
    flex: 1,
  },
  txnCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginBottom: 2,
  },
  txnMeta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
  },
});