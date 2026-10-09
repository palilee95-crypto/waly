import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from './_components/FlippableLoyaltyCard';
import FilterModal, { FilterState } from './_components/FilterModal';
import AllCategoriesModal from './_components/AllCategoriesModal';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'barber', name: 'Barber', icon: 'cut', inactiveBg: '#FEF9C3', activeBg: '#FACC15', iconColor: '#0F172A', shadowColor: '#F59E0B' },
  { id: 'beauty', name: 'Beauty', icon: 'flower', inactiveBg: '#FFF0F5', activeBg: '#FB7185', iconColor: '#E11D48', shadowColor: '#F43F5E' },
  { id: 'carwash', name: 'Car Wash', icon: 'car-sport', inactiveBg: '#F0F9FF', activeBg: '#38BDF8', iconColor: '#0284C7', shadowColor: '#0284C7' },
  { id: 'cafe', name: 'Cafe', icon: 'cafe', inactiveBg: '#FFFBEB', activeBg: '#F59E0B', iconColor: '#92400E', shadowColor: '#D97706' },
  { id: 'restaurant', name: 'Restaurant', icon: 'restaurant', inactiveBg: '#FEF2F2', activeBg: '#F87171', iconColor: '#DC2626', shadowColor: '#DC2626' },
  { id: 'more', name: 'More', icon: 'ellipsis-horizontal', inactiveBg: '#F8FAFC', activeBg: '#94A3B8', iconColor: '#475569', shadowColor: '#94A3B8' },
];

function formatUpcomingDate(dateStr?: string) {
  if (!dateStr) return 'Thu, 8 Oct 2026';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getContrastColor(hexColor?: string | null) {
  if (!hexColor || !hexColor.startsWith('#') || hexColor.length < 7) return '#000000';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#000000' : '#FFFFFF';
}

function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
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
};

