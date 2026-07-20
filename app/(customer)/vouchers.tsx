import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

const { width } = Dimensions.get('window');

type VoucherItem = {
  id: string;
  merchantName: string;
  category: string;
  logo: string;
  title: string;
  subtitle: string;
  code: string;
  expiry: string;
  status: 'active' | 'used';
  rawStatus: 'active' | 'used' | 'expired';
  color: string;
  isBirthday?: boolean;
  merchantId?: string;
};

export default function VouchersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'used'>('active');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [useModalVisible, setUseModalVisible] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [birthdayRewards, setBirthdayRewards] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVouchers = async () => {
    if (!user) return;
    try {
      const [records, birthdayLogs] = await Promise.all([
        pb.collection('vouchers').getFullList({
          filter: `customer = '${user.id}'`,
          expand: 'reward,reward.merchant',
          sort: '-created'
        }),
        pb.collection('birthday_logs').getFullList({
          filter: `customer = '${user.id}' && status = 'sent'`,
          expand: 'voucher,merchant',
          sort: '-created',
          requestKey: null,
        }),
      ]);

      const mapped = records.map((rec: any) => {
        const reward = rec.expand?.reward;
        const merchant = reward?.expand?.merchant;
        return {
          id: rec.id,
          merchantName: merchant?.name || 'Unknown Merchant',
          category: merchant?.category || 'General',
          logo: merchant?.logo 
            ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
            : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120',
          title: reward?.name || 'Voucher',
          subtitle: reward?.description || 'Loyalty Voucher',
          code: rec.code || 'CODE-PENDING',
          expiry: rec.status === 'used' && rec.used_at
            ? `Used on ${new Date(rec.used_at).toLocaleDateString()}`
            : rec.status === 'expired'
            ? `Expired on ${rec.expires_at ? new Date(rec.expires_at).toLocaleDateString() : 'Unknown'}`
            : rec.expires_at 
            ? `Valid until ${new Date(rec.expires_at).toLocaleDateString()}` 
            : 'No expiry',
          status: (rec.status === 'used' || rec.status === 'expired' ? 'used' : 'active') as 'used' | 'active',
          rawStatus: rec.status as 'active' | 'used' | 'expired',
          color: reward?.type === 'discount' ? '#7C3AED' : '#004ac6'
        };
      });
      setVouchers(mapped);

      const birthdayMapped = birthdayLogs
        .filter((log: any) => log.expand?.voucher)
        .map((log: any) => {
          const voucher = log.expand.voucher;
          const merchant = log.expand?.merchant;
          const expiresAt = voucher.expires_at || voucher.valid_until;
          return {
            id: voucher.id,
            merchantName: merchant?.name || 'Unknown Merchant',
            category: merchant?.category || 'General',
            logo: merchant?.logo
              ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
              : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120',
            title: voucher.title || 'Birthday Reward',
            subtitle: voucher.description || 'Birthday treat',
            code: voucher.code || 'CODE-PENDING',
            expiry: expiresAt
              ? `Valid until ${new Date(expiresAt).toLocaleDateString()}`
              : 'No expiry',
            status: 'active' as const,
            rawStatus: voucher.status as 'active' | 'used' | 'expired',
            color: '#000000',
            isBirthday: true,
            merchantId: merchant?.id,
          };
        });
      setBirthdayRewards(birthdayMapped);
    } catch (err) {
      console.warn('Failed to fetch vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
    if (user) {
      pb.collection('vouchers').subscribe('*', () => {
        fetchVouchers();
      }, {
        filter: `customer = '${user.id}'`
      });
    }
    return () => {
      pb.collection('vouchers').unsubscribe('*');
    };
  }, [user]);

  const filteredVouchers = vouchers.filter((v) => v.status === activeTab);

  const handleUseVoucher = (voucher: VoucherItem) => {
    setSelectedVoucher(voucher);
    setUseModalVisible(true);
  };

  const avatarUrl = user?.avatar
    ? `${pb.baseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Top Header Row */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }, { justifyContent: 'space-between' }]}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
          />
          
          <Image
            source={require('../../theme/rise_officiallogo.png')}
            style={{ width: 110, height: 38, resizeMode: 'contain' }}
          />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro Heading Section */}
          <View style={styles.introSection}>
            <Text style={styles.title}>My Vouchers</Text>
            <Text style={styles.subtitle}>
              Redeem and present rewards vouchers at partner stores to enjoy discounts.
            </Text>
          </View>

          {/* Simple Tab Filters (Matches new payment/topup mockup styling) */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
              onPress={() => setActiveTab('active')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                Available Vouchers ({vouchers.filter(v => v.status === 'active').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'used' && styles.tabButtonActive]}
              onPress={() => setActiveTab('used')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'used' && styles.tabTextActive]}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Birthday Rewards Section */}
          {activeTab === 'active' && birthdayRewards.length > 0 && (
            <View style={styles.birthdaySection}>
              <View style={styles.birthdaySectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="gift-outline" size={16} color="#0F172A" />
                  <Text style={styles.birthdaySectionTitle}>Birthday Rewards</Text>
                </View>
                <Text style={styles.birthdaySectionMeta}>{birthdayRewards[0]?.expiry || ''}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.birthdayScrollContent}
              >
                {birthdayRewards.map((item) => (
                  <View key={item.id} style={styles.birthdayCard}>
                    <View style={styles.birthdayCardHeader}>
                      <Image source={{ uri: item.logo }} style={styles.birthdayMerchantLogo} />
                      <Text style={styles.birthdayMerchantName} numberOfLines={1}>{item.merchantName}</Text>
                    </View>

                    <Text style={styles.birthdayCardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.birthdayCardExpiry}>{item.expiry}</Text>

                    <View style={styles.birthdayCodeRow}>
                      <View style={styles.birthdayCodeBox}>
                        <Text style={styles.birthdayCodeLabel}>CODE</Text>
                        <Text style={styles.birthdayCodeValue}>{item.code}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.birthdayQrBtn}
                        onPress={() => handleUseVoucher(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Dotted Ticket-Style Voucher Cards List */}
          <View style={styles.vouchersList}>
            {loading ? (
              <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
            ) : filteredVouchers.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="gift-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No Vouchers</Text>
                <Text style={styles.emptyStateSubtitle}>
                  You don't have any {activeTab} vouchers at this time.
                </Text>
              </View>
            ) : (
              filteredVouchers.map((item) => (
                <View key={item.id} style={styles.ticketCard}>
                  {/* Left side: Merchant details */}
                  <View style={styles.ticketLeft}>
                    <Image source={{ uri: item.logo }} style={styles.merchantLogo} />
                    <Text style={styles.merchantName} numberOfLines={2}>{item.merchantName}</Text>
                    <Text style={styles.merchantCategory} numberOfLines={1}>{item.category}</Text>
                  </View>

                  {/* Dotted separator divider line */}
                  <View style={styles.dottedDivider}>
                    <View style={styles.topNotch} />
                    <View style={styles.dottedLine} />
                    <View style={styles.bottomNotch} />
                  </View>

                  {/* Right side: Reward details and Claim button */}
                  <View style={styles.ticketRight}>
                    <View style={styles.rewardTextColumn}>
                      <Text style={styles.rewardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.rewardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                      <Text style={[styles.expiryText, item.status === 'used' && { color: '#64748B' }]}>{item.expiry}</Text>
                    </View>

                    {item.status === 'active' ? (
                      <TouchableOpacity
                        style={styles.useBtn}
                        onPress={() => handleUseVoucher(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.useBtnText}>Use Now</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.usedBadge}>
                        <Text style={styles.usedBadgeText}>USED / EXPIRED</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* QR/Barcode Use Voucher Modal */}
      <Modal
        visible={useModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {selectedVoucher && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Redeem Reward</Text>
                <TouchableOpacity onPress={() => setUseModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalLogoRow}>
                <Image source={{ uri: selectedVoucher.logo }} style={styles.modalMerchantLogo} />
                <View>
                  <Text style={styles.modalMerchantName}>{selectedVoucher.merchantName}</Text>
                  <Text style={styles.modalRewardTitle}>{selectedVoucher.title}</Text>
                </View>
              </View>

              <View style={styles.qrWrapper}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedVoucher.code}`,
                  }}
                  style={styles.qrCodeImage}
                />
              </View>

              <Text style={styles.codeLabel}>VOUCHER CODE</Text>
              <Text style={styles.codeValue}>{selectedVoucher.code}</Text>
              <Text style={styles.scanNotice}>
                Present this voucher code to the store staff to apply your discount reward.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Consistent pure white background
  },
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 1,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  roundHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    right: 10,
    top: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 110, // Safe clearance padding for bottom navbar
    gap: 20,
  },
  introSection: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 22,
  },
  // Tabs selector (Matches the home/discover screen styling)
  tabsRow: {
    flexDirection: 'row',
    gap: 12,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#000000', // Minimalist black border bottom indicator
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  // Dotted Ticket-Style Voucher Cards
  vouchersList: {
    gap: 20,
  },
  birthdaySection: {
    marginBottom: 24,
  },
  birthdaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  birthdaySectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  birthdaySectionMeta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  birthdayScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  birthdayCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  birthdayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  birthdayMerchantLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  birthdayMerchantName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  birthdayCardTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 22,
  },
  birthdayCardExpiry: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 16,
  },
  birthdayCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  birthdayCodeBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  birthdayCodeLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  birthdayCodeValue: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  birthdayQrBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#000000',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 148,
    overflow: 'hidden',
  },
  ticketLeft: {
    width: 110,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  merchantLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  merchantName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginTop: 4,
    textAlign: 'center',
  },
  merchantCategory: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
  },
  // Ticket notch cut divider
  dottedDivider: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  topNotch: {
    width: 24,
    height: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    position: 'absolute',
    top: -1.5,
    zIndex: 2,
  },
  bottomNotch: {
    width: 24,
    height: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    position: 'absolute',
    bottom: -1.5,
    zIndex: 2,
  },
  dottedLine: {
    width: 1,
    height: '100%',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ticketRight: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  rewardTextColumn: {
    gap: 2,
  },
  rewardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  rewardSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
  expiryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444', // Red warning color expiry
    marginTop: 4,
  },
  useBtn: {
    backgroundColor: '#000000', // Solid black button matching the home design
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  useBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  usedBadge: {
    backgroundColor: '#F1F5F9',
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  usedBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  closeBtn: {
    padding: 4,
  },
  modalLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  modalMerchantLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modalMerchantName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  modalRewardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginTop: 2,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  qrCodeImage: {
    width: 180,
    height: 180,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginTop: 4,
    marginBottom: 16,
  },
  scanNotice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyStateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
    width: '100%',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
