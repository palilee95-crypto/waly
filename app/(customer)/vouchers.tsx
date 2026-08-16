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

// Helper to determine if a hex color is light or dark
const isLightColor = (color: string) => {
  const hex = color.replace('#', '');
  // Default to a dark color if invalid
  if (hex.length !== 6 && hex.length !== 3) return false;
  const r = parseInt(hex.length === 3 ? hex.charAt(0) + hex.charAt(0) : hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.length === 3 ? hex.charAt(1) + hex.charAt(1) : hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.length === 3 ? hex.charAt(2) + hex.charAt(2) : hex.substring(4, 6), 16) || 0;
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65; // Threshold for bright colors
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
          color: merchant?.onboarding_primary_color || (reward?.type === 'discount' ? '#7C3AED' : '#004ac6')
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
            color: merchant?.onboarding_primary_color || '#0F172A',
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
        {/* ── Yellow S-Curve Header (Idea 1) ── */}
        <View style={{ backgroundColor: '#FFFFFF' }}>
          {/* Yellow Block */}
          <View style={{ backgroundColor: '#FFC700', borderBottomRightRadius: 32 }}>
            <View style={[{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
              {/* Logo row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
                <Image source={require('../../assets/risev logo.png')} style={{ width: 110, height: 38, resizeMode: 'contain' }} />
              </View>
              {/* Title */}
              <Text style={{ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', letterSpacing: -1, marginBottom: 4 }}>My Vouchers</Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#806400', lineHeight: 18 }}>
                Redeem and present rewards vouchers at partner stores to enjoy discounts.
              </Text>
            </View>
          </View>
          {/* S-Curve: white strip with concave top-left arc */}
          <View style={{ height: 28, backgroundColor: '#FFC700' }}>
            <View style={{ position: 'absolute', bottom: 0, right: 0, left: 0, top: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >

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
              filteredVouchers.map((item) => {
                const isLight = isLightColor(item.color || '#0F172A');
                
                const isClickable = item.status === 'active';
                const Container: any = isClickable ? TouchableOpacity : View;
                const containerProps = isClickable ? {
                  onPress: () => handleUseVoucher(item),
                  activeOpacity: 0.9
                } : {};

                return (
                  <Container 
                    key={item.id} 
                    style={[styles.ticketCard, { backgroundColor: item.color || '#0F172A' }, !isClickable && { opacity: 0.65 }]}
                    {...containerProps}
                  >
                    {/* Left side: Merchant details with barcode and serial number */}
                    <View style={styles.ticketLeft}>
                      <View style={styles.stubBarcodeContainer}>
                        <View style={[styles.barcodeLineWide, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                        <View style={[styles.barcodeLineThin, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                        <View style={[styles.barcodeLineMedium, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                        <View style={[styles.barcodeLineThin, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                        <View style={[styles.barcodeLineWide, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />
                      </View>
                      <Image source={{ uri: item.logo }} style={styles.merchantLogo} />
                      <Text style={[styles.merchantName, { color: isLight ? '#000000' : '#FFFFFF' }]} numberOfLines={2}>{item.merchantName}</Text>
                      <Text style={[styles.serialNumber, { color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]}>NO. {Math.floor(Math.random() * 90000) + 10000}</Text>
                    </View>

                    {/* Dotted separator divider line */}
                    <View style={styles.dottedDivider}>
                      <View style={[styles.topNotch, { backgroundColor: '#FFFFFF' }]} />
                      <View style={[styles.dottedLine, { borderColor: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)' }]} />
                      <View style={[styles.bottomNotch, { backgroundColor: '#FFFFFF' }]} />
                    </View>

                    {/* Right side: Reward details and Claim button */}
                    <View style={styles.ticketRight}>
                      <View style={styles.rewardTextColumn}>
                        <Text style={[styles.rewardTitleLight, { color: isLight ? '#000000' : '#FFFFFF' }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.rewardSubtitleLight, { color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)' }]} numberOfLines={2}>{item.subtitle}</Text>
                        <Text style={[styles.expiryTextLight, { color: isLight ? '#EF4444' : '#FFC700' }, item.status === 'used' && { color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)' }]}>{item.expiry}</Text>
                      </View>

                      {item.status === 'active' ? (
                        <View
                          style={[styles.useBtn, { backgroundColor: isLight ? '#000000' : '#FFFFFF' }]}
                        >
                          <Text style={[styles.useBtnText, { color: isLight ? '#FFFFFF' : '#000000' }]}>Use Now</Text>
                        </View>
                      ) : (
                        <View style={[styles.usedBadge, { borderColor: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }]}>
                          <Text style={[styles.usedBadgeText, { color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>USED / EXPIRED</Text>
                        </View>
                      )}
                    </View>
                  </Container>
                );
              })
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
          {selectedVoucher && (() => {
            const isModalLight = isLightColor(selectedVoucher.color || '#FFC700');
            return (
              <View style={[styles.modalContent, { padding: 0, overflow: 'hidden', borderWidth: 0 }]}>
                {/* Top Block: Dynamic Merchant Header */}
                <View style={{ backgroundColor: selectedVoucher.color || '#FFC700', padding: 24, paddingBottom: 32, width: '100%' }}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: isModalLight ? '#000000' : '#FFFFFF' }]}>Redeem Reward</Text>
                    <TouchableOpacity onPress={() => setUseModalVisible(false)} style={styles.closeBtn}>
                      <Ionicons name="close" size={24} color={isModalLight ? '#000000' : '#FFFFFF'} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.modalLogoRow, { marginBottom: 0 }]}>
                    <Image source={{ uri: selectedVoucher.logo }} style={[styles.modalMerchantLogo, { borderColor: isModalLight ? '#FFFFFF' : 'transparent', borderWidth: 2 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalMerchantName, { color: isModalLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)' }]}>{selectedVoucher.merchantName}</Text>
                      <Text style={[styles.modalRewardTitle, { color: isModalLight ? '#000000' : '#FFFFFF' }]}>{selectedVoucher.title}</Text>
                    </View>
                  </View>
                </View>

              {/* Perforated Divider with Cutouts */}
              <View style={{ width: '100%', height: 1, flexDirection: 'row', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', position: 'absolute', left: -12 }} />
                <View style={{ flex: 1, height: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', opacity: 0.5 }} />
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', position: 'absolute', right: -12 }} />
              </View>

              {/* Bottom Block: White QR Area */}
              <View style={{ backgroundColor: '#FFFFFF', padding: 24, width: '100%', alignItems: 'center' }}>
                <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, shadowColor: '#1A1400', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5, marginBottom: 24 }]}>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedVoucher.code}`,
                    }}
                    style={[styles.qrCodeImage, { width: 180, height: 180 }]}
                  />
                </View>

                <Text style={[styles.codeLabel, { color: '#64748B', marginBottom: 4 }]}>VOUCHER CODE</Text>
                <Text style={[styles.codeValue, { color: '#1A1400', fontSize: 22, letterSpacing: 2, fontFamily: 'PlusJakartaSans_800ExtraBold', marginBottom: 12 }]}>{selectedVoucher.code}</Text>
                <Text style={[styles.scanNotice, { color: '#94A3B8', textAlign: 'center' }]}>
                  Present this voucher code to the store staff to apply your discount reward.
                </Text>
              </View>
            </View>
            );
          })()}
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
    paddingTop: 16,
    paddingBottom: 110, // Safe padding to clear bottom tab bar
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
    borderRadius: 12, // Smoother corners for concert ticket
    height: 140,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  ticketLeft: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  stubBarcodeContainer: {
    position: 'absolute',
    left: -10,
    top: 0,
    bottom: 0,
    width: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.35, // Increased visibility
    transform: [{ rotate: '90deg' }],
  },
  barcodeLineWide: { width: 4, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 2 },
  barcodeLineMedium: { width: 2, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 2 },
  barcodeLineThin: { width: 1, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 1 },
  merchantLogo: {
    width: 48,
    height: 48,
    borderRadius: 24, // Round logo for concert ticket
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginTop: 2,
    textAlign: 'center',
  },
  serialNumber: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginTop: 2,
  },
  // Ticket notch cut divider
  dottedDivider: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  topNotch: {
    width: 20, 
    height: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  bottomNotch: {
    width: 20, 
    height: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    zIndex: 2,
  },
  dottedLine: {
    width: 1,
    height: '100%',
    borderColor: 'rgba(255,255,255,0.4)', // White dotted line for dark background
    borderWidth: 1.5,
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
  rewardTitleLight: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  rewardSubtitleLight: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 15,
  },
  expiryTextLight: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700', // Yellow text for expiry on dark bg
    marginTop: 4,
  },
  useBtn: {
    backgroundColor: '#FFFFFF', // White button pops against dark ticket
    height: 32,
    borderRadius: 16, // Pill shape
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  useBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
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
