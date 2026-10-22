import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import ThermalReceiptScreen from '@/components/ThermalReceiptScreen';
import { PaidReceipt } from '@/lib/paidReceipt';

type TransactionItem = {
  id: string;
  created: string;
  type: 'earn' | 'redeem' | 'adjust';
  points: number;
  stamps?: number;
  bill_amount?: number;
  metadata?: any;
  expand?: {
    merchant?: {
      id: string;
      name: string;
      logo?: string;
    };
    loyalty_card?: {
      id: string;
      stamps_collected?: number;
      expand?: {
        program?: {
          name?: string;
          stamp_goal?: number;
        };
      };
    };
  };
};

export default function StampHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PaidReceipt | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchLogs(logs.length === 0);
    }, [user?.id, logs.length])
  );

  const fetchLogs = async (showLoading = true) => {
    if (!user) return;
    try {
      if (showLoading) setIsLoading(true);
      const res = await pb.collection('transactions').getList<TransactionItem>(1, 50, {
        filter: `customer = "${user.id}"`,
        sort: '-created',
        expand: 'merchant,loyalty_card.program',
      });
      setLogs(res.items);
    } catch (err) {
      console.error('Failed to fetch transaction logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReceipt = async (item: TransactionItem) => {
    setReceiptError('');
    let meta: any = {};
    if (item.metadata) {
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata; } catch (e) {}
    }
    const bill = Number(item.bill_amount) || 0;
    const hasVoucher = Boolean(meta.voucher_id || meta.voucher_code || Number(meta.discount_amount) > 0);
    if (bill > 0 || hasVoucher) {
      // Prefer the server-owned receipt, but never block the loyalty receipt that
      // the fallback below builds: manual sales write a "recorded" row that this
      // route only reports once it is paid, and older transactions have no row at
      // all. A failed lookup must not turn into a dead-end error.
      try {
        const match = await pb.send<{ receipt_id?: string; share_token?: string }>('/api/risev/customer/transaction-receipt', {
          method: 'GET', params: { transaction_id: item.id }, requestKey: null,
        });
        // The public page reads by share token; the record id is no longer public.
        if (match?.share_token) {
          router.push({ pathname: '/b/receipt/[id]', params: { id: match.share_token } });
          return;
        }
      } catch (error) {
        console.warn('Receipt lookup failed, using the loyalty receipt instead:', error);
      }
    }
    const card = item.expand?.loyalty_card;
    const program = card?.expand?.program;
    const items = Array.isArray(meta.items) && meta.items.length
      ? meta.items.map((line: any) => ({
          name: String(line.name || 'Item'),
          qty: Math.max(1, parseInt(line.qty, 10) || 1),
          price: Math.max(0, Number(line.price) || 0),
        }))
      : [{
          name: hasVoucher ? 'Voucher redemption' : item.type === 'redeem' ? 'Reward redeemed' : item.type === 'adjust' ? 'Loyalty adjustment' : 'Stamps issued',
          qty: 1,
          price: bill > 0 ? bill : (Number(meta.subtotal) || 0),
        }];

    const receipt: PaidReceipt = {
      id: item.id,
      receipt_number: `RV-${item.id.slice(0, 8).toUpperCase()}`,
      transaction: item.id,
      created: item.created,
      merchant: item.expand?.merchant?.id || '',
      customer_name: user?.name,
      customer_phone: user?.phone,
      staff_name: meta.staff_name || '',
      branch_name: meta.branch_name || 'Main Counter',
      line_items: items,
      subtotal: Number(meta.subtotal) || (bill + (Number(meta.discount_amount) || 0)),
      discount_amount: Number(meta.discount_amount) || 0,
      total_amount: bill,
      payment_method: bill > 0 ? String(meta.payment_method || 'cash') : hasVoucher ? 'Voucher' : 'Loyalty',
      payment_status: bill > 0 || hasVoucher ? 'paid' : 'issued',
      stamps_earned: item.stamps || 0,
      // Never show the card's CURRENT balance for an old visit: it has moved on
      // (or been reset) since. Use a recorded snapshot when the ledger carries
      // one, otherwise show only what this visit earned.
      stamps_balance: (() => {
        const snapshot = Number(meta.stamps_balance ?? meta.stamps_after);
        if (Number.isFinite(snapshot) && snapshot >= 0) return snapshot;
        return Math.max(0, Number(item.stamps) || 0);
      })(),
      stamp_goal: Math.max(1, Number(program?.stamp_goal) || 10),
      reward_name: (program as any)?.reward_name || program?.name || '',
      expand: { merchant: item.expand?.merchant },
    };
    setSelectedReceipt(receipt);
    setReceiptVisible(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? '0' + minutes : minutes;
    return `${day} ${month} ${year}, ${hours}:${minStr} ${ampm}`;
  };

  const getMerchantLogo = (item: TransactionItem) => {
    const merchant = item.expand?.merchant;
    if (merchant && merchant.logo) {
      return `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`;
    }
    return 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=120';
  };
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Navigation Header */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(customer)/profile')} 
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#000000" />
            <Text style={styles.backBtnText}>Profile</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stamp History</Text>
          <View style={{ width: 60 }} />
        </View>

        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loaderText}>Loading your history...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header section info */}
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>Activity Logs</Text>
              <Text style={styles.introSub}>
                Track your stamp collections, rewards redemptions, and loyalty points earned at RISEV partner merchants.
              </Text>
            </View>
            {receiptError ? (
              <View style={styles.receiptError} accessibilityRole="alert">
                <Ionicons name="information-circle-outline" size={18} color="#8A4B00" />
                <Text style={styles.receiptErrorText}>{receiptError}</Text>
              </View>
            ) : null}

            {logs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="time-outline" size={36} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No Activity Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start scanning QR codes at partner stores to earn stamps and points.
                </Text>
              </View>
            ) : (
              <View style={styles.logsList}>
                {logs.map((item) => {
                  const isEarn = item.type === 'earn';
                  const stampVal = item.stamps || 0;
                  const pointVal = item.points || 0;
                  
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.logCard}
                      onPress={() => handleOpenReceipt(item)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: getMerchantLogo(item) }} style={styles.merchantLogo} />
                      
                      <View style={styles.logMain}>
                        <Text style={styles.merchantName} numberOfLines={1}>
                          {item.expand?.merchant?.name || 'Partner Merchant'}
                        </Text>
                        <Text style={styles.logDate}>{formatDate(item.created)}</Text>
                      </View>
                      
                      <View style={styles.logAmounts}>
                        {stampVal > 0 && (
                          <View style={[styles.badge, isEarn ? styles.badgeEarn : styles.badgeSpend]}>
                            <Text style={[styles.badgeText, isEarn ? styles.badgeTextEarn : styles.badgeTextSpend]}>
                              {isEarn ? '+' : '-'}{stampVal} Stamp{stampVal > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                        {pointVal > 0 && (
                          <View style={[styles.badge, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginTop: stampVal > 0 ? 4 : 0 }]}>
                            <Text style={[styles.badgeText, { color: isEarn ? '#854D0E' : '#EF4444', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                              {isEarn ? '+' : '-'}{pointVal} PTS
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={{ marginLeft: 8 }}>
                        <Ionicons name="receipt-outline" size={18} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Shared customer receipt */}
        <ThermalReceiptScreen
          visible={receiptVisible}
          onClose={() => setReceiptVisible(false)}
          receipt={selectedReceipt}
          mode="customer"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  receiptError: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#FFF4D6' },
  receiptErrorText: { flex: 1, color: '#6B3F00', fontSize: 13 },
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
    width: 80,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  introCard: {
    gap: 6,
  },
  introTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  introSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  logsList: {
    gap: 12,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  merchantLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  logMain: {
    flex: 1,
    gap: 2,
  },
  merchantName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  logDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  logAmounts: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEarn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeSpend: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  badgeTextEarn: {
    color: '#059669',
  },
  badgeTextSpend: {
    color: '#EF4444',
  },
});
