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
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
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
  stampColor?: string;
  fontColor?: string;
  cardBackground?: string;
};

export default function MyCardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCard, setSelectedCard] = useState<LoyaltyCardItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCardItem[]>([]);
  const [loading, setLoading] = useState(true);

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
          points: rec.stamps_collected || 0,
          gradientColors: program?.card_color ? [program.card_color, '#000000'] : ['#EC4899', '#8B5CF6'],
          cardIcon: program?.card_icon || 'coffee',
          stampColor: program?.stamp_color || '#3B82F6',
          fontColor: program?.font_color || '#FFFFFF',
          cardBackground: program?.card_background
            ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`
            : undefined,
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

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Top Header Row */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <TouchableOpacity style={styles.roundHeaderBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#000000" />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Waly</Text>
            <Text style={styles.logoSubtext}>Loyalty Reward</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.roundHeaderBtn}>
              <Ionicons name="notifications-outline" size={18} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Page Titles */}
          <View style={styles.introSection}>
            <Text style={styles.title}>All Stamp Cards</Text>
            <Text style={styles.subtitle}>
              Here is the complete wallet list of all merchant partners you have collected stamps from.
            </Text>
          </View>

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
              loyaltyCards.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.loyaltyCard, { backgroundColor: item.gradientColors[0], overflow: 'hidden' }]}
                  onPress={() => openCardDetails(item)}
                  activeOpacity={0.9}
                >
                  {item.cardBackground ? (
                    <Image source={{ uri: item.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : null}

                  {/* Premium credit card curved wave overlays */}
                  <View style={styles.cardBgWave} />
                  <View style={styles.cardBgWave2} />

                  <View style={styles.cardHeader}>
                    <View style={styles.shopLogoBg}>
                      <Image source={{ uri: item.logo }} style={styles.shopLogo} />
                    </View>
                    <View style={styles.shopTextColumn}>
                      <Text style={[styles.shopNameText, item.fontColor && { color: item.fontColor }]} numberOfLines={1}>
                        {item.merchantName}
                      </Text>
                      <Text style={[styles.shopCategoryText, item.fontColor && { color: item.fontColor, opacity: 0.65 }]} numberOfLines={1}>
                        {item.category.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.ptsColumn}>
                      <Text style={[styles.ptsValueText, item.fontColor && { color: item.fontColor }]}>
                        {item.collectedStamps}/{item.totalStamps}
                      </Text>
                      <Text style={[styles.ptsLabelText, item.fontColor && { color: item.fontColor, opacity: 0.8 }]}>STAMPS</Text>
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
                      size={16} 
                      color={item.fontColor ? item.fontColor : "rgba(255, 255, 255, 0.35)"} 
                      style={{ opacity: 0.35 }} 
                    />
                  </View>

                  {/* Card Number block */}
                  <View style={styles.cardNumberContainer}>
                    <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
                      CARD NUMBER
                    </Text>
                    <Text style={[styles.cardNumberValueText, item.fontColor && { color: item.fontColor }]} numberOfLines={1}>
                      {item.cardNumber}
                    </Text>
                  </View>

                  {/* Footer row: Holder Name, Expiration, CVV, and branded circles */}
                  <View style={styles.cardBottomRow}>
                    <View style={styles.holderBlock}>
                      <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
                        CARD HOLDER
                      </Text>
                      <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]} numberOfLines={1}>
                        {(user?.name || 'Ahmad Fazli').toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.validBlock}>
                      <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
                        VALID
                      </Text>
                      <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]}>
                        12/30
                      </Text>
                    </View>

                    <View style={styles.cvvBlock}>
                      <Text style={[styles.cardLabelText, item.fontColor && { color: item.fontColor, opacity: 0.5 }]}>
                        CVV
                      </Text>
                      <Text style={[styles.holderValueText, item.fontColor && { color: item.fontColor }]}>
                        888
                      </Text>
                    </View>

                    {/* Mastercard-style overlapping circles */}
                    <View style={styles.mastercardBadge}>
                      <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]} />
                      <View style={[styles.badgeCircle, { backgroundColor: '#F59E0B', marginLeft: -9, opacity: 0.9 }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
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

              {/* Large credit-card style loyalty details card */}
              <View style={[styles.largeCardView, { backgroundColor: selectedCard.gradientColors[0], overflow: 'hidden' }]}>
                {selectedCard.cardBackground ? (
                  <Image source={{ uri: selectedCard.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}

                {/* Premium waves in modal card view */}
                <View style={[styles.cardBgWave, { width: 350, height: 400, borderRadius: 175, right: -100, top: -80 }]} />
                <View style={[styles.cardBgWave2, { width: 250, height: 290, borderRadius: 125, right: -50, top: 0 }]} />

                <View style={styles.largeCardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.largeCardMerchant, selectedCard.fontColor && { color: selectedCard.fontColor }]} numberOfLines={1}>
                      {selectedCard.merchantName}
                    </Text>
                    <Text style={[styles.shopCategoryText, selectedCard.fontColor && { color: selectedCard.fontColor, opacity: 0.65 }]}>
                      {selectedCard.category.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.goldBadge}>
                    <Text style={styles.goldBadgeText}>LOYALTY CARD</Text>
                  </View>
                </View>

                {/* EMV Microchip */}
                <View style={styles.cardMidRow}>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLineHoriz} />
                    <View style={styles.chipLineVert} />
                    <View style={styles.chipCenterPin} />
                  </View>
                  <Ionicons 
                    name="wifi" 
                    size={18} 
                    color={selectedCard.fontColor ? selectedCard.fontColor : "rgba(255, 255, 255, 0.35)"} 
                    style={{ opacity: 0.35 }} 
                  />
                </View>

                {/* Stamps grid details */}
                <View style={styles.largeStampsGrid}>
                  {renderDetailStampSlots(selectedCard)}
                </View>

                <View style={styles.largeCardFooter}>
                  <View style={styles.holderCol}>
                    <Text style={[styles.holderLabel, selectedCard.fontColor && { color: selectedCard.fontColor, opacity: 0.5 }]}>CARD HOLDER</Text>
                    <Text style={[styles.holderValue, selectedCard.fontColor && { color: selectedCard.fontColor }]} numberOfLines={1}>
                      {(user?.name || 'Ahmad Fazli').toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ width: 45 }}>
                    <Text style={[styles.holderLabel, selectedCard.fontColor && { color: selectedCard.fontColor, opacity: 0.5 }]}>VALID</Text>
                    <Text style={[styles.holderValue, selectedCard.fontColor && { color: selectedCard.fontColor }]}>12/30</Text>
                  </View>

                  <View style={{ width: 35 }}>
                    <Text style={[styles.holderLabel, selectedCard.fontColor && { color: selectedCard.fontColor, opacity: 0.5 }]}>CVV</Text>
                    <Text style={[styles.holderValue, selectedCard.fontColor && { color: selectedCard.fontColor }]}>888</Text>
                  </View>

                  <View style={styles.brandBadge}>
                    <View style={styles.mastercardBadge}>
                      <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]} />
                      <View style={[styles.badgeCircle, { backgroundColor: '#F59E0B', marginLeft: -9, opacity: 0.9 }]} />
                    </View>
                    <Text style={[styles.largeProgressPercentage, selectedCard.fontColor && { color: selectedCard.fontColor, opacity: 0.8 }]}>
                      {selectedCard.collectedStamps}/{selectedCard.totalStamps} STAMPS
                    </Text>
                  </View>
                </View>
              </View>

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
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopLogoBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shopLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  shopTextColumn: {
    flex: 1,
    marginLeft: 12,
    gap: 1,
  },
  shopNameText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  shopCategoryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  ptsColumn: {
    alignItems: 'flex-end',
  },
  ptsValueText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  ptsLabelText: {
    fontSize: 9,
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
    width: 28,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#F3C06B',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  chipLineHoriz: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 9,
    height: 1,
    backgroundColor: '#D97706',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 13,
    width: 1,
    backgroundColor: '#D97706',
  },
  chipCenterPin: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#F3C06B',
    borderWidth: 1,
    borderColor: '#D97706',
    top: 5,
    left: 9,
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
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
});
