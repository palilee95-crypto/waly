import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

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

const AnimatedStampSlot = ({ index, children, style }: { index: number; children: React.ReactNode; style: any }) => {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active selected card for details modal popup
  const [selectedCard, setSelectedCard] = useState<LoyaltyCardItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  
  // Stacked card deck state controls
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCyclingBack, setIsCyclingBack] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<number>(1);
  const cycleAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoadingNotifications(true);
      const records = await pb.collection('notifications').getFullList({
        filter: `recipient = '${user.id}'`,
        sort: '-created'
      });
      setNotificationsList(records);
    } catch (err) {
      console.warn('Failed to fetch notifications list:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleCloseNotifications = async () => {
    setShowNotificationsModal(false);
    const unread = notificationsList.filter(n => !n.is_read);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(n => pb.collection('notifications').update(n.id, { is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark notifications as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'points':
        return <Ionicons name="star" size={18} color="#D97706" />;
      case 'reward':
        return <Ionicons name="gift" size={18} color="#DC2626" />;
      case 'campaign':
        return <Ionicons name="megaphone" size={18} color="#2563EB" />;
      case 'tier':
        return <Ionicons name="trophy" size={18} color="#7C3AED" />;
      default:
        return <Ionicons name="notifications" size={18} color="#4B5563" />;
    }
  };

  useEffect(() => {
    if (showNotificationsModal) {
      fetchNotifications();
    }
  }, [showNotificationsModal]);

  const fetchLoyaltyCards = async () => {
    if (!user) return;
    try {
      const records = await pb.collection('loyalty_cards').getFullList({
        filter: `customer = '${user.id}' && status = 'active'`,
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
          points: rec.stamps_collected || 0,
          gradientColors: program?.card_color ? [program.card_color, '#000000'] : ['#EC4899', '#8B5CF6'],
          cardIcon: program?.card_icon || 'coffee',
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
    if (!user) return;

    // Fetch initial count of unread notifications
    pb.collection('notifications')
      .getList(1, 1, {
        filter: `recipient = '${user.id}' && is_read = false`,
      })
      .then((res) => {
        setUnreadCount(res.totalItems);
      })
      .catch(() => {});

    // Listen to real-time notification additions
    pb.collection('notifications').subscribe('*', (e) => {
      if (e.action === 'create') {
        setUnreadCount((prev) => prev + 1);
        fetchNotifications();
      }
    }, {
      filter: `recipient = '${user.id}'`,
    });

    fetchLoyaltyCards();

    // Listen to real-time updates on loyalty_cards
    pb.collection('loyalty_cards').subscribe('*', (e) => {
      fetchLoyaltyCards();
    }, {
      filter: `customer = '${user.id}'`
    });

    return () => {
      pb.collection('notifications').unsubscribe('*');
      pb.collection('loyalty_cards').unsubscribe('*');
    };
  }, [user]);

  const openCardDetails = (card: LoyaltyCardItem) => {
    setSelectedCard(card);
    setDetailModalVisible(true);
    // Mark notifications as read or clear badge if needed, but a simple indicator is fine for now
  };

  const getStackedCards = () => {
    if (loyaltyCards.length === 0) return [];
    if (loyaltyCards.length === 1) return [loyaltyCards[0]];
    const list = [...loyaltyCards].slice(0, 3);
    const activeCard = list.splice(activeCardIndex % list.length, 1)[0];
    list.push(activeCard);
    return list;
  };

  const cycleCard = () => {
    if (isAnimating || loyaltyCards.length <= 1) return;
    setTransitionTarget(1);
    setIsAnimating(true);
    setIsCyclingBack(false);

    Animated.timing(cycleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setActiveCardIndex((prev) => (prev + 1) % loyaltyCards.length);
        cycleAnim.setValue(0);
        setIsCyclingBack(false);
        setIsAnimating(false);
      }
    });

    // Midway through transition (around 180ms), switch visual z-index mapping
    setTimeout(() => {
      setIsCyclingBack(true);
    }, 180);
  };

  const bringCardToFront = (item: LoyaltyCardItem) => {
    if (isAnimating || loyaltyCards.length <= 1) return;
    const clickedIndex = loyaltyCards.findIndex((c) => c.id === item.id);
    const list = getStackedCards();
    const itemIdxInStack = list.findIndex((c) => c.id === item.id); // 0 or 1

    setTransitionTarget(itemIdxInStack);
    setIsAnimating(true);
    setIsCyclingBack(false);

    Animated.timing(cycleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setActiveCardIndex(clickedIndex);
        cycleAnim.setValue(0);
        setIsCyclingBack(false);
        setIsAnimating(false);
      }
    });

    setTimeout(() => {
      setIsCyclingBack(true);
    }, 180);
  };

  const renderDetailStampSlots = (card: LoyaltyCardItem) => {
    const slots = [];
    for (let i = 1; i <= card.totalStamps; i++) {
      if (i <= card.collectedStamps) {
        slots.push(
          <AnimatedStampSlot key={i} index={i} style={styles.largeStampEarned}>
            {renderStampIcon(card.cardIcon, 16, '#FFFFFF')}
          </AnimatedStampSlot>
        );
      } else {
        slots.push(
          <AnimatedStampSlot key={i} index={i} style={styles.largeStampEmpty}>
            {renderStampIcon(card.cardIcon, 14, 'rgba(255, 255, 255, 0.25)')}
          </AnimatedStampSlot>
        );
      }
    }
    return slots;
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
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
          />
          
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Waly</Text>
            <Text style={styles.logoSubtext}>Loyalty Reward</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.roundHeaderBtn} onPress={() => router.push('/(customer)/explore')}>
              <Ionicons name="compass-outline" size={18} color="#004ac6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundHeaderBtn} onPress={() => setShowNotificationsModal(true)}>
              <Ionicons name="notifications-outline" size={18} color="#565e74" />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Points Summary Card */}
          <View style={styles.welcomeCard}>
            <View style={styles.cardHeader}>
              <View style={styles.welcomeTextWrap}>
                <Text style={styles.welcomeSubtitle}>Welcome back,</Text>
                <Text style={styles.welcomeName}>{user?.name || 'Ahmad Fazli'}</Text>
              </View>
              <View style={styles.pointsWrap}>
                <Text style={styles.pointsLabel}>TOTAL STAMPS</Text>
                <View style={styles.pointsRow}>
                  <View style={styles.coinGraphic}>
                    <Ionicons name="star" size={12} color="#D97706" />
                  </View>
                  <Text style={styles.pointsValue}>
                    {loyaltyCards.reduce((acc, curr) => acc + curr.collectedStamps, 0)}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Structured Tagline Divider */}
            <View style={styles.cardDivider} />

            <View style={styles.taglineRow}>
              <Text style={styles.taglineBold}>Every visit, rewarded.</Text>
              <Text style={styles.taglineSub}>
                You have {loyaltyCards.length} active stamp card{loyaltyCards.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Quick Action Capsules */}
            <View style={styles.capsulesRow}>
              <TouchableOpacity
                style={styles.capsuleActive}
                onPress={() => setQrModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code" size={14} color="#FFFFFF" />
                <Text style={styles.capsuleActiveText}>Show My QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.capsuleInactive}
                onPress={() => router.push('/(customer)/explore')}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={14} color="#004ac6" />
                <Text style={styles.capsuleInactiveText}>Discover Shops</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Waly Campaign Promo Banner */}
          <View style={styles.promoCard}>
            <View style={styles.promoHeaderRow}>
              <Text style={styles.promoTitle}>2x Stamps Weekend</Text>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>LIMITED</Text>
              </View>
            </View>
            <Text style={styles.promoDesc}>Visit any Waly partner shop this weekend and earn double stamps!</Text>
            <TouchableOpacity
              style={styles.viewPromoBtn}
              onPress={() => router.push('/(customer)/explore')}
              activeOpacity={0.9}
            >
              <Text style={styles.viewPromoText}>Explore Now</Text>
              <Ionicons name="arrow-forward" size={12} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* My Stamp Cards Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Stamp Cards</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/explore')}>
              <Text style={styles.viewAllText}>Add Card</Text>
            </TouchableOpacity>
          </View>

          {/* Overlapping Wallet Card Stack Layout */}
          <View style={styles.walletStackContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
            ) : loyaltyCards.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="card-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>No Active Cards</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Start visiting our partner merchants to collect stamps and earn rewards!
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateBtn} 
                  onPress={() => router.push('/(customer)/explore')}
                >
                  <Text style={styles.emptyStateBtnText}>Discover Shops</Text>
                </TouchableOpacity>
              </View>
            ) : (
              getStackedCards().map((item, idx) => {
                const stackedLength = getStackedCards().length;
                const isFront = idx === stackedLength - 1;

                // Setup layout interpolation values for smooth transition based on transitionTarget
                let translateY: Animated.AnimatedInterpolation<number> | number = 0;
                let scale: Animated.AnimatedInterpolation<number> | number = 1;

                if (stackedLength >= 3) {
                  if (idx === 2) {
                    // Front card cycling to the back or middle
                    const targetY = transitionTarget === 0 ? -110 : -55;
                    const targetScale = transitionTarget === 0 ? 0.9 : 0.95;

                    translateY = cycleAnim.interpolate({
                      inputRange: [0, 0.4, 1.0],
                      outputRange: [0, -180, targetY],
                    });
                    const stackScale = cycleAnim.interpolate({
                      inputRange: [0, 0.4, 1.0],
                      outputRange: [1.0, 1.05, targetScale],
                    });
                    scale = Animated.multiply(stackScale, pressScale);
                  } else if (idx === 1) {
                    // Middle card transitioning to the front or back/staying middle
                    const targetY = transitionTarget === 0 ? 0 : 55;
                    const targetScale = transitionTarget === 0 ? 0.95 : 1.0;

                    translateY = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0, targetY],
                    });
                    scale = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0.95, targetScale],
                    });
                  } else {
                    // Back card transitioning to the front or middle
                    const targetY = transitionTarget === 0 ? 110 : 55;
                    const targetScale = transitionTarget === 0 ? 1.0 : 0.95;

                    if (transitionTarget === 0) {
                      translateY = cycleAnim.interpolate({
                        inputRange: [0, 0.4, 1.0],
                        outputRange: [0, -60, targetY],
                      });
                    } else {
                      translateY = cycleAnim.interpolate({
                        inputRange: [0, 1.0],
                        outputRange: [0, targetY],
                      });
                    }

                    scale = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0.9, targetScale],
                    });
                  }
                } else if (stackedLength === 2) {
                  if (idx === 1) {
                    // Front card
                    translateY = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0, -55],
                    });
                    scale = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [1.0, 0.95],
                    });
                  } else {
                    // Back card
                    translateY = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0, 55],
                    });
                    scale = cycleAnim.interpolate({
                      inputRange: [0, 1.0],
                      outputRange: [0.95, 1.0],
                    });
                  }
                } else {
                  // 1 card
                  translateY = 0;
                  scale = pressScale;
                }

                // Determine zIndex dynamically during mid-transition state switch
                let currentZIndex = idx;
                if (isCyclingBack && stackedLength >= 3) {
                  if (transitionTarget === 0) {
                    if (idx === 2) currentZIndex = 0;
                    else if (idx === 1) currentZIndex = 1;
                    else if (idx === 0) currentZIndex = 2;
                  } else {
                    if (idx === 2) currentZIndex = 1;
                    else if (idx === 1) currentZIndex = 2;
                    else if (idx === 0) currentZIndex = 0;
                  }
                } else if (isCyclingBack && stackedLength === 2) {
                  currentZIndex = idx === 1 ? 0 : 1;
                }
                
                return (
                  <Animated.View
                    key={item.id}
                    style={[
                      styles.stackedCard,
                      {
                        backgroundColor: item.gradientColors[0],
                        zIndex: currentZIndex,
                        marginTop: idx === 0 ? 0 : -145,
                        transform: [
                          { translateY: translateY as any },
                          { scale: scale as any },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={StyleSheet.absoluteFill}
                      onPress={isFront ? () => openCardDetails(item) : () => bringCardToFront(item)}
                      onPressIn={isFront ? () => {
                        Animated.spring(pressScale, {
                          toValue: 0.93,
                          useNativeDriver: true,
                        }).start();
                      } : undefined}
                      onPressOut={isFront ? () => {
                        Animated.spring(pressScale, {
                          toValue: 1.0,
                          useNativeDriver: true,
                        }).start();
                      } : undefined}
                      activeOpacity={0.95}
                    >
                      <View style={styles.stackedCardContent}>
                        {/* Header info */}
                        <View style={styles.cardInfoRow}>
                          <View style={styles.shopLogoBg}>
                            <Image source={{ uri: item.logo }} style={styles.shopLogo} />
                          </View>
                          <View style={styles.shopTextColumn}>
                            <Text style={styles.shopNameText}>{item.merchantName}</Text>
                            <Text style={styles.shopCategoryText}>{item.category}</Text>
                          </View>
                          <View style={styles.ptsColumn}>
                            <Text style={styles.ptsValueText}>
                              {item.collectedStamps}/{item.totalStamps}
                            </Text>
                            <Text style={styles.ptsLabelText}>Stamps</Text>
                          </View>
                        </View>

                        {/* Front Card Specific Footer Accents */}
                        {isFront && (
                          <View style={styles.frontCardFooter}>
                            <View style={styles.bottomWaveOverlay} />
                            
                            <TouchableOpacity
                              style={styles.viewAllPill}
                              onPress={() => router.push('/(customer)/my-cards')}
                            >
                              <Text style={styles.viewAllPillText}>View all</Text>
                              <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            {stackedLength > 1 && (
                              <TouchableOpacity
                                style={styles.floatingChevronBtn}
                                onPress={cycleCard}
                              >
                                <Ionicons name="chevron-forward" size={20} color="#565e74" />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* QR Code Pop-up Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan Loyalty Card</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#0b1c30" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrWrapper}>
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user?.phone || 'waly-loyalty-customer'}`,
                }}
                style={styles.qrCodeImage}
              />
            </View>

            <Text style={styles.phoneLabel}>MEMBER ID</Text>
            <Text style={styles.phoneValue}>{user?.phone || '+60 11-2345678'}</Text>
            <Text style={styles.scanNotice}>
              Present this code to the store staff to collect stamps or redeem reward vouchers.
            </Text>
          </View>
        </View>
      </Modal>

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
              <View style={styles.modalHeader}>
                <Text style={styles.detailModalTitle}>Stamp Card Details</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#0b1c30" />
                </TouchableOpacity>
              </View>

              {/* Large credit-card style loyalty details card */}
              <View style={[styles.largeCardView, { backgroundColor: selectedCard.gradientColors[0] }]}>
                <View style={styles.largeCardHeader}>
                  <View>
                    <Text style={styles.largeCardMerchant}>{selectedCard.merchantName}</Text>
                    <Text style={styles.largeCardNumber}>{selectedCard.cardNumber}</Text>
                  </View>
                  <View style={styles.goldBadge}>
                    <Text style={styles.goldBadgeText}>STANDART</Text>
                  </View>
                </View>

                {/* EMV Microchip */}
                <View style={styles.cardChipRow}>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLineHoriz} />
                    <View style={styles.chipLineVert} />
                    <View style={styles.chipCenterPin} />
                  </View>
                  <Ionicons name="wifi" size={16} color="rgba(255, 255, 255, 0.35)" style={styles.nfcIcon} />
                </View>

                {/* Stamps grid details */}
                <View style={styles.largeStampsGrid}>
                  {renderDetailStampSlots(selectedCard)}
                </View>

                <View style={styles.largeCardFooter}>
                  <View style={styles.holderCol}>
                    <Text style={styles.holderLabel}>CARD HOLDER</Text>
                    <Text style={styles.holderValue}>{user?.name || 'Ahmad Fazli'}</Text>
                  </View>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>Waly</Text>
                    <Text style={styles.largeProgressPercentage}>
                      {selectedCard.collectedStamps}/{selectedCard.totalStamps} Stamps
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reward description card */}
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

              {/* Scan Trigger Button */}
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

      {/* Notifications Inbox Modal */}
      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseNotifications}
      >
        <View style={[styles.detailOverlay, isDesktop && { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.detailContent, { height: '80%' }, isDesktop && { maxWidth: 500, width: '90%', borderRadius: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.detailModalTitle}>My Notifications</Text>
              <TouchableOpacity onPress={handleCloseNotifications} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#0b1c30" />
              </TouchableOpacity>
            </View>

            {loadingNotifications ? (
              <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
            ) : notificationsList.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                </View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                  You're all caught up!
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18 }}>
                  Promotional blasts and reward alerts will appear here when active.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12, paddingBottom: 24 }}>
                  {notificationsList.map((notif) => (
                    <View 
                      key={notif.id} 
                      style={[
                        { flexDirection: 'row', padding: 16, borderRadius: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
                        !notif.is_read ? { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' } : { backgroundColor: '#FFFFFF' }
                      ]}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
                        {getNotificationIcon(notif.type)}
                      </View>
                      
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {notif.title}
                        </Text>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', lineHeight: 18 }}>
                          {notif.body}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                          {new Date(notif.created).toLocaleString()}
                        </Text>
                      </View>

                      {!notif.is_read && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', alignSelf: 'center' }} />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean pure white background
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
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 1,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000', // Solid black logo text matching mockup
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
    borderColor: '#E2E8F0', // Gray outline border
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 20,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1.5,
    borderColor: '#000000', // Highly stylized black frame to match mockup
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextWrap: {
    gap: 2,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  welcomeName: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000', // Black text matching card holder info
    letterSpacing: -0.5,
  },
  pointsWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pointsLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  coinGraphic: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointsValue: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000', // Black text stamp count
    letterSpacing: -0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  taglineRow: {
    alignItems: 'flex-start',
    gap: 2,
  },
  taglineBold: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Black text tagline
  },
  taglineSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  capsulesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  capsuleActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000', // Solid black button container matching image
    borderRadius: 16,
    height: 48,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  capsuleActiveText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  capsuleInactive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF', // Outlined white container matching image
    borderRadius: 16,
    height: 48,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  capsuleInactiveText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Solid black text
  },
  promoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  promoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  promoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  promoDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 18,
  },
  viewPromoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  viewPromoText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0b1c30',
    letterSpacing: -0.5,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#737686',
  },
  walletStackContainer: {
    paddingBottom: 20,
    marginTop: 10,
  },
  stackedCard: {
    borderRadius: 24,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  stackedCardContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
    position: 'relative',
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
  frontCardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomWaveOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  viewAllPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  floatingChevronBtn: {
    position: 'absolute',
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
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
  cardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EAB308',
    borderWidth: 1.2,
    borderColor: '#CA8A04',
    position: 'relative',
    overflow: 'hidden',
  },
  chipLineHoriz: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 13,
    height: 1,
    backgroundColor: '#854D0E',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    width: 1,
    backgroundColor: '#854D0E',
  },
  chipCenterPin: {
    position: 'absolute',
    width: 10,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#FACC15',
    borderColor: '#854D0E',
    borderWidth: 1,
    left: 13,
    top: 9,
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
  largeStampNumber: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  largeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 16,
  },
  largeProgressPercentage: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  holderCol: {
    gap: 4,
  },
  holderLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  brandBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  brandBadgeText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.65)',
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
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
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
    color: '#0b1c30',
  },
  closeBtn: {
    padding: 4,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  qrCodeImage: {
    width: 180,
    height: 180,
  },
  phoneLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#565e74',
    letterSpacing: 1,
  },
  phoneValue: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#004ac6',
    marginTop: 4,
    marginBottom: 16,
  },
  scanNotice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#737686',
    textAlign: 'center',
    lineHeight: 18,
  },
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
    borderTopColor: '#000000', // Solid black border accent matching image
    padding: 24,
    gap: 20,
    maxHeight: '95%',
  },
  detailModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  rewardDetailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC', // Light slate background
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  rewardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#000000', // Solid black icon circle
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
    backgroundColor: '#000000', // Solid black button
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
});
