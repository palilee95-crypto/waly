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

const { width } = Dimensions.get('window');

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
      const fullFilter = `${userFilter} && (status = 'booked' || status = 'arrived') && booking_date >= '${todayIso}'`;

      const res = await pb.collection('service_bookings').getList(1, 1, {
        filter: fullFilter,
        sort: 'booking_date,start_time',
        expand: 'merchant,branch,staff',
        requestKey: null
      });

      if (res.items.length > 0) {
        const item = res.items[0];
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

  useEffect(() => {
    if (!upcomingBooking) {
      setBookingCountdown('');
      return;
    }

    const updateCountdown = () => {
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
        if (pastMins < 60) {
          setBookingCountdown('Happening Now');
        } else {
          setBookingCountdown('Ongoing');
        }
        return;
      }

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

  // Refresh pinned cards & upcoming bookings whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
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
    if (hour < 12) return 'Good morning! 👋';
    if (hour < 18) return 'Good afternoon! 👋';
    return 'Good evening! 👋';
  };

  const highestCard = loyaltyCards.length > 0 ? loyaltyCards.reduce((prev, current) => (prev.collectedStamps > current.collectedStamps) ? prev : current) : null;
  const currentStamps = highestCard ? highestCard.collectedStamps : 0;
  const maxStamps = highestCard ? highestCard.totalStamps : 10;
  const progressArray = Array.from({ length: 10 }, (_, i) => i < Math.round((currentStamps / maxStamps) * 10));

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Main Content Wrapper for white center on dark background */}
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', maxWidth: 800, alignSelf: 'center', width: '100%' }}>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Group container to bypass scrollContent gap: 20 and join cards */}
          <View>
            {/* 🌟 SUPERCARD V2 🌟 */}
            <View style={{ borderRadius: 32, padding: 24, paddingBottom: 24, gap: 24, shadowColor: '#FFC700', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 6, marginBottom: 8 }}>
            
            {/* Absolute Folder Tab Background Layer */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 32 }}>
              {/* Base Yellow */}
              <View style={{ flex: 1, backgroundColor: '#FFC700' }} />
              
              {/* 1. Main White Cutout (lowered right area) */}
              <View style={{ position: 'absolute', top: -5, right: -5, width: 150, height: 80, backgroundColor: '#FFFFFF' }} />
              
              {/* 2. Top White Filler (fills the area above the Bottom Curve) */}
              <View style={{ position: 'absolute', top: -5, right: 145, width: 40, height: 40, backgroundColor: '#FFFFFF' }} />
              
              {/* 3. Bottom Curve (Convex part) */}
              <View style={{ position: 'absolute', top: 35, right: 145, width: 40, height: 40, backgroundColor: '#FFC700' }}>
                <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderBottomLeftRadius: 40 }} />
              </View>
              
              {/* 4. Top Curve (Concave part) */}
              <View style={{ position: 'absolute', top: -5, right: 185, width: 40, height: 40, backgroundColor: '#FFFFFF' }}>
                <View style={{ flex: 1, backgroundColor: '#FFC700', borderTopRightRadius: 40 }} />
              </View>

              {/* 5. Outer Corner Curve (Rounds the top-right of the lowered yellow part OUTWARDS/CONVEX) */}
              <View style={{ position: 'absolute', top: 75, right: -5, width: 32, height: 32, backgroundColor: '#FFFFFF' }}>
                <View style={{ flex: 1, backgroundColor: '#FFC700', borderTopRightRadius: 32 }} />
              </View>
            </View>

            {/* Header Content */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
              <View>
                <View style={{ 
                  shadowColor: '#B38B00', 
                  shadowOffset: { width: 3, height: 6 }, 
                  shadowOpacity: 0.25, 
                  shadowRadius: 10, 
                  elevation: 5,
                  alignSelf: 'flex-start',
                  marginBottom: 16,
                  borderRadius: 34,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  ...(Platform.OS === 'web' ? { boxShadow: '4px 6px 14px rgba(179, 139, 0, 0.35), -3px -3px 8px #ffffff' } : {})
                }}>
                  <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                </View>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1A1400', marginBottom: 2 }}>{getGreeting()} 🖐</Text>
                <Text style={{ fontSize: 32, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', lineHeight: 36, letterSpacing: -1 }}>
                  Welcome back,{'\n'}{user?.name ? user.name.split(' ')[0] : 'Fazli'}
                </Text>
              </View>

              <View style={{ position: 'absolute', top: -2, right: 10, width: 125, alignItems: 'center' }}>
                <Image source={require('../../assets/risev logo.png')} style={{ width: 125, height: 42, resizeMode: 'contain' }} />
              </View>
            </View>

            {/* Unified Clean Full-Width Reward Card (No Outer Glow) */}
            <View style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: 24, 
              padding: 18, 
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.08)',
              shadowColor: '#000000', 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: 0.06, 
              shadowRadius: 10, 
              elevation: 2,
              ...(Platform.OS === 'web' ? { boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)' } : {})
            }}>
              {/* Header Row: Title & Total Stamps Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  {highestCard?.logo ? (
                    <Image 
                      source={{ uri: highestCard.logo }} 
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: '#FFF5D6', 
                        flexShrink: 0,
                        borderWidth: 1,
                        borderColor: '#FFE38F',
                        shadowColor: 'rgba(0,0,0,0.1)',
                        shadowOffset: { width: 2, height: 3 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4
                      }} 
                    />
                  ) : (
                    <View style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 20, 
                      backgroundColor: '#FFE38F', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      shadowColor: '#B38B00',
                      shadowOffset: { width: 2, height: 3 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4
                    }}>
                      <Ionicons name="gift-outline" size={20} color="#806400" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400' }} numberOfLines={1}>
                      {highestCard ? highestCard.merchantName : 'Next Reward'}
                    </Text>
                    {highestCard ? (
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400', marginTop: 1 }} numberOfLines={1}>
                        {highestCard.rewardName}
                      </Text>
                    ) : null}
                  </View>
                </View>
                
                {/* Neumorphic Inset Total Stamps Badge */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: '#1A1400', 
                  paddingHorizontal: 12, 
                  paddingVertical: 7, 
                  borderRadius: 14, 
                  gap: 6,
                  borderWidth: 1,
                  borderColor: '#332700',
                  shadowColor: '#000000',
                  shadowOffset: { width: 2, height: 4 },
                  shadowOpacity: 0.35,
                  elevation: 4,
                  ...(Platform.OS === 'web' ? { boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.6), 3px 3px 8px rgba(0,0,0,0.15)' } : {})
                }}>
                  <Ionicons name="star" size={13} color="#FFC700" />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                    Total: {loyaltyCards.reduce((acc, curr) => acc + curr.collectedStamps, 0)}
                  </Text>
                </View>
              </View>
              
              {/* Recessed Neumorphic Progress Bar Track */}
              <View style={{ 
                flexDirection: 'row', 
                gap: 5, 
                marginBottom: 16,
                padding: 4,
                backgroundColor: '#FFF8E6',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(185, 172, 154, 0.25)',
                ...(Platform.OS === 'web' ? { boxShadow: 'inset 2px 2px 5px rgba(185, 172, 154, 0.3), inset -2px -2px 5px #ffffff' } : {})
              }}>
                {progressArray.map((isFilled, index) => (
                  <View 
                    key={index} 
                    style={{ 
                      flex: 1, 
                      height: 10, 
                      borderRadius: 5, 
                      backgroundColor: isFilled ? '#FFC700' : 'rgba(255, 227, 143, 0.35)',
                      shadowColor: isFilled ? '#FFC700' : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      ...(Platform.OS === 'web' ? {
                        boxShadow: isFilled 
                          ? '2px 2px 6px rgba(255, 199, 0, 0.45), inset -1px -1px 2px rgba(0,0,0,0.1)' 
                          : 'inset 1px 1px 3px rgba(185, 172, 154, 0.2)'
                      } : {})
                    }} 
                  />
                ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', letterSpacing: -0.5 }}>
                    {currentStamps} / {maxStamps} Stamps
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#806400', marginTop: 2 }}>
                    {maxStamps - currentStamps > 0 ? `${maxStamps - currentStamps} more to unlock reward` : 'Reward unlocked!'}
                  </Text>
                </View>

                {/* Integrated Neumorphic View Card Button */}
                <TouchableOpacity 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#FFFBEA', 
                    paddingHorizontal: 16, 
                    paddingVertical: 10, 
                    borderRadius: 16, 
                    borderWidth: 1, 
                    borderColor: '#FFE38F',
                    shadowColor: 'rgba(185, 172, 154, 0.35)',
                    shadowOffset: { width: 3, height: 5 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 3,
                    ...(Platform.OS === 'web' ? { boxShadow: '4px 4px 10px rgba(185, 172, 154, 0.25), -3px -3px 8px #ffffff' } : {})
                  }}
                  onPress={() => {
                    if (highestCard) {
                      setSelectedCard(highestCard);
                      setDetailModalVisible(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="card-outline" size={16} color="#806400" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#806400' }}>View Card</Text>
                </TouchableOpacity>
              </View>

              {/* ⚡ QUICK ACTIONS ROW (NEUMORPHIC DUAL BUTTONS) ⚡ */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                {/* My QR Button */}
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: '#1A1400', 
                    borderRadius: 16, 
                    paddingVertical: 13, 
                    gap: 8,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)' } : {})
                  }}
                  onPress={() => setQrModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#FFC700" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700' }}>My QR</Text>
                </TouchableOpacity>

                {/* My Vouchers Button */}
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: '#111111', 
                    borderRadius: 16, 
                    paddingVertical: 13, 
                    gap: 8,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)' } : {})
                  }}
                  onPress={() => router.push('/(customer)/vouchers')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="ticket-outline" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>My Voucher</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 🎟️ UPCOMING APPOINTMENT TICKET STUB (Follows Merchant Set Brand Accent Color) */}
          {upcomingBooking && (() => {
            const merchantAccentColor =
              upcomingBooking.expand?.merchant?.pwa_brand_color ||
              upcomingBooking.expand?.merchant?.brand_color ||
              upcomingBooking.expand?.merchant?.theme_color ||
              '#FFC700';

            const isTicketCardLight = getContrastColor(merchantAccentColor) === '#000000';
            const ticketPrimaryTextColor = isTicketCardLight ? '#0F172A' : '#FFFFFF';
            const ticketSecondaryTextColor = isTicketCardLight ? '#475569' : 'rgba(255, 255, 255, 0.85)';
            const ticketPodBgColor = isTicketCardLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(0, 0, 0, 0.18)';
            const ticketPodBorderColor = isTicketCardLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.3)';
            const ticketBtnBgColor = isTicketCardLight ? '#0F172A' : '#FFFFFF';
            const ticketBtnTextColor = isTicketCardLight ? '#FFFFFF' : '#000000';
            const ticketDashedLineColor = isTicketCardLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.35)';

            return (
              <TouchableOpacity
                style={{
                  backgroundColor: merchantAccentColor,
                  borderColor: isTicketCardLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.35)',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 16,
                  position: 'relative',
                  overflow: 'hidden',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  ...(Platform.OS === 'web' ? {
                    boxShadow: isTicketCardLight
                      ? '4px 6px 14px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                      : '4px 6px 14px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  } : {
                    shadowColor: '#000000',
                    shadowOffset: { width: 3, height: 5 },
                    shadowOpacity: isTicketCardLight ? 0.1 : 0.25,
                    shadowRadius: 7,
                    elevation: 5,
                  }),
                }}
                onPress={() => setAppointmentPassModalVisible(true)}
                activeOpacity={0.88}
              >
                {/* Left Notch Cutout */}
                <View style={{
                  position: 'absolute',
                  left: -10,
                  top: '50%',
                  marginTop: -10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#F8FAF5',
                  borderWidth: 0,
                  zIndex: 5,
                }} />
                {/* Right Notch Cutout */}
                <View style={{
                  position: 'absolute',
                  right: -10,
                  top: '50%',
                  marginTop: -10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#F8FAF5',
                  borderWidth: 0,
                  zIndex: 5,
                }} />

                {/* Left Main Information Column */}
                <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* 3D Inset Recessed Calendar Icon Container */}
                  <View style={{
                    position: 'relative',
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: ticketPodBgColor,
                    borderColor: ticketPodBorderColor,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(Platform.OS === 'web' ? {
                      boxShadow: isTicketCardLight
                        ? 'inset 2px 2px 5px rgba(0, 0, 0, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.8)'
                        : 'inset 2px 2px 5px rgba(0, 0, 0, 0.25), inset -2px -2px 5px rgba(255, 255, 255, 0.2)',
                    } : {}),
                  }}>
                    <Ionicons name="calendar-outline" size={22} color={ticketPrimaryTextColor} />
                    <View style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: '#10B981',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: '#FFFFFF',
                    }}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  </View>

                  {/* Text Details */}
                  <View style={{ flex: 1, paddingRight: 4 }}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: ticketSecondaryTextColor, letterSpacing: 0.5, marginBottom: 2 }}>
                      UPCOMING APPOINTMENT
                    </Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: ticketPrimaryTextColor, lineHeight: 18 }} numberOfLines={1}>
                      {formatUpcomingDate(upcomingBooking.booking_date)}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: ticketPrimaryTextColor, lineHeight: 16 }} numberOfLines={1}>
                      {upcomingBooking.start_time || '11:30 AM'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                      <Ionicons name="location" size={12} color={ticketSecondaryTextColor} />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: ticketSecondaryTextColor }} numberOfLines={1}>
                        {upcomingBooking.expand?.branch?.name || (upcomingBooking.expand?.merchant?.name ? `${upcomingBooking.expand.merchant.name} (HQ)` : 'Risev Official Merchant (HQ)')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Perforated Vertical Dotted Tear Line */}
                <View style={{
                  width: 1,
                  height: 54,
                  borderStyle: 'dashed',
                  borderLeftWidth: 1.5,
                  borderColor: ticketDashedLineColor,
                  marginHorizontal: 10,
                }} />

                {/* Right Action Stub */}
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <View style={{
                    backgroundColor: ticketPodBgColor,
                    borderColor: ticketPodBorderColor,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    ...(Platform.OS === 'web' ? {
                      boxShadow: isTicketCardLight
                        ? 'inset 2px 2px 4px rgba(0, 0, 0, 0.08), inset -2px -2px 4px rgba(255, 255, 255, 0.8)'
                        : 'inset 2px 2px 4px rgba(0, 0, 0, 0.2), inset -2px -2px 4px rgba(255, 255, 255, 0.15)',
                    } : {}),
                  }}>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: ticketPrimaryTextColor, letterSpacing: 0.5 }}>
                      BOOKING PASS
                    </Text>
                  </View>

                  <View style={{
                    backgroundColor: ticketBtnBgColor,
                    borderColor: isTicketCardLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 1,
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    gap: 4,
                    ...(Platform.OS === 'web' ? {
                      boxShadow: isTicketCardLight
                        ? '3px 3px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : '3px 3px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                    } : {
                      shadowColor: '#000000',
                      shadowOffset: { width: 2, height: 3 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }),
                  }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: ticketBtnTextColor }}>View Pass</Text>
                    <Ionicons name="chevron-forward" size={14} color={ticketBtnTextColor} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}


        </View>

        {/* My Stamp Cards Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('my_stamp_cards')}</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/explore')}>
              <Text style={styles.viewAllText}>{t('add_card')}</Text>
            </TouchableOpacity>
          </View>

          {/* Overlapping Wallet Card Stack Layout */}
          <View style={styles.walletStackContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
            ) : loyaltyCards.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="card-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>{t('no_active_cards')}</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {t('no_active_cards_desc')}
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateBtn} 
                  onPress={() => router.push('/(customer)/explore')}
                >
                  <Text style={styles.emptyStateBtnText}>{t('discover_shops')}</Text>
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
                        backgroundColor: (item.gradientColors ?? ['#EC4899', '#8B5CF6'])[0],
                        zIndex: currentZIndex,
                        marginTop: idx === 0 ? 0 : -145,
                        transform: [
                          { translateY: translateY as any },
                          { scale: scale as any },
                        ],
                        overflow: 'hidden',
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
                      {item.cardBackground ? (
                        <Image source={{ uri: item.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : null}


                      <View style={styles.stackedCardContent}>
                        {/* Subtle metallic sheen */}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
                        <View style={{ position: 'absolute', top: -300, left: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '40deg' }], zIndex: 1, pointerEvents: 'none' }} />
                        
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
                              <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: 'rgba(255,255,255,0.75)' }, item.fontColor && { color: item.fontColor, opacity: 0.75 }]}>POINTS</Text>
                            </View>
                          ) : (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }, item.fontColor && { color: item.fontColor }]}>
                                {item.collectedStamps}/{item.totalStamps}
                              </Text>
                              <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.75)' }, item.fontColor && { color: item.fontColor, opacity: 0.75 }]}>STAMPS</Text>
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

                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            )}
          </View>

          {/* Card Stack Action Row */}
          {!loading && loyaltyCards.length > 0 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              marginTop: 12,
              marginBottom: 16,
              width: '100%',
              paddingHorizontal: 16
            }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                  borderRadius: 20,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 1
                }}
                onPress={() => router.push('/(customer)/my-cards')}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={14} color="#000000" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold' }}>
                  {locale === 'en' ? 'View All Cards' : 'Lihat Semua Kad'}
                </Text>
              </TouchableOpacity>

              {loyaltyCards.length > 1 && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFC700',
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 2
                  }}
                  onPress={cycleCard}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#1A1400" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, color: '#1A1400', fontFamily: 'PlusJakartaSans_700Bold' }}>
                    {locale === 'en' ? 'Next Card' : 'Kad Seterusnya'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
                backgroundColor: hasMarkedArrived ? '#DCFCE7' : '#FEF3C7',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                gap: 6
              }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hasMarkedArrived ? '#16A34A' : '#D97706' }} />
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: hasMarkedArrived ? '#15803D' : '#B45309' }}>
                  {hasMarkedArrived ? 'ARRIVAL CONFIRMED' : 'BOOKING CONFIRMED'}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setAppointmentPassModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', alignSelf: 'flex-start', marginBottom: 14 }}>
              Appointment Pass
            </Text>

            {/* Countdown Box */}
            <View style={{
              backgroundColor: '#FFFBEA',
              borderWidth: 1,
              borderColor: '#FFE38F',
              borderRadius: 18,
              padding: 14,
              alignItems: 'center',
              width: '100%',
              marginBottom: 16,
              ...(Platform.OS === 'web' ? {
                boxShadow: 'inset 2px 2px 5px rgba(185, 172, 154, 0.2), inset -2px -2px 5px #ffffff',
              } : {})
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400' }}>
                {hasMarkedArrived ? 'Arrival Status:' : 'Your appointment starts in:'}
              </Text>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1400', marginTop: 4 }}>
                {hasMarkedArrived ? 'Checked In at Store' : (bookingCountdown || 'Starting Soon')}
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
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400', marginTop: 2 }}>
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

            {/* Arrived Action */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#243339', // Dark slate background for margins
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
    paddingHorizontal: 12,
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
    backgroundColor: '#FFFBEA', // primary[50]
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFE38F', // primary[200]
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    aspectRatio: 1.586,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  stackedCardContent: {
    flex: 1,
    padding: 20,
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
});
