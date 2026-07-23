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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

export default function GiveStampsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Default to Scan Voucher QR tab first (per user request)
  const [activeTab, setActiveTab] = useState<'voucher' | 'manual'>('voucher');

  // Camera Scanner States
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Voucher Scanner States
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  // Manual Issuance States
  const [phoneInput, setPhoneInput] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [stampAmount, setStampAmount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const merchantId = user?.merchant_id;

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

  // 2. Submit Voucher Code Redemption
  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Please enter or scan a voucher code.');
      return;
    }

    setIsRedeemingVoucher(true);
    setVoucherError('');
    setSuccessMsg(null);

    try {
      const code = voucherCode.trim().toUpperCase();
      const vouchers = await pb.collection('vouchers').getFullList({
        filter: `code = "${code}" && status = "active"`,
        expand: 'reward,customer',
      });

      if (vouchers.length === 0) {
        setVoucherError('Invalid, expired, or already used voucher code.');
        setIsRedeemingVoucher(false);
        return;
      }

      const v = vouchers[0];
      await pb.collection('vouchers').update(v.id, {
        status: 'used',
      });

      const customerName = v.expand?.customer?.name || v.expand?.customer?.phone || 'Customer';
      const rewardName = v.expand?.reward?.title || 'Reward';

      setSuccessMsg(`Voucher ${code} redeemed for ${customerName} (${rewardName})!`);
      setVoucherCode('');
      setIsCameraActive(false);
      fetchTransactions();
    } catch (err: any) {
      setVoucherError(err?.message || 'Failed to redeem voucher.');
    } finally {
      setIsRedeemingVoucher(false);
    }
  };

  // 3. Camera Scan Handler
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (data) {
      setVoucherCode(data.trim());
      setIsCameraActive(false);
      setVoucherError('');
    }
  };

  // 4. Submit Manual Stamp Issuance
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
          <Ionicons name="card-outline" size={22} color="#000000" />
          <Text style={styles.headerTitle}>Issue & Redeem</Text>
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
        {/* Segment Tab Selector (Monochrome Black & White) */}
        <View style={styles.tabBarWrap}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'voucher' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('voucher');
              setSuccessMsg(null);
              setVoucherError('');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color={activeTab === 'voucher' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabBtnText, activeTab === 'voucher' && styles.tabBtnTextActive]}>
              Scan Voucher QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'manual' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('manual');
              setSuccessMsg(null);
              setVoucherError('');
              setIsCameraActive(false);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color={activeTab === 'manual' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabBtnText, activeTab === 'manual' && styles.tabBtnTextActive]}>
              Manual Issuance
            </Text>
          </TouchableOpacity>
        </View>

        {/* Success Alert */}
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 1: VOUCHER QR SCANNER & REDEMPTION FORM */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'voucher' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Voucher Redemption Scanner</Text>
            <Text style={styles.cardSubtitle}>
              Scan customer QR code or enter voucher code (e.g. WV-XXXX-XXXX) to redeem rewards.
            </Text>

            {/* Viewfinder & Camera Scanner Card */}
            <View style={styles.viewfinderCard}>
              {isCameraActive ? (
                permission?.granted ? (
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    onBarcodeScanned={handleBarCodeScanned}
                  >
                    <View style={styles.scannerOverlay}>
                      <View style={styles.scanTargetBox}>
                        <View style={[styles.cornerBracket, styles.topLeft]} />
                        <View style={[styles.cornerBracket, styles.topRight]} />
                        <View style={[styles.cornerBracket, styles.bottomLeft]} />
                        <View style={[styles.cornerBracket, styles.bottomRight]} />
                      </View>
                    </View>
                  </CameraView>
                ) : (
                  <View style={styles.cameraFallbackWrap}>
                    <Text style={styles.cameraFallbackText}>Camera permission needed to scan QR codes</Text>
                    <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                      <Text style={styles.permissionBtnText}>Grant Camera Permission</Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                <View style={styles.viewfinderPlaceholder}>
                  <View style={styles.scannerTargetGraphic}>
                    <Ionicons name="qr-code" size={44} color="#FFFFFF" />
                    <View style={[styles.cornerBracket, styles.topLeft]} />
                    <View style={[styles.cornerBracket, styles.topRight]} />
                    <View style={[styles.cornerBracket, styles.bottomLeft]} />
                    <View style={[styles.cornerBracket, styles.bottomRight]} />
                  </View>
                  <Text style={styles.viewfinderHint}>Align QR code inside scanner frame</Text>
                  <TouchableOpacity
                    style={styles.activateCameraBtn}
                    onPress={async () => {
                      if (!permission?.granted) {
                        const res = await requestPermission();
                        if (res.granted) setIsCameraActive(true);
                      } else {
                        setIsCameraActive(true);
                      }
                    }}
                  >
                    <Ionicons name="camera-outline" size={18} color="#000000" />
                    <Text style={styles.activateCameraBtnText}>Open Camera Scanner</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {voucherError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorBannerText}>{voucherError}</Text>
              </View>
            ) : null}

            {/* Voucher Code Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>VOUCHER CODE</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="qr-code-outline" size={20} color="#64748B" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                  placeholder="e.g. WV-1234-5678"
                  placeholderTextColor="#94A3B8"
                  value={voucherCode}
                  onChangeText={(text) => {
                    setVoucherCode(text);
                    setVoucherError('');
                  }}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Redeem Button (Sleek Black & White) */}
            <TouchableOpacity
              style={[styles.primaryBtn, isRedeemingVoucher && styles.primaryBtnDisabled]}
              onPress={handleRedeemVoucher}
              disabled={isRedeemingVoucher}
              activeOpacity={0.8}
            >
              {isRedeemingVoucher ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="gift-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Redeem Voucher Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 2: MANUAL ISSUANCE FORM */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'manual' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Manual Stamp Issuance</Text>
            <Text style={styles.cardSubtitle}>
              Enter customer phone number to credit loyalty stamps directly if NFC card is unavailable.
            </Text>

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
                      {s} {parseInt(s, 10) === 1 ? 'Stamp' : 'Stamps'}
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
        )}
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
    color: '#000000',
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

  // Segment Tab Selector (Monochrome Black & White)
  tabBarWrap: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
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
  cardTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },

  // Viewfinder & Camera Scanner Card
  viewfinderCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraView: {
    width: '100%',
    height: 240,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanTargetBox: {
    width: 180,
    height: 180,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
  },
  viewfinderPlaceholder: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  scannerTargetGraphic: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 14,
  },
  cornerBracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  viewfinderHint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  activateCameraBtn: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  activateCameraBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  cameraFallbackWrap: {
    padding: 20,
    alignItems: 'center',
  },
  cameraFallbackText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#000000',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
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
    color: '#000000',
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
    color: '#000000',
    marginLeft: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
    color: '#000000',
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
    color: '#000000',
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
    color: '#000000',
  },
  txnBill: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
});