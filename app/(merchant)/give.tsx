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

// QR code rendering — uses a clean high-contrast image generator
function QRCodeImage({ url, size }: { url: string; size: number }) {
  const encoded = encodeURIComponent(url);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=FFFFFF&color=0F172A&qzone=1`;
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore
      <img src={qrSrc} width={size} height={size} style={{ borderRadius: 16, display: 'block' }} alt="QR Code" />
    );
  }
  return (
    <Image source={{ uri: qrSrc }} style={{ width: size, height: size, borderRadius: 16 }} resizeMode="contain" />
  );
}

export default function QRGenerationScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [txCode, setTxCode] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingTxns(true);
      const headers: Record<string, string> = {};
      if (pb.authStore.token) {
        headers['Authorization'] = pb.authStore.token;
      }
      const res = await pb.send<{ transactions: any[] }>('/api/risev/qr/list', {
        method: 'GET',
        headers,
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
    const stamps = parseInt(stampAmount, 10) || 1;

    if (bill < 0 || stamps < 1) return;

    setGenerating(true);
    try {
      const headers: Record<string, string> = {};
      if (pb.authStore.token) {
        headers['Authorization'] = pb.authStore.token;
      }
      const res = await pb.send<{ qrUrl: string; txCode: string }>('/api/risev/qr/generate', {
        method: 'POST',
        headers,
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
    setStampAmount('1');
    setCopiedLink(false);
  };

  const handleCopyLink = () => {
    if (!qrUrl) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(qrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const statusConfig: Record<string, { label: string; bg: string; color: string; icon: any }> = {
    pending: { label: 'PENDING SCAN', bg: '#FEF3C7', color: '#D97706', icon: 'time-outline' },
    sent: { label: 'WA OPENED', bg: '#E0F2FE', color: '#0284C7', icon: 'logo-whatsapp' },
    completed: { label: 'STAMPS CREDITED', bg: '#DCFCE7', color: '#16A34A', icon: 'checkmark-circle' },
    expired: { label: 'EXPIRED', bg: '#FEE2E2', color: '#DC2626', icon: 'alert-circle-outline' },
  };

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Sleek Top Header Bar */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 860, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.headerTitleGroup}>
          <Ionicons name="qr-code-outline" size={22} color="#1E1B4B" />
          <Text style={styles.headerTitle}>Issue Stamps</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={fetchTransactions} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 860, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />
        }
      >
        {/* Premium Hero Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="flash-sharp" size={12} color="#F4A825" />
            <Text style={styles.heroBadgeText}>INBOUND WHATSAPP STAMPS</Text>
          </View>
          <Text style={styles.heroTitle}>Generate Customer QR</Text>
          <Text style={styles.heroSubtitle}>
            Customer scans this QR to send a pre-filled WhatsApp message directly to your store line. Stamps are credited instantly!
          </Text>
        </View>

        {/* QR Generator Main Card */}
        <View style={styles.card}>
          {qrUrl ? (
            // ── QR Code Display View ──────────────────────────────
            <View style={styles.qrDisplaySection}>
              <View style={styles.qrCardHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.qrCardHeaderTitle}>QR Ready to Scan</Text>
              </View>

              <View style={styles.qrImageWrap}>
                <QRCodeImage url={qrUrl} size={220} />
              </View>

              <View style={styles.qrInfoBadge}>
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>BILL AMOUNT</Text>
                  <Text style={styles.qrInfoValue}>RM {parseFloat(billAmount || '0').toFixed(2)}</Text>
                </View>
                <View style={styles.qrInfoDivider} />
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>STAMPS</Text>
                  <Text style={styles.qrInfoValue}>{stampAmount} 🎁</Text>
                </View>
                <View style={styles.qrInfoDivider} />
                <View style={styles.qrInfoItem}>
                  <Text style={styles.qrInfoLabel}>CODE</Text>
                  <Text style={styles.qrInfoValueCode}>{txCode}</Text>
                </View>
              </View>

              <Text style={styles.qrHint}>
                Present this QR code to the customer. When scanned, WhatsApp will open automatically to complete the transaction.
              </Text>

              <View style={styles.actionBtnRow}>
                {Platform.OS === 'web' && (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyLink} activeOpacity={0.8}>
                    <Ionicons name={copiedLink ? "checkmark" : "copy-outline"} size={16} color="#0F172A" />
                    <Text style={styles.secondaryBtnText}>{copiedLink ? 'Copied!' : 'Copy Link'}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.primaryBtn} onPress={handleNewQR} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Generate New QR</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // ── Input Form View ──────────────────────────────
            <>
              {/* Bill Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>BILL AMOUNT (RM)</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputPrefix}>RM</Text>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null
                    ]}
                    value={billAmount}
                    onChangeText={(text) => setBillAmount(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
                {/* Preset Chips */}
                <View style={styles.chipRow}>
                  {['10', '20', '50', '100'].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, billAmount === preset && styles.presetChipActive]}
                      onPress={() => setBillAmount(preset)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, billAmount === preset && styles.presetChipTextActive]}>
                        RM {preset}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Stamp Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>STAMPS TO ISSUE</Text>
                <View style={styles.inputGroup}>
                  <Ionicons name="ribbon-outline" size={20} color="#0F172A" style={{ marginLeft: 14 }} />
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null
                    ]}
                    value={stampAmount}
                    onChangeText={(text) => setStampAmount(text.replace(/[^0-9]/g, ''))}
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                  />
                </View>
                {/* Stamp Chips */}
                <View style={styles.chipRow}>
                  {['1', '2', '3', '5'].map((stamps) => (
                    <TouchableOpacity
                      key={stamps}
                      style={[styles.presetChip, stampAmount === stamps && styles.presetChipActive]}
                      onPress={() => setStampAmount(stamps)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, stampAmount === stamps && styles.presetChipTextActive]}>
                        {stamps} {stamps === '1' ? 'Stamp' : 'Stamps'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                style={[styles.generateBtn, (!stampAmount || generating) && styles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={!stampAmount || generating}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                    <Text style={styles.generateBtnText}>Generate Stamp QR</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Recent Transactions List */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent QR Activity</Text>
            <Text style={styles.historyCount}>{transactions.length} total</Text>
          </View>

          {loadingTxns ? (
            <ActivityIndicator size="small" color="#000000" style={{ marginVertical: 32 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="qr-code-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No QR Codes Generated</Text>
              <Text style={styles.emptySub}>
                Generated QR codes will show up here along with live customer scanning activity.
              </Text>
            </View>
          ) : (
            <View style={styles.txnList}>
              {transactions.map((tx) => {
                const conf = statusConfig[tx.status] || {
                  label: tx.status.toUpperCase(),
                  bg: '#F1F5F9',
                  color: '#64748B',
                  icon: 'help-circle-outline',
                };
                return (
                  <View key={tx.id} style={styles.txnRow}>
                    <View style={styles.txnIconCircle}>
                      <Ionicons name="receipt-outline" size={18} color="#0F172A" />
                    </View>
                    <View style={styles.txnLeft}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.txnCode}>{tx.tx_code}</Text>
                        <Text style={styles.txnAmount}>RM {parseFloat(tx.bill_amount || 0).toFixed(2)}</Text>
                      </View>
                      <Text style={styles.txnMeta}>
                        {tx.stamp_amount} {tx.stamp_amount === 1 ? 'stamp' : 'stamps'}
                        {tx.customer_phone ? ` · ${tx.customer_phone}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: conf.bg }]}>
                      <Ionicons name={conf.icon} size={11} color={conf.color} />
                      <Text style={[styles.statusText, { color: conf.color }]}>{conf.label}</Text>
                    </View>
                  </View>
                );
              })}
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
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  // Hero Banner
  heroCard: {
    backgroundColor: '#1C1340',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#1C1340',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F4A825',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#CBD5E1',
    lineHeight: 19,
  },
  // Card Form
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    height: 52,
  },
  inputPrefix: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    paddingHorizontal: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  generateBtn: {
    backgroundColor: '#000000',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  generateBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
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
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  qrCardHeaderTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#10B981',
  },
  qrImageWrap: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  qrInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    width: '100%',
  },
  qrInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  qrInfoLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  qrInfoValue: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  qrInfoValueCode: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  qrInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  qrHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#000000',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  // History Section
  historySection: {
    marginTop: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  historyCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  txnList: {
    gap: 10,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  txnIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnLeft: {
    flex: 1,
  },
  txnCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  txnAmount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  txnMeta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.4,
  },
});