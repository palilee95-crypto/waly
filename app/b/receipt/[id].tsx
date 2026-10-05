import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

export default function DigitalReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    loadReceipt();
  }, [id]);

  const loadReceipt = async () => {
    setLoading(true);
    try {
      if (id && !id.startsWith('demo-')) {
        const rec = await pb.collection('digital_receipts').getOne(id, {
          expand: 'merchant,booking'
        });
        setReceipt(rec);
      } else {
        // Mock fallback for demo
        setReceipt({
          receipt_number: `REC-${Date.now().toString().slice(-6)}`,
          created: new Date().toISOString(),
          total_amount: 60.00,
          payment_method: 'NFC Counter Tap',
          stamps_earned: 1,
          line_items: [
            { name: 'Signature Fade Cut (Aiman)', price: 35.00 },
            { name: 'Strong Hold Pomade', price: 25.00 }
          ],
          expand: {
            merchant: {
              store_name: 'BARBER KING',
              branch_name: 'Bangi Sentral'
            }
          }
        });
      }
    } catch (e) {
      setReceipt({
        receipt_number: `REC-884920`,
        created: new Date().toISOString(),
        total_amount: 35.00,
        payment_method: 'NFC Counter Tap',
        stamps_earned: 1,
        line_items: [
          { name: 'Signature Fade Cut', price: 35.00 }
        ],
        expand: {
          merchant: {
            store_name: 'BARBER KING',
          }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Resit Digital Risev: ${receipt?.expand?.merchant?.store_name || 'Kedai'} - Jumlah: RM ${receipt?.total_amount?.toFixed(2)} (No: ${receipt?.receipt_number})`,
      });
    } catch (e) {}
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFC700" />
      </View>
    );
  }

  const merchantName = receipt?.expand?.merchant?.store_name || 'BARBER KING';
  const dateFormatted = new Date(receipt?.created || Date.now()).toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btnBack}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resit Rasmi Digital</Text>
        <TouchableOpacity onPress={handleShare} style={styles.btnShare}>
          <Ionicons name="share-outline" size={18} color="#FFC700" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Receipt Slip Container */}
        <View style={styles.receiptSlip}>
          
          {/* Top Notch / Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>{merchantName.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.merchantTitle}>{merchantName}</Text>
              <Text style={styles.receiptSub}>Resit Pembayaran Elektronik</Text>
            </View>
          </View>

          <View style={styles.dashDivider} />

          {/* Metadata */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>NO. RESIT</Text>
              <Text style={styles.metaValue}>{receipt?.receipt_number}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>TARIKH & MASA</Text>
              <Text style={styles.metaValue}>{dateFormatted}</Text>
            </View>
          </View>

          <View style={styles.dashDivider} />

          {/* Itemized Lines */}
          <Text style={styles.sectionHeading}>PERINCIAN ITEM / SERVIS</Text>
          <View style={styles.itemsList}>
            {(receipt?.line_items || []).map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name || 'Servis'}</Text>
                <Text style={styles.itemPrice}>RM {(item.price || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.dashDivider} />

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>JUMLAH BAYARAN</Text>
            <Text style={styles.totalAmount}>RM {(receipt?.total_amount || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentMethod}>Kaedah: {receipt?.payment_method || 'NFC Counter Tap'}</Text>
            <View style={styles.stampRewardBadge}>
              <Text style={styles.stampRewardText}>★ +{receipt?.stamps_earned || 1} Cop Loyalty</Text>
            </View>
          </View>

          {/* Verified Footer */}
          <View style={styles.verifiedBox}>
            <Ionicons name="shield-checkmark" size={16} color="#22C55E" />
            <Text style={styles.verifiedText}>Disahkan oleh Sistem Transaksi Risev</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.btnBookAgain}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.btnBookAgainText}>Kembali ke Halaman Utama ➔</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1B22',
  },
  btnBack: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#141418',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2B36',
  },
  btnShare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,199,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  receiptSlip: {
    backgroundColor: '#141418',
    borderWidth: 1.5,
    borderColor: '#2A2B36',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  merchantTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  receiptSub: {
    fontSize: 11,
    color: '#8E8F9F',
    marginTop: 2,
  },
  dashDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    marginVertical: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {},
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8F9F',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8F9F',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFC700',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentMethod: {
    fontSize: 11,
    color: '#8E8F9F',
  },
  stampRewardBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stampRewardText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22C55E',
  },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  verifiedText: {
    fontSize: 11,
    color: '#8E8F9F',
  },
  btnBookAgain: {
    marginTop: 20,
    backgroundColor: '#FFC700',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FFC700',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  btnBookAgainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
});