const stampIcons = [
  { id: 'ticket', family: 'Ionicons', name: 'ticket-sharp' },
  { id: 'star', family: 'FontAwesome', name: 'star' },
  { id: 'heart', family: 'Ionicons', name: 'heart' },
  { id: 'coffee', family: 'MaterialIcons', name: 'local-cafe' },
  { id: 'cake', family: 'MaterialIcons', name: 'cake' },
  { id: 'restaurant', family: 'Ionicons', name: 'restaurant' },
  { id: 'tag', family: 'Ionicons', name: 'pricetag' },
  { id: 'gift', family: 'Ionicons', name: 'gift' },
  { id: 'beer', family: 'Ionicons', name: 'beer' },
  { id: 'pizza', family: 'Ionicons', name: 'pizza' },
  { id: 'card', family: 'Ionicons', name: 'card' },
  { id: 'store', family: 'Ionicons', name: 'storefront' },
  { id: 'car', family: 'Ionicons', name: 'car-sport' },
  { id: 'icecream', family: 'Ionicons', name: 'ice-cream' },
  { id: 'barbell', family: 'Ionicons', name: 'barbell' },
  { id: 'scissors', family: 'Ionicons', name: 'scissors' },
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
  const { t, locale } = useLanguage();
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
  const scrollRef = useRef<ScrollView>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Upcoming Service Appointment State
  const [upcomingBooking, setUpcomingBooking] = useState<any>(null);
  const [bookingCountdown, setBookingCountdown] = useState<string>('');
  const [appointmentPassModalVisible, setAppointmentPassModalVisible] = useState(false);
  const [hasMarkedArrived, setHasMarkedArrived] = useState(false);
  const [markingArrivedLoading, setMarkingArrivedLoading] = useState(false);
  const [isBookingMissed, setIsBookingMissed] = useState(false);
  const [dismissedBookingId, setDismissedBookingId] = useState<string | null>(null);
  const [popularMerchants, setPopularMerchants] = useState<any[]>([]);
  const [allExploreMerchants, setAllExploreMerchants] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('barber');

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      fetchPopularMerchants();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [allCategoriesModalVisible, setAllCategoriesModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Partial<FilterState>>({});

  const handleApplyFilters = (filters: FilterState) => {
    setActiveFilters(filters);
    router.push({
      pathname: '/(customer)/explore',
      params: {
        category: filters.category !== 'All' ? filters.category : undefined,
        q: searchQuery,
      },
    });
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const fetchNotifications = async () => {
    // Notifications collection was removed in backend cleanup migration
    setNotificationsList([]);
    setLoadingNotifications(false);
  };

  const handleCloseNotifications = async () => {
    setShowNotificationsModal(false);
    setUnreadCount(0);
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
          points: rec.points_balance || 0,
          tier: rec.tier || 'bronze',
          merchantId: merchant?.id,
          linkedRewardId: program?.linked_reward,
          enable_stamps: program?.enable_stamps,
          enable_points: program?.enable_points,
          gradientColors: program?.card_color ? [program.card_color, '#000000'] : ['#EC4899', '#8B5CF6'] as string[],
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

      // Fetch pinned cards and sort them to the top
      let pinnedIds: string[] = [];
      try {
        const storedPinned = await AsyncStorage.getItem('@pinned_cards');
        if (storedPinned) {
          pinnedIds = JSON.parse(storedPinned);
        }
      } catch (err) {
        console.warn('Failed to read pinned cards:', err);
      }

      mapped.sort((a: any, b: any) => {
        const aPinned = pinnedIds.includes(a.id);
        const bPinned = pinnedIds.includes(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0; // fallback to the default -updated sort
      });

      setLoyaltyCards(mapped);
    } catch (err) {
      console.warn('Failed to fetch loyalty cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingAppointments = async () => {
    if (!user) return;
    try {
      // 1. Try dedicated endpoint first (runs server-side with full access)
      try {
        const phoneParam = encodeURIComponent(user.phone || '');
        const res: any = await pb.send(`/api/risev/customer/active-booking?phone=${phoneParam}`, {
          method: 'GET',
          requestKey: null
        });
        if (res && res.booking) {
          try {
            const isDismissed = await AsyncStorage.getItem(`risev_dismissed_booking_${res.booking.id}`);
            if (isDismissed === 'true') {
              setDismissedBookingId(res.booking.id);
            }
          } catch (e) {}
          setUpcomingBooking(res.booking);
          setHasMarkedArrived(res.booking.status === 'arrived');
          return;
        }
      } catch (endpointErr) {
        // Fall back to collection getList below
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const filterConditions = [];
      if (user.id) filterConditions.push(`customer = '${user.id}'`);
      if (user.phone) {
        filterConditions.push(`customer_phone = '${user.phone}'`);
        const clean = user.phone.replace(/[^\d]/g, '');
        if (clean.startsWith('60')) {
          filterConditions.push(`customer_phone = '0${clean.slice(2)}'`);
          filterConditions.push(`customer_phone = '+${clean}'`);
        } else if (clean.startsWith('0')) {
          filterConditions.push(`customer_phone = '+60${clean.slice(1)}'`);
        }
      }

      let savedPhone = null;
      try { savedPhone = await AsyncStorage.getItem('risev_cust_phone'); } catch (e) {}
      if (savedPhone) {
        filterConditions.push(`customer_phone = '${savedPhone}'`);
      }
      
      const uniqueFilters = Array.from(new Set(filterConditions));
      const userFilter = uniqueFilters.length > 0 ? `(${uniqueFilters.join(' || ')})` : `customer = '${user.id}'`;
      const fullFilter = `${userFilter} && (status = 'booked' || status = 'arrived' || (status = 'no_show' && booking_date = '${todayIso}')) && booking_date >= '${todayIso}'`;

      const res = await pb.collection('service_bookings').getList(1, 1, {
        filter: fullFilter,
        sort: 'booking_date,start_time',
        expand: 'merchant,branch,staff',
        requestKey: null
      });

      if (res.items.length > 0) {
        const item = res.items[0];
        try {
          const isDismissed = await AsyncStorage.getItem(`risev_dismissed_booking_${item.id}`);
          if (isDismissed === 'true') {
            setDismissedBookingId(item.id);
          }
        } catch (e) {}
        setUpcomingBooking(item);
        setHasMarkedArrived(item.status === 'arrived');
      } else {
        setUpcomingBooking(null);
      }
    } catch (err) {
      console.warn('Failed to fetch upcoming appointment:', err);
      setUpcomingBooking(null);
    }
  };

  const fetchPopularMerchants = async () => {
    try {
      setLoadingPopular(true);
      const merchantList = await pb.collection('merchants').getFullList({
        requestKey: null,
      }).catch(() => []);
      const programList = await pb.collection('loyalty_programs').getFullList({
        filter: 'is_active = true',
        requestKey: null,
      }).catch(() => []);
      const storeLocations = await pb.collection('store_locations').getFullList({ requestKey: null }).catch(() => []);
      const subscriptions = await pb.collection('subscriptions').getFullList({
        filter: 'status = "active"',
        requestKey: null,
      }).catch(() => []);
      const loyaltyCards = await pb.collection('loyalty_cards').getFullList({ requestKey: null }).catch(() => []);
      const serviceBookings = await pb.collection('service_bookings').getFullList({ requestKey: null }).catch(() => []);

      const labelMap: Record<string, string> = {
        food: 'Food & Drink',
        retail: 'Retail',
        beauty: 'Beauty',
        barber: 'Barber',
        health: 'Health',
        entertainment: 'Entertainment',
        carwash: 'Car Wash',
        other: 'Services'
      };

      const mapped = merchantList.map((m: any) => {
        const program = programList.find((p: any) => p.merchant === m.id);
        const loc = storeLocations.find((l: any) => l.merchant === m.id);

        // 1. PRO Subscription Check
        const isPro = m.subscription_plan === 'pro' ||
                      m.subscription_plan === 'business' ||
                      subscriptions.some((s: any) => s.merchant === m.id && (s.plan === 'pro' || s.plan === 'business'));

        // 2. Activity & Rating Calculation (Pilihan A & B)
        const customerCardsCount = loyaltyCards.filter((c: any) => c.merchant === m.id).length;
        const bookingsCount = serviceBookings.filter((b: any) => b.merchant === m.id).length;
        const activityTotal = customerCardsCount + bookingsCount;

        let ratingVal = m.rating ? parseFloat(String(m.rating)) : 4.6;
        if (!m.rating && activityTotal > 0) {
          ratingVal = Math.min(5.0, 4.6 + (activityTotal * 0.04));
        }
        const ratingStr = ratingVal.toFixed(1);
        const reviewCount = m.review_count || m.reviews || Math.max(16, activityTotal * 4 + 32);

        // 3. Distance Calculation
        let distanceKm = 999;
        let distanceStr = loc?.city ? `In ${loc.city}` : 'Jitra';
        const storeLat = loc?.lat ? parseFloat(String(loc.lat)) : null;
        const storeLng = loc?.lng ? parseFloat(String(loc.lng)) : null;

        if (storeLat !== null && storeLng !== null && !isNaN(storeLat) && !isNaN(storeLng)) {
          if (userCoords) {
            distanceKm = getHaversineDistanceKm(userCoords.lat, userCoords.lng, storeLat, storeLng);
            distanceStr = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
          } else if (loc?.city) {
            distanceStr = loc.city;
          }
        }

        let coverUri = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600';
        if (m.banner) {
          coverUri = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}`;
        } else if (m.logo) {
          coverUri = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}`;
        } else if (program?.card_background) {
          coverUri = `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`;
        }

        // Composite Ranking Score: PRO (10000) + Rating (1000) + Activity (10) - Distance
        const rankingScore = (isPro ? 10000 : 0) + (ratingVal * 1000) + (activityTotal * 10) - (distanceKm * 0.1);

        const proPerksList = ['2× stamps today', '10% OFF booking', 'Free hair wash upgrade', 'Express priority queue'];
        const proPerk = proPerksList[m.name.length % proPerksList.length];

        return {
          id: m.id,
          name: m.name || 'Merchant Store',
          slug: m.pwa_slug || m.id,
          category: labelMap[m.category?.toLowerCase()] || m.category || 'General',
          city: loc?.city || 'Jitra',
          location: distanceStr,
          distance: distanceStr,
          rating: ratingVal,
          reviews: reviewCount,
          coverUri,
          coverImage: coverUri,
          isPro,
          hasBooking: isPro,
          hasRewards: !!program,
          minPrice: 8 + (m.name.length % 5) * 5,
          nextAvailable: 'Today 5:15 PM',
          proPerk: isPro ? proPerk : undefined,
          galleryThumbnails: [coverUri],
          distanceKm,
          rankingScore,
          badgeText: isPro ? 'PRO Merchant' : (program ? 'Earn rewards' : 'Booking available'),
          badgeIcon: isPro ? 'ribbon' : (program ? 'gift' : 'calendar'),
        };
      });

      // Sort by ranking score descending (PRO & Rating & Closest Distance first)
      mapped.sort((a: any, b: any) => b.rankingScore - a.rankingScore);

      setAllExploreMerchants(mapped);
      // Take Top 5 Merchants
      setPopularMerchants(mapped.slice(0, 5));
    } catch (err) {
      console.warn('Failed to fetch popular merchants:', err);
    } finally {
      setLoadingPopular(false);
    }
  };

  const handleMarkArrived = async () => {
    if (!upcomingBooking?.id) return;
    try {
      setMarkingArrivedLoading(true);
      await pb.collection('service_bookings').update(upcomingBooking.id, {
        status: 'arrived'
      });
      setHasMarkedArrived(true);
      setUpcomingBooking((prev: any) => prev ? { ...prev, status: 'arrived' } : null);
      Alert.alert('Arrival Confirmed! 📍', 'The store counter has been notified of your arrival.');
    } catch (err: any) {
      console.warn('Arrival update err:', err);
      Alert.alert('Notice', 'Could not update arrival status right now. Please inform the store staff at the counter.');
    } finally {
      setMarkingArrivedLoading(false);
    }
  };

  const handleRescheduleBooking = () => {
    const slug = upcomingBooking?.expand?.merchant?.pwa_slug || upcomingBooking?.merchant_pwa_slug;
    setAppointmentPassModalVisible(false);
    if (slug) {
      router.push(`/b/${slug}` as any);
    } else {
      router.push('/(customer)/explore' as any);
    }
  };

  const handleDismissMissedBooking = async () => {
    if (upcomingBooking?.id) {
      const bId = upcomingBooking.id;
      setDismissedBookingId(bId);
      try {
        await AsyncStorage.setItem(`risev_dismissed_booking_${bId}`, 'true');
      } catch (e) {
        console.warn('Failed to persist dismissed booking:', e);
      }
    }
    setAppointmentPassModalVisible(false);
  };

  useEffect(() => {
    if (!upcomingBooking) {
      setBookingCountdown('');
      setIsBookingMissed(false);
      return;
    }

    const updateCountdown = () => {
      if (upcomingBooking.status === 'no_show') {
        setIsBookingMissed(true);
        setBookingCountdown('Missed Slot');
        return;
      }

      const bDate = upcomingBooking.booking_date;
      const bTime = upcomingBooking.start_time;
      if (!bDate || !bTime) return;

      const parts = bDate.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      const tParts = bTime.trim().split(' ');
      let [h, min] = (tParts[0] || '0:0').split(':').map(Number);
      const mod = tParts[1] ? tParts[1].toUpperCase() : null;
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;

      const target = new Date(y, m, d, h || 0, min || 0, 0, 0);
      const diffMs = target.getTime() - Date.now();

      if (diffMs <= 0) {
        const pastMins = Math.floor(Math.abs(diffMs) / 60000);
        if (upcomingBooking.status === 'arrived') {
          setIsBookingMissed(false);
          setBookingCountdown(pastMins < 60 ? 'Happening Now' : 'Ongoing');
        } else if (pastMins < 60) {
          setIsBookingMissed(false);
          setBookingCountdown('Happening Now');
        } else {
          // Overdue slot with no check-in (> 60m)
          setIsBookingMissed(true);
          setBookingCountdown('Missed Slot');
        }
        return;
      }

      setIsBookingMissed(false);
      const totalSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);

      if (days > 0) {
        setBookingCountdown(`Starts in ${days}d ${hours}h`);
      } else if (hours > 0) {
        setBookingCountdown(`Starts in ${hours}h ${mins}m`);
      } else {
        setBookingCountdown(`Starts in ${mins}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);
    return () => clearInterval(interval);
  }, [upcomingBooking]);

  useEffect(() => {
    fetchPopularMerchants();

    if (!user) return;

    setUnreadCount(0);

    fetchLoyaltyCards();
    fetchUpcomingAppointments();

    // Listen to real-time updates on loyalty_cards and service_bookings
    pb.collection('loyalty_cards').subscribe('*', () => {
      fetchLoyaltyCards();
    }, {
      filter: `customer = '${user.id}'`
    });

    try {
      pb.collection('service_bookings').subscribe('*', () => {
        fetchUpcomingAppointments();
      });
    } catch (e) {}

    return () => {
      pb.collection('loyalty_cards').unsubscribe('*');
      try { pb.collection('service_bookings').unsubscribe('*'); } catch (e) {}
    };
  }, [user]);

  // Refresh pinned cards, upcoming bookings & popular merchants whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchPopularMerchants();
      if (user) {
        fetchLoyaltyCards();
        fetchUpcomingAppointments();
      }
    }, [user])
  );

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
          <AnimatedStampSlot 
            key={i} 
            index={i} 
            style={[
              styles.largeStampEarned,
              card.stampColor && { backgroundColor: card.stampColor }
            ]}
          >
            {renderStampIcon(card.cardIcon, 16, '#FFFFFF')}
          </AnimatedStampSlot>
        );
      } else {
        slots.push(
          <AnimatedStampSlot key={i} index={i} style={styles.largeStampEmpty}>
            {renderStampIcon(card.cardIcon, 14, card.fontColor ? `${card.fontColor}40` : 'rgba(255, 255, 255, 0.25)')}
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  };

  const getBookingStoreImage = () => {
    if (upcomingBooking) {
      const merchant = upcomingBooking.expand?.merchant;
      const merchantId = merchant?.id || upcomingBooking.merchant || upcomingBooking.merchant_id;
      const logo = merchant?.logo || upcomingBooking.merchant_logo;
      if (merchantId && logo) {
        if (typeof logo === 'string' && (logo.startsWith('http://') || logo.startsWith('https://'))) {
          return { uri: logo };
        }
        return { uri: `${pb.baseUrl}/api/files/merchants/${merchantId}/${logo}` };
      }
      const avatar = merchant?.avatar;
      if (merchantId && avatar) {
        return { uri: `${pb.baseUrl}/api/files/merchants/${merchantId}/${avatar}` };
      }
    }
    return require('@/assets/images/jerami_barbershop.jpg');
  };

  const defaultCard: LoyaltyCardItem = {
    id: 'demo-duans-card',
    merchantName: "Duans's Store",
    category: 'Retail',
    logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=120',
    collectedStamps: 5,
    totalStamps: 10,
    rewardName: 'Free reward upon completing stamp card',
    cardNumber: '•••• •••• •••• 8888',
    points: 30,
    gradientColors: ['#EC4899', '#DB2777'],
    cardIcon: 'coffee',
    stampColor: '#EC4899',
    fontColor: '#FFFFFF',
    validUntil: '10/26',
    enable_stamps: true,
    enable_points: true,
  };

  const highestCard = loyaltyCards.length > 0 ? loyaltyCards.reduce((prev, current) => (prev.collectedStamps > current.collectedStamps) ? prev : current) : null;
  const activeCard: LoyaltyCardItem = highestCard || defaultCard;
  const currentStamps = activeCard.collectedStamps;
  const maxStamps = activeCard.totalStamps;
  const progressArray = Array.from({ length: 10 }, (_, i) => i < Math.round((currentStamps / maxStamps) * 10));

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Main Content Wrapper */}
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', maxWidth: 800, alignSelf: 'center', width: '100%' }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
            showsVerticalScrollIndicator={false}
          >
            {/* 📍 1. TOP HEADER ROW: LOCATION SELECTOR + RISEV LOGO */}
            <View style={styles.topNavRow}>
              <TouchableOpacity
                style={styles.locationSelector}
                onPress={() => router.push('/(customer)/explore')}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={18} color="#EAB308" />
                <Text style={styles.locationText}>Jitra, Kedah</Text>
                <Ionicons name="chevron-down" size={14} color="#64748B" />
              </TouchableOpacity>

              <Image
                source={require('@/assets/risev logo.png')}
                style={styles.headerRisevLogoImg}
              />
            </View>

            {/* 👋 2. GREETING & NAME + PROFILE AVATAR ON THE RIGHT */}
            <View style={styles.greetingContainer}>
              <View style={styles.greetingTextCol}>
                <Text style={styles.greetingSub}>{getGreeting()}</Text>
                <Text style={styles.greetingTitle}>
                  {user?.name ? user.name.split(' ')[0] : 'Fazli'} 👋
                </Text>
              </View>

              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={() => router.push('/(customer)/profile')}
                activeOpacity={0.8}
              >
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              </TouchableOpacity>
            </View>

            {/* 🔍 3. SEARCH BAR ROW WITH FILTER BUTTON */}
            <View style={styles.searchBarRow}>
              <TouchableOpacity
                style={styles.searchBarPill}
                onPress={() => router.push({ pathname: '/(customer)/explore', params: { q: searchQuery } })}
                activeOpacity={0.9}
              >
                <Ionicons name="search-outline" size={19} color="#0F172A" />
                <Text style={[styles.searchPlaceholder, searchQuery.length > 0 && styles.searchPlaceholderActive]} numberOfLines={1}>
                  {searchQuery || 'Search services or venues'}
                </Text>
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterIconBtn, Object.keys(activeFilters).length > 0 && styles.filterIconBtnActive]}
                onPress={() => setFilterModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="options-outline" size={19} color={Object.keys(activeFilters).length > 0 ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            {/* 🏷️ 4. QUICK CATEGORY CHIPS (3D Neumorphic Soft Clay Squircle) */}
            <View style={styles.categoriesRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryItem}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      if (cat.id === 'more') {
                        setAllCategoriesModalVisible(true);
                      } else {
                        router.push({ pathname: '/(customer)/explore', params: { category: cat.id } });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.neuClayCategoryBox,
                        {
                          backgroundColor: isSelected ? cat.activeBg : cat.inactiveBg,
                          shadowColor: cat.shadowColor,
                          shadowOpacity: isSelected ? 0.5 : 0.22,
                          shadowRadius: isSelected ? 12 : 6,
                          elevation: isSelected ? 7 : 3,
                        },
                      ]}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={22}
                        color={isSelected ? '#0F172A' : cat.iconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ❤️ FAVORITE STORES SECTION (Max 5 Stores Carousel - Placed above Your Next Reward) */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Favorite stores</Text>
                  <View style={styles.favCountBadge}>
                    <Text style={styles.favCountBadgeText}>{favorites.length}/5</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/(customer)/explore')}>
                  <Text style={styles.sectionLink}>Explore all &gt;</Text>
                </TouchableOpacity>
              </View>

              {favorites.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.favoriteStoresScroll}
                >
                  {favorites.map((favId) => {
                    const item = allExploreMerchants.find((m: any) => m.id === favId);
                    if (!item) return null;

                    if (item.isPro) {
                      // ──────── PRO PLAN: NEUMORPHISM 3D CLAY CARD ────────
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.proNeuCardContainer, { width: 345, marginRight: 14 }]}
                          onPress={() => router.push(`/b/${item.slug}`)}
                          activeOpacity={0.92}
                        >
                          {/* Top-Right Floating RISEV PRO Badge */}
                          <View style={styles.floatingRisevProBadge}>
                            <FontAwesome5 name="crown" size={10} color="#FFD700" />
                            <Text style={styles.floatingRisevProText}>RISEV PRO</Text>
                          </View>

                          <View style={styles.cardTopRow}>
                            <View style={styles.cardImageWrapper175}>
                              <Image source={{ uri: item.coverImage || item.coverUri }} style={styles.cardCoverImg175} resizeMode="cover" />
                              <View style={styles.photosGlassBadge}>
                                <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                                <Text style={styles.photosGlassText}>{item.galleryThumbnails?.length || 4} photos</Text>
                              </View>
                            </View>

                            <View style={styles.cardRightCol175}>
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
                                  <Ionicons name="heart" size={16} color="#EF4444" />
                                </TouchableOpacity>
                              </View>

                              <Text style={styles.newCardSubTitle} numberOfLines={1}>
                                {item.category} • {item.city || 'Jitra'}
                              </Text>

                              <View style={styles.newRatingRow}>
                                <Ionicons name="star" size={13} color="#F59E0B" />
                                <Text style={styles.newRatingScore}>{item.rating?.toFixed ? item.rating.toFixed(1) : item.rating}</Text>
                                <Text style={styles.newReviewCount}>({item.reviews || 120})</Text>
                                <Text style={styles.newBulletDot}>•</Text>
                                <Ionicons name="location-outline" size={13} color="#0F172A" />
                                <Text style={styles.newDistanceText}>{item.location || '1.1 km'}</Text>
                              </View>

                              <View style={styles.newBadgesRow}>
                                <View style={styles.proNeuRewardPill}>
                                  <Ionicons name="gift-outline" size={11.5} color="#92400E" />
                                  <Text style={styles.proNeuRewardPillText} numberOfLines={1}>Rewards</Text>
                                </View>
                                <View style={styles.proNeuBookingPill}>
                                  <Ionicons name="calendar-outline" size={11.5} color="#0F172A" />
                                  <Text style={styles.proNeuBookingPillText} numberOfLines={1}>Booking</Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          <View style={styles.proNeuFooterBar}>
                            <View style={styles.fullFooterPriceCol}>
                              <Text style={styles.footerFromLabel}>From</Text>
                              <Text style={styles.fullFooterPriceText}>RM{item.minPrice || 10}</Text>
                            </View>

                            <View style={styles.fullFooterDivider} />

                            <View style={styles.fullFooterSlotCol}>
                              <Ionicons name="time-outline" size={15} color="#64748B" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.footerSlotLabel}>Next available</Text>
                                <Text style={styles.fullFooterSlotText} numberOfLines={1}>{item.nextAvailable || 'Today 5:15 PM'}</Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={styles.proSleekBookCtaBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push(`/b/${item.slug}`);
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

                    // ──────── NON-PRO STANDARD CLEAN CARD ────────
                    const targetSlug = item.slug || item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.standardCardContainer, { width: 345, marginRight: 14 }]}
                        onPress={() => {
                          if (targetSlug) {
                            router.push(`/b/${targetSlug}` as any);
                          } else {
                            router.push({ pathname: '/(customer)/explore', params: { q: item.name } });
                          }
                        }}
                        activeOpacity={0.92}
                      >
                        <View style={styles.cardTopRow}>
                          <View style={styles.cardImageWrapper175}>
                            <Image source={{ uri: item.coverImage || item.coverUri }} style={styles.cardCoverImg175} resizeMode="cover" />
                            <View style={styles.photosGlassBadge}>
                              <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                              <Text style={styles.photosGlassText}>{item.galleryThumbnails?.length || 4} photos</Text>
                            </View>
                          </View>

                          <View style={styles.cardRightCol175}>
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
                                <Ionicons name="heart" size={16} color="#EF4444" />
                              </TouchableOpacity>
                            </View>

                            <Text style={styles.newCardSubTitle} numberOfLines={1}>
                              {item.category} • {item.city || 'Jitra'}
                            </Text>

                            <View style={styles.newRatingRow}>
                              <Ionicons name="star" size={13} color="#F59E0B" />
                              <Text style={styles.newRatingScore}>{item.rating?.toFixed ? item.rating.toFixed(1) : item.rating}</Text>
                              <Text style={styles.newReviewCount}>({item.reviews || 95})</Text>
                              <Text style={styles.newBulletDot}>•</Text>
                              <Ionicons name="location-outline" size={13} color="#0F172A" />
                              <Text style={styles.newDistanceText}>{item.location || '1.5 km'}</Text>
                            </View>

                            <View style={styles.newBadgesRow}>
                              <View style={styles.standardRewardPill}>
                                <Ionicons name="gift-outline" size={12} color="#92400E" />
                                <Text style={styles.standardRewardPillText} numberOfLines={1}>Rewards</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.standardFooterBar}>
                          <View style={styles.fullFooterPriceCol}>
                            <Text style={styles.footerFromLabel}>From</Text>
                            <Text style={styles.fullFooterPriceText}>RM{item.minPrice || 8}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.standardViewStoreBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              if (targetSlug) {
                                router.push(`/b/${targetSlug}` as any);
                              } else {
                                router.push({ pathname: '/(customer)/explore', params: { q: item.name } });
                              }
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.standardViewStoreText}>View Store</Text>
                            <Ionicons name="chevron-forward" size={14} color="#0F172A" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.emptyFavoritesBox}>
                  <Ionicons name="heart-outline" size={24} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emptyFavoritesTitle}>No Favorite Stores Yet</Text>
                    <Text style={styles.emptyFavoritesSub}>Tap the ❤️ icon on any store to save up to 5 favorites here for quick access!</Text>
                  </View>
                </View>
              )}
            </View>

            {/* 🎁 5. "YOUR NEXT REWARD" / LOYALTY CARD SECTION */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your next reward</Text>
                <TouchableOpacity onPress={() => router.push('/(customer)/my-cards')}>
                  <Text style={styles.sectionLink}>View all &gt;</Text>
                </TouchableOpacity>
              </View>

              {/* 💳 Actual Merchant Card Design (Using FlippableLoyaltyCard) */}
              <View style={styles.merchantCardContainer}>
                <FlippableLoyaltyCard
                  card={activeCard}
                  user={user}
                />
              </View>


            </View>

            {/* 📅 6. "UPCOMING BOOKING" SECTION */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming booking</Text>
                <TouchableOpacity onPress={() => router.push('/(customer)/explore')}>
                  <Text style={styles.sectionLink}>View all &gt;</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.bookingCard}
                onPress={() => setAppointmentPassModalVisible(true)}
                activeOpacity={0.88}
              >
                <Image
                  source={getBookingStoreImage()}
                  style={styles.bookingStoreImg}
                />
                <View style={styles.bookingMidCol}>
                  <Text style={styles.bookingShopName} numberOfLines={1}>
                    {upcomingBooking?.expand?.merchant?.name || 'Jerami Barbershop'}
                  </Text>
                  <Text style={styles.bookingServiceName} numberOfLines={1}>
                    {(() => {
                      let items = upcomingBooking?.items_summary;
                      if (typeof items === 'string') {
                        try { items = JSON.parse(items); } catch (e) { items = []; }
                      }
                      if (Array.isArray(items) && items.length > 0) {
                        return items.map((it: any) => it.name).join(', ');
                      }
                      return 'Haircut';
                    })()}
                  </Text>
                  <View style={styles.bookingMetaRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748B" />
                    <Text style={styles.bookingMetaText}>
                      {upcomingBooking ? `${formatUpcomingDate(upcomingBooking.booking_date)} • ${upcomingBooking.start_time}` : 'Tomorrow • 9:30 AM'}
                    </Text>
                  </View>
                  <View style={styles.bookingMetaRow}>
                    <Ionicons name="location-outline" size={13} color="#64748B" />
                    <Text style={styles.bookingMetaText} numberOfLines={1}>
                      {upcomingBooking?.expand?.branch?.name || 'Jerami Barbershop'}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingRightCol}>
                  <View style={styles.confirmedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.confirmedBadgeText}>Confirmed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>

            {/* 🌟 7. "POPULAR NEAR YOU" SECTION (Top 5 PRO & Nearest Merchants) */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Popular near you</Text>
                  <View style={styles.topBadgeTag}>
                    <Text style={styles.topBadgeTagText}>Top 5</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/(customer)/explore')}>
                  <Text style={styles.sectionLink}>See all &gt;</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularGridHorizontal}
                decelerationRate="fast"
                snapToInterval={212}
              >
                {(popularMerchants.length > 0 ? popularMerchants : [
                  {
                    id: 'demo-jerami',
                    name: 'Jerami Barbershop',
                    slug: 'jerami-barbershop',
                    category: 'Barber',
                    location: '1.2 km • Jitra',
                    rating: '4.9',
                    reviews: '142',
                    coverSource: require('@/assets/images/jerami_barbershop.jpg'),
                    isPro: true,
                    badgeText: 'PRO Merchant',
                    badgeIcon: 'ribbon',
                  },
                  {
                    id: 'demo-scoop',
                    name: 'Scoop Creamy',
                    slug: 'scoop-creamy',
                    category: 'Food & Drink',
                    location: '2.5 km • Jitra',
                    rating: '4.8',
                    reviews: '98',
                    coverSource: require('@/assets/images/scoop_creamy_storefront.jpg'),
                    isPro: true,
                    badgeText: 'PRO Merchant',
                    badgeIcon: 'ribbon',
                  }
                ]).map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.popularCardSlide}
                    onPress={() => item.slug ? router.push(`/b/${item.slug}` as any) : router.push('/(customer)/explore')}
                    activeOpacity={0.88}
                  >
                    <View style={styles.popularImgWrapSlide}>
                      <Image
                        source={item.coverUri ? { uri: item.coverUri } : item.coverSource}
                        style={styles.popularCardImg}
                      />
                      <TouchableOpacity style={styles.favoriteHeartBtn} activeOpacity={0.8}>
                        <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={[styles.popularBadgePill, item.isPro && styles.proBadgePill]}>
                        <Ionicons name={item.badgeIcon as any} size={11} color={item.isPro ? '#FFFFFF' : '#000000'} />
                        <Text style={[styles.popularBadgeText, item.isPro && styles.proBadgeText]}>
                          {item.badgeText}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.popularCardBody}>
                      <Text style={styles.popularCardTitle} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.popularRatingRow}>
                        <Ionicons name="star" size={12} color="#EAB308" />
                        <Text style={styles.popularRatingText}>{item.rating} ({item.reviews})</Text>
                        <Text style={styles.popularDot}>•</Text>
                        <Text style={styles.popularCategoryText} numberOfLines={1}>{item.category} • {item.location}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* QR Code Pop-up Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#1A1400', borderWidth: 1, borderColor: '#332900' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>Your RISEV Card</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, shadowColor: '#FFC700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 5 }]}>
               <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${user?.phone || 'risev-loyalty-customer'}`,
                }}
                style={[styles.qrCodeImage, { width: 200, height: 200 }]}
              />
            </View>

            <Text style={[styles.phoneLabel, { color: '#94A3B8', marginTop: 10 }]}>MEMBER ID</Text>
            <Text style={[styles.phoneValue, { color: '#FFC700', fontSize: 20, letterSpacing: 2, fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>{user?.phone || '+60 11-2345678'}</Text>
            <Text style={[styles.scanNotice, { color: '#64748B' }]}>
              Present this card to the store staff to collect stamps or redeem reward vouchers.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Appointment Pass Pop-up Modal */}
      <Modal
        visible={appointmentPassModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAppointmentPassModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            backgroundColor: '#FFFFFF', 
            maxWidth: 420, 
            padding: 22, 
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: '#FFE38F',
            shadowColor: '#FFC700',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 10,
          }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isBookingMissed ? '#FEE2E2' : (hasMarkedArrived ? '#DCFCE7' : '#FEF3C7'),
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                gap: 6
              }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isBookingMissed ? '#DC2626' : (hasMarkedArrived ? '#16A34A' : '#D97706')
                }} />
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: isBookingMissed ? '#DC2626' : (hasMarkedArrived ? '#15803D' : '#B45309')
                }}>
                  {isBookingMissed ? 'SLOT MISSED' : (hasMarkedArrived ? 'ARRIVAL CONFIRMED' : 'BOOKING CONFIRMED')}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setAppointmentPassModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', alignSelf: 'flex-start', marginBottom: 14 }}>
              Appointment Pass
            </Text>

            {/* Countdown / Status Box */}
            <View style={{
              backgroundColor: isBookingMissed ? '#FEF2F2' : '#FFFBEA',
              borderWidth: 1,
              borderColor: isBookingMissed ? '#FECACA' : '#FFE38F',
              borderRadius: 18,
              padding: 14,
              alignItems: 'center',
              width: '100%',
              marginBottom: 16,
              ...(Platform.OS === 'web' ? {
                boxShadow: isBookingMissed
                  ? 'inset 2px 2px 5px rgba(239, 68, 68, 0.1), inset -2px -2px 5px #ffffff'
                  : 'inset 2px 2px 5px rgba(185, 172, 154, 0.2), inset -2px -2px 5px #ffffff',
              } : {})
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: isBookingMissed ? '#DC2626' : '#806400' }}>
                {isBookingMissed ? 'Appointment Status:' : (hasMarkedArrived ? 'Arrival Status:' : 'Your appointment starts in:')}
              </Text>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: isBookingMissed ? '#DC2626' : '#1A1400', marginTop: 4 }}>
                {isBookingMissed ? 'Missed Appointment' : (hasMarkedArrived ? 'Checked In at Store' : (bookingCountdown || 'Starting Soon'))}
              </Text>
            </View>

            {/* Details Grid */}
            <View style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: '#F1F5F9',
              paddingVertical: 14,
              flexDirection: 'row',
              flexWrap: 'wrap',
              rowGap: 12,
              width: '100%',
              marginBottom: 16
            }}>
              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Service</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400', marginTop: 2 }}>
                  {(() => {
                    let items = upcomingBooking?.items_summary;
                    if (typeof items === 'string') {
                      try { items = JSON.parse(items); } catch (e) { items = []; }
                    }
                    if (Array.isArray(items) && items.length > 0) {
                      return items.map((it: any) => it.name).join(', ');
                    }
                    return 'Service Appointment';
                  })()}
                </Text>
              </View>

              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Provider</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400', marginTop: 2 }}>
                  {upcomingBooking?.expand?.staff?.name || 'Any Provider'}
                </Text>
              </View>

              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Slot Time</Text>
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: isBookingMissed ? '#64748B' : '#1A1400',
                  marginTop: 2,
                  textDecorationLine: isBookingMissed ? 'line-through' : 'none'
                }}>
                  {upcomingBooking?.booking_date} @ {upcomingBooking?.start_time}
                </Text>
              </View>

              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Branch</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400', marginTop: 2 }}>
                  {upcomingBooking?.expand?.branch?.name || (upcomingBooking?.expand?.merchant?.name ? `${upcomingBooking.expand.merchant.name} (HQ)` : 'Main Store')}
                </Text>
              </View>
            </View>

            {/* Bottom Actions */}
            {isBookingMissed ? (
              <View style={{ width: '100%', gap: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                  This slot has passed. Would you like to choose another time?
                </Text>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    backgroundColor: '#0F172A',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                  onPress={handleRescheduleBooking}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: '#FFFFFF'
                  }}>
                    Reschedule Appointment ➔
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleDismissMissedBooking}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    Dismiss This Pass
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginBottom: 12 }}>
                  Tap the button below as soon as you step inside the store:
                </Text>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    backgroundColor: hasMarkedArrived ? '#22C55E' : '#FFC700',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    shadowColor: hasMarkedArrived ? '#22C55E' : '#FFC700',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                  onPress={handleMarkArrived}
                  disabled={hasMarkedArrived || markingArrivedLoading}
                  activeOpacity={0.85}
                >
                  {markingArrivedLoading ? (
                    <ActivityIndicator color={hasMarkedArrived ? '#FFFFFF' : '#1A1400'} />
                  ) : (
                    <>
                      <Ionicons name="location" size={18} color={hasMarkedArrived ? '#FFFFFF' : '#1A1400'} />
                      <Text style={{
                        fontSize: 14,
                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                        color: hasMarkedArrived ? '#FFFFFF' : '#1A1400'
                      }}>
                        {hasMarkedArrived ? '✓ ARRIVAL CONFIRMED' : '📍 I HAVE ARRIVED'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
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
                <Text style={styles.detailModalTitle}>
                  {selectedCard.enable_stamps === false && selectedCard.enable_points === true
                    ? 'VIP Points Card Details'
                    : 'Stamp Card Details'}
                </Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#0b1c30" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {/* 3D Flippable Loyalty Card & Hint */}
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <View style={{ width: '100%', maxWidth: 360 }}>
                    <FlippableLoyaltyCard 
                      card={selectedCard} 
                      user={user} 
                      autoFlipDelay={500}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 6, opacity: 0.8 }}>
                    <Ionicons name="swap-horizontal" size={14} color="#6B7280" />
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#6B7280' }}>Tap card to flip</Text>
                  </View>
                </View>

                {/* Points & Tier Info Section (Hidden in Stamps-Only Mode) */}
                {selectedCard.enable_points !== false && (
                  <View style={styles.pointsTierCard}>
                    <View style={styles.pointsTierInfo}>
                      <Text style={styles.pointsTierTitle}>Points Balance</Text>
                      <Text style={styles.pointsTierValue}>{selectedCard.points} PTS</Text>
                    </View>
                    <View style={[styles.tierBadge, { backgroundColor: '#FFC700' }]}>
                      <Ionicons name="sparkles" size={13} color="#1A1400" />
                      <Text style={[styles.tierBadgeText, { color: '#1A1400' }]}>VIP MEMBER</Text>
                    </View>
                  </View>
                )}

                {/* Reward description card (Hidden in Points-Only Mode) */}
                {selectedCard.enable_stamps !== false && (
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
                )}

                {/* Points Catalog Section (Hidden in Stamps-Only Mode) */}
                {selectedCard.enable_points !== false && (
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
                )}
              </ScrollView>

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

      {/* Filter Bottom Sheet Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={activeFilters}
      />

      {/* All Categories Bottom Sheet Modal */}
      <AllCategoriesModal
        visible={allCategoriesModalVisible}
        onClose={() => setAllCategoriesModalVisible(false)}
        onSelectCategory={(catId) =>
          router.push({ pathname: '/(customer)/explore', params: { category: catId } })
        }
      />
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 20,
  },

  /* 📍 TOP HEADER ROW */
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  locationText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  headerRisevLogoImg: {
    width: 85,
    height: 28,
    resizeMode: 'contain',
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },

  /* 👋 GREETING */
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  greetingTextCol: {
    flex: 1,
    gap: 2,
  },
  greetingSub: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  greetingTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },

  /* 🔍 SEARCH BAR ROW WITH FILTER BUTTON */
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchPlaceholder: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    flex: 1,
  },
  searchPlaceholderActive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterIconBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },

  /* 🏷️ 3D NEUMORPHIC SOFT CLAY CATEGORY CHIPS */
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  neuClayCategoryBox: {
    width: 56,
    height: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowOffset: { width: 0, height: 5 },
  },
  categoryLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    textAlign: 'center',
  },
  categoryLabelSelected: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },

  /* 📦 SECTION GENERAL */
  sectionContainer: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },

  /* 💳 LOYALTY CARD */
  merchantCardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },

  /* 📅 UPCOMING BOOKING */
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  bookingStoreImg: {
    width: 68,
    height: 68,
    borderRadius: 14,
  },
  bookingMidCol: {
    flex: 1,
    gap: 3,
  },
  bookingShopName: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  bookingServiceName: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingMetaText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  bookingRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 66,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  confirmedBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },

  /* 🌟 POPULAR NEAR YOU */
  topBadgeTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  topBadgeTagText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },
  popularGridHorizontal: {
    paddingRight: 16,
    gap: 12,
  },
  popularCardSlide: {
    width: 205,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  popularImgWrapSlide: {
    position: 'relative',
    width: '100%',
    height: 115,
  },
  proBadgePill: {
    backgroundColor: '#0F172A',
  },
  proBadgeText: {
    color: '#FFD700',
  },
  popularGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  popularCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  popularImgWrap: {
    position: 'relative',
    width: '100%',
    height: 110,
  },
  popularCardImg: {
    width: '100%',
    height: 110,
    resizeMode: 'cover',
  },
  favoriteHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularBadgePill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FFC700',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  popularBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  popularCardBody: {
    padding: 10,
    gap: 3,
  },
  popularCardTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  popularRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  popularRatingText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  popularDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  popularCategoryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
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
  frontCardPillsRow: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cyclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cyclePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
  /* ❤️ Favorite Stores Section Styles */
  favCountBadge: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  favCountBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
  favoriteStoresScroll: {
    paddingRight: 16,
    gap: 12,
    paddingVertical: 8,
  },
  emptyFavoritesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  emptyFavoritesTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  emptyFavoritesSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },

  /* ──────── CARD LAYOUT STYLES FOR EXPLORE / FAVORITE CAROUSLE ──────── */
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
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
  proSleekBookCtaBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
    flexShrink: 0,
  },
  proSleekBookCtaText: {
    fontSize: 12,
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
  fullFooterPriceCol: {
    justifyContent: 'center',
    minWidth: 48,
  },
  fullFooterPriceText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  fullFooterDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  fullFooterSlotCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
    overflow: 'hidden',
  },
  fullFooterSlotText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  newCardTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
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
  footerFromLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  footerSlotLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
});
