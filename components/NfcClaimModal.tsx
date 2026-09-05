import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function NfcClaimModal() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id;

  const [claim, setClaim] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billAmount, setBillAmount] = useState('10');
  const [stampAmount, setStampAmount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [merchantColor, setMerchantColor] = useState('#5C3BCC');

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      try {
        const m = await pb.collection('merchants').getOne(merchantId);
        if (m?.onboarding_primary_color) {
          setMerchantColor(m.onboarding_primary_color);
        }
      } catch (e) {}
    })();
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;

    // 1. Initial fetch for any unhandled pending claims
    const fetchPendingClaims = async () => {
      try {
        const records = await pb.collection('nfc_claims').getList(1, 1, {
          filter: `merchant = '${merchantId}' && status = 'pending'`,
          sort: '-created',
        });
        if (records.items.length > 0) {
          setClaim(records.items[0]);
          setIsVisible(true);
        }
      } catch (err) {
        /* ignore */
      }
    };

    fetchPendingClaims();

    // 2. Realtime PocketBase SSE Subscription
    let unsubscribe: any = null;
    pb.collection('nfc_claims').subscribe('*', (e: any) => {
      const record = e.record;
      if (record && record.merchant === merchantId && record.status === 'pending') {
        setClaim(record);
        setIsSuccess(false);
        setErrorMsg(null);
        setIsVisible(true);
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    }).catch(() => {});

    return () => {
      if (unsubscribe) unsubscribe();
      pb.collection('nfc_claims').unsubscribe('*').catch(() => {});
    };
  }, [merchantId]);

  const handleConfirm = async () => {
    if (!claim) return;
    const bill = parseFloat(billAmount) || 0;
    const stamps = parseInt(stampAmount) || 1;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await pb.send('/api/risev/nfc/complete', {
        method: 'POST',
        body: {
          claim_id: claim.id,
          bill_amount: bill,
          stamp_amount: stamps,
          branch_name: user?.branch_name || '',
          branch_id: user?.branch || '',
        },
      });

      // Show sleek in-modal success view
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to issue stamps.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setClaim(null);
    setIsSuccess(false);
    setErrorMsg(null);
    setBillAmount('10');
    setStampAmount('1');
  };

  const handleDismiss = async () => {
    if (claim && !isSuccess) {
      try {
        await pb.collection('nfc_claims').update(claim.id, { status: 'cancelled' });
      } catch (err) { /* ignore */ }
    }
    handleClose();
  };

  if (!isVisible || !claim) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {isSuccess ? (
            // ── In-Modal Success Confirmation Screen ──────────────
            <View style={styles.successWrap}>
              <View style={styles.successIconBg}>
                <Ionicons name="checkmark-circle" size={42} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Stamps Issued Successfully!</Text>
              <Text style={styles.successSubtitle}>
                {stampAmount} stamp(s) credited to <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400' }}>{claim.customer_name || 'Customer'}</Text>
              </Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{claim.customer_name || 'Customer'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phone</Text>
                  <Text style={styles.summaryValue}>{claim.customer_phone}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bill Amount</Text>
                  <Text style={styles.summaryValue}>RM {parseFloat(billAmount || '0').toFixed(2)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Handled by</Text>
                  <Text style={[styles.summaryValue, { color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                    {user?.name || 'Staff'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Stamps Added</Text>
                  <View style={styles.stampPillBadge}>
                    <Ionicons name="ribbon" size={12} color="#10B981" />
                    <Text style={styles.summaryValueStamps}>+{stampAmount} stamps</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Main Claim Form View ──────────────────────────────
            (() => {
              const getIsLight = (color: string) => {
                const hex = (color || '#ffffff').replace('#', '');
                if (hex.length === 3) {
                  const r = parseInt(hex[0] + hex[0], 16);
                  const g = parseInt(hex[1] + hex[1], 16);
                  const b = parseInt(hex[2] + hex[2], 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                if (hex.length === 6) {
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
                }
                return true;
              };

              const isLightColor = getIsLight(merchantColor);
              const contrastTextColor = isLightColor ? '#050505' : '#FFFFFF';
              const iconBgColor = merchantColor + '10'; // 10% opacity
              const boxBgColor = merchantColor + '07'; // 7% opacity
              const boxBorderColor = merchantColor + '15'; // 13% opacity

              return (
                <>
                  {/* Header */}
                  <View style={styles.headerRow}>
                    <View style={[styles.iconBg, { backgroundColor: iconBgColor, borderColor: boxBorderColor }]}>
                      <Ionicons name="wifi" size={22} color={merchantColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>NFC Stamp Claim!</Text>
                      <Text style={styles.subtitle}>Customer scanned store NFC card</Text>
                    </View>
                    <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
                      <Ionicons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Error Banner */}
                  {errorMsg ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {/* Customer Details Box as VIP Pass */}
                  <View style={[styles.customerBox, { backgroundColor: boxBgColor, borderColor: boxBorderColor }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
                      <View style={[styles.initialsBadge, { backgroundColor: merchantColor, borderColor: 'transparent' }]}>
                        <Text style={[styles.initialsText, { color: contrastTextColor }]}>
                          {getInitials(claim.customer_name || 'Customer')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{claim.customer_name || 'Customer'}</Text>
                        <Text style={styles.customerPhone}>{claim.customer_phone}</Text>
                      </View>
                      <View style={[styles.sessionBadge, { backgroundColor: iconBgColor, borderColor: boxBorderColor }]}>
                        <Text style={[styles.sessionText, { color: merchantColor }]}>{claim.session_code}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Inputs */}
                  <View style={styles.inputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>BILL AMOUNT (RM)</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="cash-outline" size={16} color={merchantColor} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.inputField, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
                          keyboardType="numeric"
                          value={billAmount}
                          onChangeText={setBillAmount}
                          placeholder="10"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>STAMPS TO GIVE</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="star-outline" size={16} color={merchantColor} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.inputField, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
                          keyboardType="numeric"
                          value={stampAmount}
                          onChangeText={setStampAmount}
                          placeholder="1"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Staff Acting Badge */}
                  <View style={styles.staffPillRow}>
                    <View style={styles.staffPill}>
                      <Ionicons name="person-circle" size={14} color="#64748B" />
                      <Text style={styles.staffPillText}>
                        Issuing as <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{user?.name || 'Staff'}</Text>
                      </Text>
                    </View>
                    {user?.branch_name ? (
                      <View style={styles.branchPill}>
                        <Ionicons name="location-outline" size={12} color="#64748B" />
                        <Text style={styles.branchPillText}>{user.branch_name}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleDismiss} disabled={isLoading}>
                      <Text style={styles.cancelBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.confirmBtn, { backgroundColor: merchantColor, borderColor: merchantColor }]} 
                      onPress={handleConfirm} 
                      disabled={isLoading} 
                      activeOpacity={0.85}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={contrastTextColor} />
                      ) : (
                        <Text style={[styles.confirmBtnText, { color: contrastTextColor }]}>Issue Stamps & Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#991B1B',
    flex: 1,
  },
  customerBox: {
    backgroundColor: '#FFFDF0',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 16,
  },
  initialsBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  initialsText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  customerName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
  },
  customerPhone: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  sessionBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.2)',
  },
  sessionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1400',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1A1400',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },

  /* Success Screen Styles */
  successWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    borderWidth: 4,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1400',
    marginBottom: 4,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1400',
  },
  stampPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  summaryValueStamps: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  doneBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#1A1400',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  staffPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  branchPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
});
