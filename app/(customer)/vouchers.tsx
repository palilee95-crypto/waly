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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { getRewardVisualUrl } from '@/lib/rewardVisuals';
import { getVoucherSpineTheme } from '@/theme';

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
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'used'>('active');
  const [searchQuery, setSearchQuery] = useState('');
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

        const applicableText = reward?.applicable_items_text || parsedMeta.applicable_items_text;
        const discountScope = reward?.discount_scope || parsedMeta.discount_scope;
        const itemNote = applicableText
          ? (rewardType === 'free_item' ? `Percuma: ${applicableText}` : `Sah untuk: ${applicableText}`)
          : (discountScope === 'all' && rewardType === 'discount' ? 'Sah untuk semua pesanan' : '');

        const displayTitle = reward?.name || reward?.title || campaign?.name || campaign?.title || (discountVal ? `${discountType === 'percent' || discountType === 'percentage' ? discountVal + '%' : 'RM ' + discountVal} OFF` : 'Voucher');
        const displaySubtitle = itemNote || reward?.description || campaign?.description || parsedMeta.description || 'Redeem at store';
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
          color: merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || (reward?.type === 'discount' ? '#7C3AED' : '#050505'),
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
            color: merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || '#050505',
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

  useFocusEffect(
    React.useCallback(() => {
      fetchVouchers();
    }, [user?.id])
  );

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

  const availableCount = vouchers.filter((v) => v.status === 'active').length;
  const historyCount = vouchers.filter((v) => v.status === 'used').length;
  const totalCount = vouchers.length;

  const filteredVouchers = vouchers.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchMerchant = v.merchantName.toLowerCase().includes(q);
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchCategory = (v.category || '').toLowerCase().includes(q);
      const matchCode = (v.code || '').toLowerCase().includes(q);
      if (!matchMerchant && !matchTitle && !matchCategory && !matchCode) return false;
    }
    if (activeTab === 'all') return true;
    return v.status === activeTab;
  });

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
        {/* Apple Wallet Native Executive Header with Segmented Filter Tabs */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 0, 0, 0.06)',
          zIndex: 10,
        }}>
          <View style={[
            { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
            isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }
          ]}>
            {/* Top Row: Back button (if available) + Large Title + Active Vouchers Badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {router.canGoBack() && (
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: 'rgba(0, 0, 0, 0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                )}
                <Text style={{
                  fontSize: 28,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: '#000000',
                  letterSpacing: -0.8,
                }}>
                  My Vouchers
                </Text>
              </View>

              {/* Active Vouchers Count Badge */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 11,
                paddingVertical: 5.5,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.06)',
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFCC00' }} />
                <Text style={{
                  fontSize: 11.5,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: '#000000',
                }}>
                  {availableCount} Active
                </Text>
              </View>
            </View>

            {/* Muted Subtitle */}
            <Text style={{
              fontSize: 12.5,
              fontFamily: 'PlusJakartaSans_500Medium',
              color: 'rgba(0, 0, 0, 0.55)',
              lineHeight: 18,
              marginBottom: 12,
            }}>
              Redeem and present rewards vouchers at partner stores.
            </Text>

            {/* Apple iOS Search Bar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: 16,
              paddingHorizontal: 14,
              height: 46,
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.06)',
              marginBottom: 12,
            }}>
              <Ionicons name="search" size={18} color="rgba(0, 0, 0, 0.45)" />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_500Medium',
                  color: '#000000',
                }}
                placeholder="Search voucher or store..."
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="rgba(0, 0, 0, 0.4)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Segmented Filter Pills (All / Available / History) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {/* Tab 1: All */}
              <TouchableOpacity
                onPress={() => setActiveTab('all')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: activeTab === 'all' ? '#000000' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: activeTab === 'all' ? '#000000' : 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: activeTab === 'all' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: activeTab === 'all' ? '#FFFFFF' : '#000000',
                }}>
                  All
                </Text>
                <View style={{
                  backgroundColor: activeTab === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: activeTab === 'all' ? '#FFFFFF' : '#000000',
                  }}>
                    {totalCount}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tab 2: Available */}
              <TouchableOpacity
                onPress={() => setActiveTab('active')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: activeTab === 'active' ? '#000000' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: activeTab === 'active' ? '#000000' : 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: activeTab === 'active' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: activeTab === 'active' ? '#FFFFFF' : '#000000',
                }}>
                  Available
                </Text>
                <View style={{
                  backgroundColor: activeTab === 'active' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: activeTab === 'active' ? '#FFFFFF' : '#000000',
                  }}>
                    {availableCount}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tab 3: History */}
              <TouchableOpacity
                onPress={() => setActiveTab('used')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: activeTab === 'used' ? '#000000' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: activeTab === 'used' ? '#000000' : 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: activeTab === 'used' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: activeTab === 'used' ? '#FFFFFF' : '#000000',
                }}>
                  History
                </Text>
                <View style={{
                  backgroundColor: activeTab === 'used' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: activeTab === 'used' ? '#FFFFFF' : '#000000',
                  }}>
                    {historyCount}
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Birthday Rewards Section */}
          {(activeTab === 'all' || activeTab === 'active') && birthdayRewards.filter((b) => b.status === 'active').length > 0 && (
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
                const cardBrandColor = item.color || '#050505';
                const isLightBrand = (() => {
                  const hex = (cardBrandColor || '#050505').replace('#', '');
                  const r = parseInt(hex.substring(0, 2), 16) || 0;
                  const g = parseInt(hex.substring(2, 4), 16) || 0;
                  const b = parseInt(hex.substring(4, 6), 16) || 0;
                  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                  return yiq >= 160;
                })();
                const brandTextColor = isLightBrand ? '#0F172A' : '#FFFFFF';
                
                const isClickable = item.status === 'active';
                const Container: any = isClickable ? TouchableOpacity : View;
                const containerProps = isClickable ? {
                  onPress: () => handleUseVoucher(item),
                  activeOpacity: 0.9
                } : {};

                return (
                  <Container 
                    key={item.id} 
                    style={{
                      height: 156,
                      borderRadius: 18,
                      backgroundColor: '#FFFFFF',
                      flexDirection: 'row',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 10,
                      elevation: 4,
                      position: 'relative',
                      opacity: isClickable ? 1 : 0.65,
                    }}
                    {...containerProps}
                  >
                    {/* 1. LEFT STUB: Voucher Category Color Spine (Standardized to Merchant Brand Color) */}
                    {(() => {
                      const spineTheme = getVoucherSpineTheme(item.isBirthday ? 'festive' : item.rewardType, item.title, cardBrandColor);
                      return (
                        <View style={{
                          width: 44,
                          backgroundColor: cardBrandColor,
                          alignItems: 'center',
                          position: 'relative',
                          borderTopLeftRadius: 18,
                          borderBottomLeftRadius: 18,
                          overflow: 'hidden',
                        }}>
                          <View style={{
                            width: 156,
                            height: 44,
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginLeft: -78,
                            marginTop: -22,
                            transform: [{ rotate: '-90deg' }],
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor, letterSpacing: 0.8, textAlign: 'center' }} numberOfLines={1}>
                              {spineTheme.spineText}
                            </Text>
                            <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_700Bold', color: brandTextColor, opacity: 0.85, letterSpacing: 1.2, marginTop: 1 }}>
                              {spineTheme.subText}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* 2. CENTER ZONE: Reward Information on Pure White */}
                    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 11, paddingHorizontal: 12, justifyContent: 'space-between' }}>
                      {/* Top Row: Ready to redeem pill + Discount tag */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{
                          backgroundColor: item.status === 'active' ? '#FFFBEB' : '#F1F5F9',
                          borderWidth: 1,
                          borderColor: item.status === 'active' ? '#FDE68A' : '#E2E8F0',
                          paddingHorizontal: 7,
                          paddingVertical: 2.5,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3.5,
                        }}>
                          <Ionicons name={item.isBirthday ? "balloon" : "gift"} size={10} color={item.status === 'active' ? '#B45309' : '#64748B'} />
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: item.status === 'active' ? '#B45309' : '#64748B' }}>
                            {item.status !== 'active' ? (item.rawStatus === 'used' ? 'Used' : 'Expired') : (item.isBirthday ? 'Birthday Special' : 'Ready to redeem')}
                          </Text>
                        </View>

                        <View style={{
                          backgroundColor: item.rewardType === 'discount' ? '#0F172A' : '#FFCC00',
                          paddingHorizontal: 7,
                          paddingVertical: 2.5,
                          borderRadius: 6,
                        }}>
                          <Text style={{
                            fontSize: 8,
                            fontFamily: 'PlusJakartaSans_800ExtraBold',
                            color: item.rewardType === 'discount' ? '#FFFFFF' : '#050505',
                            letterSpacing: 0.5,
                          }}>
                            {item.rewardType === 'discount'
                              ? (item.discountValue ? (item.discountType === 'percentage' || item.discountType === 'percent' ? `${item.discountValue}% OFF` : `RM ${item.discountValue} OFF`) : 'DISCOUNT')
                              : 'FREE ITEM'}
                          </Text>
                        </View>
                      </View>

                      {/* Middle: YOUR REWARD + Title + Subtitle */}
                      <View style={{ marginVertical: 1 }}>
                        <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 1, textTransform: 'uppercase' }}>
                          YOUR REWARD
                        </Text>
                        <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 18 }} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 1, lineHeight: 14 }} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>

                      {/* Bottom Row: Source Pill & Expiry/Stock + Use Voucher Button */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 6 }}>
                          <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name={item.isBirthday ? "balloon" : "card"} size={8.5} color="#059669" />
                            <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#059669', letterSpacing: 0.3 }} numberOfLines={1}>
                              {item.isBirthday ? 'BIRTHDAY' : 'STAMP REWARD'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 9, color: '#CBD5E1' }}>|</Text>
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', flexShrink: 1 }} numberOfLines={1}>
                            {item.expiry}
                          </Text>
                        </View>

                        {/* Customer CTA Button */}
                        {item.status === 'active' ? (
                          <View style={{ height: 26, borderRadius: 13, backgroundColor: '#0F172A', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }} numberOfLines={1}>Use Voucher ➔</Text>
                          </View>
                        ) : (
                          <View style={{ height: 24, borderRadius: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8' }} numberOfLines={1}>
                              {item.rawStatus === 'used' ? 'REDEEMED' : 'EXPIRED'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* 3. PERFORATION COLUMN */}
                    <View style={{
                      width: 18,
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'relative',
                      zIndex: 3,
                    }} pointerEvents="none">
                      <View style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 9,
                        backgroundColor: cardBrandColor,
                      }} />
                      <View style={{
                        width: 1,
                        height: '100%',
                        borderColor: '#FFFFFF',
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        zIndex: 1,
                      }} />
                      <View style={{
                        position: 'absolute',
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        top: -9,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        zIndex: 2,
                      }} />
                      <View style={{
                        position: 'absolute',
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        bottom: -9,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        zIndex: 2,
                      }} />
                    </View>

                    {/* 4. RIGHT STUB */}
                    <View style={{
                      width: 100,
                      backgroundColor: cardBrandColor,
                      borderTopRightRadius: 18,
                      borderBottomRightRadius: 18,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <View style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: isLightBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.12,
                        shadowRadius: 4,
                        elevation: 2,
                        marginBottom: 6,
                      }}>
                        <Image source={{ uri: item.logo }} style={{ width: 44, height: 44, borderRadius: 22, resizeMode: 'cover' }} />
                      </View>
                      <Text style={{
                        fontSize: 10.5,
                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                        color: brandTextColor,
                        textAlign: 'center',
                        width: '100%',
                        letterSpacing: 0.3,
                      }} numberOfLines={2}>
                        {(item.merchantName || 'STORE').toUpperCase()}
                      </Text>
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
    paddingBottom: 130, // Safe padding to clear bottom tab bar
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
