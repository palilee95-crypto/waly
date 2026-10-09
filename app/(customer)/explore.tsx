import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilterModal, { FilterState } from './_components/FilterModal';
import AllCategoriesModal from './_components/AllCategoriesModal';

const { width } = Dimensions.get('window');

export type MerchantExploreItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  rawCategory: string;
  logo: string;
  coverImage: string;
  distance: string;
  distanceKm: number;
  isPro: boolean;
  lat?: number;
  lng?: number;
  city: string;
  address?: string;
  stampsRule?: string;
  collectedStamps?: number;
  totalStamps?: number;
  rating: number;
  reviewCount: number;
  minPrice: number;
  nextAvailable: string;
  hasRewards: boolean;
  hasBooking: boolean;
  galleryThumbnails: string[];
  brandColor?: string;
  bgColor?: string;
  proPerk?: string;
};

// Curated high-resolution photo gallery fallbacks matching each merchant category
const CATEGORY_FALLBACK_PHOTOS: Record<string, string[]> = {
  barber: [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&q=80&w=200',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&q=80&w=200',
  ],
  carwash: [
    'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1552930294-6b595f4c2974?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=200',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=200',
  ],
  default: [
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1582037928769-181f2644ecb7?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=200',
  ],
};

const CATEGORY_FALLBACK_COVERS: Record<string, string> = {
  barber: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600',
  beauty: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600',
  carwash: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=600',
  cafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=600',
  retail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=600',
  health: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=600',
  default: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600',
};

// Haversine formula to compute exact distance in km
function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceLabel(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  return `${km.toFixed(1)} km`;
}

// Available locations list
const LOCATIONS_LIST = [
  { id: 'jitra', label: 'Jitra, Kedah' },
  { id: 'alor_setar', label: 'Alor Setar, Kedah' },
  { id: 'sungai_petani', label: 'Sungai Petani, Kedah' },
  { id: 'penang', label: 'George Town, Penang' },
  { id: 'kl', label: 'Kuala Lumpur' },
  { id: 'all', label: 'All Malaysia' },
];

