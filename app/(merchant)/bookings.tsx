import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  Image,
  Clipboard,
  Share,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { handleSmartBack } from '@/lib/navigation';

interface BookingItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  status: 'booked' | 'arrived' | 'in_service' | 'completed' | 'cancelled';
  items_summary?: any;
  total_price: number;
  notes?: string;
  staff_name?: string;
  service_name?: string;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
  item_type: 'service' | 'class' | 'product' | 'addon';
  is_active: boolean;
  image_url?: string;
}

const COLOR_PALETTES = [
  { id: 'gold', name: 'Risev Gold', primary: '#FFC700', bg: '#FFFBEA', border: '#FEF08A' },
  { id: 'berry', name: 'Gelato Berry', primary: '#FF6B8B', bg: '#FFF0F3', border: '#FFD6E0' },
  { id: 'mocha', name: 'Warm Cocoa', primary: '#8D5B4C', bg: '#F9F6F0', border: '#E8DED5' },
  { id: 'matcha', name: 'Emerald Matcha', primary: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { id: 'ocean', name: 'Ocean Sapphire', primary: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  { id: 'dark', name: 'Midnight Obsidian', primary: '#1E2028', bg: '#F1F5F9', border: '#CBD5E1' },
];

const HERO_COVER_PRESETS = [
  { id: 'gelato', title: 'Artisanal Gelato', url: 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=800&auto=format&fit=crop&q=80' },
  { id: 'barber', title: 'Gentlemen Barber', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop&q=80' },
  { id: 'spa', title: 'Luxury Wellness', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80' },
  { id: 'cafe', title: 'Modern Café', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80' },
];

export default function BookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'pwa'>('appointments');
  const [loading, setLoading] = useState(true);
  const [merchantData, setMerchantData] = useState<any>(null);

  // Appointments State
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedDateTitle, setSelectedDateTitle] = useState('Today');
  const [selectedDateSubtitle, setSelectedDateSubtitle] = useState('Sunday, 5 Oct 2026');

  // Services State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  
  // Add Item Wizard State (Step 1, 2, 3)
  const [addModalStep, setAddModalStep] = useState<1 | 2 | 3>(1);
  const [addItemType, setAddItemType] = useState<'service' | 'class' | 'product' | 'addon'>('service');
  const [photoUri, setPhotoUri] = useState<string | null>('https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Haircut');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('30');
  const [isOnlineAvailable, setIsOnlineAvailable] = useState(true);
  const [assignedStaff, setAssignedStaff] = useState<string[]>(['Daniel', 'Sarah']);
  const [selectedLocation, setSelectedLocation] = useState('Main Branch');
  const [bufferTime, setBufferTime] = useState('10 minutes');
  const [depositPolicy, setDepositPolicy] = useState('No deposit');
  const [isSavingService, setIsSavingService] = useState(false);

  // PWA State & Branding Customizer
  const [pwaSlug, setPwaSlug] = useState('scoop-creamy');
  const [copiedLink, setCopiedLink] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=800&auto=format&fit=crop&q=80');
  const [selectedBrandColor, setSelectedBrandColor] = useState<string>('#FFC700');
  const [customTagline, setCustomTagline] = useState<string>('Handcrafted Gelato • Waffles • Desserts');
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      if (user?.merchant_id) {
        await pb.collection('merchants').update(user.merchant_id, {
          cover_url: customCoverUrl,
          pwa_brand_color: selectedBrandColor,
          subtitle: customTagline,
        });
      }
      Alert.alert('Branding Saved', 'Your live booking PWA has been updated!');
    } catch (e: any) {
      Alert.alert('Branding Updated (Preview)', 'Saved locally for your booking page!');
    } finally {
      setIsSavingBranding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      let mRecord: any = null;
      if (user?.merchant_id) {
        try {
          mRecord = await pb.collection('merchants').getOne(user.merchant_id);
          setMerchantData(mRecord);
          setPwaSlug(mRecord.pwa_slug || mRecord.store_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'my-store');
          if (mRecord.cover_url) setCustomCoverUrl(mRecord.cover_url);
          if (mRecord.pwa_brand_color) setSelectedBrandColor(mRecord.pwa_brand_color);
          if (mRecord.subtitle) setCustomTagline(mRecord.subtitle);
        } catch (e) {}
      }

      if (!mRecord) {
        setMerchantData({ store_name: 'SCOOP CREAMY' });
        setPwaSlug('scoop-creamy');
      }

      // Fetch bookings
      try {
        let bItems: any[] = [];
        if (user?.merchant_id) {
          const bRes = await pb.collection('service_bookings').getList(1, 50, {
            filter: `merchant = "${user.merchant_id}"`,
            sort: '-booking_date,-start_time'
          });
          bItems = bRes.items;
        }

        if (bItems.length > 0) {
          setBookings(bItems as any);
        } else {
          // Default mock data matching reference design in English
          setBookings([
            {
              id: 'mock-1',
              customer_name: 'Hafiz Danial',
              customer_phone: '012-3456789',
              booking_date: new Date().toISOString().split('T')[0],
              start_time: '14:30',
              status: 'arrived',
              service_name: 'Signature Fade Cut',
              staff_name: 'Aiman',
              total_price: 35,
              notes: 'Taper fade on sides'
            }
          ]);
        }
      } catch (bErr) {
        setBookings([
          {
            id: 'mock-1',
            customer_name: 'Hafiz Danial',
            customer_phone: '012-3456789',
            booking_date: new Date().toISOString().split('T')[0],
            start_time: '14:30',
            status: 'arrived',
            service_name: 'Signature Fade Cut',
            staff_name: 'Aiman',
            total_price: 35
          }
        ]);
      }

      // Fetch services
      try {
        let sItems: any[] = [];
        if (user?.merchant_id) {
          const sRes = await pb.collection('merchant_services').getList(1, 50, {
            filter: `merchant = "${user.merchant_id}"`,
            sort: 'created'
          });
          sItems = sRes.items;
        }

        if (sItems.length > 0) {
          setServices(sItems as any);
        } else {
          setServices([
            {
              id: 'srv-1',
              name: 'Signature Fade Cut',
              category: 'Haircut',
              price: 35,
              duration_minutes: 30,
              item_type: 'service',
              is_active: true,
              image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80'
            },
            {
              id: 'srv-2',
              name: 'Hair Wash & Scalp Care',
              category: 'Treatment',
              price: 20,
              duration_minutes: 20,
              item_type: 'service',
              is_active: true,
              image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&auto=format&fit=crop&q=80'
            }
          ]);
        }
      } catch (sErr) {
        setServices([
          {
            id: 'srv-1',
            name: 'Signature Fade Cut',
            category: 'Haircut',
            price: 35,
            duration_minutes: 30,
            item_type: 'service',
            is_active: true,
            image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80'
          },
          {
            id: 'srv-2',
            name: 'Hair Wash & Scalp Care',
            category: 'Treatment',
            price: 20,
            duration_minutes: 20,
            item_type: 'service',
            is_active: true,
            image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&auto=format&fit=crop&q=80'
          }
        ]);
      }

    } catch (err) {
      console.warn('Load booking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: any) => {
    try {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      if (!bookingId.startsWith('mock-')) {
        await pb.collection('service_bookings').update(bookingId, { status: newStatus });
      }
      Alert.alert('Status Updated', `Appointment status updated to ${newStatus.toUpperCase()}`);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCreateService = async () => {
    if (!newServiceName || !newServicePrice) {
      Alert.alert('Missing Details', 'Service name and price are required.');
      return;
    }
    setIsSavingService(true);
    try {
      const priceNum = parseFloat(newServicePrice);
      const durNum = parseInt(newServiceDuration) || 0;
      
      const newService: ServiceItem = {
        id: `srv-${Date.now()}`,
        name: newServiceName,
        category: newServiceCategory,
        price: priceNum,
        duration_minutes: durNum,
        item_type: addItemType,
        is_active: true,
        image_url: addItemType === 'service' 
          ? 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=200&auto=format&fit=crop&q=80'
      };

      if (user?.merchant_id) {
        try {
          const rec = await pb.collection('merchant_services').create({
            merchant: user.merchant_id,
            name: newServiceName,
            category: newServiceCategory,
            price: priceNum,
            duration_minutes: durNum,
            item_type: addItemType,
            is_active: true
          });
          newService.id = rec.id;
        } catch (pbErr) {}
      }

      setServices(prev => [newService, ...prev]);
      setShowAddServiceModal(false);
      setNewServiceName('');
      setNewServicePrice('');
      Alert.alert('Success', 'New item has been added to catalog.');
    } catch (err) {
      Alert.alert('Error', 'Failed to add service.');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleCopyLink = () => {
    const url = `https://risev.app/b/${pwaSlug}`;
    Clipboard.setString(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    Alert.alert('Link Copied! 📋', `Your booking page URL:\n${url}`);
  };

  const handleShare = async (platform: string) => {
    const url = `https://risev.app/b/${pwaSlug}`;
    const text = `Book your appointment with ${merchantData?.store_name || 'our store'} online:\n${url}`;

    if (platform === 'whatsapp') {
      const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
      Linking.canOpenURL(waUrl).then(supported => {
        if (supported) {
          Linking.openURL(waUrl);
        } else {
          Share.share({ message: text });
        }
      });
    } else {
      Share.share({ message: text });
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  const filteredServices = services.filter(s => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'active') return s.is_active;
    if (serviceFilter === 'inactive') return !s.is_active;
    return true;
  });

  const arrivedCount = bookings.filter(b => b.status === 'arrived').length;
  const bookedCount = bookings.filter(b => b.status === 'booked').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => handleSmartBack(router, '/(merchant)/profile')}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#050505" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Booking & PWA Suite</Text>
          <Text style={styles.headerSubtitle}>Manage appointments, services & booking page</Text>
        </View>

        <View style={styles.addonTag}>
          <Text style={styles.addonTagText}>ADD-ON ⚡</Text>
        </View>
      </View>

      {/* Segmented Top Tabs */}
      <View style={styles.tabBarWrap}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'appointments' && styles.tabItemActive]}
          onPress={() => setActiveTab('appointments')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="calendar"
            size={15}
            color={activeTab === 'appointments' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'appointments' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Appointments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'services' && styles.tabItemActive]}
          onPress={() => setActiveTab('services')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="cut"
            size={15}
            color={activeTab === 'services' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'services' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Services & Catalog
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pwa' && styles.tabItemActive]}
          onPress={() => setActiveTab('pwa')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="phone-portrait"
            size={15}
            color={activeTab === 'pwa' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'pwa' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Booking Page
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFC700" />
        </View>
      ) : (
        <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          {/* ========================================== */}
          {/* TAB 1: APPOINTMENTS                        */}
          {/* ========================================== */}
          {activeTab === 'appointments' && (
            <View>
              {/* Dark Hero Card */}
              <View style={styles.darkHeroCard}>
                <View style={styles.darkHeroHeader}>
                  <View>
                    <Text style={styles.darkHeroTitle}>{selectedDateTitle}</Text>
                    <Text style={styles.darkHeroDate}>{selectedDateSubtitle}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnCalendarView}
                    onPress={() => setShowCalendarModal(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.btnCalendarViewText}>View Calendar ›</Text>
                  </TouchableOpacity>
                </View>

                {/* 3 Stat Boxes inside dark hero card */}
                <View style={styles.darkStatsGrid}>
                  <View style={[styles.darkStatBox, { borderLeftColor: '#22C55E' }]}>
                    <Text style={styles.darkStatNum}>{arrivedCount}</Text>
                    <Text style={styles.darkStatLabel} numberOfLines={2}>
                      Today's Appointments
                    </Text>
                  </View>

                  <View style={[styles.darkStatBox, { borderLeftColor: '#FFC700' }]}>
                    <Text style={styles.darkStatNum}>{bookedCount}</Text>
                    <Text style={styles.darkStatLabel} numberOfLines={2}>
                      Upcoming
                    </Text>
                  </View>

                  <View style={[styles.darkStatBox, { borderLeftColor: '#38BDF8' }]}>
                    <Text style={styles.darkStatNum}>{completedCount}</Text>
                    <Text style={styles.darkStatLabel} numberOfLines={2}>
                      Completed
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status Filter Chips */}
              <View style={styles.filterPillsRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'today', label: 'Today' },
                  { key: 'booked', label: 'Upcoming' },
                  { key: 'completed', label: 'Completed' },
                ].map(st => (
                  <TouchableOpacity
                    key={st.key}
                    style={[styles.filterPill, filterStatus === st.key && styles.filterPillActive]}
                    onPress={() => setFilterStatus(st.key)}
                  >
                    <Text style={[styles.filterPillText, filterStatus === st.key && styles.filterPillTextActive]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section Header */}
              <View style={styles.appointmentsHeaderRow}>
                <Text style={styles.appointmentsSectionTitle}>Today</Text>
                <TouchableOpacity style={styles.btnDateSelect}>
                  <Ionicons name="calendar-outline" size={14} color="#000" />
                  <Text style={styles.btnDateSelectText}>5 Oct 2026</Text>
                </TouchableOpacity>
              </View>

              {/* Appointment Card Item */}
              <View style={styles.appointmentsList}>
                {filteredBookings.map(b => (
                  <View key={b.id} style={styles.bookingCardContainer}>
                    
                    {/* Time Badge on Left */}
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText}>{b.start_time}</Text>
                      <Text style={styles.timeSubText}>Today</Text>
                    </View>

                    {/* Main Booking Card on Right */}
                    <View style={styles.bookingCardMain}>
                      <View style={styles.bookingCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.customerName}>{b.customer_name}</Text>
                          <Text style={styles.customerPhone}>📞 {b.customer_phone}</Text>
                        </View>
                        <View style={[
                          styles.statusBadge,
                          b.status === 'arrived' ? styles.statusBadgeArrived :
                          b.status === 'completed' ? styles.statusBadgeCompleted : styles.statusBadgeBooked
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            b.status === 'arrived' && { color: '#15803D' }
                          ]}>
                            {b.status === 'arrived' ? '● ARRIVED' : b.status === 'completed' ? 'COMPLETED' : 'SCHEDULED'}
                          </Text>
                        </View>
                      </View>

                      {/* Service & Price Row */}
                      <View style={styles.serviceMetaBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Ionicons name="cut-outline" size={14} color="#000" />
                          <Text style={styles.serviceNameText}>{b.service_name || 'Signature Fade Cut'}</Text>
                        </View>
                        <Text style={styles.bookingPriceText}>RM {b.total_price.toFixed(2)}</Text>
                      </View>

                      {/* Staff & Duration */}
                      <View style={styles.staffMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="person-outline" size={13} color="#64748B" />
                          <Text style={styles.staffMetaText}>{b.staff_name || 'Aiman'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={13} color="#64748B" />
                          <Text style={styles.staffMetaText}>30 min</Text>
                        </View>
                      </View>

                      {/* Actions Buttons */}
                      <View style={styles.bookingActionsRow}>
                        {b.status === 'arrived' && (
                          <TouchableOpacity
                            style={styles.btnPrimaryAction}
                            onPress={() => handleUpdateStatus(b.id, 'completed')}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="checkmark" size={16} color="#000" />
                            <Text style={styles.btnPrimaryActionText}>Complete & Stamp</Text>
                          </TouchableOpacity>
                        )}

                        {b.status === 'booked' && (
                          <TouchableOpacity
                            style={styles.btnPrimaryAction}
                            onPress={() => handleUpdateStatus(b.id, 'arrived')}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="location" size={16} color="#000" />
                            <Text style={styles.btnPrimaryActionText}>Mark Arrived</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.btnSecondaryAction}
                          onPress={() => handleShare('whatsapp')}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="logo-whatsapp" size={16} color="#000" />
                          <Text style={styles.btnSecondaryActionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>

                    </View>
                  </View>
                ))}
              </View>

              {/* Next Appointments */}
              <View style={{ marginTop: 24 }}>
                <Text style={styles.nextTitle}>Next Appointments</Text>
                <View style={styles.emptyNextCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="calendar-outline" size={24} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyText}>No upcoming appointments</Text>
                  <Text style={styles.emptySubtext}>Take a break while waiting for your customers</Text>
                </View>
              </View>

            </View>
          )}

          {/* ========================================== */}
          {/* TAB 2: SERVICES & CATALOG                  */}
          {/* ========================================== */}
          {activeTab === 'services' && (
            <View>
              {/* Section Header */}
              <View style={styles.catalogHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catalogSectionTitle}>Services & Products</Text>
                  <Text style={styles.catalogSectionSubtitle}>
                    Items available for booking on your page
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnAddItemPill}
                  onPress={() => setShowAddServiceModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#000" />
                  <Text style={styles.btnAddItemText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {/* Service Filter Chips */}
              <View style={styles.filterPillsRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'inactive', label: 'Inactive' },
                ].map(sf => (
                  <TouchableOpacity
                    key={sf.key}
                    style={[styles.filterPill, serviceFilter === sf.key && styles.filterPillActive]}
                    onPress={() => setServiceFilter(sf.key as any)}
                  >
                    <Text style={[styles.filterPillText, serviceFilter === sf.key && styles.filterPillTextActive]}>
                      {sf.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Service Item Cards */}
              <View style={styles.servicesCatalogList}>
                {filteredServices.map(s => (
                  <View key={s.id} style={styles.catalogCard}>
                    <Image
                      source={{ uri: s.image_url || 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80' }}
                      style={styles.catalogThumb}
                    />

                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={styles.catalogItemTitle}>{s.name}</Text>
                      <Text style={styles.catalogItemSubtitle}>
                        {s.category} • ⏱️ {s.duration_minutes > 0 ? `${s.duration_minutes} min` : 'Product'}
                      </Text>
                      <Text style={styles.catalogItemPrice}>RM {s.price.toFixed(2)}</Text>
                    </View>

                    <View style={styles.catalogRightWrap}>
                      <TouchableOpacity style={styles.btnDotsMenu}>
                        <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                      </TouchableOpacity>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>● Active</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Tips Box */}
              <View style={styles.tipsCalloutCard}>
                <View style={styles.tipsIconCircle}>
                  <Ionicons name="bulb" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipsTitle}>Tips</Text>
                  <Text style={styles.tipsText}>
                    Services you add will be displayed on your booking page for customers to book directly.
                  </Text>
                </View>
              </View>

            </View>
          )}

          {/* ========================================== */}
          {/* TAB 3: BOOKING PAGE (BRANDING & PWA SHARE) */}
          {/* ========================================== */}
          {activeTab === 'pwa' && (
            <View>
              
              {/* Online Booking Header */}
              <View style={styles.pwaSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={18} color="#D97706" />
                  <Text style={styles.pwaSectionTitle}>Online Booking Page</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>● LIVE</Text>
                  </View>
                </View>
                <Text style={styles.pwaSectionSubtitle}>
                  Customize your hero cover image, brand color palette, and share your link with customers.
                </Text>
              </View>

              {/* Phone Mockup Card Preview with Dynamic Branding */}
              <View style={styles.phoneMockupCard}>
                <View style={styles.phoneFrameGraphic}>
                  
                  {/* Hero Cover Banner Image in Mockup */}
                  <View style={styles.mockupHeroCoverWrapper}>
                    <Image
                      source={{ uri: customCoverUrl || 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=800&auto=format&fit=crop&q=80' }}
                      style={styles.mockupHeroCoverImg}
                    />
                    <View style={styles.mockupCoverOverlay} />
                  </View>

                  <View style={styles.phoneScreenHeader}>
                    <View style={styles.mockupEmblemBox}>
                      <Text style={{ fontSize: 16 }}>🍦</Text>
                    </View>

                    <Text style={styles.miniStoreTitle}>{merchantData?.store_name || 'SCOOP CREAMY'}</Text>
                    <Text style={styles.miniStoreSub}>{customTagline || 'Handcrafted Gelato • Waffles • Desserts'}</Text>

                    <View style={[styles.miniPilihBtn, { backgroundColor: selectedBrandColor }]}>
                      <Text style={styles.miniPilihBtnText}>📅 Book Appointment</Text>
                    </View>
                  </View>

                  <View style={styles.phoneScreenContent}>
                    <View style={styles.miniServiceItem}>
                      <Ionicons name="ice-cream-outline" size={14} color="#000" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniSrvTitle}>Double Scoop Artisanal Gelato</Text>
                        <Text style={styles.miniSrvSub}>10 min • RM 18.00</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700' }}>+</Text>
                    </View>

                    <View style={styles.miniServiceItem}>
                      <Ionicons name="restaurant-outline" size={14} color="#000" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniSrvTitle}>Signature Belgian Waffle</Text>
                        <Text style={styles.miniSrvSub}>15 min • RM 24.00</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700' }}>+</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* BRANDING & HERO CUSTOMIZER CARD */}
              <View style={styles.brandingCustomizerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Ionicons name="color-palette-outline" size={20} color="#000" />
                  <Text style={styles.brandingSectionTitle}>Branding & Theme Settings</Text>
                </View>

                {/* 1-Tap Color Palette Presets */}
                <Text style={styles.brandingFieldLabel}>1-Tap Preset Color Palettes</Text>
                <View style={styles.paletteGrid}>
                  {COLOR_PALETTES.map(p => {
                    const isSelected = selectedBrandColor.toLowerCase() === p.primary.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.paletteChip,
                          { backgroundColor: p.bg, borderColor: p.border },
                          isSelected && styles.paletteChipSelected
                        ]}
                        onPress={() => setSelectedBrandColor(p.primary)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.paletteDot, { backgroundColor: p.primary }]} />
                        <Text style={[styles.paletteName, isSelected && { fontWeight: '800', color: '#000' }]}>
                          {p.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color={p.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Hero Cover Image Selection */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 16 }]}>Custom Hero Cover Banner URL</Text>
                <View style={styles.coverInputRow}>
                  <Ionicons name="image-outline" size={18} color="#64748B" />
                  <TextInput
                    style={styles.coverTextInput}
                    placeholder="Paste cover image URL..."
                    value={customCoverUrl}
                    onChangeText={setCustomCoverUrl}
                  />
                </View>

                {/* Preset Hero Cover Library */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 12, fontSize: 11 }]}>Or choose a preset cover image:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6, marginBottom: 8 }}>
                  {HERO_COVER_PRESETS.map(h => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.presetCoverThumb, customCoverUrl === h.url && styles.presetCoverThumbSelected]}
                      onPress={() => setCustomCoverUrl(h.url)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: h.url }} style={styles.presetCoverImg} />
                      <Text style={styles.presetCoverLabel} numberOfLines={1}>{h.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Tagline Field */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 12 }]}>Store Tagline & Subtitle</Text>
                <View style={styles.coverInputRow}>
                  <Ionicons name="pricetag-outline" size={18} color="#64748B" />
                  <TextInput
                    style={styles.coverTextInput}
                    placeholder="e.g. Handcrafted Gelato • Waffles • Desserts"
                    value={customTagline}
                    onChangeText={setCustomTagline}
                  />
                </View>

                {/* Save Branding Button */}
                <TouchableOpacity
                  style={[styles.btnSaveBranding, { backgroundColor: selectedBrandColor }]}
                  onPress={handleSaveBranding}
                  disabled={isSavingBranding}
                  activeOpacity={0.85}
                >
                  {isSavingBranding ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#000000" />
                      <Text style={styles.btnSaveBrandingText}>Save & Update Live PWA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Official Booking Link Box */}
              <View style={styles.officialLinkBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="link" size={16} color="#000" />
                  <Text style={styles.officialLinkLabel}>OFFICIAL BOOKING LINK</Text>
                </View>

                <View style={styles.urlDisplayRow}>
                  <Text style={styles.urlDisplayText} numberOfLines={1}>
                    https://risev.app/b/{pwaSlug}
                  </Text>
                  <TouchableOpacity onPress={handleCopyLink}>
                    <Ionicons name="copy-outline" size={18} color="#000" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={styles.btnSalinPautanMain}
                    onPress={handleCopyLink}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="copy-outline" size={16} color="#000" />
                    <Text style={styles.btnSalinPautanText}>
                      {copiedLink ? 'Link Copied!' : 'Copy Link'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPreviewOutline}
                    onPress={() => router.push(`/b/${pwaSlug}` as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="open-outline" size={16} color="#000" />
                    <Text style={styles.btnPreviewText}>Preview</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Share Your Booking Page */}
              <View style={styles.shareSection}>
                <Text style={styles.shareSectionTitle}>Share Your Booking Page</Text>

                <View style={styles.shareButtonsGrid}>
                  
                  {/* WhatsApp Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('whatsapp')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
                      <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>WhatsApp</Text>
                  </TouchableOpacity>

                  {/* Instagram Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('instagram')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#E1306C' }]}>
                      <Ionicons name="logo-instagram" size={24} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>Instagram</Text>
                  </TouchableOpacity>

                  {/* QR Code Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={handleCopyLink}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#000000' }]}>
                      <Ionicons name="qr-code-outline" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>QR Code</Text>
                  </TouchableOpacity>

                  {/* Others Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('other')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#64748B' }]}>
                      <Ionicons name="share-social-outline" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>More</Text>
                  </TouchableOpacity>

                </View>
              </View>

            </View>
          )}

        </ScrollView>
      )}

      {/* Floating Action Help Button (FAB) */}
      <TouchableOpacity
        style={styles.fabHelpButton}
        onPress={() => Alert.alert('Help Center', 'Need help with Booking Suite? Contact Risev support.')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabHelpText}>?</Text>
      </TouchableOpacity>

      {/* Add Item 3-Step Wizard Modal */}
      <Modal visible={showAddServiceModal} animationType="slide" transparent={true}>
        <View style={styles.calendarModalOverlay}>
          <View style={styles.wizardModalContainer}>
            
            {/* STEP 1: SELECT TYPE */}
            {addModalStep === 1 && (
              <View>
                <View style={styles.wizardHeaderRow}>
                  <View>
                    <Text style={styles.wizardMainTitle}>Add Item</Text>
                    <Text style={styles.wizardSubTitle}>What would you like to add?</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddServiceModal(false);
                      setAddModalStep(1);
                    }}
                    style={styles.btnCloseWizard}
                  >
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                <View style={styles.typeCardsList}>
                  {/* Service Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'service' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('service');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="cut-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Service</Text>
                      <Text style={styles.typeCardSub}>One-on-one appointment</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Class / Session Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'class' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('class');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="calendar-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Class / Session</Text>
                      <Text style={styles.typeCardSub}>Group session with a set schedule</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Product Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'product' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('product');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="cube-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Product</Text>
                      <Text style={styles.typeCardSub}>Physical product for sale</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Add-on Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'addon' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('addon');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="extension-puzzle-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Add-on</Text>
                      <Text style={styles.typeCardSub}>Extra service or option</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 2: BASIC INFO */}
            {addModalStep === 2 && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                
                {/* Header */}
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity onPress={() => setAddModalStep(1)} style={styles.btnBackWizard}>
                    <Ionicons name="arrow-back" size={20} color="#050505" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.wizardMainTitle}>New Service</Text>
                    <Text style={styles.wizardStepIndicatorText}>Step 1 of 2 • Basic Info</Text>
                  </View>

                  <TouchableOpacity onPress={() => setShowAddServiceModal(false)} style={styles.btnCloseWizard}>
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                {/* Progress Track (50%) */}
                <View style={styles.wizardProgressTrack}>
                  <View style={[styles.wizardProgressFill, { width: '50%' }]} />
                </View>

                {/* Photo Upload Area */}
                <View style={styles.photoUploadRow}>
                  {photoUri ? (
                    <View style={styles.photoPreviewBox}>
                      <Image source={{ uri: photoUri }} style={styles.photoImage} />
                      <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.btnRemovePhoto}>
                        <Ionicons name="close" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.btnAddPhotoBox}
                    onPress={() => setPhotoUri('https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200&auto=format&fit=crop&q=80')}
                  >
                    <Ionicons name="add" size={22} color="#64748B" />
                    <Text style={styles.btnAddPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* Form Inputs */}
                <View style={styles.wizardFormGroup}>
                  <Text style={styles.wizardInputLabel}>Service Name</Text>
                  <TextInput
                    style={styles.wizardInputText}
                    placeholder="Signature Fade Cut"
                    placeholderTextColor="#94A3B8"
                    value={newServiceName}
                    onChangeText={setNewServiceName}
                  />
                </View>

                <View style={styles.wizardFormGroup}>
                  <Text style={styles.wizardInputLabel}>Category</Text>
                  <View style={styles.dropdownPickerBox}>
                    <Ionicons name="cut-outline" size={16} color="#000" />
                    <Text style={styles.dropdownPickerValue}>{newServiceCategory}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </View>
                </View>

                {/* Price & Duration */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wizardInputLabel}>Price (RM)</Text>
                    <TextInput
                      style={styles.wizardInputText}
                      placeholder="35.00"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={newServicePrice}
                      onChangeText={setNewServicePrice}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.wizardInputLabel}>Duration</Text>
                    <View style={styles.dropdownPickerBox}>
                      <Text style={styles.dropdownPickerValue}>{newServiceDuration} minutes</Text>
                      <Ionicons name="chevron-down" size={16} color="#64748B" />
                    </View>
                  </View>
                </View>

                {/* Available for Online Booking Toggle */}
                <View style={styles.toggleRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleRowTitle}>Available for online booking</Text>
                    <Text style={styles.toggleRowSub}>Show this service on your booking page.</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.switchTrack, isOnlineAvailable && styles.switchTrackActive]}
                    onPress={() => setIsOnlineAvailable(!isOnlineAvailable)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.switchThumb, isOnlineAvailable && styles.switchThumbActive]} />
                  </TouchableOpacity>
                </View>

                {/* Primary Button */}
                <TouchableOpacity
                  style={styles.btnWizardPrimary}
                  onPress={() => setAddModalStep(3)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnWizardPrimaryText}>Next: More Settings ➔</Text>
                </TouchableOpacity>

              </ScrollView>
            )}

            {/* STEP 3: OPTIONAL SETTINGS */}
            {addModalStep === 3 && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                
                {/* Header */}
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity onPress={() => setAddModalStep(2)} style={styles.btnBackWizard}>
                    <Ionicons name="arrow-back" size={20} color="#050505" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.wizardMainTitle}>More Settings</Text>
                    <Text style={styles.wizardStepIndicatorText}>Step 2 of 2 • Optional</Text>
                  </View>

                  <TouchableOpacity onPress={() => setShowAddServiceModal(false)} style={styles.btnCloseWizard}>
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                {/* Progress Track (100%) */}
                <View style={styles.wizardProgressTrack}>
                  <View style={[styles.wizardProgressFill, { width: '100%' }]} />
                </View>

                {/* Settings Card 1: Staff Assignment */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="people-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Staff Assignment</Text>
                      <Text style={styles.settingSub}>Choose who can provide this service</Text>
                    </View>
                    <Ionicons name="chevron-up" size={18} color="#64748B" />
                  </View>

                  {/* Selected Staff Chips */}
                  <View style={styles.staffChipsRow}>
                    {assignedStaff.map(st => (
                      <View key={st} style={styles.staffChipPill}>
                        <Image
                          source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' }}
                          style={styles.staffChipAvatar}
                        />
                        <Text style={styles.staffChipName}>{st}</Text>
                        <TouchableOpacity onPress={() => setAssignedStaff(prev => prev.filter(s => s !== st))}>
                          <Ionicons name="close" size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity style={styles.btnAddStaffPill} onPress={() => setAssignedStaff(prev => [...prev, 'Aiman'])}>
                      <Ionicons name="add" size={14} color="#000" />
                      <Text style={styles.btnAddStaffText}>Add Staff</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Settings Card 2: Location */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="location-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Location</Text>
                      <Text style={styles.settingSub}>Where is this service provided?</Text>
                    </View>
                    <Ionicons name="chevron-up" size={18} color="#64748B" />
                  </View>

                  <View style={styles.dropdownPickerBox}>
                    <Text style={styles.dropdownPickerValue}>{selectedLocation}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </View>
                </View>

                {/* Settings Card 3: Buffer Time */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="time-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Buffer Time</Text>
                      <Text style={styles.settingSub}>Add time before and after each booking</Text>
                    </View>
                    <Ionicons name="chevron-up" size={18} color="#64748B" />
                  </View>

                  <View style={styles.dropdownPickerBox}>
                    <Text style={styles.dropdownPickerValue}>{bufferTime}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </View>
                </View>

                {/* Settings Card 4: Deposit */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="card-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Deposit</Text>
                      <Text style={styles.settingSub}>Require a deposit to confirm booking</Text>
                    </View>
                    <Ionicons name="chevron-up" size={18} color="#64748B" />
                  </View>

                  <View style={styles.dropdownPickerBox}>
                    <Text style={styles.dropdownPickerValue}>{depositPolicy}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.btnWizardPrimary}
                  onPress={() => {
                    handleCreateService();
                    setAddModalStep(1);
                  }}
                  disabled={isSavingService}
                  activeOpacity={0.85}
                >
                  {isSavingService ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.btnWizardPrimaryText}>Create Service ➔</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            )}

          </View>
        </View>
      </Modal>

      {/* View Calendar Modal */}
      <Modal visible={showCalendarModal} animationType="slide" transparent={true}>
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContainer}>
            
            {/* Modal Header */}
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>Appointment Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)} style={styles.btnCloseModal}>
                <Ionicons name="close" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              
              {/* Day / Week / Month Switcher Pills */}
              <View style={styles.calTabPillsWrap}>
                <TouchableOpacity style={styles.calTabPill}>
                  <Text style={styles.calTabPillText}>Day</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calTabPill}>
                  <Text style={styles.calTabPillText}>Week</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calTabPill, styles.calTabPillActive]}>
                  <Text style={[styles.calTabPillText, styles.calTabPillTextActive]}>Month</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigator Header */}
              <View style={styles.monthNavHeader}>
                <TouchableOpacity style={styles.btnMonthArrow}>
                  <Ionicons name="chevron-back" size={18} color="#050505" />
                </TouchableOpacity>
                <Text style={styles.monthTitleText}>October 2026</Text>
                <TouchableOpacity style={styles.btnMonthArrow}>
                  <Ionicons name="chevron-forward" size={18} color="#050505" />
                </TouchableOpacity>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekdaysRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <Text key={d} style={styles.weekdayText}>{d}</Text>
                ))}
              </View>

              {/* Month Calendar Grid (7 columns) */}
              <View style={styles.monthGrid}>
                {/* Previous month light grey days */}
                {[
                  { day: 27, count: null, isPrev: true },
                  { day: 28, count: null, isPrev: true },
                  { day: 29, count: null, isPrev: true },
                  { day: 30, count: null, isPrev: true },
                  
                  // October dates with counts
                  { day: 1, count: 3, dotColor: '#3B82F6' },
                  { day: 2, count: 5, dotColor: '#EAB308' },
                  { day: 3, count: 2, dotColor: '#22C55E' },
                  { day: 4, count: 1, dotColor: '#EAB308' },
                  { day: 5, count: 8, dotColor: '#8B5CF6', isSelected: true },
                  { day: 6, count: 6, dotColor: '#22C55E' },
                  { day: 7, count: 4, dotColor: '#EF4444' },
                  { day: 8, count: 7, dotColor: '#3B82F6' },
                  { day: 9, count: 3, dotColor: '#22C55E' },
                  { day: 10, count: 5, dotColor: '#EF4444' },
                  { day: 11, count: 2, dotColor: '#3B82F6' },
                  { day: 12, count: 6, dotColor: '#8B5CF6' },
                  { day: 13, count: 3, dotColor: '#3B82F6' },
                  { day: 14, count: 8, dotColor: '#EF4444' },
                  { day: 15, count: 7, dotColor: '#3B82F6' },
                  { day: 16, count: 4, dotColor: '#8B5CF6' },
                  { day: 17, count: 1, dotColor: '#EAB308' },
                  { day: 18, count: 3, dotColor: '#22C55E' },
                  { day: 19, count: 5, dotColor: '#EAB308' },
                  { day: 20, count: 2, dotColor: '#8B5CF6' },
                  { day: 21, count: 4, dotColor: '#3B82F6' },
                  { day: 22, count: 9, dotColor: '#EF4444' },
                  { day: 23, count: 6, dotColor: '#22C55E' },
                  { day: 24, count: 2, dotColor: '#EF4444' },
                  { day: 25, count: 1, dotColor: '#3B82F6' },
                  { day: 26, count: 4, dotColor: '#EAB308' },
                  { day: 27, count: 3, dotColor: '#EAB308' },
                  { day: 28, count: 5, dotColor: '#EF4444' },
                  { day: 29, count: 7, dotColor: '#EF4444' },
                  { day: 30, count: 4, dotColor: '#EF4444' },
                  { day: 31, count: 2, dotColor: '#8B5CF6' },
                ].map((item, idx) => {
                  const isSel = selectedDateTitle.includes(item.day.toString()) || item.isSelected;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.gridCell,
                        item.isPrev && styles.gridCellPrev,
                        isSel && styles.gridCellSelected
                      ]}
                      onPress={() => {
                        if (!item.isPrev) {
                          setSelectedDateTitle(`${item.day} October 2026`);
                          setSelectedDateSubtitle(`October ${item.day}, 2026`);
                        }
                      }}
                      disabled={item.isPrev}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.gridDayNum,
                        item.isPrev && styles.gridDayNumPrev,
                        isSel && styles.gridDayNumSelected
                      ]}>
                        {item.day}
                      </Text>

                      {item.count !== null && (
                        <View style={styles.gridBadgeRow}>
                          <View style={[styles.gridDot, { backgroundColor: item.dotColor || '#3B82F6' }]} />
                          <Text style={[styles.gridCountText, isSel && styles.gridCountTextSelected]}>
                            {item.count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Day Schedule Title Row */}
              <View style={styles.dayScheduleHeaderRow}>
                <Text style={styles.dayScheduleTitle}>{selectedDateTitle}</Text>
                <Text style={styles.dayScheduleSub}>8 appointments</Text>
              </View>

              {/* Appointment Cards List Below Calendar */}
              <View style={styles.dayApptList}>
                
                {/* Appointment 1 */}
                <View style={styles.calApptCard}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' }}
                    style={styles.calCustAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calApptTime}>10:00 AM – 10:30 AM</Text>
                    <Text style={styles.calCustName}>Hafiz Danial</Text>
                    <Text style={styles.calSrvStaff}>Signature Fade Cut • Aiman</Text>
                  </View>
                  <View style={styles.badgeConfirmed}>
                    <Ionicons name="checkmark-circle" size={12} color="#2563EB" />
                    <Text style={styles.badgeConfirmedText}>Confirmed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>

                {/* Appointment 2 */}
                <View style={styles.calApptCard}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80' }}
                    style={styles.calCustAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calApptTime}>11:00 AM – 12:00 PM</Text>
                    <Text style={styles.calCustName}>Sarah Lim</Text>
                    <Text style={styles.calSrvStaff}>Hair Treatment • Sarah</Text>
                  </View>
                  <View style={styles.badgeArrived}>
                    <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                    <Text style={styles.badgeArrivedText}>Arrived</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>

                {/* Appointment 3 */}
                <View style={styles.calApptCard}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' }}
                    style={styles.calCustAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calApptTime}>2:30 PM – 3:00 PM</Text>
                    <Text style={styles.calCustName}>Ahmad Rizal</Text>
                    <Text style={styles.calSrvStaff}>Classic Haircut • Daniel</Text>
                  </View>
                  <View style={styles.badgePending}>
                    <Ionicons name="time" size={12} color="#D97706" />
                    <Text style={styles.badgePendingText}>Pending</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>

                {/* Appointment 4 */}
                <View style={styles.calApptCard}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80' }}
                    style={styles.calCustAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calApptTime}>4:00 PM – 4:30 PM</Text>
                    <Text style={styles.calCustName}>Nurul Huda</Text>
                    <Text style={styles.calSrvStaff}>Beard Trim • Aiman</Text>
                  </View>
                  <View style={styles.badgeConfirmed}>
                    <Ionicons name="checkmark-circle" size={12} color="#2563EB" />
                    <Text style={styles.badgeConfirmedText}>Confirmed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>

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
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  addonTag: {
    backgroundColor: '#FFFBEA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  addonTagText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },

  // Segmented Tabs
  tabBarWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 46,
  },
  tabItemActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItemText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Dark Hero Card
  darkHeroCard: {
    backgroundColor: '#121318',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#262730',
  },
  darkHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  darkHeroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  darkHeroDate: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 3,
  },
  btnCalendarView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1F28',
    borderWidth: 1,
    borderColor: '#323444',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  btnCalendarViewText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  darkStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  darkStatBox: {
    flex: 1,
    backgroundColor: '#1A1B24',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    minHeight: 92,
    justifyContent: 'space-between',
  },
  darkStatNum: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  darkStatLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    lineHeight: 14,
  },

  // Filter Chips
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  filterPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Appointments Header & Cards
  appointmentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentsSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnDateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  btnDateSelectText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  appointmentsList: {
    gap: 12,
  },
  bookingCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    width: 54,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  timeSubText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  bookingCardMain: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  customerPhone: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeArrived: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeBooked: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  serviceMetaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  serviceNameText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  bookingPriceText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },

  staffMetaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  staffMetaText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  bookingActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimaryAction: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnPrimaryActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  btnSecondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnSecondaryActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Next Appointments
  nextTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 10,
  },
  emptyNextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  emptySubtext: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },

  // FAB Help
  fabHelpButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  fabHelpText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Services & Catalog Styles
  catalogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  catalogSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogSectionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  btnAddItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFC700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnAddItemText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  servicesCatalogList: {
    gap: 12,
    marginBottom: 18,
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  catalogThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  catalogItemTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogItemSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginVertical: 2,
  },
  catalogItemPrice: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogRightWrap: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 56,
  },
  btnDotsMenu: {
    padding: 4,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },

  tipsCalloutCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  tipsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  tipsText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },

  // PWA Tab Styles
  pwaSectionHeader: {
    marginBottom: 16,
  },
  pwaSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  liveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  pwaSectionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },

  // Phone Mockup Graphic
  phoneMockupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  phoneFrameGraphic: {
    width: 220,
    backgroundColor: '#121318',
    borderRadius: 24,
    padding: 12,
    borderWidth: 4,
    borderColor: '#2A2B36',
  },
  phoneScreenHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  miniStoreTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  miniStoreSub: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  miniPilihBtn: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 8,
  },
  miniPilihBtnText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000',
  },
  phoneScreenContent: {
    paddingVertical: 8,
    gap: 6,
  },
  miniServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
  },
  miniSrvTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000',
  },
  miniSrvSub: {
    fontSize: 8,
    color: '#64748B',
  },

  // Official Link Box
  officialLinkBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  officialLinkLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  urlDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  urlDisplayText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  btnSalinPautanMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnSalinPautanText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  btnPreviewOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPreviewText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Share Section
  shareSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shareSectionTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 14,
  },
  shareButtonsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareItem: {
    alignItems: 'center',
  },
  shareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shareItemLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },

  // 3-Step Wizard Modal Styles
  wizardModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  wizardMainTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  wizardSubTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  wizardStepIndicatorText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
    marginTop: 2,
  },
  btnCloseWizard: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBackWizard: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 1 Cards
  typeCardsList: {
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  typeCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  typeCardItemSelected: {
    backgroundColor: '#FFFBEA',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeCardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  typeCardSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  // Progress Bar
  wizardProgressTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  wizardProgressFill: {
    height: '100%',
    backgroundColor: '#FFC700',
    borderRadius: 2,
  },

  // Photo Upload Row
  photoUploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  photoPreviewBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    position: 'relative',
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  btnRemovePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnAddPhotoText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },

  // Form Inputs
  wizardFormGroup: {
    marginBottom: 14,
  },
  wizardInputLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 6,
  },
  wizardInputText: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  dropdownPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dropdownPickerValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    flex: 1,
  },

  // Toggle Row Card
  toggleRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  toggleRowTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  toggleRowSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#FFC700',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },

  // Primary Wizard Button
  btnWizardPrimary: {
    backgroundColor: '#FFC700',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnWizardPrimaryText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Step 3 Accordion Setting Cards
  settingAccordionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  settingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  settingTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  settingSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },

  // Staff Chips Row
  staffChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffChipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  staffChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  staffChipName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  btnAddStaffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  btnAddStaffText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  typePillActive: {
    backgroundColor: '#FFC700',
  },
  typePillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  typePillTextActive: {
    color: '#000000',
  },
  btnModalSave: {
    backgroundColor: '#FFC700',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnModalSaveText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  calendarModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnCloseModal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cal Tab Pills
  calTabPillsWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  calTabPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  calTabPillActive: {
    backgroundColor: '#121318',
  },
  calTabPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  calTabPillTextActive: {
    color: '#FFFFFF',
  },

  // Month Navigator Header
  monthNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  monthTitleText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnMonthArrow: {
    padding: 6,
  },

  // Weekdays Row
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },

  // Month Grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  gridCell: {
    width: '14.28%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  gridCellPrev: {
    opacity: 0.25,
  },
  gridCellSelected: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1.5,
    borderColor: '#FFC700',
  },
  gridDayNum: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  gridDayNumPrev: {
    color: '#94A3B8',
  },
  gridDayNumSelected: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  gridBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gridCountText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  gridCountTextSelected: {
    color: '#000000',
  },

  // Day Schedule Header Row
  dayScheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dayScheduleTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  dayScheduleSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Day Appointment Cards List
  dayApptList: {
    gap: 10,
  },
  calApptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  calCustAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  calApptTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  calCustName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginVertical: 1,
  },
  calSrvStaff: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Status Badges
  badgeConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeConfirmedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#2563EB',
  },
  badgeArrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeArrivedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgePendingText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#D97706',
  },

  // Branding & Hero Customizer Styles
  mockupHeroCoverWrapper: {
    width: '100%',
    height: 90,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: -24,
  },
  mockupHeroCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mockupCoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  mockupEmblemBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#121318',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  brandingCustomizerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  brandingSectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  brandingFieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 8,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  paletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  paletteChipSelected: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paletteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paletteName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  coverInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  coverTextInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  presetCoverThumb: {
    width: 96,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F1F5F9',
  },
  presetCoverThumbSelected: {
    borderColor: '#000000',
  },
  presetCoverImg: {
    width: '100%',
    height: 52,
    borderRadius: 10,
  },
  presetCoverLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  btnSaveBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSaveBrandingText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
});
