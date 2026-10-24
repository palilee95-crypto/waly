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
  Alert,
  Platform,
  Animated,
  Pressable,
  TextInput,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from './_components/FlippableLoyaltyCard';
import PointsCashModal from '@/components/PointsCashModal';
import { useTr } from '@/lib/i18n';

const { width } = Dimensions.get('window');

type LoyaltyCardItem = {
  id: string;
  merchantName: string;
  category: string;
  logo: string;
  collectedStamps: number;
  totalStamps: number;
  rewardName: string;
  cardNumber: string;
  points: number;
  gradientColors: string[];
  cardIcon: string;
  stampColor?: string;
  fontColor?: string;
  cardBackground?: string;
  cardBackgroundBack?: string;
  validUntil?: string;
  tier?: string;
  merchantId?: string;
  linkedRewardId?: string;
  enable_stamps?: boolean;
  enable_points?: boolean;
  merchantSlug?: string;
  merchantCity?: string;
};

// --- Sub-component for Hoverable Wallet Card ---
const StackedWalletCard = ({ item, index, isPulledOut, isExiting, onTap, user, styles }: any) => {
  const tr = useTr();
  const pullAnim = React.useRef(new Animated.Value(isPulledOut ? 1 : 0)).current;
  const enterAnim = React.useRef(new Animated.Value(0)).current;
  const exitAnim = React.useRef(new Animated.Value(0)).current;

  // Entrance animation (Drop down 1-by-1)
  React.useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 100, // Stagger effect
      useNativeDriver: true,
      easing: Easing.out(Easing.exp) // Smooth drop
    }).start();
  }, []);

  // Exit animation (Slide left 1-by-1)
  React.useEffect(() => {
    if (isExiting) {
      Animated.timing(exitAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100, // Stagger effect
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease) // Smooth slide
      }).start();
    }
  }, [isExiting]);

  React.useEffect(() => {
    Animated.spring(pullAnim, {
      toValue: isPulledOut ? 1 : 0,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isPulledOut]);

  const translateYPull = pullAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -110], // Pulls the card up significantly to reveal it
  });

  const translateXEnter = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').width + 100, 0], // Slide in from right
  });
  
  const translateXExit = exitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Dimensions.get('window').width - 100], // Slide far to left
  });

  return (
    <Animated.View style={{ 
      zIndex: index, 
      marginTop: index > 0 ? -160 : 0, 
      transform: [
        { translateY: translateYPull },
        { translateX: Animated.add(translateXEnter, translateXExit) }
      ] 
    }}>
      <Pressable
        onPress={onTap}
        style={[
          styles.loyaltyCard, 
          { backgroundColor: (item.gradientColors ?? ['#EC4899', '#8B5CF6'])[0] }
        ]}
      >
        {/* Clipping Layer for Background & Gloss */}
        <View style={{ ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' }}>
          {/* Subtle metallic sheen */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
          <View style={{ position: 'absolute', top: -300, left: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '40deg' }], zIndex: 1, pointerEvents: 'none' }} />
          
          {item.cardBackground ? (
            <Image source={{ uri: item.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
        </View>

        {/* Header: Shop Name & Logo */}
        <View style={styles.cardInfoRow}>
          <View style={styles.shopLogoBg}>
            <Image source={{ uri: item.logo }} style={styles.shopLogo} />
          </View>
          <View style={{ flex: 1, marginLeft: 0, gap: 2 }}>
            <Text style={[styles.shopNameText, item.fontColor && { color: item.fontColor }]} numberOfLines={1}>
              {item.merchantName}
            </Text>
            <Text style={[styles.shopCategoryText, item.fontColor && { color: item.fontColor, opacity: 0.65 }]} numberOfLines={1}>
              {item.category.toUpperCase()}
            </Text>
          </View>
          {item.enable_stamps === false && item.enable_points === true ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }, item.fontColor && { color: item.fontColor }]}>
                {item.points.toLocaleString()}
              </Text>
              <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: 'rgba(255,255,255,0.75)' }, item.fontColor && { color: item.fontColor, opacity: 0.75 }]}>{tr('POINTS', 'MATA')}</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }, item.fontColor && { color: item.fontColor }]}>
                {item.collectedStamps}/{item.totalStamps}
              </Text>
              <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.75)' }, item.fontColor && { color: item.fontColor, opacity: 0.75 }]}>{tr('STAMPS', 'SETEM')}</Text>
            </View>
          )}
        </View>

        {/* Middle row: EMV Chip & Wifi Contactless Symbol */}
        <View style={styles.cardMidRow}>
          <View style={styles.cardChip}>
            <View style={styles.chipLineHoriz} />
            <View style={styles.chipLineVert} />
            <View style={styles.chipCenterPin} />
          </View>
          <Ionicons 
            name="wifi" 
            size={22} 
            color={item.fontColor ? item.fontColor : "rgba(255, 255, 255, 0.35)"} 
            style={{ opacity: 0.45 }} 
          />
        </View>

        {/* Footer row: Holder Name, Expiration, CVV, and brand logo */}
        <View style={styles.cardBottomRow}>
          <View style={styles.holderBlock}>
            <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
              CARD HOLDER
            </Text>
            <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]} numberOfLines={1}>
              {(user?.name || 'Ahmad Fazli').toUpperCase()}
            </Text>
          </View>

          <View style={{ width: 45 }}>
            <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
              VALID
            </Text>
            <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]}>
              {item.validUntil || '12/30'}
            </Text>
          </View>

          <View style={{ width: 35 }}>
            <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
              CVV
            </Text>
            <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]}>
              888
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Image
              source={require('../../assets/risev logo.png')}
              style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: item.fontColor || '#FFFFFF' }}
            />
          </View>
        </View>

        {/* Tap Again Hint */}
        {isPulledOut && (
          <Animated.View style={{ position: 'absolute', bottom: 70, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{tr('Tap again to view details', 'Ketik lagi untuk lihat butiran')}</Text>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export default function MyCardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const tr = useTr();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [displayPage, setDisplayPage] = useState(1);
  const [isPaginating, setIsPaginating] = useState(false);
  const [selectedCard, setSelectedCard] = useState<LoyaltyCardItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulledOutCardId, setPulledOutCardId] = useState<string | null>(null);
  const [pinnedCards, setPinnedCards] = useState<string[]>([]);

  const [filterTab, setFilterTab] = useState<'all' | 'progress' | 'redeem'>('all');

  useEffect(() => {
    setCurrentPage(1);
    setDisplayPage(1);
  }, [searchQuery, filterTab]);

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || isPaginating) return;
    
    setCurrentPage(newPage);
    setIsPaginating(true);
    
    // Wait for exit animation (500ms duration + up to 300ms stagger)
    setTimeout(() => {
      setDisplayPage(newPage);
      setIsPaginating(false);
    }, 500 + (3 * 100)); // Total ~800ms before showing next cards
  };


  const loadPinnedCards = async () => {
    try {
      const stored = await AsyncStorage.getItem('@pinned_cards');
      if (stored) {
        setPinnedCards(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed to load pinned cards", e);
    }
  };

  const togglePinCard = async (cardId: string) => {
    try {
      let newPinned = [...pinnedCards];
      if (newPinned.includes(cardId)) {
        newPinned = newPinned.filter(id => id !== cardId);
      } else {
        if (newPinned.length >= 3) {
          Alert.alert(tr('Limit Reached', 'Had Dicapai'), tr('You can only pin up to 3 cards to your home dashboard. Please unpin another card first.', 'Anda hanya boleh menyemat sehingga 3 kad pada papan pemuka utama. Sila nyahsemak kad lain terlebih dahulu.'));
          return;
        }
        newPinned.push(cardId);
      }
      setPinnedCards(newPinned);
      await AsyncStorage.setItem('@pinned_cards', JSON.stringify(newPinned));
    } catch (e) {
      console.warn("Failed to save pinned cards", e);
    }
  };

  const handleCardTap = (item: LoyaltyCardItem) => {
    if (pulledOutCardId === item.id) {
      // Second tap: open details
      openCardDetails(item);
      setPulledOutCardId(null);
    } else {
      // First tap: pull out
      setPulledOutCardId(item.id);
    }
  };

  const fetchLoyaltyCards = async () => {
    if (!user) return;
    try {
      const records = await pb.collection('loyalty_cards').getFullList({
        filter: `customer = '${user.id}'`,
        expand: 'program,merchant',
        sort: '-updated'
      });
      const mapped = records.map((rec: any) => {
        const program = rec.expand?.program;
        const merchant = rec.expand?.merchant;
        return {
          id: rec.id,
          merchantName: merchant?.name || 'Unknown Shop',
          category: merchant?.category || 'General',
          logo: merchant?.logo 
            ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
            : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120',
          collectedStamps: rec.stamps_collected || 0,
          totalStamps: program?.stamp_goal || 10,
          rewardName: program?.reward_description || 'Free Gift',
          cardNumber: `•••• •••• •••• ${rec.id.substring(rec.id.length - 4).toUpperCase()}`,
          points: rec.points_balance || 0,
          tier: rec.tier || 'bronze',
          merchantId: merchant?.id,
          linkedRewardId: program?.linked_reward,
          enable_stamps: program?.enable_stamps,
          enable_points: program?.enable_points,
          merchantSlug: merchant?.pwa_slug || merchant?.slug || merchant?.id,
          merchantCity: merchant?.city || merchant?.location || '',
          gradientColors: program?.card_color ? [program.card_color, '#000000'] : ['#EC4899', '#8B5CF6'],
          cardIcon: program?.card_icon || 'coffee',
          stampColor: program?.stamp_color || '#3B82F6',
          fontColor: program?.font_color || '#FFFFFF',
          cardBackground: program?.card_background
            ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`
            : undefined,
          cardBackgroundBack: program?.card_background_back
            ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background_back}`
            : undefined,
          validUntil: (() => {
            const expDate = new Date(rec.created);
            expDate.setDate(expDate.getDate() + (program?.expiry_days || 30));
            return `${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getFullYear()).slice(-2)}`;
          })(),
        };
      });
      setLoyaltyCards(mapped);
    } catch (err) {
      console.warn('Failed to fetch loyalty cards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoyaltyCards();
    loadPinnedCards();

    let disposed = false;
    let unsubscribe: (() => Promise<void>) | null = null;
    if (user) {
      pb.collection('loyalty_cards').subscribe('*', () => {
        fetchLoyaltyCards();
      }, {
        filter: `customer = '${user.id}'`
      }).then((remove) => {
        if (disposed) void remove().catch(() => {});
        else unsubscribe = remove;
      }).catch(() => {});
    }

    return () => {
      disposed = true;
      if (unsubscribe) void unsubscribe().catch(() => {});
    };
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      fetchLoyaltyCards();
      loadPinnedCards();
    }, [user?.id])
  );

  const [merchantRewards, setMerchantRewards] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  // Points-to-cash settings for the selected card's store (rate + minimum).
  const [cardProgram, setCardProgram] = useState<any>(null);
  const [pointsCashOpen, setPointsCashOpen] = useState(false);

  useEffect(() => {
    if (selectedCard && selectedCard.merchantId) {
      loadMerchantRewards(selectedCard.merchantId, selectedCard.linkedRewardId);
    } else {
      setMerchantRewards([]);
    }
  }, [selectedCard]);

  const loadMerchantRewards = async (merchantId: string, linkedRewardId?: string) => {
    try {
      setLoadingRewards(true);
      // Only `catalog` rewards are buyable with points. `system` covers the
      // internal "Points Cash Voucher" backing record and `milestone` covers the
      // shadow rewards behind stamp milestones — neither is a customer catalogue
      // item (`is_archived` is kept for rows that predate `reward_scope`).
      let filterQuery = `merchant = "${merchantId}" && is_active = true && is_archived != true && reward_scope = "catalog"`;
      if (linkedRewardId) {
        filterQuery += ` && id != "${linkedRewardId}"`;
      }
      const res = await pb.collection('rewards').getFullList({
        filter: filterQuery,
        sort: '-created',
        requestKey: null,
      });
      setMerchantRewards(res);
    } catch (err) {
      console.warn("Failed to load rewards:", err);
    } finally {
      setLoadingRewards(false);
    }

    try {
      const progs = await pb.collection('loyalty_programs').getFullList({
        filter: `merchant = "${merchantId}" && is_active = true`,
        requestKey: null,
      });
      setCardProgram(progs[0] || null);
    } catch (err) {
      setCardProgram(null);
    }
  };

  // Custom Redemption States
  const [redemptionConfirmVisible, setRedemptionConfirmVisible] = useState(false);
  const [selectedRewardToRedeem, setSelectedRewardToRedeem] = useState<any>(null);
  const [redeemingInProgress, setRedeemingInProgress] = useState(false);
  const [redemptionSuccessVisible, setRedemptionSuccessVisible] = useState(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);

  const handleRedeemReward = (reward: any) => {
    setSelectedRewardToRedeem(reward);
    setRedemptionConfirmVisible(true);
    setRedemptionSuccessVisible(false);
    setRedemptionError(null);
  };

  const executeRedemption = async () => {
    if (!selectedRewardToRedeem || !selectedCard) return;
    try {
      setRedeemingInProgress(true);
      setRedemptionError(null);

      // Generate a random voucher code in format: RV-XXXX-XXXX
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = (n: number) => {
        let result = '';
        for (let i = 0; i < n; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      const redemptionCode = `RV-${seg(4)}-${seg(4)}`;

      await pb.collection('redemptions').create({
        customer: user!.id,
        reward: selectedRewardToRedeem.id,
        code: redemptionCode,
        status: 'pending',
      });
      setRedemptionSuccessVisible(true);
    } catch (err: any) {
      console.warn("Redemption failed:", err);
      setRedemptionError(err.message || "Failed to redeem reward. Please try again.");
    } finally {
      setRedeemingInProgress(false);
    }
  };

  const handleRedemptionSuccessDone = () => {
    fetchLoyaltyCards();
    if (selectedCard && selectedRewardToRedeem) {
      setSelectedCard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          points: prev.points - selectedRewardToRedeem.points_cost
        };
      });
    }
    setRedemptionConfirmVisible(false);
    setRedemptionSuccessVisible(false);
    setSelectedRewardToRedeem(null);
  };

  const handleRedemptionSuccessViewVouchers = () => {
    setRedemptionConfirmVisible(false);
    setRedemptionSuccessVisible(false);
    setSelectedRewardToRedeem(null);
    setDetailModalVisible(false);
    router.push('/(customer)/vouchers');
  };

  const getTierColor = (tier: string = 'bronze') => {
    switch (tier) {
      case 'silver': return '#64748B';
      case 'gold': return '#D97706';
      case 'platinum': return '#0284C7';
      default: return '#B45309';
    }
  };

  const openCardDetails = (card: LoyaltyCardItem) => {
    setSelectedCard(card);
    setDetailModalVisible(true);
  };

  const stampIcons = [
    { id: 'ticket', family: 'Ionicons', name: 'ticket-sharp' },
    { id: 'star', family: 'FontAwesome', name: 'star' },
    { id: 'heart', family: 'Ionicons', name: 'heart' },
    { id: 'coffee', family: 'MaterialIcons', name: 'local-cafe' },
    { id: 'cake', family: 'MaterialIcons', name: 'cake' },
    { id: 'restaurant', family: 'Ionicons', name: 'restaurant' },
    { id: 'bag', family: 'Ionicons', name: 'bag-handle' },
    { id: 'sparkles', family: 'Ionicons', name: 'sparkles' },
  ];

  const renderStampIcon = (iconId: string, size: number, color: string) => {
    const icon = stampIcons.find(i => i.id === iconId) || stampIcons.find(i => i.id === 'coffee')!;
    if (icon.family === 'Ionicons') {
      return <Ionicons name={icon.name as any} size={size} color={color} />;
    }
    if (icon.family === 'FontAwesome') {
      return <FontAwesome name={icon.name as any} size={size} color={color} />;
    }
    if (icon.family === 'MaterialIcons') {
      return <MaterialIcons name={icon.name as any} size={size} color={color} />;
    }
    return <Ionicons name="cafe" size={size} color={color} />;
  };

  const renderDetailStampSlots = (card: LoyaltyCardItem) => {
    const slots = [];
    for (let i = 1; i <= card.totalStamps; i++) {
      if (i <= card.collectedStamps) {
        slots.push(
          <View 
            key={i} 
            style={[
              styles.largeStampEarned,
              card.stampColor && { backgroundColor: card.stampColor }
            ]}
          >
            {renderStampIcon(card.cardIcon, 16, '#FFFFFF')}
          </View>
        );
      } else {
        slots.push(
          <View key={i} style={styles.largeStampEmpty}>
            {renderStampIcon(card.cardIcon, 14, card.fontColor ? `${card.fontColor}40` : 'rgba(255, 255, 255, 0.25)')}
          </View>
        );
      }
    }
    return slots;
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const CARDS_PER_PAGE = 4;
  const readyToRedeemCount = loyaltyCards.filter(item => item.collectedStamps >= item.totalStamps).length;
  const inProgressCount = loyaltyCards.filter(item => item.collectedStamps < item.totalStamps).length;
  const totalCount = loyaltyCards.length;

  const filteredCards = loyaltyCards.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = item.merchantName.toLowerCase().includes(q) || (item.rewardName || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterTab === 'redeem') return item.collectedStamps >= item.totalStamps;
    if (filterTab === 'progress') return item.collectedStamps < item.totalStamps;
    return true;
  });
  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredCards.slice((displayPage - 1) * CARDS_PER_PAGE, displayPage * CARDS_PER_PAGE);

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
            
            {/* Top Row: Back button (if available) + Large Title + Active Cards Badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
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
                  Stamp Cards
                </Text>
              </View>

              {/* Active Cards Count Badge */}
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
                  {totalCount} {totalCount === 1 ? 'Card' : 'Cards'}
                </Text>
              </View>
            </View>

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
                placeholder={tr('Search merchant or reward...', 'Cari peniaga atau ganjaran...')}
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

            {/* Segmented Filter Pills (All / In Progress / Ready to Redeem) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {/* Tab 1: All */}
              <TouchableOpacity
                onPress={() => setFilterTab('all')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: filterTab === 'all' ? '#000000' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: filterTab === 'all' ? '#000000' : 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: filterTab === 'all' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: filterTab === 'all' ? '#FFFFFF' : '#000000',
                }}>
                  All
                </Text>
                <View style={{
                  backgroundColor: filterTab === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: filterTab === 'all' ? '#FFFFFF' : '#000000',
                  }}>
                    {totalCount}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tab 2: In Progress */}
              <TouchableOpacity
                onPress={() => setFilterTab('progress')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: filterTab === 'progress' ? '#000000' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: filterTab === 'progress' ? '#000000' : 'rgba(0, 0, 0, 0.08)',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: filterTab === 'progress' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: filterTab === 'progress' ? '#FFFFFF' : '#000000',
                }}>
                  In Progress
                </Text>
                <View style={{
                  backgroundColor: filterTab === 'progress' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: filterTab === 'progress' ? '#FFFFFF' : '#000000',
                  }}>
                    {inProgressCount}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tab 3: Ready to Redeem */}
              <TouchableOpacity
                onPress={() => setFilterTab('redeem')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  backgroundColor: filterTab === 'redeem' ? '#000000' : (readyToRedeemCount > 0 ? '#FFFBEB' : '#F8FAFC'),
                  borderWidth: 1,
                  borderColor: filterTab === 'redeem' ? '#000000' : (readyToRedeemCount > 0 ? '#FDE047' : 'rgba(0, 0, 0, 0.08)'),
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: filterTab === 'redeem' ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                  color: filterTab === 'redeem' ? '#FFFFFF' : '#000000',
                }}>
                  Ready to Redeem 🎁
                </Text>
                <View style={{
                  backgroundColor: filterTab === 'redeem' ? '#FFCC00' : (readyToRedeemCount > 0 ? '#FFCC00' : 'rgba(0, 0, 0, 0.06)'),
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: '#000000',
                  }}>
                    {readyToRedeemCount}
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

          </View>
        </View>

        <ScrollView
          style={{ flex: 1, zIndex: 5 }}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 16 }, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
          onScroll={() => {
            if (pulledOutCardId) setPulledOutCardId(null);
          }}
          scrollEventThrottle={16}
        >

          {/* Cards Wallet List */}
          <View style={styles.walletList}>
            {loading ? (
              <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
            ) : loyaltyCards.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="card-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>{tr('No Stamp Cards Yet', 'Belum Ada Kad Setem')}</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {tr("You haven't collected any stamps from merchants yet. Start exploring shops!", 'Anda belum mengumpul setem daripada peniaga lagi. Mulakan terokai kedai!')}
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateBtn} 
                  onPress={() => router.push('/(customer)/explore')}
                >
                  <Text style={styles.emptyStateBtnText}>{tr('Explore Partners', 'Teroka Rakan Kongsi')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {paginatedCards.map((item, index) => (
                  <StackedWalletCard
                    key={`${item.id}-${displayPage}`} // Force remount on new page to trigger enter animation
                    item={item}
                    index={index}
                    isPulledOut={pulledOutCardId === item.id}
                    isExiting={isPaginating}
                    onTap={() => handleCardTap(item)}
                    user={user}
                    styles={styles}
                  />
                ))}

                {/* Pagination Controls */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 0, paddingBottom: 40, zIndex: 10, gap: 12 }}>
                    <TouchableOpacity 
                      disabled={currentPage === 1 || isPaginating}
                      onPress={() => handlePageChange(Math.max(1, currentPage - 1))}
                      style={{ padding: 8, opacity: currentPage === 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-back" size={24} color="#1A1400" />
                    </TouchableOpacity>
                    
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <TouchableOpacity 
                          key={i} 
                          disabled={isPaginating}
                          onPress={() => handlePageChange(i + 1)}
                          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: currentPage === i + 1 ? '#FFC700' : '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: currentPage === i + 1 ? '#1A1400' : '#64748B' }}>
                            {i + 1}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity 
                      disabled={currentPage === totalPages || isPaginating}
                      onPress={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      style={{ padding: 8, opacity: currentPage === totalPages ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-forward" size={24} color="#1A1400" />
                    </TouchableOpacity>
                  </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Stamp Card Details Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={[styles.detailOverlay, isDesktop && { justifyContent: 'center', alignItems: 'center' }]}>
          {selectedCard && (
            <View style={[styles.detailContent, isDesktop && { maxWidth: 520, width: '90%', borderRadius: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, borderTopWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 25, elevation: 10 }]}>
              {/* Apple iOS Drag Pill Indicator */}
              <View style={styles.sheetHandleBar} />

              {/* Modal Header: Merchant Name, Category, City & Circular Close */}
              <View style={styles.detailHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.detailMerchantName} numberOfLines={1}>
                    {selectedCard.merchantName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={styles.detailCategoryText} numberOfLines={1}>
                      {selectedCard.category.toUpperCase()}
                    </Text>
                    {selectedCard.merchantCity ? (
                      <>
                        <Text style={{ fontSize: 10, color: 'rgba(0, 0, 0, 0.3)' }}>•</Text>
                        <Ionicons name="location-sharp" size={11} color="rgba(0, 0, 0, 0.55)" />
                        <Text style={styles.detailCityText} numberOfLines={1}>
                          {selectedCard.merchantCity}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => setDetailModalVisible(false)} 
                  style={styles.sheetCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
              >
                {/* 3D Flippable Loyalty Card & Tap Hint */}
                <View>
                  <FlippableLoyaltyCard 
                    card={selectedCard} 
                    user={user} 
                    autoFlipDelay={500}
                  />
                  <View style={styles.flipHintRow}>
                    <Ionicons name="swap-horizontal" size={13} color="rgba(0, 0, 0, 0.45)" />
                    <Text style={styles.flipHintText}>{tr('Tap card to flip for details & barcode', 'Ketik kad untuk lihat butiran & kod bar')}</Text>
                  </View>
                </View>

                {/* Stamp Progress & Milestones Tracker (Hidden in Points-Only Mode) */}
                {selectedCard.enable_stamps !== false && (() => {
                  const isCompleted = selectedCard.collectedStamps >= selectedCard.totalStamps;
                  const progressPercent = Math.min(100, Math.max(0, Math.round((selectedCard.collectedStamps / selectedCard.totalStamps) * 100)));
                  const remainingStamps = Math.max(0, selectedCard.totalStamps - selectedCard.collectedStamps);

                  return (
                    <View style={styles.progressTrackerCard}>
                      <View style={styles.progressTrackerHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="ribbon-outline" size={15} color="#000000" />
                          <Text style={styles.progressTrackerTitle}>{tr('STAMP PROGRESS', 'PROGRES SETEM')}</Text>
                        </View>
                        <View style={styles.progressBadge}>
                          <Text style={styles.progressBadgeText}>
                            {selectedCard.collectedStamps} / {selectedCard.totalStamps} {tr('STAMPS', 'SETEM')}
                          </Text>
                        </View>
                      </View>

                      {/* Visual Progress Bar */}
                      <View style={styles.modalProgressBarTrack}>
                        <View style={[styles.modalProgressBarFill, { width: `${progressPercent}%` }]} />
                      </View>

                      {/* Milestone State */}
                      {isCompleted ? (
                        <View style={styles.rewardUnlockedBadge}>
                          <View style={styles.rewardUnlockedIconBg}>
                            <Ionicons name="gift" size={16} color="#000000" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rewardUnlockedTitle}>{tr('Reward Ready to Redeem! 🎉', 'Ganjaran Sedia Ditebus! 🎉')}</Text>
                            <Text style={styles.rewardUnlockedSub} numberOfLines={2}>
                              {selectedCard.rewardName}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.rewardPendingRow}>
                          <Ionicons name="gift-outline" size={15} color="rgba(0, 0, 0, 0.7)" />
                          <Text style={styles.rewardPendingText}>
                            {tr(`Collect ${remainingStamps} more stamps to unlock ${selectedCard.rewardName}`, `Kumpul ${remainingStamps} setem lagi untuk membuka ${selectedCard.rewardName}`)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* 2-Column Grid: Points Balance & Membership Tier (Hidden in Stamps-Only Mode) */}
                {selectedCard.enable_points !== false && (
                  <View style={styles.statsGridRow}>
                    {/* Points Balance Column */}
                    <View style={styles.statsCard}>
                      <Text style={styles.statsLabel}>{tr('POINTS BALANCE', 'BAKI MATA')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                        <Text style={styles.statsValue}>{selectedCard.points}</Text>
                        <Text style={styles.statsUnit}>{tr('PTS', 'MATA')}</Text>
                      </View>
                      {(selectedCard.enable_points as boolean | undefined) !== false ? (
                        <TouchableOpacity
                          style={styles.usePointsBtn}
                          activeOpacity={0.85}
                          onPress={() => setPointsCashOpen(true)}
                        >
                          <Text style={styles.usePointsBtnText}>{tr('Use points', 'Guna mata')}</Text>
                          <Ionicons name="chevron-forward" size={11} color="#B45309" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Membership Tier Column */}
                    <View style={styles.statsCard}>
                      <Text style={styles.statsLabel}>{tr('MEMBERSHIP', 'KEAHLIAN')}</Text>
                      <View style={styles.tierValueRow}>
                        <View style={styles.tierDot} />
                        <Text style={styles.tierValueText}>
                          {(selectedCard.tier || 'VIP').toUpperCase()} {tr('MEMBER', 'AHLI')}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Quick Actions Row: Book Appointment & Pin to Home */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={styles.bookAppointmentBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      setDetailModalVisible(false);
                      const targetSlug = selectedCard.merchantSlug || selectedCard.merchantId;
                      if (targetSlug) {
                        router.push(`/b/${targetSlug}` as any);
                      } else {
                        Alert.alert(tr('Store Unavailable', 'Kedai Tidak Tersedia'), tr('Merchant booking page is not available.', 'Halaman tempahan peniaga tidak tersedia.'));
                      }
                    }}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.bookAppointmentBtnText}>{tr('Book Appointment', 'Tempah Temujanji')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.pinToggleBtn,
                      pinnedCards.includes(selectedCard.id) && styles.pinToggleBtnActive
                    ]}
                    activeOpacity={0.85}
                    onPress={() => togglePinCard(selectedCard.id)}
                  >
                    <Ionicons 
                      name={pinnedCards.includes(selectedCard.id) ? "pin" : "pin-outline"} 
                      size={16} 
                      color={pinnedCards.includes(selectedCard.id) ? "#000000" : "rgba(0, 0, 0, 0.7)"} 
                    />
                    <Text style={[
                      styles.pinToggleBtnText,
                      pinnedCards.includes(selectedCard.id) && styles.pinToggleBtnTextActive
                    ]}>
                      {pinnedCards.includes(selectedCard.id) ? tr('Pinned', 'Disemat') : tr('Pin to Home', 'Semat ke Utama')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Points Catalog Section (Hidden in Stamps-Only Mode) */}
                {selectedCard.enable_points !== false && (
                  <View style={styles.catalogSection}>
                    <Text style={styles.catalogTitle}>{tr('Points Catalog', 'Katalog Mata')}</Text>
                    <Text style={styles.catalogSubtitle}>{tr('Spend points earned at this merchant to redeem rewards:', 'Gunakan mata yang diperoleh di peniaga ini untuk menebus ganjaran:')}</Text>
                    
                    {loadingRewards ? (
                      <ActivityIndicator color="#000000" style={{ marginVertical: 20 }} />
                    ) : merchantRewards.length === 0 ? (
                      <View style={styles.emptyCatalogCard}>
                        <Text style={styles.emptyCatalogText}>{tr('No catalog rewards available at this shop.', 'Tiada ganjaran katalog tersedia di kedai ini.')}</Text>
                      </View>
                    ) : (
                      <View style={styles.catalogList}>
                        {merchantRewards.map((reward: any) => (
                          <View key={reward.id} style={styles.catalogItem}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                              <Text style={styles.catalogItemName}>{reward.name}</Text>
                              <Text style={styles.catalogItemCost}>{reward.points_cost} {tr('Points', 'Mata')}</Text>
                              {reward.description ? (
                                <Text style={styles.catalogItemDesc}>{reward.description}</Text>
                              ) : null}
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.redeemBtn,
                                selectedCard.points < reward.points_cost && styles.redeemBtnDisabled
                              ]}
                              disabled={selectedCard.points < reward.points_cost}
                              onPress={() => handleRedeemReward(reward)}
                            >
                              <Text style={styles.redeemBtnText}>{tr('Redeem', 'Tebus')}</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Sticky Bottom Thumb-Zone Action Bar */}
              <View style={styles.stickyModalFooter}>
                <TouchableOpacity
                  style={styles.stickyScanBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    setDetailModalVisible(false);
                    setQrModalVisible(true);
                  }}
                >
                  <View style={styles.scanIconPill}>
                    <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.stickyScanBtnText}>{tr('SHOW QR TO SCAN', 'TUNJUKKAN QR UNTUK IMBAS')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Custom Redemption Confirm & Success Modal */}
      <Modal
        visible={redemptionConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!redeemingInProgress) setRedemptionConfirmVisible(false);
        }}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            {redemptionError ? (
              // Error State
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={[styles.confirmIconBg, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="warning" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.confirmTitle}>{tr('Redemption Failed', 'Penebusan Gagal')}</Text>
                <Text style={styles.confirmText}>{redemptionError}</Text>
                
                <TouchableOpacity
                  style={styles.errorCloseBtn}
                  onPress={() => {
                    setRedemptionError(null);
                    setRedemptionConfirmVisible(false);
                  }}
                >
                  <Text style={styles.errorCloseText}>{tr('Close', 'Tutup')}</Text>
                </TouchableOpacity>
              </View>
            ) : !redemptionSuccessVisible ? (
              // Confirmation State
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.confirmIconBg}>
                  <Ionicons name="gift" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.confirmTitle}>{tr('Confirm Redemption', 'Sahkan Penebusan')}</Text>
                <Text style={styles.confirmText}>
                  {tr(`Are you sure you want to redeem "${selectedRewardToRedeem?.name}" for ${selectedRewardToRedeem?.points_cost} points?`, `Adakah anda pasti mahu menebus "${selectedRewardToRedeem?.name}" dengan ${selectedRewardToRedeem?.points_cost} mata?`)}
                </Text>
                
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.cancelActionBtn}
                    disabled={redeemingInProgress}
                    onPress={() => setRedemptionConfirmVisible(false)}
                  >
                    <Text style={styles.cancelActionText}>{tr('Cancel', 'Batal')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmActionBtn}
                    disabled={redeemingInProgress}
                    onPress={executeRedemption}
                  >
                    {redeemingInProgress ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmActionText}>{tr('Redeem', 'Tebus')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Success State
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={[styles.confirmIconBg, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.confirmTitle}>{tr('Redemption Successful!', 'Penebusan Berjaya!')}</Text>
                <Text style={styles.confirmText}>
                  {tr('Your voucher has been generated successfully. You can find it under the Vouchers tab!', 'Baucar anda telah berjaya dijana. Anda boleh menemuinya di tab Baucar!')}
                </Text>
                
                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.successDoneBtn}
                    onPress={handleRedemptionSuccessDone}
                  >
                    <Text style={styles.successDoneText}>{tr('Done', 'Selesai')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.successViewVouchersBtn}
                    onPress={handleRedemptionSuccessViewVouchers}
                  >
                    <Text style={styles.successViewVouchersText}>{tr('View Vouchers', 'Lihat Baucar')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* QR Code Pop-up Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.qrOverlay}>
          <View style={styles.qrContent}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>{tr('My Member QR', 'QR Ahli Saya')}</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrImageWrapper}>
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user?.phone || 'AhmadFazli'}`,
                }}
                style={styles.qrCodeImage}
              />
            </View>

            <Text style={styles.phoneLabel}>{tr('PHONE NUMBER', 'NOMBOR TELEFON')}</Text>
            <Text style={styles.phoneValue}>{user?.phone || '+60 11-2345678'}</Text>
            <Text style={styles.scanNotice}>
              {tr('Present this code to the store staff to collect stamps or redeem reward vouchers.', 'Tunjukkan kod ini kepada kakitangan kedai untuk mengumpul setem atau menebus baucar ganjaran.')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Points → cash voucher (rate and minimum come from the store's program) */}
      {selectedCard ? (
        <PointsCashModal
          visible={pointsCashOpen}
          onClose={() => setPointsCashOpen(false)}
          merchantId={selectedCard.merchantId || ''}
          merchantName={selectedCard.merchantName || 'Store'}
          balance={Number(selectedCard.points) || 0}
          rate={Number(cardProgram?.points_per_rm) || 100}
          minRedeem={Number(cardProgram?.min_redeem_points) || 0}
          onConverted={(newBalance) => {
            setSelectedCard((prev) =>
              prev ? { ...prev, points: newBalance } : prev
            );
            fetchLoyaltyCards();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  usePointsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: '#FFFBEA',
  },
  usePointsBtnText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
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
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
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
  walletList: {
    gap: 16,
  },
  // Loyalty Card Item Styling
  loyaltyCard: {
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    aspectRatio: 1.75, // Wider aspect ratio makes it shorter to fit screen
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopLogoBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  shopLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  shopTextColumn: {
    flex: 1,
    gap: 2,
  },
  shopNameText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  shopCategoryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  ptsColumn: {
    alignItems: 'flex-end',
  },
  ptsValueText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  ptsLabelText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  cardChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  cardChip: {
    width: 32,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: 11,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: '#B45309',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    left: 15,
    width: 1,
    height: '100%',
    backgroundColor: '#B45309',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#B45309',
  },
  cardProgressWrap: {
    height: 4,
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardNumberText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.2,
  },
  cardHolderText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Details Modal styles (Apple Bottom Sheet x Fresha)
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  detailContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailMerchantName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
  },
  detailCategoryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(0, 0, 0, 0.55)',
    letterSpacing: 0.4,
  },
  detailCityText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(0, 0, 0, 0.55)',
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  detailModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  flipHintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  flipHintText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: 'rgba(0, 0, 0, 0.45)',
  },
  progressTrackerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    gap: 12,
  },
  progressTrackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrackerTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  progressBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  progressBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalProgressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 99,
    overflow: 'hidden',
  },
  modalProgressBarFill: {
    height: '100%',
    backgroundColor: '#FFCC00',
    borderRadius: 99,
  },
  largeStampEarned: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeStampEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardUnlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rewardUnlockedIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardUnlockedTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
  rewardUnlockedSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B45309',
    marginTop: 1,
  },
  rewardPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  rewardPendingText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.6)',
    lineHeight: 16,
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: 'rgba(0, 0, 0, 0.45)',
    letterSpacing: 0.5,
  },
  statsValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  statsUnit: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  tierValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFCC00',
  },
  tierValueText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.3,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bookAppointmentBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bookAppointmentBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pinToggleBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
  },
  pinToggleBtnActive: {
    backgroundColor: '#FFCC00',
    borderColor: '#FFCC00',
  },
  pinToggleBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  pinToggleBtnTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  stickyModalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FFFFFF',
  },
  stickyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  scanIconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyScanBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  // QR overlay
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrContent: {
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
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  qrImageWrapper: {
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
  phoneLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 1,
  },
  phoneValue: {
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
    gap: 12,
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
  emptyStateBtn: {
    backgroundColor: '#004ac6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  emptyStateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  cardBgWave: {
    position: 'absolute',
    right: -80,
    top: -50,
    width: 260,
    height: 300,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  cardBgWave2: {
    position: 'absolute',
    right: -40,
    top: 10,
    width: 180,
    height: 220,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  cardNumberContainer: {
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  cardLabelText: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardNumberValueText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  holderBlock: {
    flex: 1,
    marginRight: 10,
  },
  holderValueText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  validBlock: {
    width: 45,
  },
  cvvBlock: {
    width: 35,
  },
  mastercardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pointsTierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointsTierInfo: {
    flexDirection: 'column',
  },
  pointsTierTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  pointsTierValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  tierBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  catalogSection: {
    marginTop: 8,
  },
  catalogTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 2,
  },
  catalogSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 12,
  },
  emptyCatalogCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyCatalogText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  catalogList: {
    gap: 8,
  },
  catalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catalogItemName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  catalogItemCost: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
    marginTop: 2,
  },
  catalogItemDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
  },
  redeemBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  redeemBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  redeemBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  confirmIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelActionBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  confirmActionBtn: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActionText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  successActions: {
    flexDirection: 'row-reverse',
    gap: 12,
    width: '100%',
  },
  successDoneBtn: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successDoneText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  successViewVouchersBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successViewVouchersText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  errorCloseBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCloseText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