function determineCategoryLabel(m: any): { display: string; key: string } {
  const cat = (m.category || '').toLowerCase();
  const name = (m.name || '').toLowerCase();

  if (name.includes('barber') || name.includes('cut studio') || name.includes('saloon')) {
    return { display: 'Barber', key: 'barber' };
  }
  if (name.includes('carwash') || name.includes('autospa') || name.includes('garage') || name.includes('detailing')) {
    return { display: 'Car Wash', key: 'carwash' };
  }
  if (
    name.includes('coffee') ||
    name.includes('teh') ||
    name.includes('cafe') ||
    name.includes('koey teow') ||
    name.includes('resto') ||
    name.includes('pisang') ||
    name.includes('keria') ||
    cat === 'food'
  ) {
    return { display: 'Cafe', key: 'cafe' };
  }
  if (cat === 'beauty' || name.includes('spa') || name.includes('facepainting') || name.includes('butik') || name.includes('house')) {
    return { display: 'Beauty', key: 'beauty' };
  }
  if (cat === 'retail') {
    return { display: 'Retail', key: 'retail' };
  }
  if (cat === 'health' || name.includes('physiotherapy')) {
    return { display: 'Health', key: 'health' };
  }
  return { display: 'Services', key: 'default' };
}

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Search and Filter States (Default search is EMPTY so all merchants load by default)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [merchants, setMerchants] = useState<MerchantExploreItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);

  // Sorting state: 'nearest' | 'rating' | 'price'
  const [sortBy, setSortBy] = useState<'nearest' | 'rating' | 'price'>('nearest');
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);

  // Location selector state
  const [selectedLocation, setSelectedLocation] = useState('Jitra, Kedah');
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Real-time GPS Location (Default Jitra coordinates: 6.268, 100.411)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>({ lat: 6.268, lng: 100.411 });
  const [selectedRadius, setSelectedRadius] = useState<number>(0);

  // Modal states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [allCategoriesModalVisible, setAllCategoriesModalVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<Partial<FilterState>>({});

  // Merchant detail modal state
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantExploreItem | null>(null);
  const [merchantModalVisible, setMerchantModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('@favorite_stores');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.slice(0, 5));
        }
      } else {
        setFavorites([]);
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e);
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      let updated: string[];
      if (favorites.includes(id)) {
        updated = favorites.filter((item) => item !== id);
      } else {
        if (favorites.length >= 5) {
          Alert.alert(
            'Limit Reached',
            'You can favorite up to 5 stores maximum. Tap the heart on a favorited store to remove it before adding a new one.'
          );
          return;
        }
        updated = [...favorites, id];
      }
      setFavorites(updated);
      await AsyncStorage.setItem('@favorite_stores', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save favorites:', e);
    }
  };

  const handleApplyExploreFilters = (filters: FilterState) => {
    setAppliedFilters(filters);
    if (filters.category) {
      setActiveCategory(filters.category === 'All' ? 'All' : filters.category);
      setSearchQuery('');
    }
    if (filters.distanceKm) {
      setSelectedRadius(filters.distanceKm);
    }
  };

  const handleCategorySelect = (catLabel: string) => {
    setActiveCategory(catLabel);
    setSearchQuery(''); // Clear search query when selecting a category pill so full category items load!
  };

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const [merchantList, programList, storeLocations, servicesList] = await Promise.all([
        pb.collection('merchants').getFullList({ requestKey: null }).catch(() => []),
        pb.collection('loyalty_programs').getFullList({ filter: 'is_active = true' }).catch(() => []),
        pb.collection('store_locations').getFullList({ requestKey: null }).catch(() => []),
        pb.collection('services').getFullList({ requestKey: null }).catch(() => []),
      ]);

      const cardList = user
        ? await pb.collection('loyalty_cards').getFullList({ filter: `customer = '${user.id}'` }).catch(() => [])
        : [];

      const mapped: MerchantExploreItem[] = merchantList.map((m: any, index: number) => {
        const program = programList.find((p: any) => p.merchant === m.id);
        const card = cardList.find((c: any) => c.merchant === m.id);
        const loc = storeLocations.find((l: any) => l.merchant === m.id);
        const mServices = servicesList.filter((s: any) => s.merchant === m.id);

        const { display: displayCat, key: catKey } = determineCategoryLabel(m);

        let resolvedCover = m.banner ? `${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}` : null;
        if (!resolvedCover && program?.card_background) {
          resolvedCover = `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`;
        }
        if (!resolvedCover) {
          resolvedCover = CATEGORY_FALLBACK_COVERS[catKey] || CATEGORY_FALLBACK_COVERS.default;
        }

        let resolvedLogo = m.logo ? `${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}` : null;
        if (!resolvedLogo) {
          resolvedLogo = resolvedCover;
        }

        let distanceKm = 1.0;
        let distanceStr = '1.0 km';

        const storeLat = loc?.lat ? parseFloat(String(loc.lat)) : null;
        const storeLng = loc?.lng ? parseFloat(String(loc.lng)) : null;

        if (storeLat !== null && storeLng !== null && !isNaN(storeLat) && !isNaN(storeLng) && userCoords) {
          const rawDist = getHaversineDistanceKm(userCoords.lat, userCoords.lng, storeLat, storeLng);
          // If location is within Kedah/Northern area, use exact Haversine, otherwise show realistic local distance
          if (rawDist <= 30) {
            distanceKm = rawDist;
          } else {
            distanceKm = 0.6 + (index % 5) * 0.5;
          }
          distanceStr = formatDistanceLabel(distanceKm);
        } else {
          distanceKm = 0.8 + (index % 6) * 0.6;
          distanceStr = formatDistanceLabel(distanceKm);
        }

        const isProPlan =
          m.is_pro === true ||
          m.plan === 'pro' ||
          m.subscription_plan === 'pro' ||
          m.plan === 'business' ||
          m.subscription_plan === 'business' ||
          m.has_booking_addon === true ||
          m.name?.toLowerCase().includes('jerami') ||
          m.name?.toLowerCase().includes('cut studio') ||
          m.name?.toLowerCase().includes('kingsman') ||
          m.name?.toLowerCase().includes('scoop') ||
          m.name?.toLowerCase().includes('risev');

        // Minimum price calculation
        let minPrice = 20;
        if (mServices.length > 0) {
          const prices = mServices.map((s: any) => Number(s.price)).filter((p: number) => !isNaN(p) && p > 0);
          if (prices.length > 0) minPrice = Math.min(...prices);
        } else {
          if (m.name?.toLowerCase().includes('kingsman')) minPrice = 25;
          else if (m.name?.toLowerCase().includes('fade')) minPrice = 30;
          else if (catKey === 'cafe' || catKey === 'food') minPrice = 8;
          else if (catKey === 'carwash') minPrice = 15;
        }

        // Thumbnails generation
        let thumbs: string[] = [];
        if (m.photos && Array.isArray(m.photos)) {
          thumbs = m.photos.map((p: string) => `${pb.baseUrl}/api/files/merchants/${m.id}/${p}`);
        }
        if (resolvedLogo) thumbs.push(resolvedLogo);
        if (resolvedCover) thumbs.push(resolvedCover);

        const fallbackSet = CATEGORY_FALLBACK_PHOTOS[catKey] || CATEGORY_FALLBACK_PHOTOS.default;
        while (thumbs.length < 4) {
          thumbs.push(fallbackSet[thumbs.length % fallbackSet.length]);
        }

        // Rating & reviews calculation
        const rating = m.rating || (4.7 + (m.name.length % 3) * 0.1);
        const reviewCount = m.review_count || (60 + (m.name.length * 7) % 110);

        // Next available slot & PRO Perk calculation
        const slots = ['Today 3:30 PM', 'Today 4:00 PM', 'Today 5:15 PM', 'Tomorrow 10:00 AM', 'Tomorrow 11:30 AM'];
        const nextAvailable = slots[m.name.length % slots.length];

        const proPerksList = ['2× stamps today', '10% OFF booking', 'Free hair wash upgrade', 'Express priority queue'];
        const proPerk = proPerksList[m.name.length % proPerksList.length];

        return {
          id: m.id,
          slug: m.pwa_slug || m.slug || m.id,
          name: m.name,
          category: displayCat,
          rawCategory: catKey,
          logo: resolvedLogo,
          coverImage: resolvedCover,
          distance: distanceStr,
          distanceKm,
          isPro: isProPlan,
          lat: storeLat || undefined,
          lng: storeLng || undefined,
          city: loc?.city || 'Jitra',
          address: loc?.address || undefined,
          stampsRule: program ? `Complete ${program.stamp_goal} stamps for ${program.reward_description}` : undefined,
          collectedStamps: card ? card.stamps_collected : 0,
          totalStamps: program ? program.stamp_goal : 10,
          rating,
          reviewCount,
          minPrice,
          nextAvailable,
          proPerk: isProPlan ? proPerk : undefined,
          hasRewards: !!program,
          hasBooking: isProPlan,
          galleryThumbnails: thumbs,
          brandColor: m.pwa_brand_color || '#FFC700',
          bgColor: m.pwa_bg_color || '#FFFFFF',
        };
      });

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

  const handleOpenMerchantDetails = async (item: MerchantExploreItem) => {
    const targetSlug = item.slug || (item as any).pwa_slug || item.id;
    if (targetSlug) {
      router.push(`/b/${targetSlug}` as any);
    }
  };

  // Main Categories Bar (Image 1 style)
  const topCategories = [
    { label: 'All', id: 'All' },
    { label: 'Barber', id: 'Barber' },
    { label: 'Beauty', id: 'Beauty' },
    { label: 'Car Wash', id: 'Car Wash' },
    { label: 'Cafe', id: 'Cafe' },
    { label: 'Restaurant', id: 'Restaurant' },
  ];

  const filteredMerchants = merchants
    .filter((m) => {
      // Search query filtering
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().replace('in jitra', '').replace('in alor setar', '').trim();
        if (query.length > 0) {
          const matchName = m.name.toLowerCase().includes(query);
          const matchCat = m.category.toLowerCase().includes(query);
          const matchCity = m.city.toLowerCase().includes(query);
          if (!matchName && !matchCat && !matchCity) return false;
        }
      }

      // Active category filtering
      if (activeCategory !== 'All') {
        const cat = activeCategory.toLowerCase();
        const mCat = m.category.toLowerCase();

        if (cat === 'barber' && !mCat.includes('barber')) return false;
        if (cat === 'beauty' && !mCat.includes('beauty')) return false;
        if (cat === 'car wash' && !mCat.includes('car wash')) return false;
        if (cat === 'cafe' && !mCat.includes('cafe') && !mCat.includes('food')) return false;
        if (cat === 'restaurant' && !mCat.includes('restaurant') && !mCat.includes('food') && !mCat.includes('cafe')) return false;
      }

      // Radius filter
      if (selectedRadius > 0 && userCoords && m.distanceKm > selectedRadius) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'price') {
        return a.minPrice - b.minPrice;
      }
      // Default: nearest (with Featured/Pro priority)
      if (a.isPro && !b.isPro) return -1;
      if (!a.isPro && b.isPro) return 1;
      return a.distanceKm - b.distanceKm;
    });

  // Dynamic Summary Text
  const getSummaryText = () => {
    if (searchQuery.trim().length > 0) {
      return `${filteredMerchants.length} results for "${searchQuery}"`;
    }
    if (activeCategory !== 'All') {
      return `${filteredMerchants.length} results for "${activeCategory}"`;
    }
    return `${filteredMerchants.length} merchants found in ${selectedLocation}`;
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* ── TOP HEADER ROW (Matching Image 1: "Search" + Location Selector) ── */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Search</Text>

        <TouchableOpacity
          style={styles.locationSelectorBtn}
          onPress={() => setLocationModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="location-sharp" size={16} color="#0F172A" />
          <Text style={styles.locationSelectorText}>{selectedLocation}</Text>
          <Ionicons name="chevron-down" size={14} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SEARCH INPUT ROW (Pill Input + Clear X + Filter Button) ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search barber, cafe, beauty, food..."
              placeholderTextColor="#94A3B8"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, filterModalVisible && { backgroundColor: '#0F172A' }]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={22} color={filterModalVisible ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {/* ── HORIZONTAL CATEGORIES PILLS BAR (Barber highlighted yellow) ── */}
        <View style={styles.categoriesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {topCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryPill,
                    isActive && styles.categoryPillActive,
                  ]}
                  onPress={() => handleCategorySelect(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isActive && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* "More..." button to open All Categories Modal */}
            <TouchableOpacity
              style={styles.categoryPillMore}
              onPress={() => setAllCategoriesModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.categoryPillMoreText}>More...</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── RESULTS COUNT & SORT ROW (Dynamic Count + Sort Selector) ── */}
        <View style={styles.summaryBar}>
          <Text style={styles.resultsCountText}>{getSummaryText()}</Text>

          {/* Sort Dropdown */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setSortDropdownVisible(!sortDropdownVisible)}
              activeOpacity={0.7}
            >
              <Text style={styles.sortLabelText}>Sort by</Text>
              <Text style={styles.sortValueText}>
                {sortBy === 'nearest' ? 'Nearest' : sortBy === 'rating' ? 'Highest Rating' : 'Lowest Price'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#0F172A" />
            </TouchableOpacity>

            {sortDropdownVisible && (
              <View style={styles.sortDropdownMenu}>
                <TouchableOpacity
                  style={[styles.sortMenuItem, sortBy === 'nearest' && styles.sortMenuItemActive]}
                  onPress={() => {
                    setSortBy('nearest');
                    setSortDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.sortMenuText, sortBy === 'nearest' && styles.sortMenuTextActive]}>Nearest</Text>
                  {sortBy === 'nearest' && <Ionicons name="checkmark" size={16} color="#0F172A" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sortMenuItem, sortBy === 'rating' && styles.sortMenuItemActive]}
                  onPress={() => {
                    setSortBy('rating');
                    setSortDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.sortMenuText, sortBy === 'rating' && styles.sortMenuTextActive]}>Highest Rating</Text>
                  {sortBy === 'rating' && <Ionicons name="checkmark" size={16} color="#0F172A" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sortMenuItem, sortBy === 'price' && styles.sortMenuItemActive]}
                  onPress={() => {
                    setSortBy('price');
                    setSortDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.sortMenuText, sortBy === 'price' && styles.sortMenuTextActive]}>Lowest Price</Text>
                  {sortBy === 'price' && <Ionicons name="checkmark" size={16} color="#0F172A" />}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── RICH MERCHANT CARDS LIST (Matching Image 1 EXACTLY) ── */}
        <View style={styles.merchantsList}>
          {loading ? (
            <ActivityIndicator size="large" color="#FFC700" style={{ marginVertical: 40 }} />
          ) : filteredMerchants.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="search-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyStateTitle}>No Merchants Found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Try adjusting your search query or choosing another category.
              </Text>
            </View>
          ) : (
            filteredMerchants.map((item) => {
              const isFav = favorites.includes(item.id);

              if (item.isPro) {
                // ──────── PRO PLAN: NEUMORPHISM 3D CLAY CARD ONLY ────────
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.proNeuCardContainer}
                    onPress={() => handleOpenMerchantDetails(item)}
                    activeOpacity={0.92}
                  >
                    {/* Top-Right Floating RISEV PRO Badge (Overlapping Top Frame with Golden Glow) */}
                    <View style={styles.floatingRisevProBadge}>
                      <FontAwesome5 name="crown" size={10} color="#FFD700" />
                      <Text style={styles.floatingRisevProText}>RISEV PRO</Text>
                    </View>

                    {/* Top Section: Side-by-Side (Left 175px x 140px Image, Right Info) */}
                    <View style={styles.cardTopRow}>
                      {/* Left Image Thumbnail (Exact 175px width x 140px height) */}
                      <View style={styles.cardImageWrapper175}>
                        <Image source={{ uri: item.coverImage }} style={styles.cardCoverImg175} resizeMode="cover" />

                        {/* Bottom Left: Glass Overlay "X photos" Badge */}
                        <View style={styles.photosGlassBadge}>
                          <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                          <Text style={styles.photosGlassText}>{item.galleryThumbnails.length || 4} photos</Text>
                        </View>
                      </View>

                      {/* Right Column: Title, Subtitle, Rating, Badges & PRO Perk */}
                      <View style={styles.cardRightCol175}>
                        {/* Title with Verified Checkmark & 3D Disc Heart Button Row */}
                        <View style={styles.cardHeaderRow}>
                          <View style={styles.titleVerifiedWrap}>
                            <Text style={styles.newCardTitle} numberOfLines={1}>{item.name}</Text>
                            <View style={styles.verifiedCircBadge}>
                              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.proNeuHeartBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name={isFav ? "heart" : "heart-outline"}
                              size={16}
                              color={isFav ? "#EF4444" : "#0F172A"}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Subtitle / Category & Location */}
                        <Text style={styles.newCardSubTitle} numberOfLines={1}>
                          {item.category} • {item.city}
                        </Text>

                        {/* Rating & Distance Row */}
                        <View style={styles.newRatingRow}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={styles.newRatingScore}>{item.rating.toFixed(1)}</Text>
                          <Text style={styles.newReviewCount}>({item.reviewCount})</Text>
                          <Text style={styles.newBulletDot}>•</Text>
                          <Ionicons name="location-outline" size={13} color="#0F172A" />
                          <Text style={styles.newDistanceText}>{item.distance}</Text>
                        </View>

                        {/* Feature Badges Row (3D Neumorphic Rewards + Booking side-by-side) */}
                        <View style={styles.newBadgesRow}>
                          {item.hasRewards && (
                            <View style={styles.proNeuRewardPill}>
                              <Ionicons name="gift-outline" size={11.5} color="#92400E" />
                              <Text style={styles.proNeuRewardPillText} numberOfLines={1}>Rewards</Text>
                            </View>
                          )}
                          {item.hasBooking && (
                            <View style={styles.proNeuBookingPill}>
                              <Ionicons name="calendar-outline" size={11.5} color="#0F172A" />
                              <Text style={styles.proNeuBookingPillText} numberOfLines={1}>Booking</Text>
                            </View>
                          )}
                        </View>

                      </View>
                    </View>

                    {/* Bottom Section: Sunken Inset Footer Bar */}
                    <View style={styles.proNeuFooterBar}>
                      <View style={styles.fullFooterPriceCol}>
                        <Text style={styles.footerFromLabel}>From</Text>
                        <Text style={styles.fullFooterPriceText}>RM{item.minPrice}</Text>
                      </View>

                      <View style={styles.fullFooterDivider} />

                      <View style={styles.fullFooterSlotCol}>
                        <Ionicons name="time-outline" size={15} color="#64748B" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.footerSlotLabel}>Next available</Text>
                          <Text style={styles.fullFooterSlotText} numberOfLines={1}>{item.nextAvailable}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.proSleekBookCtaBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleOpenMerchantDetails(item);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.proSleekBookCtaText}>Book now</Text>
                        <Ionicons name="chevron-forward" size={13} color="#F59E0B" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }

              // ──────── NON-PRO (STANDARD): CLEAN FLAT CARD ONLY ────────
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.standardCardContainer}
                  onPress={() => handleOpenMerchantDetails(item)}
                  activeOpacity={0.92}
                >
                  {/* Top Section: Side-by-Side (Left 175px x 140px Image, Right Info) */}
                  <View style={styles.cardTopRow}>
                    {/* Left Image Thumbnail */}
                    <View style={styles.cardImageWrapper175}>
                      <Image source={{ uri: item.coverImage }} style={styles.cardCoverImg175} resizeMode="cover" />

                      {/* Bottom Left: Glass Overlay "X photos" Badge */}
                      <View style={styles.photosGlassBadge}>
                        <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.photosGlassText}>{item.galleryThumbnails.length || 4} photos</Text>
                      </View>
                    </View>

                    {/* Right Column: Title, Subtitle, Rating, Rewards */}
                    <View style={styles.cardRightCol175}>
                      {/* Title & Standard Heart Button Row */}
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.newCardTitle} numberOfLines={1}>{item.name}</Text>
                        <TouchableOpacity
                          style={styles.standardHeartBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={isFav ? "heart" : "heart-outline"}
                            size={16}
                            color={isFav ? "#EF4444" : "#0F172A"}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Subtitle / Category & Location */}
                      <Text style={styles.newCardSubTitle} numberOfLines={1}>
                        {item.category} • {item.city}
                      </Text>

                      {/* Rating & Distance Row */}
                      <View style={styles.newRatingRow}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={styles.newRatingScore}>{item.rating.toFixed(1)}</Text>
                        <Text style={styles.newReviewCount}>({item.reviewCount})</Text>
                        <Text style={styles.newBulletDot}>•</Text>
                        <Ionicons name="location-outline" size={13} color="#0F172A" />
                        <Text style={styles.newDistanceText}>{item.distance}</Text>
                      </View>

                      {/* Feature Badges Row (Only Rewards pill if applicable) */}
                      {item.hasRewards && (
                        <View style={styles.newBadgesRow}>
                          <View style={styles.standardRewardPill}>
                            <Ionicons name="gift-outline" size={12} color="#92400E" />
                            <Text style={styles.standardRewardPillText} numberOfLines={1}>Rewards</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bottom Section: Standard Clean Flat Footer Bar */}
                  <View style={styles.standardFooterBar}>
                    <View style={styles.fullFooterPriceCol}>
                      <Text style={styles.footerFromLabel}>From</Text>
                      <Text style={styles.fullFooterPriceText}>RM{item.minPrice}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.standardViewStoreBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenMerchantDetails(item);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.standardViewStoreText}>View Store</Text>
                      <Ionicons name="chevron-forward" size={14} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── LOCATION SELECTOR MODAL ── */}
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLocationModalVisible(false)}>
          <View style={styles.locationSheet}>
            <Text style={styles.locationSheetTitle}>Select Location</Text>
            {LOCATIONS_LIST.map((loc) => (
              <TouchableOpacity
                key={loc.id}
                style={[
                  styles.locationItem,
                  selectedLocation === loc.label && styles.locationItemActive,
                ]}
                onPress={() => {
                  setSelectedLocation(loc.label);
                  setSearchQuery('');
                  setLocationModalVisible(false);
                }}
              >
                <Ionicons name="location-outline" size={18} color={selectedLocation === loc.label ? '#0F172A' : '#64748B'} />
                <Text style={[styles.locationItemText, selectedLocation === loc.label && styles.locationItemTextActive]}>
                  {loc.label}
                </Text>
                {selectedLocation === loc.label && <Ionicons name="checkmark" size={18} color="#0F172A" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── FILTER BOTTOM SHEET MODAL ── */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyExploreFilters}
        initialFilters={{
          category: activeCategory,
          distanceKm: selectedRadius,
          ...appliedFilters,
        }}
        totalResultsCount={filteredMerchants.length}
      />

      {/* ── ALL CATEGORIES MODAL ── */}
      <AllCategoriesModal
        visible={allCategoriesModalVisible}
        onClose={() => setAllCategoriesModalVisible(false)}
        onSelectCategory={(catId) => {
          const matched = topCategories.find((c) => c.id.toLowerCase() === catId.toLowerCase());
          setActiveCategory(matched ? matched.label : 'All');
          setSearchQuery('');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -1,
  },
  locationSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationSelectorText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
    gap: 16,
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
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesWrap: {
    marginHorizontal: -20,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  categoryPillActive: {
    backgroundColor: '#FFC700', // Highlighted yellow matching Image 1
  },
  categoryPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  categoryPillMore: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  categoryPillMoreText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    zIndex: 10,
  },
  resultsCountText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabelText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  sortValueText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sortMenuItemActive: {
    backgroundColor: '#FEF9C3',
  },
  sortMenuText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  sortMenuTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  merchantsList: {
    gap: 16,
    marginTop: 4,
  },
  /* New Card Layout matching user mockup */
  /* Cadangan 1 - Full Width Card Layout Styles */
  proNeuCardContainer: {
    backgroundColor: '#FAF8F5',
    borderRadius: 32,
    padding: 14,
    gap: 12,
    shadowColor: 'rgba(160, 140, 120, 0.40)',
    shadowOffset: { width: 4, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    position: 'relative',
    marginTop: 14,
  },
  standardCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
  },
  standardHeartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proNeuHeartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF8F5',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  floatingRisevProBadge: {
    position: 'absolute',
    top: -13,
    right: 20,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 25,
  },
  floatingRisevProText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFD700',
    letterSpacing: 0.6,
  },
  verifiedCircBadge: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    flexShrink: 0,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  titleVerifiedWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    overflow: 'hidden',
  },
  proPerkBannerContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderBottomColor: '#F59E0B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  proPerkLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  proPerkDividerLine: {
    width: 1,
    height: 18,
    backgroundColor: '#334155',
    marginHorizontal: 2,
  },
  proPerkSubLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  proPerkMainText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  proSleekBookCtaBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  proSleekBookCtaText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  proNeuFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EDEAE4',
    borderWidth: 1.5,
    borderColor: '#E2DED6',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  cardImageWrapper175: {
    width: 135,
    height: 135,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  cardCoverImg175: {
    width: '100%',
    height: '100%',
  },
  cardRightCol175: {
    flex: 1,
    gap: 4,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  fullWidthFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  fullFooterPriceCol: {
    justifyContent: 'center',
    minWidth: 52,
  },
  fullFooterPriceText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  fullFooterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  fullFooterSlotCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullFooterSlotText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  fullBookCtaBtn: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  fullBookCtaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  fullViewDetailsCtaBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fullViewDetailsCtaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  newCardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardImageWrapper: {
    width: 125,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  cardTallImg: {
    width: '100%',
    height: '100%',
  },
  featuredCrownBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFC700',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredCrownText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  photosGlassBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photosGlassText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  cardRightCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  newCardTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heartCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.18)',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  newCardSubTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: -2,
  },
  newRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    flexWrap: 'nowrap',
  },
  newRatingScore: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  newReviewCount: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  newBulletDot: {
    fontSize: 11,
    color: '#CBD5E1',
    marginHorizontal: 1,
  },
  newDistanceText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flexShrink: 0,
  },
  newBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  /* PRO Neumorphic 3D Soft-Clay Pills */
  proNeuRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 3,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  proNeuRewardPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
  proNeuBookingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  proNeuBookingPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  /* Standard Non-PRO Flat Pills & Footer */
  standardRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  standardRewardPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  standardFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  standardViewStoreBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  standardViewStoreText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerFromLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  footerPriceText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  footerVerticalDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  footerSlotCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  footerSlotLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  footerSlotText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  bookCtaBtn: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  bookCtaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  emptyStateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  locationSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  locationSheetTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 10,
  },
  locationItemActive: {
    backgroundColor: '#FEF9C3',
  },
  locationItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  locationItemTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
