import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import pb from '@/lib/pocketbase';

export interface CustomerBookingItem {
  id: string;
  merchantName: string;
  serviceName: string;
  dateTimeStr: string;
  locationStr: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  badgeLabel?: string;
  timeframeGroup: 'Tomorrow' | 'This week' | 'Later' | 'Completed' | 'Cancelled';
  imageSource: any;
  merchantId?: string;
  merchantSlug?: string;
  priceStr?: string;
  rawDate?: string;
  rawTime?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  bookingRef?: string;
}

function formatDateLabel(dateStr?: string): string {
  if (!dateStr) return 'Upcoming';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function CustomerBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [bookingsList, setBookingsList] = useState<CustomerBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail Ticket Pass Modal
  const [selectedPass, setSelectedPass] = useState<CustomerBookingItem | null>(null);
  const [passModalVisible, setPassModalVisible] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      let records: any[] = [];
      if (user?.id) {
        try {
          records = await pb.collection('service_bookings').getFullList({
            filter: `customer = "${user.id}"`,
            sort: '-booking_date,-start_time',
            expand: 'merchant,service',
            requestKey: null,
          });
        } catch (err) {}
      }

      if (records.length === 0) {
        records = await pb.collection('service_bookings').getFullList({
          sort: '-booking_date,-start_time',
          expand: 'merchant,service',
          requestKey: null,
        }).catch(() => []);
      }

      const mapped: CustomerBookingItem[] = records.map((b: any) => {
        const m = b.expand?.merchant || {};
        const s = b.expand?.service || {};

        // Dynamic Date Evaluator against midnight today (2026-10-10)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);

        let bDate = today;
        if (b.booking_date) {
          const parsed = new Date(b.booking_date);
          if (!isNaN(parsed.getTime())) {
            bDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
          }
        }

        const isPast = bDate.getTime() < today.getTime();
        const isToday = bDate.getTime() === today.getTime();
        const isTomorrow = bDate.getTime() === tomorrow.getTime();
        const isThisWeek = bDate.getTime() > tomorrow.getTime() && bDate.getTime() <= endOfWeek.getTime();

        let status: CustomerBookingItem['status'] = 'confirmed';
        let timeframeGroup: CustomerBookingItem['timeframeGroup'] = 'This week';
        let badgeLabel = 'Confirmed';

        if (b.status === 'completed') {
          status = 'completed';
          timeframeGroup = 'Completed';
          badgeLabel = 'Completed';
        } else if (b.status === 'cancelled' || b.status === 'no_show' || isPast) {
          status = 'cancelled';
          timeframeGroup = 'Cancelled';
          badgeLabel = isPast && b.status !== 'cancelled' ? 'Missed' : 'Cancelled';
        } else {
          status = b.status === 'pending' ? 'pending' : 'confirmed';
          if (isToday) timeframeGroup = 'Tomorrow'; // Today or Tomorrow upcoming group
          else if (isTomorrow) timeframeGroup = 'Tomorrow';
          else if (isThisWeek) timeframeGroup = 'This week';
          else timeframeGroup = 'Later';
          badgeLabel = status === 'pending' ? 'Pending' : 'Confirmed';
        }

        // Service Title resolution
        let serviceTitle = s.title || s.name || b.service_title || '';
        let items = b.items_summary;
        if (typeof items === 'string') {
          try { items = JSON.parse(items); } catch (e) {}
        }
        if (Array.isArray(items) && items.length > 0) {
          serviceTitle = items.map((i: any) => i.name).filter(Boolean).join(', ');
        }
        if (!serviceTitle) serviceTitle = 'Service Appointment';

        // Image resolution
        let imgSource: any = { uri: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600' };
        if (m.banner && typeof m.banner === 'string' && m.banner.trim().length > 0) {
          imgSource = { uri: `${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}` };
        } else if (m.logo && typeof m.logo === 'string' && m.logo.trim().length > 0) {
          imgSource = { uri: `${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}` };
        } else if (m.background_image && typeof m.background_image === 'string' && m.background_image.trim().length > 0) {
          imgSource = { uri: `${pb.baseUrl}/api/files/merchants/${m.id}/${m.background_image}` };
        } else if (m.name?.toLowerCase().includes('scoop')) {
          imgSource = require('@/assets/images/scoop_creamy_storefront.jpg');
        } else if (m.name?.toLowerCase().includes('jerami')) {
          imgSource = require('@/assets/images/jerami_barbershop.jpg');
        } else if (m.name?.toLowerCase().includes('risev')) {
          imgSource = require('@/assets/images/banner_pro_plan.png');
        }

        const formattedDate = formatDateLabel(b.booking_date);
        const priceVal = b.total_price || s.price || 30;

        return {
          id: b.id,
          merchantName: m.name || m.store_name || 'Risev Partner Merchant',
          serviceName: serviceTitle,
          dateTimeStr: `${formattedDate} • ${b.start_time || '09:00 AM'}`,
          locationStr: m.name || m.store_name || 'Risev Store',
          status,
          badgeLabel,
          timeframeGroup,
          imageSource: imgSource,
          merchantId: m.id,
          merchantSlug: m.pwa_slug || m.slug || m.id,
          priceStr: `RM ${priceVal}`,
          rawDate: b.booking_date,
          rawTime: b.start_time,
          address: m.description || m.address || `${m.city || 'Jitra'}, Kedah`,
          latitude: m.latitude ? parseFloat(String(m.latitude)) : undefined,
          longitude: m.longitude ? parseFloat(String(m.longitude)) : undefined,
          notes: b.notes || '',
          bookingRef: `REV-${b.id.substring(0, 6).toUpperCase()}`,
        };
      });

      setBookingsList(mapped);
    } catch (err) {
      console.warn('Failed to fetch real bookings:', err);
      setBookingsList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Open Maps Navigation
  const handleOpenDirections = (item: CustomerBookingItem) => {
    const query = item.latitude && item.longitude
      ? `${item.latitude},${item.longitude}`
      : encodeURIComponent(item.address || item.merchantName);
    
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    
    Linking.openURL(url).catch((err) => {
      console.warn('Could not open map URL:', err);
    });
  };

  // Open Pass Ticket Modal
  const handleOpenPass = (item: CustomerBookingItem) => {
    setSelectedPass(item);
    setPassModalVisible(true);
  };

  // Filter bookings according to active tab
  const filteredBookings = bookingsList.filter((b) => {
    if (activeTab === 'upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (activeTab === 'completed') return b.status === 'completed';
    if (activeTab === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  // Calculate dynamic tab counts
  const upcomingCount = bookingsList.filter((b) => b.status === 'confirmed' || b.status === 'pending').length;
  const completedCount = bookingsList.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookingsList.filter((b) => b.status === 'cancelled').length;

  // Group items by timeframe for upcoming tab
  const groupedUpcoming: { [groupKey: string]: CustomerBookingItem[] } = {};
  if (activeTab === 'upcoming') {
    filteredBookings.forEach((b) => {
      const group = b.timeframeGroup || 'Later';
      if (!groupedUpcoming[group]) groupedUpcoming[group] = [];
      groupedUpcoming[group].push(b);
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── HEADER ─── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Bookings</Text>
          <Text style={styles.headerSubtitle}>All your appointments in one place.</Text>
        </View>
      </View>

      {/* ─── FILTER SEGMENT TABS ─── */}
      <View style={styles.tabsStripContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsStrip}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'upcoming' && styles.tabPillActive]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabPillText, activeTab === 'upcoming' && styles.tabPillTextActive]}>
              Upcoming ({upcomingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'completed' && styles.tabPillActive]}
            onPress={() => setActiveTab('completed')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabPillText, activeTab === 'completed' && styles.tabPillTextActive]}>
              Completed ({completedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'cancelled' && styles.tabPillActive]}
            onPress={() => setActiveTab('cancelled')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabPillText, activeTab === 'cancelled' && styles.tabPillTextActive]}>
              Cancelled ({cancelledCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ─── MAIN BOOKING LIST ─── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F59E0B']} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyStateTitle}>No {activeTab} bookings</Text>
            <Text style={styles.emptyStateSub}>
              {activeTab === 'upcoming'
                ? 'You currently have no scheduled appointments. Explore top merchants to book your next visit!'
                : `No ${activeTab} appointments found in your account history.`}
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity style={styles.exploreCtaBtn} onPress={() => router.push('/(customer)/explore')}>
                <Text style={styles.exploreCtaText}>Explore Stores & Book</Text>
                <Ionicons name="chevron-forward" size={16} color="#0F172A" />
              </TouchableOpacity>
            )}
          </View>
        ) : activeTab === 'upcoming' ? (
          /* Render grouped upcoming bookings */
          Object.keys(groupedUpcoming).map((groupTitle) => {
            const items = groupedUpcoming[groupTitle];
            return (
              <View key={groupTitle} style={styles.groupSection}>
                {/* Timeframe Group Header */}
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupTitleText}>{groupTitle}</Text>
                  <Text style={styles.groupCountText}>
                    {items.length} {items.length === 1 ? 'booking' : 'bookings'}
                  </Text>
                </View>

                {/* Cards in group */}
                {items.map((item) => renderBookingCard(item, handleOpenPass, handleOpenDirections, router))}
              </View>
            );
          })
        ) : (
          /* Flat list for Completed / Cancelled */
          <View style={styles.groupSection}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.groupTitleText}>
                {activeTab === 'completed' ? 'Past Appointments' : 'Cancelled History'}
              </Text>
              <Text style={styles.groupCountText}>
                {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}
              </Text>
            </View>
            {filteredBookings.map((item) => renderBookingCard(item, handleOpenPass, handleOpenDirections, router))}
          </View>
        )}
      </ScrollView>

      {/* ─── TICKET / PASS DETAIL MODAL ─── */}
      <Modal visible={passModalVisible} transparent animationType="slide" onRequestClose={() => setPassModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passModalContent}>
            {/* Top Close Row */}
            <View style={styles.modalHeaderRow}>
              <View style={[
                styles.modalStatusPill,
                { backgroundColor: selectedPass?.status === 'confirmed' ? '#DCFCE7' : (selectedPass?.status === 'completed' ? '#E0F2FE' : '#FEE2E2') }
              ]}>
                <Ionicons
                  name={selectedPass?.status === 'confirmed' ? 'checkmark-circle' : (selectedPass?.status === 'completed' ? 'checkbox' : 'close-circle')}
                  size={14}
                  color={selectedPass?.status === 'confirmed' ? '#16A34A' : (selectedPass?.status === 'completed' ? '#0284C7' : '#DC2626')}
                />
                <Text style={[
                  styles.modalStatusText,
                  { color: selectedPass?.status === 'confirmed' ? '#15803D' : (selectedPass?.status === 'completed' ? '#0369A1' : '#B91C1C') }
                ]}>
                  {selectedPass?.status?.toUpperCase() || 'CONFIRMED'}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setPassModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.passModalTitle}>Appointment Ticket</Text>

            {/* QR / Barcode Card Showcase */}
            <View style={styles.qrCardBox}>
              <View style={styles.qrCodeIconWrap}>
                <Ionicons name="qr-code-outline" size={76} color="#0F172A" />
              </View>
              <Text style={styles.qrRefText}>REF: {selectedPass?.bookingRef || 'REV-98214'}</Text>
              <Text style={styles.qrInstruction}>Show this pass upon arrival at merchant counter</Text>
            </View>

            {/* Merchant & Service Summary */}
            <View style={styles.passDetailGrid}>
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Merchant</Text>
                <Text style={styles.passDetailValue}>{selectedPass?.merchantName}</Text>
              </View>
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Service</Text>
                <Text style={styles.passDetailValue}>{selectedPass?.serviceName}</Text>
              </View>
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Date & Time</Text>
                <Text style={styles.passDetailValue}>{selectedPass?.dateTimeStr}</Text>
              </View>
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Location</Text>
                <Text style={styles.passDetailValue}>{selectedPass?.address || selectedPass?.locationStr}</Text>
              </View>
              <View style={[styles.passDetailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.passDetailLabel}>Total Price</Text>
                <Text style={[styles.passDetailValue, { color: '#0F172A', fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                  {selectedPass?.priceStr || 'RM 25'}
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.passModalActionsRow}>
              <TouchableOpacity
                style={styles.modalActionSecondaryBtn}
                onPress={() => {
                  if (selectedPass) handleOpenDirections(selectedPass);
                }}
              >
                <Ionicons name="navigate-outline" size={16} color="#0F172A" />
                <Text style={styles.modalActionSecondaryText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionPrimaryBtn}
                onPress={() => {
                  setPassModalVisible(false);
                  if (selectedPass?.merchantSlug) {
                    router.push(`/b/${selectedPass.merchantSlug}`);
                  }
                }}
              >
                <Text style={styles.modalActionPrimaryText}>Visit Merchant Page</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── RENDER SINGLE APPOINTMENT CARD (Matching Image 2 Mockup) ───
function renderBookingCard(
  item: CustomerBookingItem,
  onOpenPass: (item: CustomerBookingItem) => void,
  onOpenDirections: (item: CustomerBookingItem) => void,
  router: any
) {
  const isConfirmed = item.status === 'confirmed';
  const isCompleted = item.status === 'completed';
  const isCancelled = item.status === 'cancelled';

  return (
    <View key={item.id} style={styles.bookingCardCardContainer}>
      {/* Main Touch Area (Card Body) */}
      <TouchableOpacity
        style={styles.cardMainTouch}
        onPress={() => onOpenPass(item)}
        activeOpacity={0.88}
      >
        <View style={styles.cardContentRow}>
          {/* Store Image Thumbnail */}
          <Image source={item.imageSource} style={styles.storeThumbnailImg} resizeMode="cover" />

          {/* Center Info */}
          <View style={styles.cardMidCol}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.merchantNameText} numberOfLines={1}>
                {item.merchantName}
              </Text>

              {/* Status Badge Pill */}
              <View
                style={[
                  styles.statusBadgePill,
                  isConfirmed && styles.statusBadgeConfirmed,
                  isCompleted && styles.statusBadgeCompleted,
                  isCancelled && styles.statusBadgeCancelled,
                ]}
              >
                <Ionicons
                  name={isConfirmed ? 'checkmark-circle' : (isCompleted ? 'checkmark-done-circle' : 'close-circle')}
                  size={12}
                  color={isConfirmed ? '#16A34A' : (isCompleted ? '#0284C7' : '#DC2626')}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    isConfirmed && styles.statusBadgeTextConfirmed,
                    isCompleted && styles.statusBadgeTextCompleted,
                    isCancelled && styles.statusBadgeTextCancelled,
                  ]}
                >
                  {item.badgeLabel || (isConfirmed ? 'Confirmed' : (isCompleted ? 'Completed' : 'Cancelled'))}
                </Text>
              </View>
            </View>

            {/* Service Name */}
            <Text style={styles.serviceNameText} numberOfLines={1}>
              {item.serviceName}
            </Text>

            {/* Date & Time */}
            <View style={styles.metaInfoRow}>
              <Ionicons name="calendar-outline" size={13.5} color="#64748B" />
              <Text style={styles.metaInfoText} numberOfLines={1}>
                {item.dateTimeStr}
              </Text>
            </View>

            {/* Location */}
            <View style={styles.metaInfoRow}>
              <Ionicons name="location-outline" size={13.5} color="#64748B" />
              <Text style={styles.metaInfoText} numberOfLines={1}>
                {item.locationStr}
              </Text>
            </View>
          </View>

          {/* Right Chevron */}
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Dual Action Buttons Row (View booking & Directions) */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.actionSubtleBtn}
          onPress={() => onOpenPass(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={15} color="#0F172A" />
          <Text style={styles.actionSubtleBtnText}>View booking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionSubtleBtn}
          onPress={() => onOpenDirections(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate-outline" size={15} color="#0F172A" />
          <Text style={styles.actionSubtleBtnText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  /* ─── HEADER ─── */
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  /* ─── TAB STRIP ─── */
  tabsStripContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginTop: 6,
  },
  tabsStrip: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
  },
  tabPillActive: {
    backgroundColor: '#0F172A',
  },
  tabPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },

  /* ─── MAIN LIST CONTENT ─── */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  groupTitleText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  groupCountText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },

  /* ─── BOOKING CARD ─── */
  bookingCardCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardMainTouch: {
    marginBottom: 12,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeThumbnailImg: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  cardMidCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  merchantNameText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    flex: 1,
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeCompleted: {
    backgroundColor: '#E0F2FE',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  statusBadgeTextConfirmed: {
    color: '#15803D',
  },
  statusBadgeTextCompleted: {
    color: '#0369A1',
  },
  statusBadgeTextCancelled: {
    color: '#B91C1C',
  },
  serviceNameText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 4,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaInfoText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    flex: 1,
  },
  chevronWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ─── DUAL ACTION BUTTONS ROW ─── */
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  actionSubtleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSubtleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  /* ─── EMPTY STATE ─── */
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
    marginBottom: 20,
  },
  exploreCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  exploreCtaText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 12,
  },

  /* ─── PASS TICKET MODAL ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  passModalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFE38F',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  modalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  modalStatusText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passModalTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  qrCardBox: {
    width: '100%',
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FFE38F',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrCodeIconWrap: {
    marginBottom: 8,
  },
  qrRefText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 1,
  },
  qrInstruction: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#854D0E',
    marginTop: 4,
  },
  passDetailGrid: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  passDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  passDetailLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  passDetailValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    textAlign: 'right',
    maxWidth: 200,
  },
  passModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalActionSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalActionSecondaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  modalActionPrimaryBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionPrimaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
});
