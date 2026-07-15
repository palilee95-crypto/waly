import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

const { width } = Dimensions.get('window');

type MerchantItem = {
  id: string;
  name: string;
  category: string;
  logo: string;
  coverImage: string;
  distance: string;
  stampsRule: string;
  collectedStamps: number;
  totalStamps: number;
  featuredTag?: string;
};

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Merchant Info Modal
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantItem | null>(null);
  const [merchantModalVisible, setMerchantModalVisible] = useState(false);
  const [merchantLocation, setMerchantLocation] = useState<any>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const handleOpenMerchantDetails = async (item: MerchantItem) => {
    setSelectedMerchant(item);
    setMerchantModalVisible(true);
    setFetchingLocation(true);
    setMerchantLocation(null);
    try {
      const loc = await pb.collection('store_locations').getFirstListItem(`merchant = "${item.id}"`, { requestKey: null });
      setMerchantLocation(loc);
    } catch (e: any) {
      if (!e.isAbort) {
        console.warn("Failed to fetch store location details:", e);
      }
    } finally {
      setFetchingLocation(false);
    }
  };

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const merchantList = await pb.collection('merchants').getFullList({
        filter: 'status = "active" || status = "pending"',
      });
      const programList = await pb.collection('loyalty_programs').getFullList({
        filter: 'is_active = true',
      });
      const cardList = user 
        ? await pb.collection('loyalty_cards').getFullList({ filter: `customer = '${user.id}'` })
        : [];

      const mapped = merchantList
        .map((m: any) => {
          const program = programList.find((p: any) => p.merchant === m.id);
          if (!program) return null;

          const card = cardList.find((c: any) => c.merchant === m.id);

          let resolvedCover = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600';
          if (m.banner) {
            resolvedCover = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}`;
          } else if (program.card_background) {
            resolvedCover = `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`;
          }

          return {
            id: m.id,
            name: m.name,
            category: m.category || 'Other',
            logo: m.logo 
              ? `${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}`
              : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=120',
            coverImage: resolvedCover,
            distance: '0.5 km away',
            stampsRule: `Complete ${program.stamp_goal} stamps for ${program.reward_description}`,
            collectedStamps: card ? card.stamps_collected : 0,
            totalStamps: program.stamp_goal,
            featuredTag: m.is_verified ? 'Verified' : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      setMerchants(mapped);
    } catch (err) {
      console.warn('Failed to fetch explore data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExploreData();
  }, [user]);

  const categories = ['All', 'Cafes', 'Food', 'Fashion', 'Beauty', 'Bakery'];

  const filteredMerchants = merchants.filter((m) => {
    // Filter by search name
    if (searchQuery.trim().length > 0 && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filter by Category
    if (activeCategory !== 'All') {
      if (activeCategory === 'Cafes' && m.category !== 'Cafe & Eatery') return false;
      if (activeCategory === 'Food' && !['Cafe & Eatery', 'Bakery & Sweets'].includes(m.category)) return false;
      if (activeCategory === 'Fashion' && m.category !== 'Fashion & Apparel') return false;
      if (activeCategory === 'Bakery' && m.category !== 'Bakery & Sweets') return false;
    }
    return true;
  });

  const renderOperatingHours = () => {
    if (fetchingLocation) {
      return <ActivityIndicator size="small" color="#64748B" style={{ marginVertical: 10 }} />;
    }
    const hrs = merchantLocation?.hours;
    if (!hrs || typeof hrs !== 'object' || Object.keys(hrs).length === 0) {
      return (
        <View style={styles.hoursList}>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Monday - Friday</Text>
            <Text style={styles.hoursTime}>08:00 - 22:00</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Saturday</Text>
            <Text style={styles.hoursTime}>09:00 - 23:00</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Sunday</Text>
            <Text style={styles.hoursTime}>09:00 - 21:00</Text>
          </View>
        </View>
      );
    }

    const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return (
      <View style={styles.hoursList}>
        {daysOrder.map((day) => {
          let time = hrs[day];
          if (time === undefined && day !== "Saturday" && day !== "Sunday") {
            time = hrs["Monday - Friday"]; // schema fallback
          }
          if (time === undefined) return null;
          const isClosed = String(time).toLowerCase() === 'closed';
          return (
            <View key={day} style={styles.hoursRow}>
              <Text style={styles.hoursDay}>{day}</Text>
              <Text style={[styles.hoursTime, isClosed && { color: '#EF4444' }]}>{String(time)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const avatarUrl = user?.avatar
    ? `${pb.baseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Top Header */}
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
        {/* Intro Section */}
        <View style={styles.introSection}>
          <Text style={styles.title}>Discover Merchants</Text>
          <Text style={styles.subtitle}>
            Explore top local merchants near you and collect loyalty rewards stamps.
          </Text>
        </View>

        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search coffee shop, boutique, salon..."
              placeholderTextColor="#94A3B8"
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="map-outline" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Categories Pills scroll */}
        <View style={styles.categoriesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  activeCategory === cat && styles.categoryPillActive,
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryText,
                    activeCategory === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Merchant Cards list */}
        <View style={styles.merchantsList}>
          {loading ? (
            <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
          ) : filteredMerchants.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="search-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyStateTitle}>No Merchants Found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Try adjusting your search query or choosing another category.
              </Text>
            </View>
          ) : (
            filteredMerchants.map((item) => (
              <TouchableOpacity key={item.id} style={styles.merchantCard} onPress={() => handleOpenMerchantDetails(item)} activeOpacity={0.95}>
                {/* Cover photo header inside card */}
                <View style={styles.coverWrapper}>
                  <Image source={{ uri: item.coverImage }} style={styles.coverImage} />
                  <View style={styles.coverDarkGradient} />
                  
                  {/* Distance Badge */}
                  <View style={styles.distanceBadge}>
                    <Ionicons name="location-sharp" size={10} color="#FFFFFF" />
                    <Text style={styles.distanceText}>{item.distance}</Text>
                  </View>

                  {/* Popularity/Tag Badge */}
                  {item.featuredTag && (
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredText}>{item.featuredTag}</Text>
                    </View>
                  )}
                </View>

                {/* Merchant Details Block */}
                <View style={styles.cardDetails}>
                  <View style={styles.nameRow}>
                    <Image source={{ uri: item.logo }} style={styles.merchantLogo} />
                    <View style={styles.nameWrap}>
                      <Text style={styles.merchantName}>{item.name}</Text>
                      <Text style={styles.merchantCategory}>{item.category}</Text>
                    </View>
                  </View>

                  <View style={styles.ruleDivider} />

                  {/* Stamp Reward Campaign Info */}
                  <View style={styles.campaignInfo}>
                    <View style={styles.campaignHeader}>
                      <Ionicons name="gift-outline" size={16} color="#000000" />
                      <Text style={styles.campaignRuleText}>{item.stampsRule}</Text>
                    </View>

                    {/* Stamp count mini-progress bar */}
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>My Progress</Text>
                      <Text style={styles.progressCount}>
                        {item.collectedStamps}/{item.totalStamps} Stamps
                      </Text>
                    </View>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${(item.collectedStamps / item.totalStamps) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Merchant Details Modal */}
      <Modal
        visible={merchantModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMerchantModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && { maxWidth: 500, width: '90%', borderRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Merchant Info</Text>
              <TouchableOpacity onPress={() => setMerchantModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Cover Banner */}
              {selectedMerchant && (
                <View style={styles.modalCoverContainer}>
                  <Image source={{ uri: selectedMerchant.coverImage }} style={styles.modalCoverImage} />
                  <View style={styles.modalLogoContainer}>
                    <Image source={{ uri: selectedMerchant.logo }} style={styles.modalLogo} />
                  </View>
                </View>
              )}

              {selectedMerchant && (
                <View style={styles.merchantMetaSection}>
                  <Text style={styles.modalMerchantName}>{selectedMerchant.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{selectedMerchant.category}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalDivider} />

              {/* Operating Hours Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="time-outline" size={20} color="#000000" />
                  <Text style={styles.detailCardTitle}>Operating Hours</Text>
                </View>
                {renderOperatingHours()}
              </View>

              {/* Location Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="location-outline" size={20} color="#000000" />
                  <Text style={styles.detailCardTitle}>Location & Address</Text>
                </View>
                <Text style={styles.detailCardText}>
                  {fetchingLocation 
                    ? 'Loading address...' 
                    : (merchantLocation?.address 
                        ? `${merchantLocation.address}, ${merchantLocation.city || ''}, ${merchantLocation.country || ''}`.trim()
                        : 'No specific address details listed.')
                  }
                </Text>
                {!fetchingLocation && (merchantLocation?.address || selectedMerchant?.name) && (
                  <TouchableOpacity 
                    style={styles.modalActionBtn} 
                    onPress={() => {
                      const lat = merchantLocation?.lat;
                      const lng = merchantLocation?.lng;
                      const address = merchantLocation?.address || selectedMerchant?.name || '';
                      const url = Platform.select({
                        ios: lat && lng ? `maps:0,0?q=${lat},${lng}` : `maps:0,0?q=${encodeURIComponent(address)}`,
                        android: lat && lng ? `geo:${lat},${lng}?q=${lat},${lng}` : `geo:0,0?q=${encodeURIComponent(address)}`,
                        web: lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                      });
                      if (url) {
                        Linking.openURL(url).catch(() => {
                          Alert.alert('Error', 'Could not open map directions.');
                        });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalActionBtnText}>Get Directions</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Contact Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Ionicons name="call-outline" size={20} color="#000000" />
                  <Text style={styles.detailCardTitle}>Contact Info</Text>
                </View>
                <Text style={styles.detailCardText}>
                  {fetchingLocation 
                    ? 'Loading contact...' 
                    : (merchantLocation?.phone || 'No phone number listed.')
                  }
                </Text>
                {!fetchingLocation && merchantLocation?.phone && (
                  <TouchableOpacity 
                    style={styles.modalSecondaryBtn} 
                    onPress={() => {
                      Linking.openURL(`tel:${merchantLocation.phone}`).catch(() => {
                        Alert.alert('Error', 'Could not initiate phone call.');
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call-outline" size={16} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionBtnText, { color: '#000000' }]}>Call Store</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    paddingTop: 24,
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
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    height: 48,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#000000',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesSection: {
    marginHorizontal: -20,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#000000', // Active black category matching home page design
    borderColor: '#000000',
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  merchantsList: {
    gap: 20,
  },
  merchantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  coverWrapper: {
    height: 140,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverDarkGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  distanceText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    backgroundColor: '#000000', // Black tagline badge
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  cardDetails: {
    padding: 16,
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  merchantLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  nameWrap: {
    gap: 2,
  },
  merchantName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  merchantCategory: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  ruleDivider: {
    height: 1.2,
    backgroundColor: '#E2E8F0',
  },
  campaignInfo: {
    gap: 8,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campaignRuleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  progressCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Black progress text
  },
  barContainer: {
    height: 6,
    backgroundColor: '#F1F5F9', // Gray progress bg
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#000000', // Black progress fill
    borderRadius: 3,
  },
  emptyStateContainer: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxHeight: '85%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalCoverContainer: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'visible',
    position: 'relative',
    marginTop: 16,
    backgroundColor: '#F1F5F9',
  },
  modalCoverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  modalLogoContainer: {
    position: 'absolute',
    bottom: -30,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    resizeMode: 'cover',
  },
  merchantMetaSection: {
    alignItems: 'center',
    marginTop: 38,
    gap: 6,
  },
  modalMerchantName: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailCardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  hoursList: {
    gap: 8,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursDay: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  hoursTime: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  detailCardText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 10,
    height: 38,
    marginTop: 4,
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    height: 38,
    marginTop: 4,
  },
  modalActionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
