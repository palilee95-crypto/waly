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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from './_components/FlippableLoyaltyCard';

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
};

// --- Sub-component for Hoverable Wallet Card ---
const StackedWalletCard = ({ item, index, isPulledOut, isExiting, onTap, user, styles }: any) => {
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
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }, item.fontColor && { color: item.fontColor }]}>
              {item.collectedStamps}/{item.totalStamps}
            </Text>
            <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.75)' }, item.fontColor && { color: item.fontColor, opacity: 0.75 }]}>STAMPS</Text>
          </View>
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
              <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Tap again to view details</Text>
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

  useEffect(() => {
    setCurrentPage(1);
    setDisplayPage(1);
  }, [searchQuery]);

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
          Alert.alert("Limit Reached", "You can only pin up to 3 cards to your home dashboard. Please unpin another card first.");
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

    if (user) {
      pb.collection('loyalty_cards').subscribe('*', () => {
        fetchLoyaltyCards();
      }, {
        filter: `customer = '${user.id}'`
      });
    }

    return () => {
      pb.collection('loyalty_cards').unsubscribe('*');
    };
  }, [user]);

  const [merchantRewards, setMerchantRewards] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

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
      let filterQuery = `merchant = "${merchantId}" && is_active = true`;
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
  const filteredCards = loyaltyCards.filter(item => item.merchantName.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  const paginatedCards = filteredCards.slice((displayPage - 1) * CARDS_PER_PAGE, displayPage * CARDS_PER_PAGE);

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Yellow Header Foreground (Z-Index 10 so cards scroll UNDER this part) */}
        <View style={{ backgroundColor: '#FFC700', borderBottomRightRadius: 28, zIndex: 10 }}>
          <View style={[{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
            
            {/* Page Titles inside the Yellow Header */}
            <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', letterSpacing: -1 }}>All Stamp Cards</Text>

            {/* Search Bar */}
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, height: 48, shadowColor: '#B38B00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
              <Ionicons name="search" size={20} color="#94A3B8" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium', color: '#1A1400' }}
                placeholder="Search merchant name..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* White swoop Background (Z-Index 1 so cards scroll OVER this part) */}
        <View style={{ height: 28, backgroundColor: '#FFC700', zIndex: 1 }}>
          <View style={{ position: 'absolute', bottom: 0, right: 0, left: 0, top: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28 }} />
        </View>

        <ScrollView
          style={{ marginTop: -28, zIndex: 5 }}
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
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
                <Text style={styles.emptyStateTitle}>No Stamp Cards Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  You haven't collected any stamps from merchants yet. Start exploring shops!
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateBtn} 
                  onPress={() => router.push('/(customer)/explore')}
                >
                  <Text style={styles.emptyStateBtnText}>Explore Partners</Text>
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
            <View style={[styles.detailContent, isDesktop && { maxWidth: 500, width: '90%', borderRadius: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, borderTopWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 25, elevation: 10 }]}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailModalTitle}>Stamp Card Details</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {/* 3D Flippable Loyalty Card & Hint */}
                <View>
                  <FlippableLoyaltyCard 
                    card={selectedCard} 
                    user={user} 
                    autoFlipDelay={500}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 6, opacity: 0.8 }}>
                    <Ionicons name="swap-horizontal" size={14} color="#6B7280" />
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#6B7280' }}>Tap card to flip</Text>
                  </View>
                </View>

                {/* Points & Tier Info Section */}
                <View style={styles.pointsTierCard}>
                  <View style={styles.pointsTierInfo}>
                    <Text style={styles.pointsTierTitle}>Points Balance</Text>
                    <Text style={styles.pointsTierValue}>{selectedCard.points} PTS</Text>
                  </View>
                  <View style={[styles.tierBadge, { backgroundColor: getTierColor(selectedCard.tier) }]}>
                    <Ionicons name="ribbon" size={14} color="#FFFFFF" />
                    <Text style={styles.tierBadgeText}>{(selectedCard.tier || 'bronze').toUpperCase()}</Text>
                  </View>
                </View>

                {/* Pin to Home Button */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pinnedCards.includes(selectedCard.id) ? '#F1F5F9' : '#000000',
                    padding: 16,
                    borderRadius: 16,
                    gap: 8,
                  }}
                  onPress={() => togglePinCard(selectedCard.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={pinnedCards.includes(selectedCard.id) ? "pin" : "pin-outline"} 
                    size={20} 
                    color={pinnedCards.includes(selectedCard.id) ? "#0F172A" : "#FFFFFF"} 
                  />
                  <Text style={{
                    fontFamily: 'PlusJakartaSans_700Bold',
                    fontSize: 14,
                    color: pinnedCards.includes(selectedCard.id) ? "#0F172A" : "#FFFFFF"
                  }}>
                    {pinnedCards.includes(selectedCard.id) ? "Unpin from Home" : "Pin to Home Dashboard"}
                  </Text>
                </TouchableOpacity>

                {/* Stamp Completion Reward panel */}
                <View style={styles.rewardDetailPanel}>
                  <View style={styles.rewardIconBg}>
                    <Ionicons name="gift" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.rewardDetailInfo}>
                    <Text style={styles.rewardDetailTitle}>{selectedCard.rewardName}</Text>
                    <Text style={styles.rewardDetailSub}>
                      Get rewarded instantly once you earn {selectedCard.totalStamps} stamp points.
                    </Text>
                  </View>
                </View>

                {/* Points Catalog Section */}
                <View style={styles.catalogSection}>
                  <Text style={styles.catalogTitle}>Points Catalog</Text>
                  <Text style={styles.catalogSubtitle}>Spend points earned at this merchant to redeem rewards:</Text>
                  
                  {loadingRewards ? (
                    <ActivityIndicator color="#000000" style={{ marginVertical: 20 }} />
                  ) : merchantRewards.length === 0 ? (
                    <View style={styles.emptyCatalogCard}>
                      <Text style={styles.emptyCatalogText}>No catalog rewards available at this shop.</Text>
                    </View>
                  ) : (
                    <View style={styles.catalogList}>
                      {merchantRewards.map((reward: any) => (
                        <View key={reward.id} style={styles.catalogItem}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={styles.catalogItemName}>{reward.name}</Text>
                            <Text style={styles.catalogItemCost}>{reward.points_cost} Points</Text>
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
                            <Text style={styles.redeemBtnText}>Redeem</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalScanBtn}
                onPress={() => {
                  setDetailModalVisible(false);
                  setQrModalVisible(true);
                }}
              >
                <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalScanBtnText}>Show QR to Scan</Text>
              </TouchableOpacity>
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
                <Text style={styles.confirmTitle}>Redemption Failed</Text>
                <Text style={styles.confirmText}>{redemptionError}</Text>
                
                <TouchableOpacity
                  style={styles.errorCloseBtn}
                  onPress={() => {
                    setRedemptionError(null);
                    setRedemptionConfirmVisible(false);
                  }}
                >
                  <Text style={styles.errorCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : !redemptionSuccessVisible ? (
              // Confirmation State
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={styles.confirmIconBg}>
                  <Ionicons name="gift" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.confirmTitle}>Confirm Redemption</Text>
                <Text style={styles.confirmText}>
                  Are you sure you want to redeem "{selectedRewardToRedeem?.name}" for {selectedRewardToRedeem?.points_cost} points?
                </Text>
                
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.cancelActionBtn}
                    disabled={redeemingInProgress}
                    onPress={() => setRedemptionConfirmVisible(false)}
                  >
                    <Text style={styles.cancelActionText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmActionBtn}
                    disabled={redeemingInProgress}
                    onPress={executeRedemption}
                  >
                    {redeemingInProgress ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmActionText}>Redeem</Text>
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
                <Text style={styles.confirmTitle}>Redemption Successful!</Text>
                <Text style={styles.confirmText}>
                  Your voucher has been generated successfully. You can find it under the Vouchers tab!
                </Text>
                
                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.successDoneBtn}
                    onPress={handleRedemptionSuccessDone}
                  >
                    <Text style={styles.successDoneText}>Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.successViewVouchersBtn}
                    onPress={handleRedemptionSuccessViewVouchers}
                  >
                    <Text style={styles.successViewVouchersText}>View Vouchers</Text>
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
              <Text style={styles.qrTitle}>My Member QR</Text>
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

            <Text style={styles.phoneLabel}>PHONE NUMBER</Text>
            <Text style={styles.phoneValue}>{user?.phone || '+60 11-2345678'}</Text>
            <Text style={styles.scanNotice}>
              Present this code to the store staff to collect stamps or redeem reward vouchers.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Details Modal styles
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2,
    borderTopColor: '#000000',
    padding: 24,
    gap: 20,
    maxHeight: '95%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  closeBtn: {
    padding: 4,
  },
  largeCardView: {
    borderRadius: 24,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  largeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  largeCardMerchant: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  largeCardNumber: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  goldBadge: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  goldBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nfcIcon: {
    transform: [{ rotate: '90deg' }],
  },
  largeStampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    width: '100%',
  },
  largeStampEarned: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  largeStampGift: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  largeStampEmpty: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeStampNumber: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  largeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holderCol: {
    gap: 2,
  },
  holderLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  brandBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  brandBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  largeProgressPercentage: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  rewardDetailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  rewardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardDetailInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 4,
  },
  rewardDetailTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  rewardDetailSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  modalScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    height: 52,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modalScanBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
