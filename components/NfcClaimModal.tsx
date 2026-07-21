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
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Stamps Issued Successfully!</Text>
              <Text style={styles.successSubtitle}>
                {stampAmount} stamp(s) credited to <Text style={{ fontWeight: '800', color: '#000000' }}>{claim.customer_name || 'Customer'}</Text>
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
                  <Text style={styles.summaryLabel}>Stamps Added</Text>
                  <Text style={styles.summaryValueStamps}>+{stampAmount} 🎁</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Main Claim Form View ──────────────────────────────
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.iconBg}>
                  <Ionicons name="wifi" size={24} color="#000000" />
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

              {/* Customer Details Box */}
              <View style={styles.customerBox}>
                <Text style={styles.customerName}>{claim.customer_name || 'Customer'}</Text>
                <Text style={styles.customerPhone}>{claim.customer_phone}</Text>
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionText}>NFC CODE: {claim.session_code}</Text>
                </View>
              </View>

              {/* Inputs */}
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>BILL AMOUNT (RM)</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                    keyboardType="numeric"
                    value={billAmount}
                    onChangeText={setBillAmount}
                    placeholder="10"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>STAMPS TO GIVE</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                    keyboardType="numeric"
                    value={stampAmount}
                    onChangeText={setStampAmount}
                    placeholder="1"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleDismiss} disabled={isLoading}>
                  <Text style={styles.cancelBtnText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={isLoading} activeOpacity={0.8}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Issue Stamps & Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
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
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  customerName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  customerPhone: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    marginTop: 2,
  },
  sessionBadge: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
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
  input: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
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
    color: '#000000',
  },
  summaryValueStamps: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  doneBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#000000',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
