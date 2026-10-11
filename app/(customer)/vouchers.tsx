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
import { getRewardVisualUrl } from '@/lib/rewardVisuals';

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
  rewardImage?: string;
  rewardType?: 'free_item' | 'discount' | 'experience' | 'cash_credit' | string;
  discountValue?: number;
  discountType?: 'percentage' | 'fixed_amount' | 'percent' | string;
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
          expand: 'reward,reward.merchant,campaign,campaign.merchant',
          sort: '-created'
        }),
        pb.collection('birthday_logs').getFullList({
          filter: `customer = '${user.id}' && status = 'sent'`,
          expand: 'voucher,merchant,reward',
          sort: '-created',
          requestKey: null,
        }),
      ]);

      const mapped = records.map((rec: any) => {
        const reward = rec.expand?.reward;
        const campaign = rec.expand?.campaign;
        const merchant = reward?.expand?.merchant || campaign?.expand?.merchant;

        let parsedMeta: any = {};
        try {
          parsedMeta = typeof rec.metadata === 'string' ? JSON.parse(rec.metadata) : (rec.metadata || {});
        } catch (e) {}

        let rewardImage = getRewardVisualUrl(reward) || '';
        if (!rewardImage && campaign?.image) {
          rewardImage = `${pb.baseUrl}/api/files/campaigns/${campaign.id}/${campaign.image}`;
        }

        const rewardType = reward?.type || campaign?.type || parsedMeta.reward_type || 'discount';
        const discountVal = parsedMeta.discount_value || reward?.discount_value || campaign?.discount_value;
        const discountType = parsedMeta.discount_type || reward?.discount_type || campaign?.discount_type;

        const displayTitle = reward?.name || reward?.title || campaign?.name || campaign?.title || (discountVal ? `${discountType === 'percent' || discountType === 'percentage' ? discountVal + '%' : 'RM ' + discountVal} OFF` : 'Voucher');
        const displaySubtitle = reward?.description || campaign?.description || parsedMeta.description || 'Redeem at store';
        const merchantName = merchant?.name || parsedMeta.merchant_name || 'Risev Merchant';
        const logo = merchant?.logo 
          ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
          : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120';

        const isUsed = rec.status === 'used';
        let isPastExpiry = false;
        if (rec.expires_at) {
          const expDate = new Date(String(rec.expires_at).replace(' ', 'T'));
          if (!isNaN(expDate.getTime())) {
            isPastExpiry = expDate.getTime() < Date.now();
          }
        }
        const isExpired = rec.status === 'expired' || (!isUsed && isPastExpiry);

        let expiryDisplay = 'No expiry';
        if (isUsed) {
          expiryDisplay = rec.used_at
            ? `Used on ${new Date(String(rec.used_at).replace(' ', 'T')).toLocaleDateString()}`
            : 'Used';
        } else if (isExpired) {
          expiryDisplay = rec.expires_at
            ? `Expired on ${new Date(String(rec.expires_at).replace(' ', 'T')).toLocaleDateString()}`
            : 'Expired';
        } else if (rec.expires_at) {
          expiryDisplay = `Valid until ${new Date(String(rec.expires_at).replace(' ', 'T')).toLocaleDateString()}`;
        }

        return {
          id: rec.id,
          merchantName,
          category: merchant?.category || 'General',
          logo,
          title: displayTitle,
          subtitle: displaySubtitle,
          code: rec.code || 'CODE-PENDING',
          expiry: expiryDisplay,
          status: (isUsed || isExpired ? 'used' : 'active') as 'used' | 'active',
          rawStatus: (isUsed ? 'used' : isExpired ? 'expired' : 'active') as 'active' | 'used' | 'expired',
          color: merchant?.onboarding_primary_color || (reward?.type === 'discount' ? '#7C3AED' : '#004ac6'),
          rewardImage,
          rewardType,
          discountValue: discountVal,
          discountType,
        };
      });
      setVouchers(mapped);

      const birthdayMapped = birthdayLogs
        .filter((log: any) => log.expand?.voucher)
        .map((log: any) => {
          const voucher = log.expand.voucher;
          const merchant = log.expand?.merchant;
          const bdayReward = log.expand?.reward;
          const expiresAt = voucher.expires_at || voucher.valid_until;

          const isBirthdayUsed = voucher.status === 'used';
          let isBirthdayPastExpiry = false;
          if (expiresAt) {
            const expDate = new Date(String(expiresAt).replace(' ', 'T'));
            if (!isNaN(expDate.getTime())) {
              isBirthdayPastExpiry = expDate.getTime() < Date.now();
            }
          }
          const isBirthdayExpired = voucher.status === 'expired' || (!isBirthdayUsed && isBirthdayPastExpiry);

          let bdayExpiryDisplay = 'No expiry';
          if (isBirthdayUsed) {
            bdayExpiryDisplay = 'Used';
          } else if (isBirthdayExpired) {
            bdayExpiryDisplay = expiresAt
              ? `Expired on ${new Date(String(expiresAt).replace(' ', 'T')).toLocaleDateString()}`
              : 'Expired';
          } else if (expiresAt) {
            bdayExpiryDisplay = `Valid until ${new Date(String(expiresAt).replace(' ', 'T')).toLocaleDateString()}`;
          }

          let parsedMeta: any = {};
          try {
            parsedMeta = typeof voucher.metadata === 'string' ? JSON.parse(voucher.metadata) : (voucher.metadata || {});
          } catch (e) {}

          let bdayImage = '';
          if (bdayReward?.image) {
            bdayImage = `${pb.baseUrl}/api/files/rewards/${bdayReward.id}/${bdayReward.image}`;
          }

          return {
            id: voucher.id,
            merchantName: merchant?.name || 'Unknown Merchant',
            category: merchant?.category || 'General',
            logo: merchant?.logo
              ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
              : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120',
            title: voucher.title || parsedMeta.title || 'Birthday Reward',
            subtitle: voucher.description || parsedMeta.description || 'Birthday treat',
            code: voucher.code || 'CODE-PENDING',
            expiry: bdayExpiryDisplay,
            status: (isBirthdayUsed || isBirthdayExpired ? 'used' : 'active') as 'used' | 'active',
            rawStatus: (isBirthdayUsed ? 'used' : isBirthdayExpired ? 'expired' : 'active') as 'active' | 'used' | 'expired',
            color: merchant?.onboarding_primary_color || '#0F172A',
            isBirthday: true,
            merchantId: merchant?.id,
            rewardImage: bdayImage,
            rewardType: bdayReward?.type || 'free_item',
          };
        });
      setBirthdayRewards(birthdayMapped);
    } catch (err) {
      console.warn('Failed to fetch vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Global collection subscription for user's vouchers
  useEffect(() => {
    fetchVouchers();
    if (user) {
      pb.collection('vouchers').subscribe('*', (e) => {
        fetchVouchers();
        if (e.record) {
          setSelectedVoucher((prev) => {
            if (prev && prev.id === e.record.id) {
              const isUsed = e.record.status === 'used';
              return {
                ...prev,
                status: (isUsed ? 'used' : e.record.status) as any,
                rawStatus: e.record.status as any,
                expiry: isUsed ? `Used on ${new Date().toLocaleDateString()}` : prev.expiry,
              };
            }
            return prev;
          });
        }
      }).catch((err) => {
        console.warn('Vouchers collection realtime subscription error:', err);
      });
    }
    return () => {
      pb.collection('vouchers').unsubscribe('*');
    };
  }, [user]);

  // 2. Active Modal Realtime Watchdog (Direct Record SSE + 1.5s Polling Fallback)
  useEffect(() => {
    if (!useModalVisible || !selectedVoucher || selectedVoucher.status === 'used') return;

    const voucherId = selectedVoucher.id;
    let isMounted = true;

    // Direct single-record SSE subscription (instant push notification from server)
    pb.collection('vouchers').subscribe(voucherId, (e) => {
      if (!isMounted) return;
      if (e.action === 'update' && e.record && e.record.status === 'used') {
        setSelectedVoucher((prev) => prev && prev.id === voucherId ? {
          ...prev,
          status: 'used',
          rawStatus: 'used',
          expiry: `Used on ${new Date().toLocaleDateString()}`,
        } : prev);
        fetchVouchers();
      }
    }).catch((err) => {
      console.warn('Direct voucher SSE subscription error:', err);
    });

    // 1.5s Active Modal Polling Watchdog (guarantees update even across network hiccups)
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const latest = await pb.collection('vouchers').getOne(voucherId, { requestKey: null });
        if (latest && latest.status === 'used') {
          if (isMounted) {
            setSelectedVoucher((prev) => prev && prev.id === voucherId ? {
              ...prev,
              status: 'used',
              rawStatus: 'used',
              expiry: `Used on ${new Date().toLocaleDateString()}`,
            } : prev);
            fetchVouchers();
          }
        }
      } catch (err) {}
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      pb.collection('vouchers').unsubscribe(voucherId).catch(() => {});
    };
  }, [useModalVisible, selectedVoucher?.id, selectedVoucher?.status]);

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
          {activeTab === 'active' && birthdayRewards.filter((b) => b.status === 'active').length > 0 && (
            <View style={styles.birthdaySection}>
              <View style={styles.birthdaySectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="gift-outline" size={16} color="#0F172A" />
                  <Text style={styles.birthdaySectionTitle}>Birthday Rewards</Text>
                </View>
                <Text style={styles.birthdaySectionMeta}>{birthdayRewards.filter((b) => b.status === 'active')[0]?.expiry || ''}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.birthdayScrollContent}
              >
                {birthdayRewards.filter((b) => b.status === 'active').map((item) => (
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
                const isLight = isLightColor(item.color || '#0B0F17');
                
                const isClickable = item.status === 'active';
                const Container: any = isClickable ? TouchableOpacity : View;
                const containerProps = isClickable ? {
                  onPress: () => handleUseVoucher(item),
                  activeOpacity: 0.9
                } : {};

                return (
                  <Container 
                    key={item.id} 
                    style={[styles.ticketCard, !isClickable && { opacity: 0.65 }]}
                    {...containerProps}
                  >
                    {/* 1. LEFT ZONE: Merchant Identity ONLY */}
                    <View style={styles.ticketLeftZone}>
                      <View style={styles.whiteLogoCircle}>
                        <Image source={{ uri: item.logo }} style={styles.merchantCircleLogo} />
                      </View>
                      <Text style={styles.merchantName} numberOfLines={1}>{item.merchantName}</Text>
                      <Text style={styles.merchantCategory} numberOfLines={1}>
                        {item.category || 'food'}
                      </Text>
                    </View>

                    {/* CENTER DIVIDER: Ticket Cutout Notches & Perforated Line */}
                    <View style={styles.dottedDivider}>
                      <View style={styles.topNotch} />
                      <View style={styles.dottedLine} />
                      <View style={styles.bottomNotch} />
                    </View>

                    {/* 2. CENTER ZONE: Reward Information */}
                    <View style={styles.ticketCenterZone}>
                      {/* Top Badge: Ready to redeem */}
                      <View style={styles.yellowStatusBadge}>
                        <Ionicons name="gift" size={11} color="#000000" style={{ marginRight: 4 }} />
                        <Text style={styles.yellowStatusText}>
                          {item.isBirthday ? 'Birthday Special' : 'Ready to redeem'}
                        </Text>
                      </View>

                      {/* Middle: Reward Title & Description */}
                      <View style={{ marginVertical: 2 }}>
                        <Text style={styles.rewardTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.rewardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                      </View>

                      {/* Bottom Footer Row: Source Badge + Stock */}
                      <View style={styles.mainFooterRow}>
                        <View style={styles.sourceBadgePill}>
                          <Ionicons name="card" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={styles.sourceBadgeText}>STAMP CARD</Text>
                        </View>

                        <Text style={styles.stockLabelText}>
                          Stock: <Text style={styles.stockValueText}>Unlimited</Text>
                        </Text>
                      </View>
                    </View>

                    {/* 3. RIGHT SAFE ZONE: Tag & Use Voucher CTA */}
                    <View style={styles.ticketRightZone}>
                      {/* Top Right Tag */}
                      <Text style={styles.specialRewardTag}>
                        {item.rewardType === 'discount' 
                          ? (item.discountValue ? (item.discountType === 'percentage' ? `${item.discountValue}% OFF` : `RM ${item.discountValue}`) : 'DISCOUNT')
                          : 'FREE ITEM'}
                      </Text>

                      {/* Bottom Right CTA Button */}
                      {item.status === 'active' ? (
                        <View style={styles.ctaPillBtn}>
                          <Text style={styles.ctaPillText} numberOfLines={1}>Use Voucher ➔</Text>
                        </View>
                      ) : (
                        <View style={styles.usedBadge}>
                          <Text style={styles.usedBadgeText}>USED / EXPIRED</Text>
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

              {/* Bottom Block: White QR or Redeemed Receipt Area */}
              <View style={{ backgroundColor: '#FFFFFF', padding: 24, width: '100%', alignItems: 'center' }}>
                {selectedVoucher.status === 'used' || selectedVoucher.rawStatus === 'used' ? (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    {/* Glowing Checkmark */}
                    <View style={styles.redeemedSuccessIconWrap}>
                      <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                    </View>

                    <Text style={styles.redeemedSuccessTitle}>Voucher Redeemed!</Text>
                    <Text style={styles.redeemedSuccessSubtitle}>
                      Your discount reward has been verified and applied to your bill.
                    </Text>

                    {/* Receipt Summary Box */}
                    <View style={styles.redeemedReceiptBox}>
                      <View style={styles.redeemedReceiptRow}>
                        <Text style={styles.redeemedReceiptLabel}>VOUCHER CODE</Text>
                        <View style={styles.redeemedReceiptCodePill}>
                          <Text style={styles.redeemedReceiptCodeText}>{selectedVoucher.code}</Text>
                        </View>
                      </View>
                      <View style={[styles.redeemedReceiptRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                        <Text style={styles.redeemedReceiptLabel}>STATUS</Text>
                        <Text style={[styles.redeemedReceiptValue, { color: '#10B981' }]}>REDEEMED & APPLIED</Text>
                      </View>
                      <View style={[styles.redeemedReceiptRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                        <Text style={styles.redeemedReceiptLabel}>STORE</Text>
                        <Text style={styles.redeemedReceiptValue}>{selectedVoucher.merchantName}</Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <TouchableOpacity
                      style={styles.redeemedDoneModalBtn}
                      onPress={() => setUseModalVisible(false)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.redeemedDoneModalBtnText}>Done</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ marginTop: 12, paddingVertical: 6 }}
                      onPress={() => {
                        setUseModalVisible(false);
                        setActiveTab('used');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                        View in Used Wallet →
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
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
                  </>
                )}
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
    borderRadius: 20,
    height: 146,
    backgroundColor: '#0B0F17',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  ticketLeftZone: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  whiteLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 5,
  },
  merchantCircleLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    resizeMode: 'cover',
  },
  merchantName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
  merchantCategory: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    width: '100%',
    marginTop: 1,
  },
  dottedDivider: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  topNotch: {
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 0,
    zIndex: 5,
  },
  bottomNotch: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    zIndex: 5,
  },
  dottedLine: {
    width: 1,
    height: '100%',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ticketCenterZone: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  yellowStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFC700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  yellowStatusText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  rewardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  rewardSubtitle: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 1,
    lineHeight: 14,
  },
  mainFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  sourceBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  sourceBadgeText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footerDividerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  stockLabelText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  stockValueText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  ticketRightZone: {
    width: 105,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'relative',
    zIndex: 2,
  },
  specialRewardTag: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 0.5,
    zIndex: 3,
  },
  ctaPillBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 3,
    alignSelf: 'flex-end',
  },
  ctaPillText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  floatingRightImageWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 105,
    overflow: 'hidden',
  },
  floatingRightImage: {
    width: '100%',
    height: '100%',
  },
  rightImageLeftFade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: '#0B0F17',
    opacity: 0.8,
  },
  usedBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 3,
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

  // Redeemed Receipt Modal Styles
  redeemedSuccessIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  redeemedSuccessTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  redeemedSuccessSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  redeemedReceiptBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  redeemedReceiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  redeemedReceiptLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  redeemedReceiptCodePill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  redeemedReceiptCodeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 1,
  },
  redeemedReceiptValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  redeemedDoneModalBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  redeemedDoneModalBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
});
