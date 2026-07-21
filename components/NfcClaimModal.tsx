import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
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
    try {
      await pb.send('/api/risev/nfc/complete', {
        method: 'POST',
        body: {
          claim_id: claim.id,
          bill_amount: bill,
          stamp_amount: stamps,
        },
      });

      setIsVisible(false);
      setClaim(null);
      if (Platform.OS === 'web') {
        window.alert(`Stamps issued successfully to ${claim.customer_name || 'customer'}!`);
      } else {
        Alert.alert('Success', `Stamps issued successfully to ${claim.customer_name || 'customer'}!`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to issue stamps.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (claim) {
      try {
        await pb.collection('nfc_claims').update(claim.id, { status: 'cancelled' });
      } catch (err) { /* ignore */ }
    }
    setIsVisible(false);
    setClaim(null);
  };

  if (!isVisible || !claim) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconBg}>
              <Ionicons name="wifi" size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>NFC Stamp Claim!</Text>
              <Text style={styles.subtitle}>Customer scanned store NFC card</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

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
            <TouchableOpacity style={styles.cancelBtn} onPress={handleDismiss}>
              <Text style={styles.cancelBtnText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Issue Stamps & Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
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
    fontWeight: '800',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 14,
    color: '#475569',
    marginTop: 2,
  },
  sessionBadge: {
    marginTop: 8,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3730A3',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
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
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
